import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from "../discovery.interface";
import {attemptSelectorCorrection} from "../../../../services/attemptSelectorCorrection";


/**
 * Lógica de extração blindada. Um card quebrado não quebra a coleta inteira.
 */
async function scrapeCompanies(page: Page, selector: string): Promise<DiscoveredCompany[]> {
    try {
        await page.waitForSelector(selector, { timeout: 15000 });
        // @ts-ignore
        return page.$$eval(selector, (elements, nameSelector) =>
                elements.map(el => {
                    try {
                        const name = el.querySelector(nameSelector)?.textContent?.trim() || '';
                        const href = (el as HTMLAnchorElement).href;
                        if (!href || !href.startsWith('http')) return null;
                        const domain = new URL(href).hostname.replace('www.', '');
                        return { name, domain };
                    } catch (e) { return null; }
                }).filter(c => c && c.name && c.domain && !c.domain.includes('a16z.com')),
            selectors.companyName
        );
    } catch (e) { return []; }
}

export async function fetchA16ZCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/A16Z] Buscando portfólio completo...`);
    try {
        await page.goto('https://a16z.com/portfolio/', { waitUntil: 'networkidle2', timeout: 90000 });
        for (let i = 0; i < 30; i++) { // Scroll robusto
            const previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await humanizedWait(page, 1500, 2500);
            if (previousHeight === await page.evaluate('document.body.scrollHeight')) break;
        }

        let companies = await scrapeCompanies(page, selectors.companyLink);

        // LÓGICA DE AUTO-CORREÇÃO E RETENTATIVA
        if (companies.length === 0) {
            console.warn(`[A16Z] Seletor inicial falhou. Acionando auto-correção...`);
            const newSelector = await attemptSelectorCorrection(page, "Encontrar o link de cada empresa no portfólio (o elemento 'a' que engloba o card)");
            if (newSelector) {
                console.log(`[A16Z] Tentando novamente com o seletor da IA: "${newSelector}"`);
                companies = await scrapeCompanies(page, newSelector);
            }
        }

        console.log(`[Discovery/A16Z] Encontradas ${companies.length} empresas.`);
        return companies;
    } catch (error: any) {
        console.error(`[Discovery/A16Z] Falha crítica ao buscar empresas: ${error.message}`);
        return [];
    }
}