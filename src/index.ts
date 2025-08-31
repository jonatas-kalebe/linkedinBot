
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import {Browser, Page} from 'puppeteer';

import {launchBrowser, takeScreenshotOnError} from './core/browserManager';
import {loadProcessedJobs} from './core/fileManager';
import {processJob} from './core/jobProcessor';
import {humanizedWait, isWithinWorkingHours} from "./utils/humanization";
import {Scraper} from './scrapers/scraper.interface';
import {linkedinScraper} from './scrapers/linkedin';
import {weWorkRemotelyScraper} from "./scrapers/weworkremotely"; import { remoteOkScraper } from './scrapers/remoteok';
import {programathorScraper} from "./scrapers/programathor";

async function main() {
    let browser: Browser | null = null;
    let page: Page | null = null;

        const latexTemplate = fs.readFileSync(path.resolve(__dirname, '..', config.CV_LATEX_TEMPLATE_PATH), 'utf-8');
    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        const scrapersToRun: Scraper[] = [
        weWorkRemotelyScraper,
        remoteOkScraper,
        programathorScraper,
    ];

    let cycleCount = 0;
    while (true) {
        try {
            // if (!isWithinWorkingHours()) {
            //     console.log("--- 😴 Fora do horário de trabalho. O bot vai dormir por algumas horas. ---");
            //     await new Promise(res => setTimeout(res, Math.random() * 2 * 3600 * 1000 + 2 * 3600 * 1000));
            //     continue;
            // }

            cycleCount++;
            console.log(`\n--- 🔄 Iniciando CICLO DE ORQUESTRAÇÃO #${cycleCount} ---`);

            // Inicia o navegador para o ciclo
            const browserSession = await launchBrowser();
            browser = browserSession.browser;
            page = browserSession.page;

            const processedUrls = loadProcessedJobs();
            let newJobsInCycle = 0;
            let perfectFitCountInCycle = 0;

            // Itera sobre cada scraper da lista
            for (const scraper of scrapersToRun) {
                // O orquestrador chama o 'run' do scraper e aguarda as vagas
                const jobDataGenerator = scraper.run(page, processedUrls);

                for await (const jobData of jobDataGenerator) {
                    newJobsInCycle++;
                    await humanizedWait(page, 5000, 10000); // Pausa entre o processamento de vagas
                    const cvGenerated = await processJob(jobData, latexTemplate, outputDir, processedUrls);
                    if (cvGenerated) {
                        perfectFitCountInCycle++;
                    }
                }
            }

            console.log(`\n--- ✅ Ciclo #${cycleCount} finalizado. ---`);
            console.log(`- ${newJobsInCycle} novas vagas analisadas neste ciclo.`);
            console.log(`- ${perfectFitCountInCycle} novos currículos gerados.`);

            await browser.close();
            browser = null;

            const waitTimeMinutes = config.SEARCH_INTERVAL_MINUTES || 30;
            console.log(`--- 🕒 Aguardando ~${waitTimeMinutes} minutos até o próximo ciclo... ---`);
            await humanizedWait(page, waitTimeMinutes * 60 * 1000, (waitTimeMinutes + 10) * 60 * 1000);

        } catch (error: any) {
            console.error(`\n🚨 ERRO FATAL NO ORQUESTRADOR (Ciclo #${cycleCount}): ${error.message}`);
            if (page) await takeScreenshotOnError(page, 'orquestrador_fatal_error');

            if (browser) await browser.close();

            console.error("    Reiniciando após uma pausa...");
            await new Promise(res => setTimeout(res, 30000));
        }
    }
}

main();