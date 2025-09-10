// ARQUIVO: src/scrapers/companyHunter/intelligence/gatherer.ts

import { Page, HTTPResponse } from 'puppeteer';
import { CompanyEntry } from '../database';

/**
 * Coleta a inteligência mínima necessária: a URL da página de carreiras.
 */
export async function gatherIntelligence(page: Page, company: CompanyEntry): Promise<Partial<CompanyEntry>> {
    console.log(`[Intelligence] Buscando "Carreiras" ou e-mail de contato para ${company.name}...`);
    const intelligence: Partial<CompanyEntry> = {};
    const url = `https://${company.domain}`;

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // ETAPA 1: Tentar encontrar a página de Carreiras
        let careersUrl = await page.evaluate(() => {
            const selectors = ['a[href*="career"]', 'a[href*="jobs"]', 'a[href*="vagas"]', 'a[href*="work"]', 'a[href*="join"]'];
            const link = Array.from(document.querySelectorAll(selectors.join(',')))
                .find(l => /(career|jobs|vagas|work with us|trabalhe conosco|join us|opportunities)/i.test(l.textContent || ''));
            return link ? new URL((link as HTMLAnchorElement).href, document.baseURI).href : null;
        });

        if (careersUrl) {
            console.log(`  - ✅ Página de carreiras encontrada: ${careersUrl}`);
            intelligence.careersUrl = careersUrl;
        } else {
            // ETAPA 2: Fallback - Se não encontrou "Carreiras", procurar por e-mail
            console.log(`  - ⚠️  Página de "Carreiras" não encontrada. Procurando por e-mail de contato...`);
            const prospectEmail = await page.evaluate(() => {
                const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
                const priorityEmails = ['jobs@', 'careers@', 'contact@', 'hello@', 'support@'];

                for (const priority of priorityEmails) {
                    const foundLink = mailtoLinks.find(link => (link as HTMLAnchorElement).href.includes(priority));
                    if (foundLink) {
                        return (foundLink as HTMLAnchorElement).href.replace('mailto:', '');
                    }
                }
                // Se não achar um prioritário, retorna o primeiro que encontrar
                return mailtoLinks.length > 0 ? (mailtoLinks[0] as HTMLAnchorElement).href.replace('mailto:', '') : null;
            });

            if (prospectEmail) {
                console.log(`  - ✅ E-mail de prospecção encontrado: ${prospectEmail}`);
                intelligence.prospectEmail = prospectEmail;
            } else {
                console.log(`  - ❌ Nenhum link de "Carreiras" ou e-mail de contato encontrado para ${company.name}.`);
            }
        }

        return intelligence;

    } catch (error: any) {
        console.error(`[Intelligence] Erro ao processar ${company.domain}: ${error.message}`);
        throw error;
    }
}