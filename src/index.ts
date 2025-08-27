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

        const analysisResult = await isPerfectFit(jobData);

        // Apenas continua se a IA marcou como 'isFit: true'
        if (analysisResult.fit) {
            perfectFitCount++;
            console.log(`✨ Vaga Perfeita #${perfectFitCount} encontrada! Gerando currículo...`);

            try {
                // ### NOVA LÓGICA DE PASTAS E ARQUIVOS ###

                // 1. Sanitiza os nomes para criar um nome de pasta válido
                const safeCompanyName = jobData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const safeJobTitle = jobData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);

                // 2. Cria o nome da subpasta com a nota de fit
                const subfolderName = `${analysisResult.fitScore} - ${safeCompanyName} - ${safeJobTitle}`;
                const subfolderPath = path.join(outputDir, subfolderName);
                if (!fs.existsSync(subfolderPath)) {
                    fs.mkdirSync(subfolderPath, { recursive: true });
                }

                // 3. Define os caminhos para o PDF e o TXT dentro da nova subpasta
                const pdfPath = path.join(subfolderPath, 'Jonatas_CV.pdf');
                const txtPath = path.join(subfolderPath, 'link_da_vaga.txt');

                // 4. Gera e compila o currículo
                const personalizedLatex = await generateLatexCV(jobData.description, config.AI_USER_PROFILE, latexTemplate, analysisResult.language);
                await compileLatexToPdf(personalizedLatex, pdfPath);

                // 5. Salva o TXT com o link e a justificativa da IA
                const txtContent = `Vaga: ${jobData.title} @ ${jobData.company}\nURL: ${jobData.url}\n\nNota de Fit: ${analysisResult.fitScore}/10\nJustificativa: ${analysisResult.reason}`;
                fs.writeFileSync(txtPath, txtContent);

                console.log(`✅ Currículo e link salvos em: ${subfolderPath}`);

            } catch (error: any) {
                console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
            }
        }
    }

    console.log(`\n🏁 Processo finalizado. Total de vagas perfeitas encontradas: ${perfectFitCount}.`);
    await browser.close();
})();