// ARQUIVO: src/services/aiLinkFinder.ts
import { Page } from 'puppeteer';
import { generateWithRetryLite } from "./geminiService";
import { cleanHtmlForAnalysis } from "../utils/htmlUtils";

/**
 * Usa uma IA SUPER FOCADA para encontrar links de vagas de TI individuais.
 */
export async function findJobLinksWithAI(page: Page, careersPageUrl: string): Promise<string[]> {
    console.log(`- 🤖 Usando IA para encontrar links de vagas de ENGENHARIA em: ${careersPageUrl}`);
    const rawHtml = await page.content();
    const cleanedHtml = cleanHtmlForAnalysis(rawHtml);

    const prompt = `
      **TAREFA:** Você é um especialista em scraping. Analise o HTML de uma página de "Carreiras" e encontre links para vagas de emprego INDIVIDUAIS e ESPECÍFICAS para áreas de TECNOLOGIA (Software Engineering, Backend, Frontend, Data Science, Product Management, DevOps).

      **INSTRUÇÕES CRÍTICAS:**
      1.  **FOCO ABSOLUTO:** Procure por links \`<a>\` cujo texto seja um cargo de TI.
      2.  **REJEITE PÁGINAS DE LISTA:** IGNORE links com textos genéricos como "View All Jobs", "Explore Careers", "Vagas Recomendadas", "Benefícios" ou links que levem a outra página de busca/filtro. O objetivo é o link da DESCRIÇÃO FINAL da vaga.
      3.  **EXTRAIA O HREF COMPLETO:** Extraia o atributo \`href\` de cada link válido.
      4.  **FORMATO DA RESPOSTA:** Responda APENAS com um objeto JSON.
      5.  **ESTRUTURA:** { "jobUrls": ["https://.../job/123", "https://.../vaga/456"] }
      6.  Se nenhum link de vaga de TI individual for encontrado, retorne: { "jobUrls": [] }

      **HTML PARA ANÁLISE:**
      \`\`\`html
      ${cleanedHtml}
      \`\`\`
    `;

    try {
        const jsonResponse = await generateWithRetryLite(prompt);
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        if (parsed.jobUrls && Array.isArray(parsed.jobUrls)) {
            const validUrls = parsed.jobUrls
                .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
                .map((url: string) => new URL(url, careersPageUrl).href);
            const uniqueUrls = [...new Set(validUrls)];
            console.log(`- ✅ IA encontrou ${uniqueUrls.length} links de vagas de TI individuais.`);
            // @ts-ignore
            return uniqueUrls;
        }
        return [];
    } catch (error) {
        console.error(`- ❌ Erro ao usar IA para encontrar links:`, error);
        return [];
    }
}