import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { companyDB, CompanyEntry } from './database';
import { fetchYCombinatorCompanies } from './discovery/ycombinator/fetcher';
import { fetchRemoteOkCompanies } from './discovery/remoteok/fetcher';
import { gatherIntelligence } from './intelligence/gatherer';
import { extractJobDataWithAI } from './intelligence/aiExtractor';
import { humanizedWait } from '../../utils/humanization';
import { fetchA16ZCompanies } from './discovery/a16z/fetcher';
import { findJobLinksWithAI } from "../../services/aiLinkFinder"; // Verifique o caminho deste import

let discoveryHasRunInThisCycle = false;
let jobLinksToProcess: { company: CompanyEntry; url: string }[] = [];

export const companyHunterScraper: Scraper = {
  name: 'CompanyHunter',
  run: async function* (page: Page): AsyncGenerator<JobData> {
    // <<< MUDANÇA-CHAVE: Loop de trabalho contínuo >>>
    // O bot agora busca ativamente a próxima tarefa sem precisar ser chamado novamente.
    while (true) {
      // --- ETAPA 1 (PRIORIDADE MÁXIMA): Processar links de vagas já encontrados ---
      if (jobLinksToProcess.length > 0) {
        const jobToProcess = jobLinksToProcess.shift()!;
        console.log(`[PROCESSANDO VAGA] ${jobToProcess.url.substring(0, 100)}...`);
        try {
          const jobDetails = await extractJobDataWithAI(page, jobToProcess.url);
          if (jobDetails && jobDetails.title && jobDetails.description) {
            yield { // <<< YIELD: Envia o dado da vaga para fora
              url: jobToProcess.url,
              title: jobDetails.title,
              company: jobDetails.company || jobToProcess.company.name,
              description: jobDetails.description,
              source: `${this.name} (${jobToProcess.company.name})`
            };
          }
        } catch (error: any) {
            console.error(`[ERRO NA EXTRAÇÃO IA] Falha ao processar ${jobToProcess.url}. Causa: ${error.message}`);
        }
        continue; // <<< CONTINUE: Volta ao início do loop para processar o próximo link da fila
      }

      // --- ETAPA 2: Encontrar vagas em empresas com inteligência coletada ---
      const companyToScrape = companyDB.getNextCompanyForJobScraping();
      if (companyToScrape && companyToScrape.careersUrl) {
        console.log(`[BUSCANDO VAGAS] Na empresa: ${companyToScrape.name} (${companyToScrape.careersUrl})`);
        try {
          await page.goto(companyToScrape.careersUrl, { waitUntil: 'networkidle2', timeout: 60000 }); // Timeout reduzido para agilidade
          const jobLinks = await findJobLinksWithAI(page, companyToScrape.careersUrl);

          if (jobLinks.length > 0) {
            console.log(`[VAGAS ENCONTRADAS] ${jobLinks.length} vagas em ${companyToScrape.name}. Adicionando à fila.`);
            jobLinksToProcess.push(...jobLinks.map(url => ({ company: companyToScrape, url })));
          } else {
            console.log(`[SEM VAGAS] Nenhuma vaga encontrada via IA em ${companyToScrape.name}.`);
          }
          await companyDB.updateCompany(companyToScrape.domain, { status: 'jobs_scraped' });
        } catch (e: any) {
          console.error(`[ERRO AO BUSCAR VAGAS] Falha ao processar ${companyToScrape.careersUrl}. Causa: ${e.message}`);
          await companyDB.updateCompany(companyToScrape.domain, { status: 'failed' });
        }
        await humanizedWait(page, 1000, 2000); // Espera reduzida
        continue; // <<< CONTINUE: Volta ao início para já processar os links que acabou de encontrar
      }

      // --- ETAPA 3: Coletar inteligência (URL de carreiras, etc.) ---
      const companyToIntelligence = companyDB.getNextCompanyForIntelligence();
      if (companyToIntelligence) {
        console.log(`[COLETANDO INTELIGÊNCIA] Para a empresa: ${companyToIntelligence.name}`);
        try {
            const intelligenceData = await gatherIntelligence(page, companyToIntelligence);
            const newStatus = intelligenceData.careersUrl ? 'intelligence_gathered' : 'jobs_scraped'; // Se não achar URL, pula direto
            console.log(`[INTELIGÊNCIA OK] Status de ${companyToIntelligence.name} -> ${newStatus}`);
            await companyDB.updateCompany(companyToIntelligence.domain, { ...intelligenceData, status: newStatus });
        } catch (e: any) {
            console.error(`[ERRO NA INTELIGÊNCIA] Falha ao coletar dados de ${companyToIntelligence.name}. Causa: ${e.message}`);
            await companyDB.updateCompany(companyToIntelligence.domain, { status: 'failed' });
        }
        await humanizedWait(page, 1000, 2000);
        continue; // <<< CONTINUE: Volta ao início para a próxima tarefa
      }

      // --- ETAPA 4: Descobrir novas empresas (se não houver mais nada pra fazer) ---
      if (!discoveryHasRunInThisCycle) {
        console.log(`[DESCOBERTA] Fim do ciclo de scraping. Buscando novas empresas...`);
        discoveryHasRunInThisCycle = true;
        const browser = page.browser();
        
        // Seu código de descoberta está ótimo e pode permanecer o mesmo.
        const [ycCompanies, a16zCompanies, remoteOkCompanies] = await Promise.all([
        (async () => {
          const p = await browser.newPage()
          try {
            return await fetchYCombinatorCompanies(p)
          } finally {
            await p.close()
          }
        })(),
        (async () => {
          const p = await browser.newPage()
          try {
            return await fetchA16ZCompanies(p)
          } finally {
            await p.close()
          }
        })(),
        (async () => {
          const p = await browser.newPage()
          try {
            return await fetchRemoteOkCompanies(p)
          } finally {
            await p.close()
          }
        })()
      ])
        
        await companyDB.addDiscoveredCompanies(ycCompanies.map(c => ({...c, source: 'YCombinator'})));
        await companyDB.addDiscoveredCompanies(a16zCompanies.map(c => ({...c, source: 'A16Z'})));
        await companyDB.addDiscoveredCompanies(remoteOkCompanies.map(c => ({...c, source: 'RemoteOK'})));
        
        console.log(`[DESCOBERTA FINALIZADA] Reiniciando ciclo de trabalho.`);
        ; // <<< CONTINUE: Volta ao início para começar a coletar inteligência das novas empresas.
      }

      // --- ETAPA 5 (CONDIÇÃO DE SAÍDA): Fim de tudo ---
      // Se chegou até aqui, significa que todos os `if` anteriores falharam.
      // Não há mais links para processar, nem empresas para analisar, e a descoberta já rodou.
      console.log("🏁 Todos os ciclos foram concluídos. Nenhuma nova ação a ser tomada.");
      break; // <<< BREAK: Sai do loop while(true) e encerra o gerador.
    }
  }
};

export function resetCompanyHunterCycle() {
  console.log("♻️ Ciclo do CompanyHunter reiniciado.");
  discoveryHasRunInThisCycle = false;
  jobLinksToProcess = [];
  companyDB.resetScrapingStatus(); // Agora podemos usar a função de reset do DB
}
