// MELHORIA: Importando puppeteer-extra e plugins
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {Browser, Page} from 'puppeteer';
import {createCursor} from "ghost-cursor"; // MELHORIA: Para simular mouse humano
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import login from './login';
import selectors from './selectors';
import {fetchJobData, JobData} from './fetch/fetchJobData';
import {isPerfectFit} from './analysis';
import {generateLatexCV} from './services/geminiService';
import {compileLatexToPdf} from './compiler';
import {humanizedWait, isWithinWorkingHours, performCoverAction} from "./utils/humanization";

// MELHORIA: Aplicando o plugin stealth
puppeteer.use(StealthPlugin());

const processedJobsPath = path.join(__dirname, '../processed_jobs.json');

function loadProcessedJobs(): Set<string> {
    try {
        if (fs.existsSync(processedJobsPath)) {
            const fileContent = fs.readFileSync(processedJobsPath, 'utf-8');
            const urls: string[] = JSON.parse(fileContent);
            return new Set(urls.map(url => new URL(url).origin + new URL(url).pathname));
        }
    } catch (error) {
        console.warn('Aviso: Não foi possível ler o ficheiro de vagas processadas.', error);
    }
    return new Set();
}

function saveProcessedJob(url: string, currentSet: Set<string>): void {
    currentSet.add(url);
    fs.writeFileSync(processedJobsPath, JSON.stringify(Array.from(currentSet), null, 2));
}

