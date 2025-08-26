import puppeteer, {Page} from "puppeteer";
import config from "../config";
import path from 'path';
import ask from "../utils/ask";
import login from "../login";
import apply, {ApplicationFormData} from "../apply";
import fetchJobLinksUser from "../fetch/fetchJobLinksUser";
import selectors from "../selectors";
import fs from "fs";

interface AppState {
  paused: boolean;
}

const learnedConfigPath = path.join(__dirname, '../../learned_config.json');

function getMergedConfig() {
  let learnedConfig = {TEXT_FIELDS: {}, BOOLEANS: {}, MULTIPLE_CHOICE_FIELDS: {}};

  if (fs.existsSync(learnedConfigPath)) {
    learnedConfig = JSON.parse(fs.readFileSync(learnedConfigPath, 'utf-8'));
  } else {
    fs.writeFileSync(learnedConfigPath, JSON.stringify(learnedConfig, null, 2));
  }

  const mergedConfig = {
    ...config,
    TEXT_FIELDS: {...config.TEXT_FIELDS, ...learnedConfig.TEXT_FIELDS},
    BOOLEANS: {...config.BOOLEANS, ...learnedConfig.BOOLEANS},
    MULTIPLE_CHOICE_FIELDS: {...config.MULTIPLE_CHOICE_FIELDS, ...learnedConfig.MULTIPLE_CHOICE_FIELDS},
  };

  return mergedConfig;
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
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: path.join(__dirname, '../../session'), ignoreHTTPSErrors: true,
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--start-maximized"]
  });

  const pages = await browser.pages();
  const listingPage = pages.length > 0 ? pages[0] : await browser.newPage();

  await listingPage.setViewport({ width: 1920, height: 1080 });

  await listingPage.goto('https://www.linkedin.com/feed/', {waitUntil: 'load'});

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

  let resumeText = '';
  try {
    const cvTextPath = path.resolve(__dirname, '../', config.CV_TEXT_PATH);
    if (fs.existsSync(cvTextPath)) {
      resumeText = fs.readFileSync(cvTextPath, 'utf-8');
      console.log('📄 Conteúdo do currículo em texto carregado para a IA.');
    } else {
      console.warn(`Aviso: Arquivo de currículo em texto não encontrado em ${cvTextPath}. A IA não terá esse contexto.`);
      console.warn("Por favor, crie o arquivo ou corrija o caminho em config.ts");
    }
  } catch (err) {
    console.error("Erro ao ler o arquivo de currículo em texto (CV_TEXT_PATH).", err);
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
      applicationPage = await browser.newPage();
    }

    await applicationPage.bringToFront();

    try {
      console.log(`\n--- Vaga compatível encontrada! Tentando aplicar para: "${title}" em "${companyName}" ---`);

      const currentConfig = getMergedConfig();

      const formData: ApplicationFormData = {
        phone: currentConfig.PHONE,
        cvPath: currentConfig.CV_PATH,
        homeCity: currentConfig.HOME_CITY,
        coverLetterPath: currentConfig.COVER_LETTER_PATH,
        yearsOfExperience: currentConfig.YEARS_OF_EXPERIENCE,
        languageProficiency: currentConfig.LANGUAGE_PROFICIENCY,
        requiresVisaSponsorship: currentConfig.REQUIRES_VISA_SPONSORSHIP,
        booleans: currentConfig.BOOLEANS,
        textFields: currentConfig.TEXT_FIELDS,
        multipleChoiceFields: currentConfig.MULTIPLE_CHOICE_FIELDS,
      };

      await apply({
        page: applicationPage,
        link,
        formData,
        resumeText: resumeText, shouldSubmit: process.argv[2] === "SUBMIT",
      });

      jobsAppliedCount++;
      console.log(`🎉 SUCESSO! Vaga aplicada nº ${jobsAppliedCount}: "${title}"`);

    } catch (err: any) {
      if (err.name === 'UnlearnedQuestionError') {
        console.warn(`⏭️ VAGA PULADA: ${err.message}. Verifique o learned_config.json.`);
      } else {
      console.error(`❌ FALHA ao aplicar para "${title}": ${err.message}`);
      }
    } finally {
      if (applicationPage && !applicationPage.isClosed()) {
        await applicationPage.close();
        applicationPage = null;
      }
    }

    await listingPage.bringToFront();
  }

  console.log(`\nProcesso finalizado. Total de vagas aplicadas com sucesso: ${jobsAppliedCount}.`);
})();