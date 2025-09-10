import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from "../discovery.interface";

export async function fetchRemoteOkCompanies(page: Page): Promise<({ name: string; domain: string } | null)[]> {
    console.log(`[Discovery/RemoteOK] Espionando empresas...`);
    try {
        await page.goto('https://remoteok.com/remote-companies', { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector(selectors.companyCard, { timeout: 20000 });

        const companies = await page.$$eval(selectors.companyCard, (elements) =>
            elements.map(el => {
                try {
                    const name = el.querySelector('h2')?.textContent?.trim() || '';
                    // Heurística para o domínio, pois não há link direto
                    const domain = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
                    return { name, domain };
                } catch(e) { return null; }
            }).filter(c => c && c.name && c.domain)
        );
        console.log(`[Discovery/RemoteOK] Encontradas e inferidas ${companies.length} empresas.`);
        return companies;
    } catch (error: any) {
        console.error(`[Discovery/RemoteOK] Falha ao buscar empresas: ${error.message}`);
        return [];
    }
}