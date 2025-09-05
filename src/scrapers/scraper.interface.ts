import {JobData} from "../core/jobProcessor";

export type Engine = 'puppeteer' | 'playwright';

export interface Scraper {
    name: string;
    engine?: Engine;

    run(page: any): AsyncGenerator<JobData>;
}