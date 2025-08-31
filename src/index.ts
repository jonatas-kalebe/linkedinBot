// src/index.ts

import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import {Browser, Page} from 'puppeteer';

import {launchBrowser, takeScreenshotOnError} from './core/browserManager';
// << ALTERAÇÃO >> saveProcessedJob será chamado aqui
import {saveProcessedJob} from './core/fileManager';
import {processJob} from './core/jobProcessor';
import {humanizedWait} from "./utils/humanization";

import {Scraper} from './scrapers/scraper.interface';
import {linkedinScraper} from './scrapers/linkedin';
import {weWorkRemotelyScraper} from './scrapers/weworkremotely';
import {remoteOkScraper} from './scrapers/remoteok';

async function main() {
    let browser: Browser | null = null;
    let page: Page | null = null;

    const latexTemplate = fs.readFileSync(path.resolve(__dirname, '..', config.CV_LATEX_TEMPLATE_PATH), 'utf-8');
    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const scrapersToRun: Scraper[] = [
        weWorkRemotelyScraper,
        remoteOkScraper,
        linkedinScraper,

        // Adicione os outros aqui quando estiverem atualizados
    ];

    let cycleCount = 0;
    while (true) {
        try {
            // if (!isWithinWorkingHours()) {
            //     console.log("--- 😴 Fora do horário de trabalho. O bot vai dormir...");
            //     await new Promise(res => setTimeout(res, 2 * 3600 * 1000));
            //     continue;
            // }

            cycleCount++;
            console.log(`\n--- 🔄 Iniciando CICLO DE ORQUESTRAÇÃO #${cycleCount} ---`);

            const browserSession = await launchBrowser();
            browser = browserSession.browser;
            page = browserSession.page;

            for (const scraper of scrapersToRun) {
                // << ALTERAÇÃO >> A chamada ao 'run' está mais simples
                const jobDataGenerator = scraper.run(page);

                for await (const jobData of jobDataGenerator) {
                    await humanizedWait(page, 5000, 10000);
                    // O processJob não precisa mais do set de URLs
                    await processJob(jobData, latexTemplate, outputDir);
                    // O orquestrador agora salva o status da URL
                    saveProcessedJob(jobData.url, jobData.source);
                }
            }

            await browser.close();
            browser = null;

            console.log(`\n--- ✅ Ciclo #${cycleCount} finalizado. ---`);
            const waitTimeMinutes = config.SEARCH_INTERVAL_MINUTES || 30;
            console.log(`--- 🕒 Aguardando ~${waitTimeMinutes} minutos até o próximo ciclo... ---`);
            await new Promise(res => setTimeout(res, (waitTimeMinutes * 60 * 1000)));

        } catch (error: any) {
            console.error(`\n🚨 ERRO FATAL NO ORQUESTRADOR (Ciclo #${cycleCount}): ${error.message}`);
            if (page) await takeScreenshotOnError(page, 'orquestrador_fatal_error');
            if (browser) await browser.close();

            console.error("    Reiniciando após uma pausa de 60 segundos...");
            await new Promise(res => setTimeout(res, 60000));
        }
    }
}

main();