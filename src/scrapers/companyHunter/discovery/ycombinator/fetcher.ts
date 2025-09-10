import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from '../discovery.interface';
import {attemptSelectorCorrection} from "../../../../services/attemptSelectorCorrection";

const YC_URL = 'https://www.ycombinator.com/companies?isHiring=true';

async function scrapeYCCompanies(page: Page, selector: string): Promise<DiscoveredCompany[]> {
    try {
        await page.waitForSelector(selector, { timeout: 15000 });
        // @ts-ignore
        return page.$$eval(selector, (elements, nameSelector) =>
                elements.map(el => {
                    try {
                        const name = el.querySelector(nameSelector)?.textContent?.trim() || '';
                        const websiteLinkElement = el.parentElement?.querySelectorAll('a')[1];
                        let domain = '';
                        if (websiteLinkElement?.href && !websiteLinkElement.href.includes('ycombinator.com')) {
                            domain = new URL(websiteLinkElement.href).hostname.replace(/^www\./, '');
                        }
                        return { name, domain };
                    } catch (e) { return null; }
                }).filter(c => c && c.name && c.domain),
            selectors.companyName
        );
    } catch (e) { return []; }
}

export async function fetchYCombinatorCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/YC] Buscando startups dos batches mais recentes...`);
    try {
        await page.goto(YC_URL, { waitUntil: 'networkidle2', timeout: 90000 });
        for (let i = 0; i < 20; i++) {
            const previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await humanizedWait(page, 1000, 2000);
            if (previousHeight === await page.evaluate('document.body.scrollHeight')) break;
        }

        let companies = await scrapeYCCompanies(page, selectors.companyCard);

        if (companies.length === 0) {
            console.warn(`[YC] Seletor inicial falhou. Acionando auto-correção...`);
            const newSelector = await attemptSelectorCorrection(page, "Encontrar o link principal de cada empresa na lista (o elemento 'a' que leva ao perfil da empresa)");
            if (newSelector) {
                console.log(`[YC] Tentando novamente com o seletor da IA: "${newSelector}"`);
                companies = await scrapeYCCompanies(page, newSelector);
            }
        }

        console.log(`[Discovery/YC] Encontradas ${companies.length} startups recentes.`);
        return companies;
    } catch (error: any) {
        console.error(`[Discovery/YC] Falha crítica ao buscar startups: ${error.message}`);
        return [];
    }
}