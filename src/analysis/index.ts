import config from '../config';
import {analyzeJobFit} from '../services/geminiService';
import {JobData} from "../core/jobProcessor";

export async function isPerfectFit(jobData: JobData): Promise<{ fit: boolean; fitScore: number; language: string; reason: string; }> {
    try {
        console.log(`  - Analisando fit da vaga "${jobData.title}" com a IA...`);

                const analysisResult = await analyzeJobFit(jobData.description, config.AI_USER_PROFILE, config.JOB_DESCRIPTION_LANGUAGES);

                if (analysisResult.fit) {
            console.log(`  - ✅ Fit Aprovado pela IA! (Nota: ${analysisResult.fitScore}/10, Idioma: ${analysisResult.language})`);
        } else {
            console.log(`  - ❌ Fit Reprovado pela IA. (Nota: ${analysisResult.fitScore}/10, Motivo: ${analysisResult.reason})`);
        }
        return analysisResult;

    } catch (error) {
        console.error('  - Erro ao analisar o fit da vaga:', error);
        return { fit: false, fitScore: 0, language: 'unknown', reason: 'Erro no módulo de análise' };
    }
}