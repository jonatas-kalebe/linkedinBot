// ARQUIVO: src/scrapers/companyHunter/discovery/a16z/fetcher.ts
import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from "../discovery.interface";

export async function fetchA16ZCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/A16Z] Buscando portfólio completo (com scroll)...`);
    try {
        await page.goto('https://a16z.com/portfolio/', { waitUntil: 'networkidle2', timeout: 90000 });
        let previousHeight;
        while (true) {
            previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await humanizedWait(page, 2000, 4000);
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === previousHeight) break;
        }
        const companies = await page.$$eval(selectors.companyLink, (elements, nameSelector) =>
                elements.map(el => {
                    const name = el.querySelector(nameSelector)?.textContent?.trim() || '';
                    const domain = new URL((el as HTMLAnchorElement).href).hostname.replace('www.', '');
                    return { name, domain };
                }).filter(c => c.name && c.domain && !c.domain.includes('a16z.com'))
            , selectors.companyName);
        console.log(`[Discovery/A16Z] Encontradas ${companies.length} empresas.`);
        return companies;
    } catch (error: any) {
        console.error(`[Discovery/A16Z] Falha ao buscar empresas: ${error.message}`);
        return [];
    }
}