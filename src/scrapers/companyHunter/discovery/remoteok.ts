import { Page } from 'puppeteer';
import { DiscoveryModule, DiscoveredCompany } from './discovery.interface';

export const remoteOkDiscovery: DiscoveryModule = {
    name: 'RemoteOK',
    async discover(page: Page): Promise<DiscoveredCompany[]> {
        console.log(`[Discovery] Executando módulo: ${this.name}`);
        await page.goto('https://remoteok.com/remote-companies', { waitUntil: 'networkidle2' });
        const selector = 'a.company-card h2'; // Seletor para os nomes das empresas

        const names = await page.$$eval(selector, elements => elements.map(el => el.textContent?.trim() || ''));

        // No RemoteOK, o domínio não é explícito, então o inferimos a partir do nome
        // Isso é menos preciso, mas é uma boa heurística para "espionagem"
        return names.map(name => ({
            name,
            domain: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
        }));
    }
};