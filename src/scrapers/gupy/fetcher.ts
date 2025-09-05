import axios from 'axios';
import config from '../../config';
import {JobData} from '../../core/jobProcessor';

interface GupyJob {
    id: number;
    name: string;
    description: string;
    jobUrl: string;
    careerPageName: string;
    company?: {
        name: string;
    };
}

export async function* fetchGupyJobs(processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const API_URL = 'https://employability-portal.gupy.io/api/v1/jobs';
    const JOBS_PER_PAGE = 20;

    for (const query of config.GUPY_SEARCH_QUERIES) {
        console.log(`\n[Gupy API] 🚀 Buscando por "${query}"...`);
        let offset = 0;
        let hasMoreJobs = true;

        while (hasMoreJobs) {
            try {
                const response = await axios.get(API_URL, {
                    params: {
                        jobName: query,
                        workplaceType: "remote",
                        offset: offset,
                        limit: JOBS_PER_PAGE,
                    }
                });

                const jobs: GupyJob[] = response.data.data;

                if (!jobs || jobs.length === 0) {
                    console.log(`- Nenhuma vaga nova encontrada para "${query}".`);
                    hasMoreJobs = false;
                    continue;
                }

                console.log(`- 📄 Página ${offset / JOBS_PER_PAGE + 1}. Encontrados ${jobs.length} resultados.`);

                for (const job of jobs) {

                    const jobUrl = job.jobUrl;
                    const normalizedUrl = new URL(jobUrl).origin + new URL(jobUrl).pathname;

                    if (processedUrls.has(normalizedUrl)) {
                        continue;
                    }

                    yield {
                        url: jobUrl,
                        title: job.name,
                        company: job.careerPageName ?? job.company?.name ?? 'Empresa não informada',
                        description: job.description,
                    };
                }

                if (jobs.length < JOBS_PER_PAGE) {
                    hasMoreJobs = false;
                } else {
                    offset += JOBS_PER_PAGE;
                }

            } catch (error: any) {
                console.error(`- ❌ [Gupy API] Erro ao processar vagas para "${query}" (offset: ${offset}):`, error instanceof Error ? error.message : error);
                hasMoreJobs = false;
            }
        }
    }
}