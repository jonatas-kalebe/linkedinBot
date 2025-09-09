// src/scrapers/companyHunter/discovery/ycombinator/fetcher.ts
import { Page } from 'puppeteer'
import selectors from './selectors'
import { humanizedWait } from '../../../../utils/humanization'
import { DiscoveredCompany } from '../discovery.interface'

export async function fetchYCombinatorCompanies(page: Page): Promise<DiscoveredCompany[]> {
  const YC_URL = 'https://www.ycombinator.com/companies'
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36')
    await page.goto(YC_URL, { waitUntil: 'networkidle2', timeout: 90000 })
    await humanizedWait(page, 4000, 6000)

    for (let i = 0; i < 3; i++) {
      await page.evaluate('window.scrollBy(0, window.innerHeight * 2)')
      await humanizedWait(page, 2500, 4000)
    }

    try {
      await page.waitForSelector(selectors.companyCard, { timeout: 15000 })
    } catch {}

    const companiesPrimary = await page.$$eval(
      selectors.companyCard,
      (elements, nameSelector) =>
        elements
          .map(el => {
            const nameElement = el.querySelector(nameSelector as string)
            const name = nameElement ? (nameElement.textContent || '').trim() : ''
            const websiteLink = el.querySelector('a[href^="http"]') as HTMLAnchorElement | null
            let domain = ''
            if (websiteLink && websiteLink.href && !websiteLink.href.includes('ycombinator.com')) {
              try {
                domain = new URL(websiteLink.href).hostname.replace(/^www\./, '')
              } catch {}
            }
            return { name, domain }
          })
          .filter(c => c.name && c.domain),
      selectors.companyName
    )

    if (companiesPrimary.length > 0) return companiesPrimary

    const fallback = await page.$$eval('a[href^="http"]', as =>
      as
        .map(a => {
          const href = (a as HTMLAnchorElement).href
          const text = (a.textContent || '').trim()
          let domain = ''
          try {
            const u = new URL(href)
            if (!/ycombinator\.com$/i.test(u.hostname)) domain = u.hostname.replace(/^www\./, '')
          } catch {}
          return { name: text, domain }
        })
        .filter(x => x.name && x.domain)
    )

    return fallback.slice(0, 100)
  } catch {
    await page.screenshot({ path: 'error_yc_discovery.png', fullPage: true })
    return []
  }
}
