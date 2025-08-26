// fetch/fetchJobLinksUser.ts

import { ElementHandle, Page } from 'puppeteer';
// As importações do 'franc' e 'iso-639-3' foram removidas daqui
import buildUrl from '../utils/buildUrl';
import wait from '../utils/wait';
import selectors from '../selectors';
import fs from 'fs';

// Esta função continua igual, mas a biblioteca 'iso-639-3' será carregada dinamicamente
function getLanguageName(iso6393Data: any[], code: string): string | undefined {
  const lang = iso6393Data.find(l => l.iso6393 === code);
  return lang ? lang.name.toLowerCase() : undefined;
}

// A função para pegar os metadados continua a mesma, pois funciona bem.
async function getJobSearchMetadata({ page, location, keywords }: { page: Page, location: string, keywords: string }) {
  console.log('Construindo URL de busca direta...');
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('keywords', keywords);
  url.searchParams.set('location', location);
  url.searchParams.set('f_AL', 'true');

  console.log(`Navegando diretamente para a busca: ${url.toString()}`);
  await page.goto(url.toString(), { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  try {
    console.log('Aguardando a contagem de resultados...');
    const numJobsHandle = await page.waitForSelector(selectors.searchResultListText, { timeout: 15000 });
      const availableJobsText = await (numJobsHandle as ElementHandle<HTMLElement>).evaluate((el) => el.innerText);
    const numAvailableJobs = parseInt(availableJobsText.replace(/\D/g, ''));
    console.log(`${numAvailableJobs} vagas encontradas.`);
    const currentUrl = new URL(page.url());
    const geoId = currentUrl.searchParams.get('geoId');
    return { geoId, numAvailableJobs };
  } catch (error) {
    console.log('Não foi possível encontrar a contagem de vagas. Salvando HTML e continuando com um número padrão.');
    fs.writeFileSync(`pagina_erro_contagem.html`, await page.content());
    return { geoId: null, numAvailableJobs: 25 }; // Retorna um valor padrão para não quebrar
  }
};

interface PARAMS {
  page: Page,
  location: string,
  keywords: string,
  workplace: { remote: boolean, onSite: boolean, hybrid: boolean },
  jobTitle: string,
  jobDescription: string,
  jobDescriptionLanguages: string[]
};

// ### LÓGICA COMPLETAMENTE NOVA ###
async function* fetchJobLinksUser({
                                    page: listingPage,
                                    location,
                                    keywords,
                                    workplace: { remote, onSite, hybrid },
                                    jobTitle,
                                    jobDescription,
                                    jobDescriptionLanguages
                                  }: PARAMS): AsyncGenerator<[string, string, string]> {

  // ### CORREÇÃO AQUI: Importação dinâmica das bibliotecas ESM ###
  const { franc } = await import('franc');
  const { iso6393 } = await import('iso-639-3');
  // #############################################################

  let numSeenJobs = 0;
  let numMatchingJobs = 0;
  let pageNum = 0;

  const fWt = [onSite, remote, hybrid].reduce((acc, c, i) => c ? [...acc, i + 1] : acc, [] as number[]).join(',');
  const { geoId, numAvailableJobs } = await getJobSearchMetadata({ page: listingPage, location, keywords });

  const maxJobsToProcess = Math.min(numAvailableJobs, 999);

  const searchParams: { [key: string]: string } = {
    keywords,
    location,
    start: '0',
    f_WT: fWt,
    f_AL: 'true'
  };
  if (geoId) searchParams.geoId = geoId.toString();

  const url = buildUrl('https://www.linkedin.com/jobs/search', searchParams);
  const jobTitleRegExp = new RegExp(jobTitle, 'i');
  const jobDescriptionRegExp = new RegExp(jobDescription, 'i');

  while (numSeenJobs < maxJobsToProcess) {
    pageNum++;
    url.searchParams.set('start', numSeenJobs.toString());

    console.log(`\n--- Navegando para a página ${pageNum} de resultados... ---`);
    await listingPage.goto(url.toString(), { waitUntil: "load" });

    // 1. Coleta todos os links da página de uma vez.
    console.log('Coletando links da página...');
    const linksOnPage = await listingPage.$$eval(selectors.searchResultListItemLink, (elements) =>
        elements.map(el => (el as HTMLLinkElement).href.trim())
    );

    if (linksOnPage.length === 0) {
      console.warn(`AVISO: Nenhum link de vaga encontrado na página ${pageNum}. Pode ser um limite do LinkedIn.`);
      fs.writeFileSync(`pagina_erro_links_p${pageNum}.html`, await listingPage.content());
      break;
    }

    console.log(`Encontrados ${linksOnPage.length} links. Analisando cada um individualmente...`);

    // 2. Visita cada link para analisar a vaga.
    for (const link of linksOnPage) {
      let title = 'N/A', companyName = 'N/A', jobDescriptionText = '';
      try {
        await listingPage.goto(link, { waitUntil: 'load', timeout: 45000 });

        title = await listingPage.$eval(selectors.jobTitle, el => (el as HTMLElement).innerText.trim());
        companyName = await listingPage.$eval(selectors.companyName, el => (el as HTMLElement).innerText.trim());
        jobDescriptionText = await listingPage.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

        console.log(`\n--- Analisando Vaga: ${title} @ ${companyName} ---`);

        const canApply = !!(await listingPage.$(selectors.easyApplyButtonEnabled));
        const matchesTitle = jobTitleRegExp.test(title);
        const matchesDescription = jobDescriptionRegExp.test(jobDescriptionText);

        // ### LÓGICA DE IDIOMA CORRIGIDA COM 'franc' ###
        const langCode = franc(jobDescriptionText);
        const languageDetected = getLanguageName(iso6393, langCode) || 'unknown'; // Passando os dados da biblioteca
        const matchesLanguage = jobDescriptionLanguages.includes("any") || jobDescriptionLanguages.includes(languageDetected);

        console.log(`  - Candidatura Simplificada? ${canApply ? '✅' : '❌'}`);
        console.log(`  - Título corresponde ao filtro? ${matchesTitle ? '✅' : '❌'}`);
        console.log(`  - Descrição corresponde ao filtro? ${matchesDescription ? '✅' : '❌'}`);
        console.log(`  - Idioma (${languageDetected}) corresponde ao filtro? ${matchesLanguage ? '✅' : '❌'}`);

        if (canApply && matchesTitle && matchesDescription && matchesLanguage) {
          console.log('  = ✅ VAGA COMPATÍVEL! Enviando para aplicação...');
          numMatchingJobs++;
          yield [link, title, companyName];
        } else {
          console.log('  = ❌ Ignorando vaga.');
        }
      } catch (e: any) {
        console.log(`Erro ao processar o link ${link}: ${e.message}. Pulando para a próxima.`);

        // ### CÓDIGO ADICIONADO PARA SALVAR O HTML DA PÁGINA DA VAGA ###
        console.log('Salvando HTML da página da vaga que falhou para análise...');
        fs.writeFileSync(`pagina_erro_DETALHES_VAGA.html`, await listingPage.content());
        console.log("Arquivo 'pagina_erro_DETALHES_VAGA.html' salvo. Por favor, envie este arquivo.");
        // ##############################################################
      }
    }

    numSeenJobs += linksOnPage.length;
    console.log(`\nProgresso: ${numSeenJobs} de ${maxJobsToProcess} vagas vistas. ${numMatchingJobs} vagas compatíveis encontradas até agora.`);
    await wait(3000);
  }

  console.log(`\nBusca finalizada. Total de vagas compatíveis encontradas: ${numMatchingJobs}.`);
}

export default fetchJobLinksUser;