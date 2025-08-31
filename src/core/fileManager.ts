import * as fs from 'fs';
import * as path from 'path';

function getProcessedJobsPath(siteName: string): string {
    const sanitizedSiteName = siteName.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    return path.join(__dirname, `../../processed_${sanitizedSiteName}.json`);
}

export function loadProcessedJobs(siteName: string): Set<string> {
    const filePath = getProcessedJobsPath(siteName);
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const urls: string[] = JSON.parse(fileContent);
            return new Set(urls.map(url => {
                try {
                    const urlObject = new URL(url);
                    return `${urlObject.origin}${urlObject.pathname}`;
                } catch {
                    return url;
                }
            }));
        }
    } catch (error) {
        console.warn(`Aviso: Não foi possível ler o ficheiro de vagas processadas para ${siteName}.`, error);
    }
    return new Set();
}

export function saveProcessedJob(url: string, siteName: string): void {
    const filePath = getProcessedJobsPath(siteName);
    const currentSet = loadProcessedJobs(siteName);

    const normalizedUrl = new URL(url).origin + new URL(url).pathname;
    currentSet.add(normalizedUrl);

    fs.writeFileSync(filePath, JSON.stringify(Array.from(currentSet), null, 2));
}