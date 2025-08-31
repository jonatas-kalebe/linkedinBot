// src/scrapers/programathor/index.ts
import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { fetchProgramathorJobs } from './fetcher';

export const programathorScraper: Scraper = {
    name: 'Programathor',
    run: async function* (page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        yield* fetchProgramathorJobs(page, processedUrls);
        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};