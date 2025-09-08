import { Page } from 'puppeteer';
import selectors from './selectors';

import { humanizedWait } from '../../../../utils/humanization';
import {DiscoveredCompany} from "../discovery.interface";

/**
 * Busca no portfólio da A16Z e extrai uma lista de empresas.
 * @param page A instância da página do Puppeteer.
 * @returns Uma promessa que resolve para um array de empresas descobertas.
 */
export async function fetchA16ZCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/A16Z] Buscando empresas no portfólio da A16Z...`);
    try {
        await page.goto('https://a16z.com/portfolio/', { waitUntil: 'networkidle2' });
        await humanizedWait(page, 1500, 2500);

        const companies = await page.$$eval(selectors.companyLink, (elements, nameSelector) =>
                elements.map(el => {
                    const name = el.querySelector(nameSelector)?.textContent?.trim() || '';
                    const href = (el as HTMLAnchorElement).href;
                    let domain = '';
                    if (href) {
                        try {
                            domain = new URL(href).hostname.replace('www.', '');
                        } catch (e) {
                            // Ignora links inválidos
                        }
                    }
                    return { name, domain };
                }).filter(c =>
                    c.name &&
                    c.domain &&
                    !c.domain.includes('a16z.com') // Filtra links internos
                )
            , selectors.companyName); // Passa o seletor de nome como argumento

        console.log(`[Discovery/A16Z] Encontradas ${companies.length} empresas.`);
        return companies;

    } catch (error: any) {
        console.error(`[Discovery/A16Z] Falha ao buscar empresas: ${error.message}`);
        return [];
    }
}