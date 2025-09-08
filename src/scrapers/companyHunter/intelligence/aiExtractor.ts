import { Page } from 'puppeteer';
import {cleanHtmlForAnalysis, cleanHtmlForAnalysisCheerio} from "../../../utils/htmlUtils";
import {generateWithRetryLite} from "../../../services/geminiService";

/**
 * Usa a IA para analisar o HTML de uma página e extrair dinamicamente os detalhes de uma vaga.
 * @param page A instância da página do Puppeteer para obter o HTML.
 * @param jobUrl A URL da vaga, para contexto.
 * @returns Um objeto com os dados extraídos ou null em caso de falha.
 */
export async function extractJobDataWithAI(page: Page, jobUrl: string): Promise<{ title: string, company: string, description: string } | null> {
    console.log(`- 🤖 Iniciando extração dinâmica com IA para: ${jobUrl.substring(0, 80)}...`);
    try {
        const rawHtml = await page.content();
        const cleanedHtmlCheerio = cleanHtmlForAnalysisCheerio(rawHtml);
        const cleanedHtml = cleanHtmlForAnalysis(cleanedHtmlCheerio);

        const prompt = `
          **TAREFA:** Você é um especialista em parsing de HTML. Sua função é extrair informações de uma página de vaga de emprego a partir do HTML.

          **CONTEXTO:**
          - URL da vaga: ${jobUrl}
          - O HTML abaixo representa o conteúdo desta página.

          **INSTRUÇÕES:**
          1. Extraia: o título (title), o nome da empresa (company) e a descrição completa da vaga (description).
          2. Sua resposta deve ser **APENAS UM OBJETO JSON VÁLIDO**.
          3. A estrutura deve ser: { "title": "...", "company": "...", "description": "..." }

          **HTML LIMPO PARA ANÁLISE:**
          \`\`\`html
          ${cleanedHtml}
          \`\`\`
        `;

        const jsonResponse = await generateWithRetryLite(prompt);
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(cleanedJson);

        if (extractedData.title && extractedData.description) {
            console.log(`- ✅ IA extraiu com sucesso: "${extractedData.title}"`);
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