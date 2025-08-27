import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import login from './login';
import selectors from './selectors';
import { fetchJobData } from './fetch/fetchJobData';
import { isPerfectFit } from './analysis';
import { generateLatexCV } from './services/geminiService';
import { compileLatexToPdf } from './compiler';

const processedJobsPath = path.join(__dirname, '../processed_jobs.json');
let processedJobUrls: Set<string>;

function loadProcessedJobs(): Set<string> {
    try {
        if (fs.existsSync(processedJobsPath)) {
            const fileContent = fs.readFileSync(processedJobsPath, 'utf-8');
            return new Set(JSON.parse(fileContent));
        }
    } catch (error) {
        console.warn('Aviso: Não foi possível ler o ficheiro de vagas processadas. Começando do zero.', error);
    }
    return new Set();
}

function saveProcessedJob(url: string): void {
    processedJobUrls.add(url);
    fs.writeFileSync(processedJobsPath, JSON.stringify(Array.from(processedJobUrls), null, 2));
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

(async () => {
    console.log('🚀 Iniciando o Bot Gerador de Currículos...');

    processedJobUrls = loadProcessedJobs();
    console.log(`📚 Encontradas ${processedJobUrls.size} vagas já processadas anteriormente.`);

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: path.join(__dirname, '../session'),
        args: ["--start-maximized"]
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'load' });
    if (!await page.$(selectors.feedUpdate).catch(() => null)) {
        console.log('Sessão não encontrada. Iniciando processo de login...');
        await login({ page, email: config.LINKEDIN_EMAIL, password: config.LINKEDIN_PASSWORD });
    } else {
        console.log('✅ Sessão de login detectada.');
    }

    // --- 2. CARREGAR TEMPLATE DE CURRÍCULO ---
    let latexTemplate = '';
    try {
        const templatePath = path.resolve(__dirname, '../', config.CV_LATEX_TEMPLATE_PATH);
        latexTemplate = fs.readFileSync(templatePath, 'utf-8');
        console.log('📄 Template de currículo em LaTeX carregado com sucesso.');
    } catch (error) {
        console.error(`❌ ERRO CRÍTICO: Não foi possível carregar o template LaTeX de ${config.CV_LATEX_TEMPLATE_PATH}. Encerrando.`);
        await browser.close();
        return;
    }

    // --- 3. CRIAR PASTA DE SAÍDA ---
    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    console.log(`📂 Arquivos serão salvos em: ${outputDir}`);

    // --- 4. FLUXO PRINCIPAL DE BUSCA, ANÁLISE E GERAÇÃO ---
    const jobDataGenerator = fetchJobData(page, config.KEYWORDS, config.LOCATION);
    let perfectFitCount = 0;
    let seenJobsCount = 0;

    console.log('\n--- Iniciando busca por vagas... ---');
    for await (const jobData of jobDataGenerator) {

        // ### VERIFICAÇÃO DE VAGA JÁ VISTA ###
        if (processedJobUrls.has(jobData.url)) {
            seenJobsCount++;
            continue; // Pula para a próxima vaga sem imprimir nada
        }

        console.log(`\n--- Processando nova vaga: ${jobData.title} @ ${jobData.company} ---`);

        const { fit, language, fitScore, reason } = await isPerfectFit(jobData);

        // Marca a vaga como processada, independentemente do resultado do fit
        saveProcessedJob(jobData.url);

        if (fit) {
            perfectFitCount++;
            console.log(`✨ Vaga Perfeita #${perfectFitCount} encontrada! Gerando currículo...`);

            try {
                // Cria a subpasta com a nota de fit
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

            } catch (error: any) {
                console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
            }
        }
    }

    if (seenJobsCount > 0) {
        console.log(`\n(Foram ignoradas ${seenJobsCount} vagas que já haviam sido analisadas em execuções anteriores.)`);
    }

    console.log(`\n🏁 Processo finalizado. Total de vagas perfeitas encontradas nesta execução: ${perfectFitCount}.`);
    await browser.close();
})();