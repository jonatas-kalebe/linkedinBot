import { Page } from 'puppeteer';
import selectors from '../selectors';
import config from '../config';
import { analyzeJobFit } from '../services/geminiService';
import { JobData } from '../fetch/fetchJobData'; // Importa a interface correta

// ### CORREÇÃO: A função agora recebe o objeto JobData completo ###
export async function isPerfectFit(jobData: JobData): Promise<{ fit: boolean, language: string }> {
    try {
        console.log(`  - Analisando fit da vaga "${jobData.title}" com a IA...`);

        // A IA agora fará a análise completa, incluindo o idioma.
        const analysisResult = await analyzeJobFit(jobData.description, config.AI_USER_PROFILE, config.JOB_DESCRIPTION_LANGUAGES);

        if (analysisResult.isFit) {
            console.log(`  - ✅ Fit Aprovado pela IA! (Idioma: ${analysisResult.language})`);
            return { fit: true, language: analysisResult.language };
        } else {
            console.log(`  - ❌ Fit Reprovado pela IA. (Motivo: ${analysisResult.reason})`);
            return { fit: false, language: analysisResult.language };
        }
    } catch (error) {
        console.error('  - Erro ao analisar o fit da vaga:', error);
        return { fit: false, language: 'unknown' };
    }
}