// ARQUIVO: src/scrapers/companyHunter/companyHunterScraper.ts

import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { companyDB, CompanyEntry } from './database';
import { gatherIntelligence } from './intelligence/gatherer';
import { findJobLinksWithAI } from '../../services/aiLinkFinder';
import { extractJobDataWithAI } from './intelligence/aiExtractor';
import { humanizedWait } from '../../utils/humanization';

// Importa todos os seus fetchers de descoberta
import { fetchYCombinatorCompanies } from './discovery/ycombinator/fetcher';
import { fetchA16ZCompanies } from './discovery/a16z/fetcher';
import { fetchRemoteOkCompanies } from './discovery/remoteok/fetcher';

let discoveryHasRunInThisCycle = false;
// Fila de vagas individuais encontradas para processar
let jobLinksToProcess: { company: CompanyEntry; url: string }[] = [];

export const companyHunterScraper: Scraper = {
  name: 'CompanyHunter',
  run: async function* (page: Page): AsyncGenerator<JobData> {
    while (true) {
      // ETAPA 1 (PRIORIDADE MÁXIMA): Processar vagas individuais que já encontramos
      if (jobLinksToProcess.length > 0) {
        const jobToProcess = jobLinksToProcess.shift()!;
        console.log(`[CompanyHunter] Processando vaga encontrada: ${jobToProcess.url.substring(0, 100)}...`);
        try {
          const jobDetails = await extractJobDataWithAI(page, jobToProcess.url);
          if (jobDetails && jobDetails.title && jobDetails.description) {
            yield { // Entrega a vaga para o orquestrador principal
              url: jobToProcess.url,
              title: jobDetails.title,
              company: jobDetails.company || jobToProcess.company.name,
              description: jobDetails.description,
              source: `${this.name} (${jobToProcess.company.name})`
            };
          }
        } catch (error: any) {
          console.error(`[CompanyHunter] Falha ao extrair detalhes da vaga: ${error.message}`);
        }
        continue;
      }

      // ETAPA 2: Buscar vagas em empresas que já têm página de carreiras
      const companyToScrape = companyDB.getNextCompanyForJobScraping();
      if (companyToScrape && companyToScrape.careersUrl) {
        console.log(`[CompanyHunter] Buscando vagas de TI em: ${companyToScrape.name}`);
        try {
          await page.goto(companyToScrape.careersUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          const jobLinks = await findJobLinksWithAI(page, companyToScrape.careersUrl);

          if (jobLinks.length > 0) {
            console.log(`  - ${jobLinks.length} vagas de TI encontradas. Adicionando à fila de processamento.`);
            jobLinksToProcess.push(...jobLinks.map(url => ({ company: companyToScrape, url })));
          } else {
            console.log(`  - Nenhuma vaga de TI encontrada para ${companyToScrape.name}.`);
          }
          await companyDB.updateCompany(companyToScrape.domain, { status: 'jobs_scraped' });
        } catch (e: any) {
          console.error(`[CompanyHunter] Erro ao buscar vagas em ${companyToScrape.careersUrl}: ${e.message}`);
          await companyDB.updateCompany(companyToScrape.domain, { status: 'failed' });
        }
        await humanizedWait(page, 1000, 2000);
        continue; // Volta ao topo para começar a processar os links que acabou de encontrar
      }

      // ETAPA 3: Encontrar a página de carreiras de novas empresas
      const companyToIntelligence = companyDB.getNextCompanyForIntelligence();
      if (companyToIntelligence) {
        console.log(`[CompanyHunter] Buscando "Carreiras" em: ${companyToIntelligence.name}`);
        try {
          const intelligenceData = await gatherIntelligence(page, companyToIntelligence);
          const newStatus = intelligenceData.careersUrl ? 'intelligence_gathered' : 'jobs_scraped';
          await companyDB.updateCompany(companyToIntelligence.domain, { ...intelligenceData, status: newStatus });
        } catch (e: any) {
          await companyDB.updateCompany(companyToIntelligence.domain, { status: 'failed' });
        }
        await humanizedWait(page, 1000, 2000);
        continue;
      }

      // ETAPA 4: Descobrir novas empresas se não houver mais nada a fazer
      if (!discoveryHasRunInThisCycle) {
        console.log(`[CompanyHunter] Nenhuma empresa na fila. Iniciando descoberta...`);
        discoveryHasRunInThisCycle = true;
        const browser = page.browser();

        const [ycCompanies, a16zCompanies, remoteOkCompanies] = await Promise.all([
          (async () => { const p = await browser.newPage(); try { return await fetchYCombinatorCompanies(p); } finally { await p.close(); } })(),
          (async () => { const p = await browser.newPage(); try { return await fetchA16ZCompanies(p); } finally { await p.close(); } })(),
          (async () => { const p = await browser.newPage(); try { return await fetchRemoteOkCompanies(p); } finally { await p.close(); } })()
        ]);

        // Adiciona a propriedade 'source' que estava faltando
        const allCompanies = [
            ...ycCompanies.map(c => ({ ...c, source: 'YCombinator' })),
            ...a16zCompanies.map(c => ({ ...c, source: 'A16Z' })),
            ...remoteOkCompanies.map(c => ({ ...c, source: 'RemoteOK' }))
        ];

        const uniqueCompanies = allCompanies.filter((v,i,a)=>a.findIndex(t=>(t.domain === v.domain && v.domain))===i);
        await companyDB.addDiscoveredCompanies(uniqueCompanies);

        console.log(`[CompanyHunter] Descoberta finalizada. O ciclo continuará processando as novas empresas.`);
        continue;
      }

      console.log("🏁 [CompanyHunter] Todas as empresas foram processadas. Finalizando este scraper para o ciclo atual.");
      break; // Encerra o gerador
    }
  }
};

/**
 * Função para ser chamada pelo orquestrador principal para resetar o ciclo.
 */
export function resetCompanyHunterCycle() {
  console.log("♻️ Ciclo do CompanyHunter reiniciado para a próxima orquestração.");
  discoveryHasRunInThisCycle = false;
  jobLinksToProcess = [];
  companyDB.resetScrapingStatus();
}