// MELHORIA: Função para tirar screenshots em caso de erro para depuração.
async function takeScreenshotOnError(page: Page, errorName: string): Promise<void> {
    try {
        const screenshotDir = path.join(__dirname, '../error_screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(screenshotDir, `${errorName}-${timestamp}.png`);
        await page.screenshot({path: screenshotPath, fullPage: true});
        console.error(`📷 Screenshot de erro salvo em: ${screenshotPath}`);
    } catch (e) {
        console.error("Falha ao tirar screenshot do erro.", e);
    }
}

async function processJob(jobData: JobData, latexTemplate: string, outputDir: string, processedUrls: Set<string>): Promise<boolean> {
    console.log(`\n--- Processando nova vaga: ${jobData.title} @ ${jobData.company} ---`);
    const {fit, language, fitScore, reason} = await isPerfectFit(jobData);
    saveProcessedJob(jobData.url, processedUrls);

    if (!fit) {
        return false;
    }

    console.log(`✨ Vaga Perfeita encontrada! Gerando currículo...`);
    try {
        const safeCompanyName = jobData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeJobTitle = jobData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const subfolderName = `${fitScore} - ${safeCompanyName} - ${safeJobTitle}`;
        const subfolderPath = path.join(outputDir, subfolderName);
        if (!fs.existsSync(subfolderPath)) {
            fs.mkdirSync(subfolderPath, {recursive: true});
        }

        const pdfPath = path.join(subfolderPath, 'Jonatas_CV.pdf');
        const txtPath = path.join(subfolderPath, 'link_da_vaga.txt');

        const personalizedLatex = await generateLatexCV(jobData.description, config.AI_USER_PROFILE, latexTemplate, language);
        await compileLatexToPdf(personalizedLatex, pdfPath);

        const txtContent = `Vaga: ${jobData.title} @ ${jobData.company}\nURL: ${jobData.url}\n\nNota de Fit: ${fitScore}/10\nJustificativa: ${reason}`;
        fs.writeFileSync(txtPath, txtContent);

        console.log(`✅ Currículo e link salvos em: ${subfolderPath}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
        return false;
    }
}

async function setup(): Promise<{ browser: Browser, page: Page, latexTemplate: string, outputDir: string }> {
    console.log('🚀 Iniciando instância do navegador (com stealth)...');
    const browser = await puppeteer.launch({
        headless: false, // Stealth funciona melhor em modo non-headless
        userDataDir: path.join(__dirname, '../session'),
        args: [
            "--start-maximized",
            // NOTA: Para usar com proxies residenciais rotativos (altamente recomendado):
            // '--proxy-server=http://<proxy_user>:<proxy_pass>@<proxy_host>:<proxy_port>'
        ]
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});

    // MELHORIA: Inicializando o cursor fantasma para movimentos humanos.
    const cursor = createCursor(page);

    await page.goto('https://www.linkedin.com/feed/', {waitUntil: 'domcontentloaded', timeout: 60000});
    if (!await page.$(selectors.feedUpdate).catch(() => null)) {
        // NOTA: Ao usar .type(), considere adicionar um delay para simular digitação humana.
        // Ex: await page.type(selector, text, { delay: Math.random() * 100 + 50 });
        await login({page, email: config.LINKEDIN_EMAIL, password: config.LINKEDIN_PASSWORD});
    } else {
        console.log('✅ Sessão de login detectada.');
    }

    let latexTemplate = '';
    try {
        const templatePath = path.resolve(__dirname, '../', config.CV_LATEX_TEMPLATE_PATH);
        latexTemplate = fs.readFileSync(templatePath, 'utf-8');
        console.log('📄 Template de currículo em LaTeX carregado com sucesso.');
    } catch (error) {
        console.error(`❌ ERRO CRÍTICO: Não foi possível carregar o template LaTeX. Encerrando.`);
        await browser.close();
        process.exit(1);
    }

    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    console.log(`📂 Arquivos serão salvos em: ${outputDir}`);

    return {browser, page, latexTemplate, outputDir};
}

(async () => {
    let {browser, page, latexTemplate, outputDir} = await setup();
    // MELHORIA: Função de espera com tempo aleatório para simular comportamento humano.
    const randomWait = (min: number, max: number) => new Promise(res => setTimeout(res, Math.random() * (max - min) + min));
    let cycleCount = 0;

    while (true) {
        try {
            // << MELHORIA: LÓGICA DE HORÁRIO DE TRABALHO >>
            if (!isWithinWorkingHours()) {
                console.log("--- 😴 Fora do horário de trabalho. O bot vai dormir por algumas horas. ---");
                // Dorme por um tempo longo e aleatório (entre 2 e 4 horas)
                await new Promise(res => setTimeout(res, Math.random() * 2 * 3600 * 1000 + 2 * 3600 * 1000));
                continue; // Pula para a próxima iteração, que vai checar o horário de novo
            }

            cycleCount++;
            const processedUrls = loadProcessedJobs();
            console.log(`\n--- 🔄 Iniciando ciclo de busca #${cycleCount} ---`);
            console.log(`📚 ${processedUrls.size} vagas já foram processadas no total.`);

            let perfectFitCountInCycle = 0;
            let newJobsInCycle = 0;

            const shuffledQueries = config.SEARCH_QUERIES.sort(() => 0.5 - Math.random());

            for (const query of shuffledQueries) {
                console.log(`\n🔎 Executando busca por: "${query}"...`);
                // << MELHORIA: Pausa longa antes de iniciar a busca >>
                await humanizedWait(page, 8000, 15000);

                const jobDataGenerator = fetchJobData(page, query, config.LOCATION, processedUrls);

                for await (const jobData of jobDataGenerator) {
                    newJobsInCycle++;
                    // << MELHORIA: Pausa antes de processar cada vaga individualmente >>
                    await humanizedWait(page, 5000, 10000);
                    const cvGenerated = await processJob(jobData, latexTemplate, outputDir, processedUrls);
                    if (cvGenerated) {
                        perfectFitCountInCycle++;
                    }
                }

                await performCoverAction(page);
            }

            console.log(`\n--- ✅ Ciclo #${cycleCount} finalizado. ---`);
            console.log(`- ${newJobsInCycle} novas vagas analisadas neste ciclo.`);
            console.log(`- ${perfectFitCountInCycle} novos currículos gerados.`);

            const waitTimeMinutes = config.SEARCH_INTERVAL_MINUTES || 15;
            console.log(`--- 🕒 Aguardando ~${waitTimeMinutes} minutos até o próximo ciclo... (Pressione Ctrl+C para encerrar) ---`);

            console.log("    (Atualizando a página para o próximo ciclo...)");
            await page.reload({waitUntil: 'domcontentloaded', timeout: 60000});

            // MELHORIA: Espera aleatória em torno do intervalo definido.
            const baseWaitMillis = waitTimeMinutes * 60 * 1000;
            await humanizedWait(page, baseWaitMillis - (5 * 60 * 1000), baseWaitMillis + (10 * 60 * 1000));

        } catch (error: any) {
            console.error(`\n🚨 ERRO FATAL NO CICLO #${cycleCount}: ${error.message}`);
            await takeScreenshotOnError(page, 'ciclo_fatal_error'); // Tira screenshot do erro
            console.error("    Ocorreu um erro grave. Reiniciando o navegador...");

            if (browser) await browser.close();
            await humanizedWait(page, 20000, 40000);

            ({browser, page, latexTemplate, outputDir} = await setup());
            console.log("    Navegador reiniciado com sucesso. Retomando os ciclos de busca...");
        }
    }
})();