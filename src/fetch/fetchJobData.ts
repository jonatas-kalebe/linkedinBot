import { Page } from 'puppeteer';
import selectors from '../selectors';

export interface JobData {
  url: string;
  title: string;
  company: string;
  description: string;
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function* fetchJobData(page: Page, keywords: string, location: string): AsyncGenerator<JobData> {
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('keywords', keywords);
  url.searchParams.set('location', location);

  console.log(`Buscando vagas em: ${url.toString()}`);
  await page.goto(url.toString(), { waitUntil: 'load' });
  await wait(3000);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(2000);

  const jobLinks = await page.$$eval(selectors.searchResultListItemLink, (links) =>
      links.map(a => (a as HTMLAnchorElement).href)
  );

  console.log(`Encontrados ${jobLinks.length} links de vagas na primeira página.`);

  for (const link of jobLinks) {
    try {
      await page.goto(link, { waitUntil: 'load', timeout: 30000 });
      const title = await page.$eval(selectors.jobTitle, el => (el as HTMLElement).innerText.trim());
      const company = await page.$eval(selectors.companyName, el => (el as HTMLElement).innerText.trim());
      const description = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

      // ### CORREÇÃO: Agora a função retorna apenas os dados brutos, como definido na interface ###
      yield { url: link, title, company, description };

    } catch (error) {
      console.warn(`- Não foi possível processar a vaga em ${link}. Pulando.`);
    }
  }
}