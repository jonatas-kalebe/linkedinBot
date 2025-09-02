import { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../config';
import initialSelectors from './selectors';
import { humanizedWait } from "../../utils/humanization";
import { JobData } from '../../core/jobProcessor';
import { attemptSelfCorrection } from '../../services/selfCorrectionService';
import { safeExtract } from '../../utils/extractor';
import { cleanHtmlForAnalysisCheerio } from "../../utils/htmlUtils";

// Tipos para clareza
type Selectors = Record<string, string>;
interface CorrectionResult {
    path: string;
    selectors: Selectors;
}

/**
 * Salva o HTML de uma página para análise em caso de erro.
 */
async function saveErrorHtml(page: Page, fileName: string): Promise<void> {
    try {
        const pageContent = await page.content();
        const cleanedHtml = cleanHtmlForAnalysisCheerio(pageContent);
        const outputPath = path.resolve(__dirname, fileName);
        fs.writeFileSync(outputPath, cleanedHtml);
        console.log(`- ✅ HTML de depuração salvo em: ${outputPath}`);
    } catch (saveError: any) {
        console.error(`- ❌ Falha ao tentar salvar o HTML de depuração: ${saveError.message}`);
    }
}

/**
 * Extrai todos os links de vagas de uma página de busca.
 */
async function getJobLinksFromSearchPage(page: Page, searchUrl: string): Promise<string[]> {
    console.log(`\n[Remotive] Buscando links em: ${searchUrl}`);
    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await humanizedWait(page, 2000, 3000);
        await page.waitForSelector(initialSelectors.jobListItemLink, { timeout: 20000 });

        const jobLinks = await page.$$eval(initialSelectors.jobListItemLink, (links) =>
            [...new Set(links.map(a => (a as HTMLAnchorElement).href))]
        );

        console.log(`- Encontrados ${jobLinks.length} links para processar.`);
        return jobLinks;
    } catch (error) {
        console.warn(`- ⚠️ [Remotive] Falha ao buscar links. Salvando HTML para análise...`);
        await saveErrorHtml(page, 'remotive_search_error.html');
        return []; // Retorna um array vazio para não quebrar o fluxo principal
    }
}

/**
 * Raspa os detalhes de uma única vaga, com lógica de retentativa e autocorreção.
 */
async function scrapeJobDetails(page: Page, link: string): Promise<Omit<JobData, 'source'> | null> {
    let currentSelectors: Selectors = initialSelectors;
    const originalSelectorsPath = path.resolve(__dirname, 'selectors.ts');
    let tempSelectorsPath: string | null = null;

    for (let attempts = 1; attempts <= 3; attempts++) {
        try {
            await humanizedWait(page, 2000, 4000);
            await page.goto(link, { waitUntil: 'domcontentloaded' });

            const title = await safeExtract(page, currentSelectors, 'jobTitle', 'extrair título');
            const company = await safeExtract(page, currentSelectors, 'companyName', 'extrair empresa');
            const description = await safeExtract(page, currentSelectors, 'jobDescription', 'extrair descrição');

            // Sucesso! Promove a correção (se houver) e retorna os dados.
            if (tempSelectorsPath) {
                fs.writeFileSync(originalSelectorsPath, fs.readFileSync(tempSelectorsPath, 'utf-8'));
                console.log(`- ✅ Correção da IA promovida para o arquivo original!`);
                fs.unlinkSync(tempSelectorsPath);
            }
            return { url: link, title, company, description };

        } catch (error: any) {
            console.warn(`- [Remotive] Tentativa ${attempts}/3 falhou para ${link.substring(0, 70)}...`);
            if (error.message.startsWith('SelectorError:') && attempts < 3) {
                const brokenSelectorKey = error.message.match(/chave "([^"]+)"/)?.[1] || 'unknown';

                const correctionResult: CorrectionResult | null = await attemptSelfCorrection(page, {
                    siteName: 'Remotive', failedUrl: link, goal: error.message, brokenSelectorKey,
                    selectorsFilePath: tempSelectorsPath || originalSelectorsPath
                });

                if (correctionResult) {
                    if (tempSelectorsPath) fs.unlinkSync(tempSelectorsPath); // Limpa temp antigo
                    tempSelectorsPath = correctionResult.path;
                    currentSelectors = correctionResult.selectors;
                    console.log(`- Tentando novamente com seletores corrigidos pela IA...`);
                } else {
                    break; // IA não conseguiu corrigir, desiste das retentativas
                }
            } else {
                break; // Erro não é de seletor ou já esgotou tentativas
            }
        }
    }

    // Se chegou até aqui, todas as tentativas falharam. Limpa arquivos temporários.
    if (tempSelectorsPath) {
        console.log(`- ❌ Correção da IA não funcionou. Descartando arquivo temporário.`);
        fs.unlinkSync(tempSelectorsPath);
    }
    return null;
}


/**
 * Função principal (Gerador) que orquestra a raspagem de vagas do Remotive.
 */
export async function* fetchRemotiveJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const BASE_URL = 'https://remotive.com/remote-jobs/software-dev';

    for (const search of config.REMOTIVE_SEARCHES) {
        const params = new URLSearchParams();
        if (search.tags) params.set('tags', search.tags);
        if (search.locations) params.set('locations', search.locations);
        const searchUrl = `${BASE_URL}?${params.toString()}`;

        const jobLinks = await getJobLinksFromSearchPage(page, searchUrl);

        for (const link of jobLinks) {
            const normalizedUrl = new URL(link).origin + new URL(link).pathname;
            if (processedUrls.has(normalizedUrl)) {
                console.log(`- Pulando vaga já processada: ${link.substring(0, 70)}...`);
                continue;
            }

            const jobDetails = await scrapeJobDetails(page, link);
            if (jobDetails) {
                yield jobDetails;
            }
        }
        console.log(`- ✅ Análise da busca finalizada.`);
        await humanizedWait(page, 4000, 8000);
    }
}