import {generateWithRetryLite} from './geminiService';
import {cleanHtmlForAnalysis, cleanHtmlForAnalysisCheerio} from '../utils/htmlUtils';
import {JobData} from '../core/jobProcessor';
import {Page} from 'puppeteer';

/**
 * Usa a IA para analisar o HTML de uma página e extrair dinamicamente os detalhes de uma vaga.
 * @param page A instância da página do Puppeteer para obter o HTML.
 * @param jobUrl A URL da vaga, para contexto.
 * @returns {Promise<Partial<JobData> | null>} Um objeto com os dados extraídos ou null em caso de falha.
 */
export async function extractJobDataWithAI(page: Page, jobUrl: string): Promise<Partial<JobData> | null> {
    console.log(`- 🤖 Iniciando extração dinâmica com IA para: ${jobUrl}`);
    try {
        const rawHtml = await page.content();
        const cleanedHtmlCheerio = cleanHtmlForAnalysisCheerio(rawHtml);
        const cleanedHtml = cleanHtmlForAnalysis(cleanedHtmlCheerio);

        const prompt = `
          **TAREFA:** Você é um especialista em parsing de HTML. Sua função é extrair informações específicas de uma página de vaga de emprego a partir do HTML fornecido.

          **CONTEXTO:**
          - Eu estou na URL: ${jobUrl}
          - O HTML abaixo representa o conteúdo desta página.

          **INSTRUÇÕES:**
          1.  Analise o HTML para encontrar as seguintes informações:
              - O título principal da vaga (job title).
              - O nome da empresa que está contratando (company name).
              - A descrição completa da vaga (job description), incluindo requisitos, responsabilidades, etc. Mantenha a formatação do texto, como quebras de linha.
          2.  Sua resposta deve ser **APENAS UM OBJETO JSON VÁLIDO**.
          3.  Não inclua explicações, introdução ou markdown como \`\`\`json.
          4.  A resposta deve começar com "{" e terminar com "}".
          5.  A estrutura do JSON deve ser: { "title": "...", "company": "...", "description": "..." }

          **HTML LIMPO PARA ANÁLISE:**
          \`\`\`html
          ${cleanedHtml}
          \`\`\`
        `;

        const jsonResponse = await generateWithRetryLite(prompt);

        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        const extractedData = JSON.parse(cleanedJson);

        if (extractedData.title && extractedData.company && extractedData.description) {
            console.log(`- ✅ IA extraiu com sucesso: "${extractedData.title}" na "${extractedData.company}"`);
            return extractedData;
        } else {
            console.warn('- ⚠️ A IA retornou um JSON, mas faltam dados essenciais.');
            return null;
        }

    } catch (error) {
        console.error(`- ❌ Erro catastrófico durante a extração com IA:`, error);
        return null;
    }
}