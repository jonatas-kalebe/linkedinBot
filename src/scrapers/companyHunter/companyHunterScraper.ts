import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { companyDB, CompanyEntry } from './database';
import { fetchYCombinatorCompanies } from './discovery/ycombinator/fetcher';

import { fetchRemoteOkCompanies } from './discovery/remoteok/fetcher';
import { gatherIntelligence } from './intelligence/gatherer';
import { extractJobDataWithAI } from './intelligence/aiExtractor';
import { humanizedWait } from '../../utils/humanization';
import {fetchA16ZCompanies} from "./discovery/a16z/fetcher";

// Variáveis de estado que persistem entre as chamadas do gerador
let discoveryHasRunInThisCycle = false;
let jobLinksToProcess: { company: CompanyEntry, url: string }[] = [];

export const companyHunterScraper: Scraper = {
    name: 'CompanyHunter',
    run: async function* (page: Page): AsyncGenerator<JobData> {
        console.log(`\n---▶️ Iniciando uma rodada do scraper: ${this.name} ---`);

        // ===================================================================
        // PRIORIDADE 1: Processar UM link de vaga que já está na fila
        // ===================================================================
        if (jobLinksToProcess.length > 0) {
            const jobToProcess = jobLinksToProcess.shift()!; // Pega o primeiro e o remove da fila
            console.log(`[Hunter] Processando vaga pendente em ${jobToProcess.company.name}`);

            const jobDetails = await extractJobDataWithAI(page, jobToProcess.url);
            if (jobDetails && jobDetails.title && jobDetails.description) {
                console.log(`[Hunter] Vaga encontrada via IA: ${jobDetails.title}`);
                // YIELD: Entrega a vaga e pausa a execução até a próxima rodada
                yield {
                    url: jobToProcess.url,
                    title: jobDetails.title,
                    company: jobDetails.company || jobToProcess.company.name,
                    description: jobDetails.description,
                    source: `${this.name} (${jobToProcess.company.name})`
                };
            }
            // RETURN: Termina esta rodada para o orquestrador chamar o próximo scraper
            return;
        }

        // ===================================================================
        // PRIORIDADE 2: Encontrar e enfileirar links de UMA empresa pronta
        // ===================================================================
        const companyToScrape = await companyDB.getNextCompanyForJobScraping();
        if (companyToScrape && companyToScrape.careersUrl) {
            console.log(`[Hunter] Buscando links de vagas em ${companyToScrape.name}...`);
            try {
                await page.goto(companyToScrape.careersUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                const links = await page.$$eval('a', anchors => anchors.map(a => a.href));
                const jobLinks = [...new Set(links.filter(href => /(job|position|opening|vaga|role|listing|requisition)/i.test(href)))];

                if (jobLinks.length > 0) {
                    console.log(`[Hunter] Encontrados ${jobLinks.length} links. Enfileirando para as próximas rodadas.`);
                    // Adiciona os links encontrados na fila para serem processados nas rodadas seguintes
                    jobLinksToProcess.push(...jobLinks.map(url => ({ company: companyToScrape, url })));
                }

                await companyDB.updateCompany(companyToScrape.domain, { status: 'jobs_scraped' });
            } catch (error: any) {
                console.error(`[Hunter] Falha ao buscar vagas em ${companyToScrape.name}: ${error.message}`);
                await companyDB.updateCompany(companyToScrape.domain, { status: 'failed' });
            }
            await humanizedWait(page, 2000, 3000);
            // RETURN: Termina esta rodada
            return;
        }

        // ===================================================================
        // PRIORIDADE 3: Coletar inteligência de UMA empresa descoberta
        // ===================================================================
        const companyToIntelligence = await companyDB.getNextCompanyForIntelligence();
        if (companyToIntelligence) {
            console.log(`[Hunter] Coletando inteligência para ${companyToIntelligence.name}...`);
            const intelligenceData = await gatherIntelligence(page, companyToIntelligence);
            const newStatus = intelligenceData.careersUrl ? 'intelligence_gathered' : 'jobs_scraped';
            await companyDB.updateCompany(companyToIntelligence.domain, { ...intelligenceData, status: newStatus });
            await humanizedWait(page, 2000, 3000);
            // RETURN: Termina esta rodada
            return;
        }

        // ===================================================================
        // PRIORIDADE 4: Descobrir novas empresas (apenas se não houver mais nada a fazer)
        // ===================================================================
        if (!discoveryHasRunInThisCycle) {
            console.log(`[Hunter] Nenhuma tarefa pendente. Executando fase de descoberta...`);
            discoveryHasRunInThisCycle = true; // Marca que já rodou neste ciclo

            // Roda todas as descobertas em paralelo para otimizar o tempo desta única grande tarefa
            const [ycCompanies, a16zCompanies, remoteOkCompanies] = await Promise.all([
                fetchYCombinatorCompanies(page),
                fetchA16ZCompanies(page),
                fetchRemoteOkCompanies(page)
            ]);
            await companyDB.addDiscoveredCompanies(ycCompanies.map(c => ({ ...c, source: 'YCombinator' })));
            await companyDB.addDiscoveredCompanies(a16zCompanies.map(c => ({ ...c, source: 'A16Z' })));
            await companyDB.addDiscoveredCompanies(remoteOkCompanies.map(c => ({ ...c, source: 'RemoteOK' })));
            // RETURN: Termina esta rodada
            return;
        }

        console.log(`--- ✅ ${this.name} sem novas ações nesta rodada. Aguardando próximo ciclo. ---`);
    }
};

// A função de reset continua essencial para o funcionamento do ciclo
export function resetCompanyHunterCycle() {
    discoveryHasRunInThisCycle = false;
    // Também limpamos a fila de links para o novo ciclo
    jobLinksToProcess = [];
}