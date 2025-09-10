import { Page } from 'puppeteer';
import { CompanyEntry } from '../database';
import { generateWithRetryLite } from '../../../services/geminiService';

/**
 * Tenta encontrar um link de "Carreiras" na página.
 * @param page A instância da página do Puppeteer.
 * @returns A URL da página de carreiras ou null.
 */
async function findCareersLink(page: Page): Promise<string | null> {
    return page.evaluate(() => {
        const keywords = /(career|jobs|vagas|work with us|trabalhe conosco|join us|opportunities)/i;
        const link = Array.from(document.querySelectorAll('a')).find(a => keywords.test(a.textContent || ''));
        return link ? new URL(link.href, document.baseURI).href : null;
    });
}

/**
 * Usa IA para verificar se o texto de uma página contém vagas de TI.
 * @param pageText O texto da página a ser analisado.
 * @returns True se vagas de TI forem encontradas, false caso contrário.
 */
async function analyzePageForTechJobs(pageText: string): Promise<{ hasTechJobs: boolean; reason: string }> {
    const prompt = `
      Analise o texto de uma página de site e me diga se ela contém menções claras a vagas ou times nas áreas de Engenharia, Software, Produto, ou Dados.
      Responda apenas com um JSON: {"hasTechJobs": boolean, "reason": "Justificativa curta, citando os cargos encontrados se houver"}.

      Texto da página (primeiros 5000 caracteres):
      "${pageText.substring(0, 5000)}"
    `;
    try {
        const response = await generateWithRetryLite(prompt);
        return JSON.parse(response.replace(/```json|```/g, '').trim());
    } catch (e) {
        console.error("  - ❌ Erro na análise de vagas pela IA.");
        return { hasTechJobs: false, reason: "Falha na API da IA." };
    }
}

/**
 * Qualifica uma empresa usando uma estratégia de duas camadas.
 */
export async function qualifyCompany(page: Page, company: CompanyEntry): Promise<Partial<CompanyEntry> & { isQualified: boolean }> {
    console.log(`[Qualificação] Analisando ${company.name} para vagas de TI...`);

    try {
        await page.goto(`https://${company.domain}`, { waitUntil: 'networkidle2', timeout: 60000 });

        // --- CAMADA 1: Tenta encontrar uma página de "Carreiras" dedicada ---
        const careersUrl = await findCareersLink(page);

        if (careersUrl) {
            console.log(`  - Etapa 1: Página de carreiras encontrada: ${careersUrl}. Analisando conteúdo...`);
            await page.goto(careersUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            const careersPageText = await page.evaluate(() => document.body.innerText);
            const analysis = await analyzePageForTechJobs(careersPageText);

            if (analysis.hasTechJobs) {
                console.log(`  - ✅ [Qualificada] IA confirmou vagas de TI na página de carreiras. Razão: ${analysis.reason}`);
                return { isQualified: true, careersUrl };
            }
        }

        // --- CAMADA 2: Fallback - Analisa a página inicial ---
        console.log(`  - Etapa 2: Nenhuma vaga encontrada em "Carreiras" ou link não existe. Analisando a página inicial...`);
        await page.goto(`https://${company.domain}`, { waitUntil: 'networkidle2', timeout: 60000 }); // Garante que estamos na home
        const homePageText = await page.evaluate(() => document.body.innerText);
        const homeAnalysis = await analyzePageForTechJobs(homePageText);

        if (homeAnalysis.hasTechJobs) {
            console.log(`  - ✅ [Qualificada] IA confirmou vagas de TI na PÁGINA INICIAL. Razão: ${homeAnalysis.reason}`);
            // Usa a URL da home como "careersUrl", já que as vagas estão lá
            return { isQualified: true, careersUrl: page.url() };
        }

        console.log(`  - ❌ [Rejeitada] Nenhuma evidência de vagas de TI encontrada no site.`);
        return { isQualified: false };

    } catch (error: any) {
        console.error(`[Qualificação] Erro crítico ao processar ${company.domain}: ${error.message}`);
        return { isQualified: false };
    }
}

