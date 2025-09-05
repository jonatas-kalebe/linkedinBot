import axios from 'axios';
import config from '../../config';
import {JobData} from '../../core/jobProcessor';
import * as cheerio from 'cheerio';

const GQL_QUERY = `
    query JobSearch($query: String, $page: Int, $remote: Boolean, $compensation: [CompensationInput!]) {
      jobListings(
        filter: {
          keywords: $query,
          remote: $remote,
          compensation: $compensation
        }
        page: $page
      ) {
        totalPages
        jobs {
          id
          title
          company {
            name
            slug
          }
          description
          remote
          url
        }
      }
    }
`;

export async function* fetchWellfoundJobs(processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const API_URL = 'https://wellfound.com/graphql';

    for (const query of config.WELLFOUND_SEARCH_QUERIES) {
        console.log(`\n[Wellfound API] Buscando por "${query}"...`);
        let currentPage = 1;
        let totalPages = 1;

        while (currentPage <= totalPages) {
            try {
                const response = await axios.post(API_URL, {
                    query: GQL_QUERY,
                    variables: {
                        query: query,
                        page: currentPage,
                        remote: true,
                    }
                }, {
                    headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
                });

                const jobListings = response.data.data.jobListings;
                if (!jobListings) {
                    console.log(`- Nenhum resultado encontrado para "${query}" na página ${currentPage}.`);
                    break;
                }

                totalPages = jobListings.totalPages;
                const jobs = jobListings.jobs;

                console.log(`- Página ${currentPage}/${totalPages}. Encontrados ${jobs.length} resultados.`);

                for (const job of jobs) {
                    if (!job.url) continue;
                    const normalizedUrl = new URL(job.url).origin + new URL(job.url).pathname;
                    if (processedUrls.has(normalizedUrl)) continue;

                    const $ = cheerio.load(job.description || '');

                    yield {
                        url: job.url,
                        title: job.title,
                        company: job.company.name,
                        description: $('body').text().trim(),
                    };
                }
                currentPage++;
            } catch (error: any) {
                console.error(`- ❌ [Wellfound API] Erro ao buscar a página ${currentPage} para "${query}":`, error.response?.data || error.message);
                break;
            }
        }
    }
}