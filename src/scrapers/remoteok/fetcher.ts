// src/scrapers/remoteok/fetcher.ts
import { Page } from 'puppeteer';
import selectors from './selectors';
import { humanizedWait } from "../../utils/humanization";
import { JobData } from '../../core/jobProcessor';

export async function* fetchRemoteOKJobs(page: Page, processedUrls: Set<string>): AsyncGenerator<JobData> {
    const BASE_URL = 'https://remoteok.com/remote-developer-jobs';
    console.log(`Buscando vagas em: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(selectors.jobListRow, { timeout: 15000 });

    const jobLinks = await page.$$eval(selectors.jobListRow, (rows) =>
        rows.map(row => {
            const linkElement = row.querySelector('a.preventLink');
            return linkElement ? `https://remoteok.com${linkElement.getAttribute('href')}` : null;
        }).filter((link): link is string => link !== null)
    );
    console.log(`[RemoteOK] Encontrados ${jobLinks.length} links de vagas.`);

    for (const link of jobLinks) {
        const urlObject = new URL(link);
        const normalizedUrl = `${urlObject.origin}${urlObject.pathname}`;

        if (processedUrls.has(normalizedUrl)) {
            continue;
        }

        try {
            await humanizedWait(page, 2000, 4000);
            await page.goto(link, { waitUntil: 'domcontentloaded' });

            const title = await page.$eval(selectors.jobTitle, el => el.textContent?.trim() ?? '');
            const company = await page.$eval(selectors.companyName, el => el.textContent?.trim() ?? '');
            const description = await page.$eval(selectors.jobDescription, el => (el as HTMLElement).innerText);

            yield { url: link, title, company, description };

        } catch (error) {
            console.warn(`- [RemoteOK] Falha ao processar a vaga em ${link}:`, error);
        }
    }
}