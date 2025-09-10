// ARQUIVO: src/scrapers/companyHunter/companyHunterScraper.ts
import { Page } from 'puppeteer';
import { Scraper } from '../scraper.interface';
import { JobData } from '../../core/jobProcessor';
import { companyDB, CompanyEntry } from './database';
import { qualifyCompany } from './intelligence/gatherer';
import { findJobLinksWithAI } from '../../services/aiLinkFinder';
import { extractJobDataWithAI } from './intelligence/aiExtractor';
import { humanizedWait } from '../../utils/humanization';

import { fetchYCombinatorCompanies } from './discovery/ycombinator/fetcher';
import { fetchA16ZCompanies } from './discovery/a16z/fetcher';
import { fetchRemoteOkCompanies } from './discovery/remoteok/fetcher'; // Mantido como fonte secundária

let discoveryHasRunInThisCycle = false;
let jobLinksToProcess: { company: CompanyEntry; url: string }[] = [];

export const companyHunterScraper: Scraper = {
  name: 'CompanyHunter',
  run: async function* (page: Page): AsyncGenerator<JobData> {
    while (true) {
      // ETAPA 3: Processar vagas individuais de empresas já qualificadas
      if (jobLinksToProcess.length > 0) {
        const jobToProcess = jobLinksToProcess.shift()!;
        try {
          const jobDetails = await extractJobDataWithAI(page, jobToProcess.url);
          if (jobDetails?.title && jobDetails.description) {
            yield {
              url: jobToProcess.url,
              title: jobDetails.title,
              company: jobDetails.company || jobToProcess.company.name,
              description: jobDetails.description,
              source: `${this.name} (${jobToProcess.company.name})`
            };
          }
        } catch (error) {}
        continue;
      }

      // ETAPA 2: Buscar links de vagas em empresas qualificadas
      const companyToScrape = await companyDB.getNextCompanyForJobScraping();
      if (companyToScrape) {
        try {
          await page.goto(companyToScrape.careersUrl!, { waitUntil: 'networkidle2' });
          const jobLinks = await findJobLinksWithAI(page, companyToScrape.careersUrl!);
          if (jobLinks.length > 0) {
            jobLinksToProcess.push(...jobLinks.map(url => ({ company: companyToScrape, url })));
          }
          await companyDB.updateCompany(companyToScrape.domain, { status: 'jobs_scraped' });
        } catch (e) { await companyDB.updateCompany(companyToScrape.domain, { status: 'failed' }); }
        continue;
      }

      // ETAPA 1: Qualificar empresas recém-descobertas
      const companyToQualify = await companyDB.getNextCompanyForIntelligence();
      if (companyToQualify) {
        try {
          const qualification = await qualifyCompany(page, companyToQualify);
          if (qualification.isQualified) {
            await companyDB.updateCompany(companyToQualify.domain, { status: 'intelligence_gathered', careersUrl: qualification.careersUrl });
          } else {
            await companyDB.updateCompany(companyToQualify.domain, { status: 'jobs_scraped' }); // Marcar como 'jobs_scraped' para não tentar de novo
          }
        } catch (e) { await companyDB.updateCompany(companyToQualify.domain, { status: 'failed' }); }
        continue;
      }

      // ETAPA 0: Descobrir novas empresas
      if (!discoveryHasRunInThisCycle) {
        console.log(`[CompanyHunter] Nenhuma empresa na fila. Iniciando descoberta...`);
        discoveryHasRunInThisCycle = true;
        const browser = page.browser();

        const [yc, a16z, remoteok] = await Promise.all([
          (async () => { const p = await browser.newPage(); try { return await fetchYCombinatorCompanies(p); } finally { await p.close(); } })(),
          (async () => { const p = await browser.newPage(); try { return await fetchA16ZCompanies(p); } finally { await p.close(); } })(),
          (async () => { const p = await browser.newPage(); try { return await fetchRemoteOkCompanies(p); } finally { await p.close(); } })()
        ]);

        const allCompanies = [
          ...yc.map(c => ({ ...c, source: 'YCombinator' })),
          ...a16z.map(c => ({ ...c, source: 'A16Z' })),
          ...remoteok.map(c => ({ ...c, source: 'RemoteOK' }))
        ];
        const unique = allCompanies.filter((v,i,a)=>a.findIndex(t=>(t.domain === v.domain && v.domain))===i);
        await companyDB.addDiscoveredCompanies(unique);
        continue;
      }

      console.log("🏁 [CompanyHunter] Todas as empresas foram processadas. Finalizando scraper.");
      break;
    }
  }
};

export function resetCompanyHunterCycle() {
  console.log("♻️ Ciclo do CompanyHunter reiniciado.");
  discoveryHasRunInThisCycle = false;
  jobLinksToProcess = [];
  companyDB.resetScrapingStatus();
}