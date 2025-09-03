// src/scrapers/gupy/fetcher.ts
import axios from 'axios';
import config from '../../config';
import { JobData } from '../../core/jobProcessor';

export async function* fetchGupyJobs(processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const API_URL = 'https://portal.gupy.io/api/v1/jobs';
    const JOBS_PER_PAGE = 20;

    for (const query of config.GUPY_SEARCH_QUERIES) {
        console.log(`\n[Gupy API] Buscando por "${query}"...`);
        let offset = 0;
        let hasMoreJobs = true;

        while (hasMoreJobs) {
            try {
                const response = await axios.post(API_URL, {
                    query: query,
                    workplaceType: "remote", // Filtra apenas por vagas remotas
                    offset: offset,
                    limit: JOBS_PER_PAGE,
                });

                const jobs = response.data.data;
                if (!jobs || jobs.length === 0) {
                    hasMoreJobs = false; // Não há mais vagas nesta busca
                    continue;
                }

                console.log(`- Página ${offset / JOBS_PER_PAGE + 1}. Encontrados ${jobs.length} resultados.`);

                for (const job of jobs) {
                    const jobUrl = job.jobUrl;
                    const normalizedUrl = new URL(jobUrl).origin + new URL(jobUrl).pathname;

                    if (processedUrls.has(normalizedUrl)) continue;

                    yield {
                        url: jobUrl,
                        title: job.name,
                        company: job.company.name,
                        // A API da Gupy já fornece a descrição em texto puro, o que é ótimo!
                        description: job.description,
                    };
                }

                offset += JOBS_PER_PAGE;

            } catch (error: any) {
                console.error(`- ❌ [Gupy API] Erro ao buscar vagas para "${query}" (offset: ${offset}):`, error.response?.data || error.message);
                hasMoreJobs = false; // Interrompe a busca para esta query em caso de erro
            }
        }
    }
}