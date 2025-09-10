// ARQUIVO: src/services/aiLinkFinder.ts

import { Page } from 'puppeteer';
import { generateWithRetryLite } from "./geminiService";
import { cleanHtmlForAnalysis } from "../utils/htmlUtils";

/**
 * Usa a IA para analisar o HTML de uma página de carreiras e encontrar os links para as vagas de TI.
 */
export async function findJobLinksWithAI(page: Page, careersPageUrl: string): Promise<string[]> {
    console.log(`- 🤖 Usando IA para encontrar links de vagas de TI em: ${careersPageUrl}`);
    try {
        const rawHtml = await page.content();
        // Usamos uma limpeza mais leve para não destruir a estrutura dos links
        const cleanedHtml = cleanHtmlForAnalysis(rawHtml);

        const prompt = `
          **TAREFA:** Você é um especialista em scraping. Analise o HTML de uma página de "Carreiras" e encontre links para vagas de emprego de TECNOLOGIA (Software, Engenharia, Dados, Produto, Design).

          **CONTEXTO:**
          - A página é: ${careersPageUrl}
          - O HTML abaixo é o conteúdo desta página.

          **INSTRUÇÕES:**
          1.  **FOCO EM VAGAS DE TI:** Procure por links \`<a>\` cujo texto seja um cargo como "Software Engineer", "Product Manager", "Java Developer", "Data Scientist", etc.
          2.  **IGNORE O RESTO:** Ignore links de navegação como "About Us", "Blog", "Locations", "Vagas Administrativas", "Marketing", "Vendas".
          3.  **EXTRAIA O HREF COMPLETO:** Extraia o atributo \`href\` de cada link válido.
          4.  **FORMATO DA RESPOSTA:** Responda APENAS com um objeto JSON.
          5.  A estrutura deve ser: { "jobUrls": ["https://.../job1", "https://.../job2", ...] }
          6.  Se nenhum link de vaga de TI for encontrado, retorne um array vazio: { "jobUrls": [] }

          **HTML PARA ANÁLISE:**
          \`\`\`html
          ${cleanedHtml}
          \`\`\`
        `;

        const jsonResponse = await generateWithRetryLite(prompt);
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.jobUrls && Array.isArray(parsed.jobUrls)) {
            const validUrls = parsed.jobUrls
                .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
                .map((url: string) => new URL(url, careersPageUrl).href) // Garante que URLs relativas funcionem
                .filter((url: string | null): url is string => url !== null);

            const uniqueUrls = [...new Set(validUrls)];
            console.log(`- ✅ IA encontrou ${uniqueUrls.length} links de vagas de TI.`);
            // @ts-ignore
            return uniqueUrls;
        }
        return [];
    } catch (error) {
        console.error(`- ❌ Erro ao usar IA para encontrar links de vagas:`, error);
        return [];
    }
}