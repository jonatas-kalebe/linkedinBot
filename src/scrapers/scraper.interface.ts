// src/scrapers/scraper.interface.ts
import { Page as PuppeteerPage } from 'puppeteer';
import { Page as PlaywrightPage } from 'playwright';
import { JobData } from "../core/jobProcessor";

// 1. Definimos os tipos de motores possíveis
export type Engine = 'puppeteer' | 'playwright';

export interface Scraper {
    name: string;
    // 2. Adicionamos a propriedade opcional 'engine'. Se não for definida, o padrão será 'puppeteer'.
    engine?: Engine;
    // 3. Usamos 'any' para a 'page' para simplificar. O orquestrador garantirá que o tipo certo seja passado.
    run(page: any): AsyncGenerator<JobData>;
}