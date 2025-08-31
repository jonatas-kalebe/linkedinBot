// src/scrapers/weworkremotely/index.ts
import {Page} from 'puppeteer';
import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import {fetchWWRJobs} from './fetcher';
import {loadProcessedJobs} from '../../core/fileManager'; // << NOVO >>

export const weWorkRemotelyScraper: Scraper = {
    name: 'We Work Remotely',
    run: async function* (page: Page): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name); // << NOVO >>

        const jobDataGenerator = fetchWWRJobs(page, processedUrls);

        for await (const job of jobDataGenerator) {
            // Adiciona a fonte antes de entregar para o orquestrador
            yield {...job, source: this.name};
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};