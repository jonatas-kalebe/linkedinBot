import {Page} from 'puppeteer';
import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import {fetchRemotiveJobs} from './fetcher';
import {loadProcessedJobs} from '../../core/fileManager';

export const remotiveScraper: Scraper = {
    name: 'Remotive',
    run: async function* (page: Page): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name);

        const jobDataGenerator = fetchRemotiveJobs(page, processedUrls);

        for await (const job of jobDataGenerator) {
            yield {...job, source: this.name};
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};