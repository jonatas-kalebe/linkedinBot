import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import login from './login';
import selectors from './selectors';
import { fetchJobData, JobData } from './fetch/fetchJobData';
import { isPerfectFit } from './analysis';
import { generateLatexCV } from './services/geminiService';
import { compileLatexToPdf } from './compiler';

// --- MÓDULO DE GERENCIAMENTO DE ESTADO ---
// Mantém o controle das vagas já processadas.

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

// --- FUNÇÃO PRINCIPAL DE PROCESSAMENTO DE UMA VAGA ---
// Esta função encapsula toda a lógica para uma única vaga.

async function processJob(jobData: JobData, latexTemplate: string, outputDir: string, processedUrls: Set<string>): Promise<boolean> {
    console.log(`\n--- Processando nova vaga: ${jobData.title} @ ${jobData.company} ---`);

    const { fit, language, fitScore, reason } = await isPerfectFit(jobData);

    // Salva a vaga como processada para não a vermos novamente
    saveProcessedJob(jobData.url, processedUrls);

    if (!fit) {
        return false; // Retorna false se não for um "fit"
    }

    console.log(`✨ Vaga Perfeita encontrada! Gerando currículo...`);
    try {
        const safeCompanyName = jobData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeJobTitle = jobData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const subfolderName = `${fitScore} - ${safeCompanyName} - ${safeJobTitle}`;
        const subfolderPath = path.join(outputDir, subfolderName);
        if (!fs.existsSync(subfolderPath)) {
            fs.mkdirSync(subfolderPath, { recursive: true });
        }

        const pdfPath = path.join(subfolderPath, 'Jonatas_CV.pdf');
        const txtPath = path.join(subfolderPath, 'link_da_vaga.txt');

        const personalizedLatex = await generateLatexCV(jobData.description, config.AI_USER_PROFILE, latexTemplate, language);
        await compileLatexToPdf(personalizedLatex, pdfPath);

        const txtContent = `Vaga: ${jobData.title} @ ${jobData.company}\nURL: ${jobData.url}\n\nNota de Fit: ${fitScore}/10\nJustificativa: ${reason}`;
        fs.writeFileSync(txtPath, txtContent);

        console.log(`✅ Currículo e link salvos em: ${subfolderPath}`);
        return true; // Retorna true se um CV foi gerado
    } catch (error: any) {
        console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
        return false;
    }
}

// --- FUNÇÃO DE SETUP ---
// Prepara tudo o que é necessário antes do loop principal.

async function setup() {
    console.log('🚀 Iniciando o Bot Gerador de Currículos...');
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: path.join(__dirname, '../session'),
        args: ["--start-maximized"]
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'load' });
    if (!await page.$(selectors.feedUpdate).catch(() => null)) {
        await login({ page, email: config.LINKEDIN_EMAIL, password: config.LINKEDIN_PASSWORD });
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
        process.exit(1); // Encerra o processo com erro
    }

    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    console.log(`📂 Arquivos serão salvos em: ${outputDir}`);

    return { browser, page, latexTemplate, outputDir };
}

// --- ORQUESTRADOR PRINCIPAL ---
// Onde o loop contínuo acontece.

(async () => {
    const { browser, page, latexTemplate, outputDir } = await setup();
    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
    let cycleCount = 0;

    while (true) {
        cycleCount++;
        const processedUrls = loadProcessedJobs();
        console.log(`\n--- 🔄 Iniciando ciclo de busca #${cycleCount} ---`);
        console.log(`📚 ${processedUrls.size} vagas já foram processadas no total.`);

        const jobDataGenerator = fetchJobData(page, config.KEYWORDS, config.LOCATION, processedUrls);
        let perfectFitCountInCycle = 0;
        let newJobsInCycle = 0;
        let seenJobsCountInCycle = 0;

        for await (const jobData of jobDataGenerator) {

            newJobsInCycle++;

            const cvGenerated = await processJob(jobData, latexTemplate, outputDir, processedUrls);
            if (cvGenerated) {
                perfectFitCountInCycle++;
            }
        }

        console.log(`\n--- ✅ Ciclo #${cycleCount} finalizado. ---`);
        console.log(`- ${newJobsInCycle} novas vagas analisadas neste ciclo.`);
        console.log(`- ${perfectFitCountInCycle} novos currículos gerados.`);

        const waitTimeMinutes = config.SEARCH_INTERVAL_MINUTES || 15;
        console.log(`--- 🕒 Aguardando ${waitTimeMinutes} minutos até o próximo ciclo... (Pressione Ctrl+C para encerrar) ---`);
        await wait(waitTimeMinutes * 60 * 1000);
    }
})();