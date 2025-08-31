import {Page} from 'puppeteer';
import config from '../../config';
import selectors from './selectors';
import {humanizedWait} from "../../utils/humanization";
import {JobData} from '../../core/jobProcessor';
import {extractJobDataWithAI} from '../../services/dynamicExtractionService';

export async function* fetchWWRJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const BASE_URL = 'https://weworkremotely.com/remote-jobs/search?term=';

    for (const query of config.WWR_SEARCH_QUERIES) {
        const searchUrl = `${BASE_URL}${encodeURIComponent(query)}`;
        console.log(`\n[WWR] Iniciando busca por "${query}" em: ${searchUrl}`);

        let jobLinksForThisQuery: string[] = [];
        try {
            await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});
            await page.waitForSelector(selectors.jobListItemLink, {timeout: 15000});

            jobLinksForThisQuery = await page.$$eval(selectors.jobListItemLink, (links) =>
                [...new Set(links.map(a => (a as HTMLAnchorElement).href))]
            );

            if (jobLinksForThisQuery.length === 0) {
                console.log(`- Nenhuma vaga encontrada para "${query}".`);
                continue;
            }

            console.log(`- Encontrados ${jobLinksForThisQuery.length} links para "${query}". Iniciando análise...`);

        } catch (error) {
            console.warn(`- ⚠️ [WWR] Busca por "${query}" falhou ou não retornou resultados. Pulando para a próxima busca.`);
            continue;
        }

        for (const link of jobLinksForThisQuery) {
            const urlObject = new URL(link);
            const normalizedUrl = `${urlObject.origin}${urlObject.pathname}`;

            if (processedUrls.has(normalizedUrl)) {
                console.log(`-- Pulando vaga já processada: ${link}`);
                continue;
            }

            try {
                await humanizedWait(page, 2000, 4000);
                await page.goto(link, { waitUntil: 'domcontentloaded' });

                const extractedData = await extractJobDataWithAI(page, link);

                if (extractedData && extractedData.title && extractedData.company && extractedData.description) {
                    yield {
                        url: link,
                        title: extractedData.title,
                        company: extractedData.company,
                        description: extractedData.description,
                    };
                } else {
                    console.warn(`- ⚠️ [WWR] Extração com IA falhou ou retornou dados incompletos para: ${link}`);
                }

            } catch (error) {
                console.warn(`- ❌ [WWR] Falha crítica ao processar a página da vaga em ${link}:`, error);
            }
        }

        console.log(`- ✅ Análise para a busca "${query}" finalizada.`);
    }
}