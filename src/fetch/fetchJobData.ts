import {ElementHandle, Page} from 'puppeteer';
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

    // ### CORREÇÃO AQUI: Adicionado o filtro para vagas remotas ###
    // f_WT=2 é o código do LinkedIn para "Remoto".
    url.searchParams.set('f_WT', '2');

    console.log(`Buscando VAGAS REMOTAS em: ${url.toString()}`);
    await page.goto(url.toString(), {waitUntil: 'load'});
    await wait(3000);

    let numTotalJobs = 25;
    try {
        const numJobsHandle = await page.waitForSelector(selectors.searchResultListText, {timeout: 5000});
        const availableJobsText = await (numJobsHandle as ElementHandle<HTMLElement>).evaluate((el) => el.innerText);
        numTotalJobs = parseInt(availableJobsText.replace(/\D/g, ''));
    } catch (e) {
        console.warn('Não foi possível determinar o número total de vagas. Processando os resultados encontrados.');
    }

    console.log(`Total de vagas encontradas na busca: ${numTotalJobs}`);
    let processedJobsInThisRun = 0;
    let currentPageNum = 1;

    // ### LÓGICA DE PAGINAÇÃO COMPLETA ###
    while (processedJobsInThisRun < numTotalJobs) {
        url.searchParams.set('start', String(processedJobsInThisRun));

        if (processedJobsInThisRun > 0) {
            console.log(`\n--- Navegando para a página ${currentPageNum} de resultados... ---`);
            await page.goto(url.toString(), {waitUntil: 'load'});
            await wait(2000);
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(2000);

        const jobLinks = await page.$$eval(selectors.searchResultListItemLink, (links) => links.map(a => (a as HTMLAnchorElement).href));

        if (jobLinks.length === 0) {
            console.log("Nenhum link novo encontrado nesta página. Finalizando o ciclo de busca.");
            break;
        }

        console.log(`Encontrados ${jobLinks.length} links na página ${currentPageNum}.`);
        processedJobsInThisRun += jobLinks.length;
        currentPageNum++;

        for (const link of jobLinks) {
            try {
                await page.goto(link, {waitUntil: 'load', timeout: 30000});
                const title = await page.$eval(selectors.jobTitle, el => (el as HTMLElement).innerText.trim());
                const company = await page.$eval(selectors.companyName, el => (el as HTMLElement).innerText.trim());
                const description = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

                // ### CORREÇÃO: Agora a função retorna apenas os dados brutos, como definido na interface ###
                yield {url: link, title, company, description};

            } catch (error) {
                console.warn(`- Não foi possível processar a vaga em ${link}. Pulando.`);
            }
        }
    }
}