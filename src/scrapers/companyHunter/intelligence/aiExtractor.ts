// ARQUIVO: src/scrapers/companyHunter/intelligence/aiExtractor.ts

import { Page } from 'puppeteer';
import { generateWithRetryLite } from '../../../services/geminiService';
import { cleanHtmlForAnalysisCheerio } from '../../../utils/htmlUtils';

/**
 * Usa a IA para analisar o HTML de uma PÁGINA DE VAGA e extrair os detalhes.
 */
export async function extractJobDataWithAI(page: Page, jobUrl: string): Promise<{ title: string, company: string, description: string } | null> {
    console.log(`- 🤖 Iniciando extração de detalhes com IA para: ${jobUrl.substring(0, 80)}...`);
    try {
        const rawHtml = await page.content();
        const cleanedHtml = cleanHtmlForAnalysisCheerio(rawHtml);

        const prompt = `
          **TAREFA:** Você é um especialista em parsing de HTML. Extraia as informações de uma vaga de emprego do HTML abaixo.

          **CONTEXTO:**
          - URL da vaga: ${jobUrl}

          **INSTRUÇÕES:**
          1. Extraia: o título (title), o nome da empresa (company) e a descrição completa (description).
          2. Sua resposta deve ser **APENAS UM OBJETO JSON VÁLIDO**.
          3. A estrutura deve ser: { "title": "...", "company": "...", "description": "..." }

          **HTML PARA ANÁLISE:**
          \`\`\`html
          ${cleanedHtml}
          \`\`\`
        `;

        const jsonResponse = await generateWithRetryLite(prompt);
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(cleanedJson);

        if (extractedData.title && extractedData.description) {
            console.log(`- ✅ IA extraiu com sucesso: "${extractedData.title}"`);
            // Se a IA não conseguir o nome da empresa, tentamos pegar do título da página
            if (!extractedData.company) {
                extractedData.company = await page.title();
            }
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