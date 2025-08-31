// src/scrapers/scraper.interface.ts

import {Page} from 'puppeteer';
import {JobData} from "../core/jobProcessor";

export interface Scraper {
    name: string;

    // << ALTERAÇÃO 4: A função run agora é mais simples >>
    run(page: Page): AsyncGenerator<JobData>;
}