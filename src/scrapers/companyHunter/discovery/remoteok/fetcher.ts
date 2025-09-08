import { Page } from 'puppeteer';
import selectors from './selectors';

import { humanizedWait } from '../../../../utils/humanization';
import {DiscoveredCompany} from "../discovery.interface";


export async function fetchRemoteOkCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/RemoteOK] Espionando empresas no RemoteOK...`);
    try {
        await page.goto('https://remoteok.com/remote-companies', { waitUntil: 'networkidle2' });
        await humanizedWait(page, 2000, 3000);

        const names = await page.$$eval(selectors.companyName, elements =>
            elements.map(el => el.textContent?.trim() || '')
        );

        // Aplica a heurística para inferir o domínio a partir do nome da empresa.
        // Ex: "Digital Ocean" -> "digitalocean.com"
        const companies = names.map(name => ({
            name,
            domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`
        }));

        console.log(`[Discovery/RemoteOK] Encontradas ${companies.length} empresas.`);
        return companies;

    } catch (error: any) {
        console.error(`[Discovery/RemoteOK] Falha ao buscar empresas: ${error.message}`);
        return [];
    }
}