// src/scrapers/remoteok/index.ts

import {Page} from 'puppeteer';
import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import {fetchRemoteOKJobs} from './fetcher';
import {loadProcessedJobs} from '../../core/fileManager';

export const remoteOkScraper: Scraper = {
    name: 'RemoteOK',
    run: async function* (page: Page): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name);

        const jobDataGenerator = fetchRemoteOKJobs(page, processedUrls);

        for await (const job of jobDataGenerator) {
            yield {...job, source: this.name};
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};