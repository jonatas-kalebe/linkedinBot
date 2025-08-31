// src/scrapers/remoteok/index.ts
import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { fetchRemoteOKJobs } from './fetcher';

export const remoteOkScraper: Scraper = {
    name: 'RemoteOK',
    run: async function* (page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        yield* fetchRemoteOKJobs(page, processedUrls);
        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};