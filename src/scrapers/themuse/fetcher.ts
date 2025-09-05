import axios from 'axios';
import * as cheerio from 'cheerio';
import config from '../../config';
import {JobData} from '../../core/jobProcessor';

export async function* fetchTheMuseJobs(processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const BASE_URL = 'https://www.themuse.com/api/public/jobs';

    for (const query of config.THEMUSE_SEARCH_QUERIES) {
        console.log(`\n[The Muse API] Buscando por "${query}"...`);
        let currentPage = 1;
        let totalPages = 1;

        while (currentPage <= totalPages) {
            try {
                const response = await axios.get(BASE_URL, {
                    params: {
                        category: 'Software Engineering',
                        location: 'Flexible / Remote',
                        q: query,
                        page: currentPage,
                    }
                });

                const {results, page_count} = response.data;
                totalPages = page_count;
                console.log(`- Página ${currentPage}/${totalPages}. Encontrados ${results.length} resultados.`);

                for (const job of results) {
                    const jobUrl = job.refs.landing_page;
                    const normalizedUrl = new URL(jobUrl).origin + new URL(jobUrl).pathname;

                    if (processedUrls.has(normalizedUrl)) continue;

                    const $ = cheerio.load(job.contents);

                    yield {
                        url: jobUrl,
                        title: job.name,
                        company: job.company.name,
                        description: $('body').text(),
                    };
                }
                currentPage++;
            } catch (error) {
                console.error(`- ❌ [The Muse API] Erro ao buscar a página ${currentPage} para "${query}":`, error);
                break;
            }
        }
    }
}