import {Page} from 'puppeteer';
import {JobData} from "../core/jobProcessor";

export interface Scraper {
    name: string;

    run(page: Page): AsyncGenerator<JobData>;
}