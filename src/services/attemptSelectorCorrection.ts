import { Page } from 'puppeteer';
import { generateWithRetry } from './geminiService';
import { cleanHtmlForAnalysis } from '../utils/htmlUtils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tenta corrigir um seletor de CSS quebrado usando a IA para analisar o HTML da página.
 * @param page A instância da página do Puppeteer com o conteúdo que falhou.
 * @param context Informações sobre a falha para a IA entender o objetivo.
 * @returns O novo seletor de CSS corrigido, ou null se a correção falhar.
 */
export async function attemptSelectorCorrection(page: Page, goal: string): Promise<string | null> {
    console.warn(`\n--- 🤖 INICIANDO CICLO DE AUTO-CORREÇÃO ---`);
    console.warn(`- Objetivo: ${goal}`);
    try {
        const cleanedHtml = cleanHtmlForAnalysis(await page.content());
        const prompt = `
          **TAREFA:** Você é um Engenheiro de Scraping Sênior. Um seletor de CSS quebrou. Analise o HTML de uma página e me forneça um novo seletor de CSS robusto para atingir meu objetivo.

          **CONTEXTO:**
          - Meu objetivo é: "${goal}".
          - O seletor antigo falhou (não encontrou nenhum elemento).

          **HTML LIMPO DA PÁGINA PARA ANÁLISE (ATÉ 30K CARACTERES):**
          \`\`\`html
          ${cleanedHtml.substring(0, 30000)} 
          \`\`\`

          **INSTRUÇÕES:**
          1.  Analise o HTML para entender a estrutura da página.
          2.  Crie o seletor de CSS mais específico e estável possível para encontrar os elementos descritos no meu objetivo.
          3.  Sua resposta deve ser **APENAS O SELETOR DE CSS**, em uma única linha, sem explicações ou markdown.
        `;

        const correctedSelector = await generateWithRetry(prompt);
        const finalSelector = correctedSelector.replace(/```(css)?/g, '').trim();

        if (finalSelector && finalSelector.length > 3 && !finalSelector.includes('\n')) {
            console.log(`- ✅ IA sugeriu um novo seletor: "${finalSelector}"`);
            return finalSelector;
        }
        console.error('- ❌ A IA retornou um seletor em formato inválido. Abortando correção.');
        return null;
    } catch (error) {
        console.error("- ❌ Erro catastrófico durante o processo de auto-correção:", error);
        return null;
    }
}