// src/scrapers/weworkremotely/index.ts
import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { fetchWWRJobs } from './fetcher';

export const weWorkRemotelyScraper: Scraper = {
    name: 'We Work Remotely',
    run: async function* (page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        yield* fetchWWRJobs(page, processedUrls);
        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};