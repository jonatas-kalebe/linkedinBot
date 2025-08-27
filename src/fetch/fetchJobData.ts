import {ElementHandle, Page} from 'puppeteer';
import selectors from '../selectors';

export interface JobData {
    url: string;
    title: string;
    company: string;
    description: string;
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Normaliza uma URL do LinkedIn para a sua forma base, removendo parâmetros de rastreamento.
 * @param url A URL completa.
 * @returns A URL normalizada.
 */
function normalizeUrl(url: string): string {
    try {
    const urlObject = new URL(url);
    // Mantém apenas o caminho base (ex: /jobs/view/12345/) e remove a busca (query params).
    return `${urlObject.origin}${urlObject.pathname}`;
    } catch (error) {
        console.warn(`URL inválida encontrada: ${url}`);
        return url;
    }
}

// ### CORREÇÃO PRINCIPAL: A função agora recebe as URLs já processadas ###
export async function* fetchJobData(
    page: Page,
    keywords: string,
    location: string,
    processedUrls: Set<string>
): AsyncGenerator<JobData> {
    const searchUrl = new URL('https://www.linkedin.com/jobs/search/');
    searchUrl.searchParams.set('keywords', keywords);
    searchUrl.searchParams.set('location', location);
    searchUrl.searchParams.set('f_WT', '2');

    console.log(`Buscando VAGAS REMOTAS em: ${searchUrl.toString()}`);
    await page.goto(searchUrl.toString(), { waitUntil: 'load' });
    await wait(2000);

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
        searchUrl.searchParams.set('start', String(processedJobsInThisRun));

        if (processedJobsInThisRun > 0) {
            console.log(`\n--- Navegando para a página ${currentPageNum} de resultados... ---`);
            await page.goto(searchUrl.toString(), { waitUntil: 'load' });
            await wait(2000);
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(2000);

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

        // ### LÓGICA DE FILTRAGEM OTIMIZADA ###
        // 1. Normaliza todos os links encontrados na página.
        const normalizedLinks = jobLinks.map(normalizeUrl);
        // 2. Filtra para criar uma lista apenas com os links que NÃO ESTÃO na nossa memória.
        const newLinksToProcess = normalizedLinks.filter(link => !processedUrls.has(link));

        if (newLinksToProcess.length === 0) {
            console.log("Todos os links nesta página já foram processados. Pulando para a próxima.");
            continue; // Avança para a próxima página de resultados
        }

        console.log(`Destes, ${newLinksToProcess.length} são novos. Começando a análise...`);

        // ### NOVA LÓGICA DE TENTATIVAS AQUI ###
        for (const link of newLinksToProcess) {
            const MAX_RETRIES = 3;
            let success = false;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await page.goto(link, {waitUntil: 'load', timeout: 30000});
                const title = await page.$eval(selectors.jobTitle, el => (el as HTMLElement).innerText.trim());
                const company = await page.$eval(selectors.companyName, el => (el as HTMLElement).innerText.trim());
                const description = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

                yield { url: link, title, company, description };
                    success = true; // Marca como sucesso para sair do loop de tentativas
                    break;

            } catch (error) {
                    console.warn(`  - Tentativa ${attempt} de ${MAX_RETRIES} falhou ao processar a vaga em ${link}.`);
                    if (attempt < MAX_RETRIES) {
                        console.log("  - Atualizando a página e tentando novamente...");
                        await page.reload({ waitUntil: 'load' });
                        await wait(3000); // Espera um pouco após atualizar
                    }
                }
            }
            if (!success) {
                 console.error(`  - ❌ Falha final ao processar a vaga em ${link} após ${MAX_RETRIES} tentativas. Pulando.`);
            }
        }
    }
}