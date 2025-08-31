// src/scrapers/weworkremotely/fetcher.ts
import { Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import initialSelectors from './selectors'; // Importa os seletores iniciais e para tipagem
import { humanizedWait } from "../../utils/humanization";
import { JobData } from '../../core/jobProcessor';
import { attemptSelfCorrection } from '../../services/selfCorrectionService';

// Helper para extrair dados de forma segura, agora recebe os seletores como argumento
async function safeExtract(page: Page, selectors: any, selectorKey: string, goal: string): Promise<string> {
    const selector = selectors[selectorKey];
    if (!selector) {
        throw new Error(`SelectorError: Chave de seletor "${selectorKey}" não encontrada no objeto de seletores.`);
    }
    try {
        await page.waitForSelector(selector, { timeout: 7000 });
        const content = await page.$eval(selector, (el) =>
            (el instanceof HTMLElement) ? el.innerText : el.textContent
        );
        return content?.trim() ?? '';
    } catch (error) {
        throw new Error(`SelectorError: Falha ao tentar "${goal}" com a chave "${selectorKey}" (seletor: "${selector}")`);
    }
}

export async function* fetchWWRJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
    // ... (início da função, busca de links, etc. - sem alterações)
    const BASE_URL = 'https://weworkremotely.com/remote-full-time-jobs';
    console.log(`Buscando vagas em: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(initialSelectors.jobSection, { timeout: 15000 });

    const jobLinks = await page.$$eval(initialSelectors.jobListItem, (links) =>
        links.map(a => (a as HTMLAnchorElement).href)
    );
    console.log(`[WWR] Encontrados ${jobLinks.length} links de vagas.`);

    for (const link of jobLinks) {
        // ... (lógica de normalizar e pular URL sem alterações)
        const urlObject = new URL(link);
        const normalizedUrl = `${urlObject.origin}${urlObject.pathname}`;
        if (processedUrls.has(normalizedUrl)) continue;

        // << LÓGICA DE TENTATIVAS E AUTO-CORREÇÃO >>
        let success = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 5;
        let currentSelectors = initialSelectors; // Começa com os seletores importados
        const originalSelectorsPath = path.resolve(__dirname, 'selectors.ts');
        let tempSelectorsPath: string | null = null;

        while (attempts < MAX_ATTEMPTS && !success) {
            attempts++;
            try {
                await humanizedWait(page, 2000, 4000);
                await page.goto(link, { waitUntil: 'domcontentloaded' });

                const title = await safeExtract(page, currentSelectors, 'jobTitle', 'extrair o título da vaga');
                const company = await safeExtract(page, currentSelectors, 'companyName', 'extrair o nome da empresa');
                const description = await safeExtract(page, currentSelectors, 'jobDescription', 'extrair a descrição da vaga');

                yield { url: link, title, company, description };
                success = true;

            } catch (error: any) {
                console.warn(`- [WWR] Tentativa ${attempts}/${MAX_ATTEMPTS} falhou para a vaga ${link}: ${error.message}`);

                if (error.message.startsWith('SelectorError:')) {
                    const brokenSelectorKey = error.message.match(/chave "([^"]+)"/)?.[1] || 'unknown';

                    // Tenta a auto-correção
                    const newTempPath = await attemptSelfCorrection(page, {
                        siteName: 'We Work Remotely',
                        failedUrl: link,
                        goal: error.message,
                        brokenSelectorKey,
                        selectorsFilePath: tempSelectorsPath || originalSelectorsPath // Usa o último temp ou o original
                    });

                    if (newTempPath) {
                        // Se um arquivo temporário anterior falhou, apague-o
                        if (tempSelectorsPath) fs.unlinkSync(tempSelectorsPath);

                        tempSelectorsPath = newTempPath;
                        // Carrega dinamicamente os novos seletores do arquivo temporário
                        delete require.cache[require.resolve(tempSelectorsPath)];
                        currentSelectors = require(tempSelectorsPath).default;
                        console.log(`- Tentando novamente com os seletores corrigidos de ${path.basename(tempSelectorsPath)}...`);
                    } else {
                        // Se a IA não conseguiu corrigir, desiste desta vaga
                        break;
                    }
                } else {
                    // Se o erro não for de seletor, desiste desta vaga
                    break;
                }
            }
        }

        // << LÓGICA DE PROMOÇÃO E LIMPEZA >>
        if (success && tempSelectorsPath) {
            console.log(`- ✅ Correção bem-sucedida! Promovendo ${path.basename(tempSelectorsPath)} para o original...`);
            const correctedContent = fs.readFileSync(tempSelectorsPath, 'utf-8');
            fs.writeFileSync(originalSelectorsPath, correctedContent);
            fs.unlinkSync(tempSelectorsPath); // Limpa o arquivo temp
        } else if (tempSelectorsPath) {
            console.log(`- ❌ Correção não funcionou. Descartando ${path.basename(tempSelectorsPath)}.`);
            fs.unlinkSync(tempSelectorsPath); // Limpa o arquivo temp
        }

        if (!success) {
            console.error(`- ❌ Falha final ao processar a vaga em ${link} após ${MAX_ATTEMPTS} tentativas.`);
        }
    }
}