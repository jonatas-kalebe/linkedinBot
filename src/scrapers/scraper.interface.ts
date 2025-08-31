// src/scrapers/scraper.interface.ts

import {Page} from 'puppeteer';
import {JobData} from "../core/jobProcessor";

export interface Scraper {
    name: string;

    /**
     * O método principal que executa o scraping.
     * Deve ser um gerador assíncrono que "produz" vagas encontradas.
     * @param page A instância da página do Puppeteer.
     * @param processedUrls O conjunto de URLs já processadas para evitar duplicatas.
     */
    run(page: Page, processedUrls: Set<string>): AsyncGenerator<JobData>;
}