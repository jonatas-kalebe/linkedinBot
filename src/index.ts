import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import {Browser, Page} from 'puppeteer';

import {launchBrowser, takeScreenshotOnError} from './core/puppeteerManager';
import {saveProcessedJob} from './core/fileManager';
import {processJob} from './core/jobProcessor';
import {humanizedWait, isWithinWorkingHours} from "./utils/humanization";

import {Scraper} from './scrapers/scraper.interface';
import {linkedinScraper} from './scrapers/linkedin';
import {weWorkRemotelyScraper} from './scrapers/weworkremotely';
import {remoteOkScraper} from './scrapers/remoteok';
import {programathorScraper} from "./scrapers/programathor";
import {theMuseScraper} from "./scrapers/themuse";
import {remotiveScraper} from "./scrapers/remotive";
import {wellfoundScraper} from "./scrapers/wellfound";
import {gupyScraper} from "./scrapers/gupy";

// Interface para agrupar o scraper com seu gerador
interface ScraperSession {
    scraper: Scraper;
    generator: AsyncGenerator<any, void, unknown>;
}

async function main() {
    let browser: Browser | null = null;
    let page: Page | null = null;

    const latexTemplate = fs.readFileSync(path.resolve(__dirname, '..', config.CV_LATEX_TEMPLATE_PATH), 'utf-8');
    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const scrapersToRun: Scraper[] = [
        gupyScraper,
        // wellfoundScraper,
        // theMuseScraper,
        linkedinScraper,

        programathorScraper,
        weWorkRemotelyScraper,
        remoteOkScraper,


    ];

    let cycleCount = 0;
    while (true) {
        try {
            // if (!isWithinWorkingHours()) {
            //     console.log("--- 😴 Fora do horário de trabalho. O bot vai dormir por 2 horas...");
            //     await new Promise(res => setTimeout(res, 2 * 3600 * 1000));
            //     continue;
            // }

            cycleCount++;
            console.log(`\n--- 🔄 Iniciando CICLO DE ORQUESTRAÇÃO #${cycleCount} ---`);

            const browserSession = await launchBrowser();
            browser = browserSession.browser;
            page = browserSession.page;

            // 1. Inicializa todos os geradores de uma vez
            console.log("--- 🚀 Inicializando todos os scrapers para o ciclo de rodízio...");
            let activeScrapers: ScraperSession[] = scrapersToRun.map(scraper => ({
                scraper,
                generator: scraper.run(page!),
            }));

            // 2. Loop principal de rodízio: continua enquanto houver algum scraper ativo
            while (activeScrapers.length > 0) {
                console.log(`\n--- 🕵️‍♀️ Iniciando rodada com ${activeScrapers.length} fontes ativas...`);
                const remainingScrapers: ScraperSession[] = [];
                let jobsFoundInRound = 0;

                // 3. Itera sobre os geradores ativos, pegando no máximo UMA vaga de cada
                for (const session of activeScrapers) {
                    try {
                        const result = await session.generator.next();

                        if (!result.done) {
                            // Encontrou uma vaga, processa e mantém o scraper na lista para a próxima rodada
                            const jobData = result.value;
                            console.log(`    [✔️ ${session.scraper.name}] Vaga encontrada: ${jobData.title}`);

                    await processJob(jobData, latexTemplate, outputDir);
                    saveProcessedJob(jobData.url, jobData.source);
                            jobsFoundInRound++;

                            // A espera humanizada agora ocorre APÓS CADA vaga processada
                            await humanizedWait(page, 8000, 15000);

                            remainingScrapers.push(session);
                        } else {
                            // O gerador terminou, então este scraper não tem mais vagas neste ciclo
                            console.log(`    [✅ ${session.scraper.name}] Finalizou a busca neste ciclo.`);
                        }
                    } catch (error: any) {
                         console.error(`    [❌ ${session.scraper.name}] Erro ao buscar vaga: ${error.message}. Removendo do ciclo atual.`);
                         // Se um scraper específico falhar, ele é removido do rodízio para não travar o ciclo
                    }
                }

                // 4. Atualiza a lista de scrapers ativos para a próxima rodada do rodízio
                activeScrapers = remainingScrapers;

                if (activeScrapers.length > 0 && jobsFoundInRound === 0) {
                    console.log("--- ⏳ Nenhuma vaga nova em todas as fontes nesta rodada. Aguardando um pouco antes de tentar novamente...");
                    await humanizedWait(page, 20000, 40000);
                }
            }

            await browser.close();
            browser = null;

            console.log(`\n--- ✅ Ciclo #${cycleCount} finalizado. Todas as fontes foram esgotadas.`);
            const waitTimeMinutes = config.SEARCH_INTERVAL_MINUTES || 30;
            console.log(`--- 🕒 Aguardando ~${waitTimeMinutes} minutos até o próximo ciclo completo... ---`);
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