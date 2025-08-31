import {Page} from 'puppeteer';
import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import config from '../../config';
import {humanizedWait, performCoverAction} from "../../utils/humanization";
import {verifyLinkedInSession} from './login';
import {fetchLinkedInJobs} from "./fetcher";
import {loadProcessedJobs} from '../../core/fileManager';

export const linkedinScraper: Scraper = {
    name: 'LinkedIn',
    run: async function* (page: Page): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper: ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name);
        await verifyLinkedInSession(page);

        const shuffledQueries = config.LINKEDIN_SEARCH_QUERIES.sort(() => 0.5 - Math.random());

        for (const query of shuffledQueries) {
            console.log(`\n🔎 [${this.name}] Buscando por: "${query}"...`);
            await humanizedWait(page, 4000, 8000);

            const jobDataGenerator = fetchLinkedInJobs(page, query, config.LOCATION, processedUrls);

            for await (const job of jobDataGenerator) {
                yield {...job, source: this.name};
            }

            await performCoverAction(page);
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};