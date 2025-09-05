import {Scraper} from '../scraper.interface';
import {JobData} from '../../core/jobProcessor';
import {fetchGupyJobs} from './fetcher';
import {loadProcessedJobs} from '../../core/fileManager';

export const gupyScraper: Scraper = {
    name: 'Gupy',
    run: async function* (page: any): AsyncGenerator<JobData> {
        console.log(`\n--- ▶️ Iniciando scraper (API): ${this.name} ---`);
        const processedUrls = loadProcessedJobs(this.name);
        const jobDataGenerator = fetchGupyJobs(processedUrls);

        for await (const job of jobDataGenerator) {
            yield {...job, source: this.name};
        }

        console.log(`--- ✅ Finalizado scraper: ${this.name} ---`);
    }
};