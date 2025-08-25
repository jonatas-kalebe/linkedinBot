// fetch/fetchJobLinksUser.ts

import { ElementHandle, Page } from 'puppeteer';
import LanguageDetect from 'languagedetect';
import buildUrl from '../utils/buildUrl';
import wait from '../utils/wait';
import selectors from '../selectors';
import fs from 'fs';

const languageDetector = new LanguageDetect();

async function getJobSearchMetadata({ page, location, keywords }: { page: Page, location: string, keywords: string }) {
  console.log('Construindo URL de busca direta...');
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('keywords', keywords);
  url.searchParams.set('location', location);
  url.searchParams.set('f_AL', 'true');

  console.log(`Navegando diretamente para a busca: ${url.toString()}`);
  await page.goto(url.toString(), { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('Aguardando a contagem de resultados...');
  const numJobsHandle = await page.waitForSelector(selectors.searchResultListText, { timeout: 15000 }) as ElementHandle<HTMLElement>;

  const availableJobsText = await numJobsHandle.evaluate((el) => (el as HTMLElement).innerText);
  const numAvailableJobs = parseInt(availableJobsText.replace(/\D/g, ''));

  console.log(`${numAvailableJobs} vagas encontradas.`);

  const currentUrl = new URL(page.url());
  const geoId = currentUrl.searchParams.get('geoId');

  return { geoId, numAvailableJobs };
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

async function* fetchJobLinksUser({
  page,
  location,
  keywords,
  workplace: { remote, onSite, hybrid },
  jobTitle,
  jobDescription,
  jobDescriptionLanguages
}: PARAMS): AsyncGenerator<[string, string, string]> {
  let numSeenJobs = 0;
  let numMatchingJobs = 0;
  let pageNum = 0;

  const fWt = [onSite, remote, hybrid].reduce((acc, c, i) => c ? [...acc, i + 1] : acc, [] as number[]).join(',');
  const { geoId, numAvailableJobs } = await getJobSearchMetadata({ page, location, keywords });

  const maxJobsToProcess = Math.min(numAvailableJobs, 999);

  const searchParams: { [key: string]: string } = {
    keywords,
    location,
    start: '0',
    f_WT: fWt,
    f_AL: 'true'
  };

  if (geoId) {
    searchParams.geoId = geoId.toString();
  }

  const url = buildUrl('https://www.linkedin.com/jobs/search', searchParams);
  const jobTitleRegExp = new RegExp(jobTitle, 'i');
  const jobDescriptionRegExp = new RegExp(jobDescription, 'i');

  while (numSeenJobs < maxJobsToProcess) {
    pageNum++;
    url.searchParams.set('start', numSeenJobs.toString());

    console.log(`\nNavegando para a página ${pageNum} de resultados...`);
    await page.goto(url.toString(), { waitUntil: "load" });

    try {
      console.log('Aguardando a lista de vagas aparecer...');
      await page.waitForSelector(selectors.searchResultListItem, { visible: true, timeout: 15000 });
      console.log('Lista de vagas detectada.');
    } catch (error) {
        console.warn(`AVISO: A página ${pageNum} não carregou a lista de vagas. Pode ser um limite do LinkedIn.`);

        // ### CÓDIGO ADICIONADO AQUI ###
        console.log('Salvando o HTML da página para análise...');
        fs.writeFileSync(`pagina_erro_lista_vagas_p${pageNum}.html`, await page.content());
        console.log(`Arquivo 'pagina_erro_lista_vagas_p${pageNum}.html' salvo!`);
        // ##############################

        await page.screenshot({ path: `erro_limite_linkedin_pagina_${pageNum}.png`, fullPage: true });
        break;
    }

    const jobListings = await page.$$(selectors.searchResultListItem);

    if (jobListings.length === 0) {
      console.warn(`AVISO: A página ${pageNum} não contém vagas. Finalizando a busca.`);
      break;
    }

    for (const jobListing of jobListings) {
      let title = 'N/A';
      let companyName = 'N/A';
      let link = '#';

      try {
        title = await jobListing.$eval(selectors.searchResultListItemLink, el => (el as HTMLElement).innerText.trim()).catch(() => 'Título não encontrado');
        companyName = await jobListing.$eval(selectors.searchResultListItemCompanyName, el => (el as HTMLElement).innerText.trim()).catch(() => 'Empresa não encontrada');

        console.log(`\n--- Analisando Vaga: ${title} @ ${companyName} ---`);

        // 2. Clica no card para carregar os detalhes na coluna da direita.
        const linkHandle = await jobListing.$(selectors.searchResultListItemLink);
        if (!linkHandle) {
          console.log('  = ❌ Ignorando vaga (não foi possível encontrar o link).');
          continue;
        }
        await linkHandle.click();
        link = await linkHandle.evaluate(el => (el as HTMLLinkElement).href.trim());

        // 3. Espera os detalhes carregarem.
        await page.waitForFunction((s) => {
          const hasDesc = !!document.querySelector<HTMLElement>(s.jobDescription)?.innerText.trim();
          const hasStatus = !!(document.querySelector(s.easyApplyButtonEnabled) || document.querySelector(s.appliedToJobFeedback));
          return hasDesc && hasStatus;
        }, { timeout: 7000 }, selectors);

        // 4. Analisa os detalhes.
        const jobDescriptionText = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);
        const canApply = !!(await page.$(selectors.easyApplyButtonEnabled));
        const matchesTitle = jobTitleRegExp.test(title);
        const matchesDescription = jobDescriptionRegExp.test(jobDescriptionText);
        const jobDescriptionLanguage = languageDetector.detect(jobDescriptionText, 1)[0][0];
        const matchesLanguage = jobDescriptionLanguages.includes("any") || jobDescriptionLanguages.includes(jobDescriptionLanguage);

        console.log(`  - Candidatura Simplificada? ${canApply ? '✅' : '❌'}`);
        console.log(`  - Título corresponde ao filtro? ${matchesTitle ? '✅' : '❌'}`);
        console.log(`  - Descrição corresponde ao filtro? ${matchesDescription ? '✅' : '❌'}`);
        console.log(`  - Idioma (${jobDescriptionLanguage}) corresponde ao filtro? ${matchesLanguage ? '✅' : '❌'}`);

        if (canApply && matchesTitle && matchesDescription && matchesLanguage) {
          console.log('  = ✅ VAGA COMPATÍVEL! Enviando para aplicação...');
          numMatchingJobs++;
          yield [link, title, companyName];
        } else {
          console.log('  = ❌ Ignorando vaga.');
        }

      } catch (e: any) {
        console.log(`Erro ao processar a vaga "${title}": ${e.message}. Pulando para a próxima.`);
      }
    }

    numSeenJobs += jobListings.length;
    console.log(`\nProgresso: ${numSeenJobs} de ${maxJobsToProcess} vagas vistas. ${numMatchingJobs} vagas compatíveis encontradas até agora.`);
    await wait(3000);
  }

  console.log(`\nBusca finalizada. Total de vagas compatíveis encontradas: ${numMatchingJobs}.`);
}

export default fetchJobLinksUser;