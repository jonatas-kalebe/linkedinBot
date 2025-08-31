import {ElementHandle, Page} from 'puppeteer';
import {humanizedWait} from "../../utils/humanization";
import selectors from "./selectors";


export interface JobData {
    url: string;
    title: string;
    company: string;
    description: string;
}

// MELHORIA: Função de espera com tempo aleatório para simular comportamento humano.
const randomWait = (min: number, max: number) => new Promise(res => setTimeout(res, Math.random() * (max - min) + min));

/**
 * Normaliza uma URL do LinkedIn para a sua forma base, removendo parâmetros de rastreamento.
 * @param url A URL completa.
 * @returns A URL normalizada.
 */
function normalizeUrl(url: string): string {
    try {
        const urlObject = new URL(url);
        return `${urlObject.origin}${urlObject.pathname}`;
    } catch (error) {
        console.warn(`URL inválida encontrada: ${url}`);
        return url;
    }
}

export async function* fetchLinkedInJobs(
    page: Page,
    keywords: string,
    location: string,
    processedUrls: Set<string>
): AsyncGenerator<JobData> {
    const searchUrl = new URL('https://www.linkedin.com/jobs/search/');
    searchUrl.searchParams.set('keywords', keywords);
    searchUrl.searchParams.set('location', location);
    searchUrl.searchParams.set('f_WT', '2');
    searchUrl.searchParams.set('sortBy', 'DD');

    console.log(`Buscando VAGAS MAIS RECENTES em: ${searchUrl.toString()}`);
    await page.goto(searchUrl.toString(), {waitUntil: 'domcontentloaded', timeout: 60000});
    await humanizedWait(page, 3000, 5000);

    let numTotalJobs = 10;
    try {
        const numJobsHandle = await page.waitForSelector(selectors.searchResultListText, {timeout: 7000});
        const availableJobsText = await (numJobsHandle as ElementHandle<HTMLElement>).evaluate((el) => el.innerText);
        numTotalJobs = parseInt(availableJobsText.replace(/\D/g, ''));
    } catch (e) {
        console.warn('Não foi possível determinar o número total de vagas. Processando os resultados encontrados.');
    }

    console.log(`Total de vagas encontradas na busca: ${numTotalJobs}`);
    let processedJobsInThisRun = 0;
    let currentPageNum = 1;
    const maxJobsToProcess = 50;
    let consecutiveEmptyPages = 0;

    while (processedJobsInThisRun < maxJobsToProcess) {
        searchUrl.searchParams.set('start', String(processedJobsInThisRun));

        if (processedJobsInThisRun > 0) {
            console.log(`\n--- Navegando para a página ${currentPageNum} de resultados... ---`);
            await page.goto(searchUrl.toString(), {waitUntil: 'domcontentloaded', timeout: 60000});
            await humanizedWait(page, 3000, 6000);
        }

        // MELHORIA: Simula uma rolagem mais humana na página.
        console.log("   -> Rolando a página para carregar mais vagas...");
        await page.evaluate(async () => {
            const scrollHeight = document.body.scrollHeight;
            for (let i = 0; i < scrollHeight; i += 100) {
                window.scrollTo(0, i);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10)); // Pequenas pausas durante a rolagem
            }
        });
        await humanizedWait(page, 2000, 4000);

        const jobLinks = await page.$$eval(selectors.searchResultListItemLink, (links) =>
            links.map(a => (a as HTMLAnchorElement).href)
        );

        if (jobLinks.length === 0) {
            console.log("Nenhum link novo encontrado nesta página. Finalizando o ciclo de busca.");
            break;
        }
        console.log(`Encontrados ${jobLinks.length} links na página ${currentPageNum}.`);
        processedJobsInThisRun += jobLinks.length;
        currentPageNum++;

        const newLinksToProcess = jobLinks.map(normalizeUrl).filter(link => !processedUrls.has(link));

        if (newLinksToProcess.length === 0) {
            console.log("Todos os links nesta página já foram processados.");

            // NOVA LÓGICA: Incrementa o contador e verifica se o limite foi atingido.
            consecutiveEmptyPages++;
            console.log(`   -> Páginas consecutivas sem vagas novas: ${consecutiveEmptyPages}/2`);
            if (consecutiveEmptyPages >= 2) {
                console.log("   -> Limite atingido. Finalizando esta busca e passando para a próxima query.");
                break; // Sai do laço 'while' e encerra a busca para esta palavra-chave.
            }

            continue; // Pula para a próxima página de resultados
        }

        // NOVA LÓGICA: Se encontrarmos vagas novas, o contador é zerado.
        consecutiveEmptyPages = 0;

        console.log(`Destes, ${newLinksToProcess.length} são novos. Começando a análise...`);

        for (const link of newLinksToProcess) {
            const MAX_RETRIES = 4;
            let success = false;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    await page.goto(link, {waitUntil: 'domcontentloaded', timeout: 60000});
                    await humanizedWait(page, 2500, 4500);

                    const title = await page.$eval(selectors.jobTitle, el => (el as HTMLElement).innerText.trim());
                    const company = await page.$eval(selectors.companyName, el => (el as HTMLElement).innerText.trim());
                    const description = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

                    yield {url: link, title, company, description};
                    success = true;
                    break;

                } catch (error) {
                    console.warn(`   - Tentativa ${attempt} de ${MAX_RETRIES} falhou ao processar a vaga em ${link}.`);
                    if (attempt < MAX_RETRIES) {
                        // MELHORIA: Exponential backoff + jitter para as tentativas
                        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 2000;
                        console.log(`   - Atualizando a página e tentando novamente em ${Math.round(waitTime / 1000)}s...`);
                        await page.reload({waitUntil: 'domcontentloaded', timeout: 60000});
                        await humanizedWait(page, waitTime, waitTime + 1000);
                    }
                }
            }
            if (!success) {
                console.error(`   - ❌ Falha final ao processar a vaga em ${link} após ${MAX_RETRIES} tentativas. Pulando.`);
            }
        }
    }
}