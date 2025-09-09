// src/scrapers/companyHunter/companyHunterScraper.ts
import { Page } from 'puppeteer'
import { Scraper } from '../scraper.interface'
import { JobData } from '../../core/jobProcessor'
import { companyDB, CompanyEntry } from './database'
import { fetchYCombinatorCompanies } from './discovery/ycombinator/fetcher'
import { fetchRemoteOkCompanies } from './discovery/remoteok/fetcher'
import { gatherIntelligence } from './intelligence/gatherer'
import { extractJobDataWithAI } from './intelligence/aiExtractor'
import { humanizedWait } from '../../utils/humanization'
import { fetchA16ZCompanies } from './discovery/a16z/fetcher'

let discoveryHasRunInThisCycle = false
let jobLinksToProcess: { company: CompanyEntry; url: string }[] = []

export const companyHunterScraper: Scraper = {
  name: 'CompanyHunter',
  run: async function* (page: Page): AsyncGenerator<JobData> {
    if (jobLinksToProcess.length > 0) {
      const jobToProcess = jobLinksToProcess.shift()!
      const jobDetails = await extractJobDataWithAI(page, jobToProcess.url)
      if (jobDetails && jobDetails.title && jobDetails.description) {
        yield {
          url: jobToProcess.url,
          title: jobDetails.title,
          company: jobDetails.company || jobToProcess.company.name,
          description: jobDetails.description,
          source: `${this.name} (${jobToProcess.company.name})`
        }
      }
      return
    }

    const companyToScrape = await companyDB.getNextCompanyForJobScraping()
    if (companyToScrape && companyToScrape.careersUrl) {
      try {
        await page.goto(companyToScrape.careersUrl, { waitUntil: 'networkidle2', timeout: 60000 })
        const links = await page.$$eval('a', a => a.map(x => (x as HTMLAnchorElement).href))
        const jobLinks = [...new Set(links.filter(h => /(job|position|opening|vaga|role|listing|requisition)/i.test(h)))]
        if (jobLinks.length > 0) {
          jobLinksToProcess.push(...jobLinks.map(url => ({ company: companyToScrape, url })))
        }
        await companyDB.updateCompany(companyToScrape.domain, { status: 'jobs_scraped' })
      } catch (e: any) {
        await companyDB.updateCompany(companyToScrape.domain, { status: 'failed' })
      }
      await humanizedWait(page, 2000, 3000)
      return
    }

    const companyToIntelligence = await companyDB.getNextCompanyForIntelligence()
    if (companyToIntelligence) {
      const intelligenceData = await gatherIntelligence(page, companyToIntelligence)
      const newStatus = intelligenceData.careersUrl ? 'intelligence_gathered' : 'jobs_scraped'
      await companyDB.updateCompany(companyToIntelligence.domain, { ...intelligenceData, status: newStatus })
      await humanizedWait(page, 2000, 3000)
      return
    }

    if (!discoveryHasRunInThisCycle) {
      discoveryHasRunInThisCycle = true
      const browser = page.browser()

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

      await companyDB.addDiscoveredCompanies(ycCompanies.map(c => ({ ...c, source: 'YCombinator' })))
      await companyDB.addDiscoveredCompanies(a16zCompanies.map(c => ({ ...c, source: 'A16Z' })))
      await companyDB.addDiscoveredCompanies(remoteOkCompanies.map(c => ({ ...c, source: 'RemoteOK' })))
      return
    }
  }
}

export function resetCompanyHunterCycle() {
  discoveryHasRunInThisCycle = false
  jobLinksToProcess = []
}
