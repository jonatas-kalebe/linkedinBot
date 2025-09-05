import {Page} from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../config';
import initialSelectors from './selectors';
import {humanizedWait} from "../../utils/humanization";
import {JobData} from '../../core/jobProcessor';
import {attemptSelfCorrection} from '../../services/selfCorrectionService';
import {saveProcessedJob} from '../../core/fileManager';
import {safeExtract} from '../../utils/extractor';

export async function* fetchProgramathorJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<Omit<JobData, 'source'>> {
    const BASE_URL = 'https://programathor.com.br';

    let pesquisas = config.PROGRAMATHOR_SEARCHES.sort(() => 0.5 - Math.random());

    for (const search of pesquisas) {
        const pathKeyword = search.keyword.toLowerCase().replace(/\s+/g, '-');
        const params = new URLSearchParams();
        if (search.contract) params.set('contract_type', search.contract);
        if (search.expertise) params.set('expertise', search.expertise);

        const searchUrl = `${BASE_URL}/jobs-${pathKeyword}/remoto?${params.toString()}`;
        console.log(`\n[Programathor] Iniciando busca avançada em: ${searchUrl}`);

        let newLinksToProcess: string[] = [];
        try {
            await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});
            await page.waitForSelector(initialSelectors.jobListItemContainer, {timeout: 15000});

            const jobCandidates = await page.$$eval(initialSelectors.jobListItemContainer, (items, selectors) => {
                return items
                    .filter(item => !item.querySelector('ins.adsbygoogle')).map(item => ({
                        link: (item.querySelector(selectors.jobLinkInListItem) as HTMLAnchorElement)?.href || null,
                        isExpired: item.querySelector(selectors.expiredTagInListItem) !== null,
                    }));
            }, {
                jobLinkInListItem: initialSelectors.jobLinkInListItem,
                expiredTagInListItem: initialSelectors.expiredTagInListItem
            });

            console.log(`- Encontrados ${jobCandidates.length} cards de vagas.`);

            for (const candidate of jobCandidates) {
                if (!candidate.link) continue;
                const normalizedUrl = new URL(candidate.link).origin + new URL(candidate.link).pathname;
                if (processedUrls.has(normalizedUrl)) continue;

                if (candidate.isExpired) {
                    saveProcessedJob(candidate.link, 'Programathor');
                } else {
                    newLinksToProcess.push(candidate.link);
                }
            }

            if (newLinksToProcess.length === 0) {
                console.log(`- Nenhuma vaga NOVA E VÁLIDA encontrada para esta busca.`);
                continue;
            }
            console.log(`- Das encontradas, ${newLinksToProcess.length} são novas e válidas. Iniciando processamento...`);

        } catch (error) {
            console.warn(`- ⚠️ [Programathor] Busca falhou ou não retornou resultados.`);
            continue;
        }

        for (const link of newLinksToProcess) {
            try {
                let success = false;
                let attempts = 0;
                const MAX_ATTEMPTS = 3;
                let currentSelectors = initialSelectors;
                const originalSelectorsPath = path.resolve(__dirname, 'selectors.ts');
                let tempSelectorsPath: string | null = null;

                while (attempts < MAX_ATTEMPTS && !success) {
                    attempts++;
                    try {
                        await humanizedWait(page, 2000, 4000);
                        await page.goto(link, {waitUntil: 'domcontentloaded'});

                        const title = await safeExtract(page, currentSelectors, 'jobTitle', 'extrair título');
                        const company = await safeExtract(page, currentSelectors, 'companyName', 'extrair empresa');
                        const description = await safeExtract(page, currentSelectors, 'jobDescription', 'extrair descrição');

                        yield {url: link, title, company, description};
                        success = true;

                    } catch (error: any) {
                        console.warn(`- [Programathor] Tentativa ${attempts}/${MAX_ATTEMPTS} falhou: ${error.message}`);
                        if (error.message.startsWith('SelectorError:') && attempts < MAX_ATTEMPTS) {
                            const brokenSelectorKey = error.message.match(/chave "([^"]+)"/)?.[1] || 'unknown';

                            // @ts-ignore
                            const correctionResult = await attemptSelfCorrection(page, {
                                siteName: 'Programathor', failedUrl: link, goal: error.message, brokenSelectorKey,
                                selectorsFilePath: tempSelectorsPath || originalSelectorsPath
                            });

                            if (correctionResult) {
                                if (tempSelectorsPath) fs.unlinkSync(tempSelectorsPath);

                                tempSelectorsPath = correctionResult.path;
                                currentSelectors = correctionResult.selectors;
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
                    const correctedContent = fs.readFileSync(tempSelectorsPath, 'utf-8');
                    fs.writeFileSync(originalSelectorsPath, correctedContent);
                    console.log(`- ✅ Correção da IA promovida para o arquivo original!`);
                    fs.unlinkSync(tempSelectorsPath);
                } else if (tempSelectorsPath) {
                    fs.unlinkSync(tempSelectorsPath);
                }

                if (!success) {
                    console.error(`- ❌ Falha final ao processar a vaga em ${link}.`);
                }

            } catch (error: any) {
                console.warn(`- ❌ [Programathor] Falha crítica ao navegar para ${link}: ${error.message.split('\n')[0]}`);
            }
        }

        console.log(`- ✅ Análise para a busca finalizada.`);
        await humanizedWait(page, 4000, 8000);
    }
}