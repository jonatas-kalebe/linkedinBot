// src/scrapers/wellfound/index.ts
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { fetchWellfoundJobs } from './fetcher';
import { loadProcessedJobs } from '../../core/fileManager';

export const wellfoundScraper: Scraper = {
    name: 'Wellfound',
    // Não precisa da propriedade 'engine' pois não usará navegador
    run: async function* (page: any): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper (API): ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name);

        // O 'page' não é usado, mas a interface exige. Passamos 'null' ou 'page'.
        const jobDataGenerator = fetchWellfoundJobs(processedUrls);

        for await (const job of jobDataGenerator) {
            yield { ...job, source: this.name };
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};