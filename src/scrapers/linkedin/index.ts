// src/scrapers/linkedin/index.ts

import {Page} from 'puppeteer';
import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import config from '../../config';
import {humanizedWait, performCoverAction} from "../../utils/humanization";
import { verifyLinkedInSession } from './login';
import {fetchLinkedInJobs} from "./fetcher";

export const linkedinScraper: Scraper = {
    name: 'LinkedIn',

    run: async function* (page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        await verifyLinkedInSession(page);
        const shuffledQueries = config.SEARCH_QUERIES.sort(() => 0.5 - Math.random());

        for (const query of shuffledQueries) {
            console.log(`\n🔎 [${this.name}] Buscando por: "${query}"...`);
            await humanizedWait(page, 4000, 8000);

            yield* fetchLinkedInJobs(page, query, config.LOCATION, processedUrls);

            await performCoverAction(page);
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};