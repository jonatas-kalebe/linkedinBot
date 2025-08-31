
import * as fs from 'fs';
import * as path from 'path';
import config from '../config';
import {isPerfectFit} from '../analysis';
import {generateLatexCV} from '../services/geminiService';
import {compileLatexToPdf} from '../compiler';
import {saveProcessedJob} from "./fileManager";

export interface JobData {
    url: string;
    title: string;
    company: string;
    description: string;
}

export async function processJob(jobData: JobData, latexTemplate: string, outputDir: string, processedUrls: Set<string>): Promise<boolean> {
    console.log(`\n--- Processando nova vaga: ${jobData.title} @ ${jobData.company} ---`);
    const analysis = await isPerfectFit(jobData);
    saveProcessedJob(jobData.url, processedUrls);

    if (!analysis.fit) {
        console.log(`-- ❌ Vaga não compatível (Nota: ${analysis.fitScore}). Motivo: ${analysis.reason}`);
        return false;
    }

    console.log(`-- ✨ Vaga Perfeita encontrada! (Nota: ${analysis.fitScore}). Gerando currículo...`);
    try {
        const safeCompanyName = jobData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeJobTitle = jobData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const subfolderName = `${analysis.fitScore} - ${safeCompanyName} - ${safeJobTitle}`;
        const subfolderPath = path.join(outputDir, subfolderName);
        if (!fs.existsSync(subfolderPath)) {
            fs.mkdirSync(subfolderPath, {recursive: true});
        }

        const pdfPath = path.join(subfolderPath, 'Jonatas_CV.pdf');
        const txtPath = path.join(subfolderPath, 'link_da_vaga.txt');

        const personalizedLatex = await generateLatexCV(jobData.description, config.AI_USER_PROFILE, latexTemplate, analysis.language);
        await compileLatexToPdf(personalizedLatex, pdfPath);

        const txtContent = `Vaga: ${jobData.title} @ ${jobData.company}\nURL: ${jobData.url}\n\nNota de Fit: ${analysis.fitScore}/10\nJustificativa: ${analysis.reason}`;
        fs.writeFileSync(txtPath, txtContent);

        console.log(`✅ Currículo e link salvos em: ${subfolderPath}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Falha ao gerar ou compilar o currículo para "${jobData.title}":`, error.message);
        return false;
    }
}