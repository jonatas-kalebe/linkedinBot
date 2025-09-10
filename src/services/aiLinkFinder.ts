import { Page } from 'puppeteer';
import {generateWithRetryLite} from "./geminiService";
import {cleanHtmlForAnalysis} from "../utils/htmlUtils";


/**
 * Usa a IA para analisar o HTML de uma página de carreiras e encontrar os links para as vagas individuais.
 * @param page A instância da página do Puppeteer.
 * @param careersPageUrl A URL da página de carreiras, para contexto.
 * @returns Uma lista de URLs de vagas encontradas.
 */
export async function findJobLinksWithAI(page: Page, careersPageUrl: string): Promise<string[]> {
    console.log(`- 🤖 Usando IA para encontrar links de vagas em: ${careersPageUrl}`);
    try {
        const rawHtml = await page.content();
        const cleanedHtml = cleanHtmlForAnalysis(rawHtml);

        const prompt = `
          **TAREFA:** Você é um assistente especialista em analisar HTML de páginas de "Carreiras". Sua função é encontrar TODOS os links que levam a uma descrição de vaga de emprego INDIVIDUAL e ESPECÍFICA.

          **CONTEXTO:**
          - A página é: ${careersPageUrl}
          - O HTML abaixo é o conteúdo desta página.

          **INSTRUÇÕES CRÍTICAS:**
          1.  **FOCO EM VAGAS ESPECÍFICAS:** Procure por links cujo texto seja um cargo (ex: "Software Engineer", "Product Manager", "Desenvolvedor Backend").
          2.  **IGNORE LINKS GENÉRICOS:** Ignore links com textos como "View All Jobs", "Explore Careers", "Our Teams", "Locations", "Benefícios". O objetivo NÃO é encontrar a lista de vagas, mas sim os links DIRETOS para cada vaga individual a partir da lista.
          3.  **EXTRAIA O HREF COMPLETO:** Extraia o atributo \`href\` completo de cada link válido que encontrar.
          4.  **FORMATO DA RESPOSTA:** Sua resposta deve ser **APENAS UM OBJETO JSON VÁLIDO**.
          5.  A estrutura deve ser: { "jobUrls": ["https://.../job1", "https://.../job2", ...] }
          6.  Se nenhum link de vaga **específica** for encontrado, retorne um array vazio: { "jobUrls": [] }

          **HTML PARA ANÁLISE:**
          \`\`\`html
          ${cleanedHtml}
          \`\`\`
        `;

        const jsonResponse = await generateWithRetryLite(prompt);
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.jobUrls && Array.isArray(parsed.jobUrls)) {
            // SOLUÇÃO: Garante que todos os itens do array são strings e que as URLs são válidas.
            const validUrls = parsed.jobUrls
                .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
                .map((url: string) => {
                    try {
                        // Constrói a URL absoluta para tratar links relativos (ex: /jobs/123)
                        return new URL(url, careersPageUrl).href;
                    } catch (e) {
                        console.warn(`[IA] URL inválida retornada e ignorada: ${url}`);
                        return null; // Marca a URL inválida para remoção
                    }
                })
                // @ts-ignore
                .filter((url: null): url is string => url !== null); // Remove as URLs nulas/inválidas

            const uniqueUrls = [...new Set(validUrls)];
            console.log(`- ✅ IA encontrou ${uniqueUrls.length} links de vagas válidos.`);
            // @ts-ignore
            return uniqueUrls;
        }

        return [];
    } catch (error) {
        console.error(`- ❌ Erro ao usar IA para encontrar links de vagas:`, error);
        return [];
    }
}