// ARQUIVO: src/scrapers/companyHunter/discovery/ycombinator/fetcher.ts
import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from '../discovery.interface';

const YC_URL = 'https://www.ycombinator.com/companies?batch=W24&batch=S24';

export async function fetchYCombinatorCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/YC] Buscando startups dos batches mais recentes...`);
    try {
        await page.goto(YC_URL, { waitUntil: 'networkidle2', timeout: 90000 });
        let previousHeight;
        while (true) {
            previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await humanizedWait(page, 2000, 4000);
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === previousHeight) break;
        }
        const companies = await page.$$eval(selectors.companyCard, (elements, nameSelector) =>
                elements.map(el => {
                    const name = el.querySelector(nameSelector)?.textContent?.trim() || '';
                    const websiteLinkElement = el.parentElement?.querySelectorAll('a')[1];
                    let domain = '';
                    if (websiteLinkElement && websiteLinkElement.href && !websiteLinkElement.href.includes('ycombinator.com')) {
                        try { domain = new URL(websiteLinkElement.href).hostname.replace(/^www\./, ''); } catch {}
                    }
                    return { name, domain };
                }).filter(c => c.name && c.domain),
            selectors.companyName);
        console.log(`[Discovery/YC] Encontradas ${companies.length} startups.`);
        return companies;
    } catch (error: any) {
        console.error(`[Discovery/YC] Falha ao buscar startups: ${error.message}`);
        return [];
    }
}