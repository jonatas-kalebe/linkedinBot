import {Page} from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../config';
import initialSelectors from './selectors';
import {humanizedWait} from "../../utils/humanization";
import {JobData} from '../../core/jobProcessor';
import {attemptSelfCorrection} from '../../services/selfCorrectionService';
import {safeExtract} from "../../utils/extractor";


export async function* fetchRemoteOKJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const BASE_URL = 'https://remoteok.com/remote-';

    for (const query of config.REMOKEOK_SEARCH_QUERIES) {
        const searchTerm = query.toLowerCase().replace(/\s+/g, '-');
        const searchUrl = `${BASE_URL}${searchTerm}-jobs`;
        console.log(`\n[RemoteOK] Iniciando busca por "${query}" em: ${searchUrl}`);

        let jobLinksForThisQuery: string[] = [];
        try {
            await page.goto(searchUrl, {waitUntil: 'domcontentloaded', timeout: 60000});
            console.log('-- Dando tempo para a verificação anti-bot do Cloudflare...');
            await humanizedWait(page, 8000, 12000);
            await page.waitForSelector(initialSelectors.jobListRow, {timeout: 15000});

            jobLinksForThisQuery = await page.$$eval(initialSelectors.jobListRow, (rows) =>
                rows.map(row => {
                    const linkElement = row.querySelector('a.preventLink');
                    return linkElement ? `https://remoteok.com${linkElement.getAttribute('href')}` : null;
                }).filter((link): link is string => link !== null)
            );

            if (jobLinksForThisQuery.length === 0) {
                console.log(`- Nenhuma vaga encontrada para "${query}".`);
                continue;
            }
            console.log(`- Encontrados ${jobLinksForThisQuery.length} links para "${query}". Iniciando processamento...`);

        } catch (error) {
            console.warn(`- ⚠️ [RemoteOK] Busca por "${query}" falhou. Provavelmente devido a um bloqueio anti-bot.`);
            continue;
        }

        for (const link of jobLinksForThisQuery) {
            const normalizedUrl = new URL(link).origin + new URL(link).pathname;
            if (processedUrls.has(normalizedUrl)) {
                console.log(`-- Pulando vaga já processada: ${link.substring(0, 70)}...`);
                continue;
            }

            let success = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 3;
            let currentSelectors = initialSelectors;
            const originalSelectorsPath = path.resolve(__dirname, 'selectors.ts');
            let tempSelectorsPath: string | null = null;

            while (attempts < MAX_ATTEMPTS && !success) {
                attempts++;
                try {
                    await humanizedWait(page, 2500, 5000);
                    await page.goto(link, {waitUntil: 'domcontentloaded'});

                    const title = await safeExtract(page, currentSelectors, 'jobTitle', 'extrair título');
                    const company = await safeExtract(page, currentSelectors, 'companyName', 'extrair empresa');
                    const description = await safeExtract(page, currentSelectors, 'jobDescription', 'extrair descrição');

                    yield {url: link, title, company, description};
                    success = true;

                } catch (error: any) {
                    console.warn(`- [RemoteOK] Tentativa ${attempts}/${MAX_ATTEMPTS} falhou para ${link.substring(0, 70)}...: ${error.message}`);

                    if (error.message.startsWith('SelectorError:') && attempts < MAX_ATTEMPTS) {
                        const brokenSelectorKey = error.message.match(/chave "([^"]+)"/)?.[1] || 'unknown';

                        // << CORREÇÃO PRINCIPAL AQUI >>
                        // @ts-ignore
                        const correctionResult = await attemptSelfCorrection(page, {
                            siteName: 'RemoteOK', failedUrl: link, goal: error.message, brokenSelectorKey,
                            selectorsFilePath: tempSelectorsPath || originalSelectorsPath
                        });

                        // Agora verificamos o objeto de resultado, não apenas o caminho
                        if (correctionResult) {
                            if (tempSelectorsPath) fs.unlinkSync(tempSelectorsPath); // Limpa o temp antigo

                            tempSelectorsPath = correctionResult.path;        // Salva o caminho para promover depois
                            currentSelectors = correctionResult.selectors;    // Usa o objeto de seletores DIRETAMENTE

                            console.log(`- Tentando novamente com seletores corrigidos pela IA...`);
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }

            if (success && tempSelectorsPath) {
                console.log(`- ✅ Correção da IA bem-sucedida! Promovendo para o arquivo original...`);
                const correctedContent = fs.readFileSync(tempSelectorsPath, 'utf-8');
                fs.writeFileSync(originalSelectorsPath, correctedContent);
                fs.unlinkSync(tempSelectorsPath);
            } else if (tempSelectorsPath) {
                console.log(`- ❌ Correção da IA não funcionou. Descartando arquivo temporário.`);
                fs.unlinkSync(tempSelectorsPath);
            }

            if (!success) {
                console.error(`- ❌ Falha final ao processar a vaga em ${link} após ${MAX_ATTEMPTS} tentativas.`);
            }
        }

        console.log(`- ✅ Análise para a busca "${query}" finalizada.`);
        console.log("-- Pausa para simular comportamento humano antes da próxima busca...");
        await humanizedWait(page, 5000, 10000);
    }
}