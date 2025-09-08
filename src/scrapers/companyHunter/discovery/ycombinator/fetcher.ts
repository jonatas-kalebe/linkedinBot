import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from '../../../../utils/humanization';
import { DiscoveredCompany } from "../discovery.interface"; // Ajuste o caminho se necessário

export async function fetchYCombinatorCompanies(page: Page): Promise<DiscoveredCompany[]> {
    console.log(`[Discovery/YC] Buscando empresas em Y Combinator...`);
    const YC_URL = 'https://www.ycombinator.com/companies';
    try {
        // Define um User-Agent de um navegador real
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');

        await page.goto(YC_URL, {
            waitUntil: 'networkidle2',
            timeout: 90000 // Aumenta o timeout para 90 segundos
        });

        // Espera um pouco para qualquer script de detecção de bot rodar e se acalmar
        await humanizedWait(page, 4000, 6000);

        // Lógica para lidar com banner de cookies (se existir)
        // const cookieButton = await page.$(selectors.cookieButton);
        // if (cookieButton) {
        //     console.log('[Discovery/YC] Banner de cookies encontrado. Clicando para dispensar...');
        //     await cookieButton.click();
        //     await humanizedWait(page, 2000, 3000);
        // }

        // Scroll mais lento e humano para carregar o conteúdo "infinite scroll"
        console.log('[Discovery/YC] Rolando a página para carregar mais empresas...');
        for (let i = 0; i < 3; i++) { // Rola 3 vezes para pegar uma boa quantidade
            await page.evaluate('window.scrollBy(0, window.innerHeight * 2)');
            await humanizedWait(page, 2500, 4000);
        }

        // Extrai os dados
        const companies = await page.$$eval(selectors.companyCard, (elements, nameSelector) => {
            return elements.map(el => {
                const nameElement = el.querySelector(nameSelector);
                const name = nameElement ? nameElement.textContent?.trim() || '' : '';
                const href = (el as HTMLAnchorElement).href;
                let domain = '';
                if (href) {
                    try {
                        domain = new URL(href).hostname.replace('www.', '');
                    } catch (e) { /* ignora */ }
                }
                return { name, domain };
            }).filter(c => c.name && c.domain);
        }, selectors.companyName);

        if (companies.length === 0) {
            console.warn('[Discovery/YC] Nenhum empresa encontrada. O seletor pode ter mudado ou o site bloqueou a extração.');
            return [];
        }

        console.log(`[Discovery/YC] Encontradas ${companies.length} empresas.`);
        return companies;

    } catch (error: any) {
        console.error(`[Discovery/YC] Falha ao buscar empresas: ${error.message}`);
        // Tira um screenshot em caso de erro para facilitar a depuração
        await page.screenshot({ path: 'error_yc_discovery.png', fullPage: true });
        console.log('Screenshot do erro salvo em error_yc_discovery.png');
        return [];
    }
}