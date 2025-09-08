import { Page, HTTPResponse } from 'puppeteer';
import { CompanyEntry } from '../database';
// Removemos o 'import Wappalyzer from 'wappalyzer';' do topo
import type { Technology } from 'wappalyzer';

export async function gatherIntelligence(page: Page, company: CompanyEntry): Promise<Partial<CompanyEntry>> {
    console.log(`[Intelligence] Coletando dados para ${company.name}...`);
    const intelligence: Partial<CompanyEntry> = {};
    const url = `https://${company.domain}`;

    try {
        const response: HTTPResponse | null = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        if (!response) {
            throw new Error('A navegação não retornou uma resposta.');
        }

        const careersHandle = await page.evaluateHandle(() => {
            const selectors = ['a[href*="career"]', 'a[href*="jobs"]', 'a[href*="vagas"]'];
            const link = Array.from(document.querySelectorAll(selectors.join(',')))
                .find(l => /(career|jobs|vagas|work with us|trabalhe conosco)/i.test(l.textContent || ''));
            return link;
        });
        if (careersHandle.asElement()) {
            intelligence.careersUrl = await careersHandle.asElement()!.evaluate(el => (el as HTMLAnchorElement).href);
        }

        const pageText = await page.evaluate(() => document.body.innerText);
        intelligence.isRemoteFriendly = /(remote|distributed|work from anywhere)/i.test(pageText);

        // --- LÓGICA CORRIGIDA COM IMPORTAÇÃO DINÂMICA ---
        try {
            console.log(`[Wappalyzer Local] Analisando tecnologias para ${url}...`);

            // 1. Importa dinamicamente a classe Wappalyzer DENTRO da função
            const { default: Wappalyzer } = await import('wappalyzer');

            const wappalyzer = new Wappalyzer();
            await wappalyzer.init();

            const html = await page.content();
            const headers = response.headers();
            const finalUrl = page.url();

            const results = await wappalyzer.analyze({
                url: finalUrl,
                html: html,
                headers: headers,
            });

            if (results && results.technologies) {
                intelligence.techStack = results.technologies.map((tech: Technology) => tech.name);
            }

            await wappalyzer.destroy();
        } catch (wappalyzerError: any) {
            console.error(`[Wappalyzer Local] Erro ao analisar tecnologias: ${wappalyzerError.message}`);
        }
        // --- FIM DA LÓGICA CORRIGIDA ---

        console.log(`[Intelligence] Coleta finalizada para ${company.name}. URL de carreira: ${intelligence.careersUrl ? 'Sim' : 'Não'}`);
    } catch (error: any) {
        console.error(`[Intelligence] Erro ao processar ${company.domain}: ${error.message}`);
        intelligence.status = 'failed';
    }

    return intelligence;
}