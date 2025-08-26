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

(async () => {
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
        console.log('Sessão não encontrada. Iniciando processo de login...');
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
        console.error(`❌ ERRO CRÍTICO: Não foi possível carregar o template LaTeX de ${config.CV_LATEX_TEMPLATE_PATH}. Encerrando.`);
        await browser.close();
        return;
    }

    const outputDir = path.join(__dirname, '../generated_cvs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    console.log(`📄 Arquivos serão salvos em: ${outputDir}`);

    const jobDataGenerator = fetchJobData(page, config.KEYWORDS, config.LOCATION);
    let perfectFitCount = 0;

    console.log('\n--- Iniciando busca por vagas... ---');
    for await (const jobData of jobDataGenerator) {
        console.log(`\n--- Processando vaga: ${jobData.title} @ ${jobData.company} ---`);

        // ### CORREÇÃO: A chamada para isPerfectFit agora passa apenas o objeto jobData ###
        const { fit, language } = await isPerfectFit(jobData);

    if (fit) {
            perfectFitCount++;
            console.log(`✨ Vaga Perfeita #${perfectFitCount} encontrada! Gerando currículo...`);

            try {
        // A linguagem correta é passada para a geração do LaTeX
        const personalizedLatex = await generateLatexCV(jobData.description, config.AI_USER_PROFILE, latexTemplate, language);

                const safeCompanyName = jobData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const safeJobTitle = jobData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20);
                const fileNameBase = `${perfectFitCount}_${safeCompanyName}_${safeJobTitle}`;
                const pdfPath = path.join(outputDir, `${fileNameBase}.pdf`);
                const txtPath = path.join(outputDir, `${fileNameBase}.txt`);

                await compileLatexToPdf(personalizedLatex, pdfPath);

                fs.writeFileSync(txtPath, `Vaga: ${jobData.title} @ ${jobData.company}\nURL: ${jobData.url}`);

                console.log(`✅ Currículo e link salvos para a vaga "${jobData.title}"`);

            } catch (error: any) {
                console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
            }
        }
    }

    console.log(`\n🏁 Processo finalizado. Total de vagas perfeitas encontradas: ${perfectFitCount}.`);
    await browser.close();
})();