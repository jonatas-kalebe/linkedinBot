import puppeteer, { Page } from "puppeteer";
import config from "../config";
import path from 'path'; // Importe o 'path' do Node.js

import ask from "../utils/ask";
import login from "../login";
import apply, { ApplicationFormData } from "../apply";
import fetchJobLinksUser from "../fetch/fetchJobLinksUser";
import selectors from "../selectors";

interface AppState {
  paused: boolean;
}

const wait = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

const state: AppState = {
  paused: false,
};

const askForPauseInput = async () => {
  await ask("Pressione ENTER para pausar o programa");
  state.paused = true;
  console.log("\nPausado. Finalizando a aplicação atual antes de parar...");
  await ask("Pressione ENTER para continuar...\n");
  state.paused = false;
  console.log("Continuando...");
  askForPauseInput();
};

(async () => {
  // ### MODIFICAÇÃO PRINCIPAL AQUI ###
  // Adiciona 'userDataDir' para salvar a sessão e evitar logins repetidos.
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: path.join(__dirname, '../../session'), // Salva a sessão em uma pasta 'session'
    ignoreHTTPSErrors: true,
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--start-maximized" // Inicia o navegador maximizado
    ]
  });

  // Pega a primeira página que já vem aberta, em vez de criar uma anônima
  const pages = await browser.pages();
  const listingPage = pages.length > 0 ? pages[0] : await browser.newPage();

  await listingPage.setViewport({ width: 1920, height: 1080 });

  // Navega para o LinkedIn e verifica se já está logado
  await listingPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'load' });

  const isLoggedIn = await listingPage.$(selectors.feedUpdate).catch(() => null);

  if (!isLoggedIn) {
    console.log('Sessão não encontrada. Iniciando processo de login...');
    await login({
      page: listingPage,
      email: config.LINKEDIN_EMAIL,
      password: config.LINKEDIN_PASSWORD
    });
  } else {
    console.log('Sessão detectada. Login pulado.');
  }

  askForPauseInput();

  console.log('Iniciando o processo de busca e aplicação em tempo real...');
  let jobsAppliedCount = 0;

  const linkGenerator = fetchJobLinksUser({
    page: listingPage,
    location: config.LOCATION,
    keywords: config.KEYWORDS,
    workplace: {
      remote: config.WORKPLACE.REMOTE,
      onSite: config.WORKPLACE.ON_SITE,
      hybrid: config.WORKPLACE.HYBRID,
    },
    jobTitle: config.JOB_TITLE,
    jobDescription: config.JOB_DESCRIPTION,
    jobDescriptionLanguages: config.JOB_DESCRIPTION_LANGUAGES
  });

  let applicationPage: Page | null = null;

  for await (const [link, title, companyName] of linkGenerator) {
    while (state.paused) {
      console.log("\nPrograma pausado. Pressione ENTER na outra janela para continuar.");
      await wait(2000);
    }

    if (!applicationPage || applicationPage.isClosed()) {
      applicationPage = await browser.newPage(); // Usa o browser principal, não o contexto anônimo
    }

    await applicationPage.bringToFront();

    try {
      console.log(`\n--- Vaga compatível encontrada! Tentando aplicar para: "${title}" em "${companyName}" ---`);

      const formData: ApplicationFormData = {
        phone: config.PHONE,
        cvPath: config.CV_PATH,
        homeCity: config.HOME_CITY,
        coverLetterPath: config.COVER_LETTER_PATH,
        yearsOfExperience: config.YEARS_OF_EXPERIENCE,
        languageProficiency: config.LANGUAGE_PROFICIENCY,
        requiresVisaSponsorship: config.REQUIRES_VISA_SPONSORSHIP,
        booleans: config.BOOLEANS,
        textFields: config.TEXT_FIELDS,
        multipleChoiceFields: config.MULTIPLE_CHOICE_FIELDS,
      };

      await apply({
        page: applicationPage,
        link,
        formData,
        shouldSubmit: process.argv[2] === "SUBMIT",
      });

      jobsAppliedCount++;
      console.log(`🎉 SUCESSO! Vaga aplicada nº ${jobsAppliedCount}: "${title}"`);

    } catch (err: any) {
      console.error(`❌ FALHA ao aplicar para "${title}": ${err.message}`);
    } finally {
      if (applicationPage && !applicationPage.isClosed()) {
        await applicationPage.close(); // Fecha a aba da vaga após a tentativa
      }
    }

    await listingPage.bringToFront();
  }

  console.log(`\nProcesso finalizado. Total de vagas aplicadas com sucesso: ${jobsAppliedCount}.`);
  // await browser.close(); // Deixe comentado para manter a sessão aberta
})();