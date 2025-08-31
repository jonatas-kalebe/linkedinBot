import * as fs from 'fs';
import * as path from 'path';

const processedJobsPath = path.join(__dirname, '../../processed_jobs.json');

// @ts-ignore
export function loadProcessedJobs(): Set<string> {
    try {
        if (fs.existsSync(processedJobsPath)) {
            const fileContent = fs.readFileSync(processedJobsPath, 'utf-8');
            const urls: string[] = JSON.parse(fileContent);
            return new Set(urls.map(url => {
                try {
                    const urlObject = new URL(url);
                    return `${urlObject.origin}${urlObject.pathname}`;
                } catch {
                    return url;                 }
            }));
        }
    } catch (error) {
        console.warn('Aviso: Não foi possível ler o ficheiro de vagas processadas.', error);
    }
    return new Set();
}

export function saveProcessedJob(url: string, currentSet: Set<string>): void {
    const normalizedUrl = new URL(url).origin + new URL(url).pathname;
    currentSet.add(normalizedUrl);
    fs.writeFileSync(processedJobsPath, JSON.stringify(Array.from(currentSet), null, 2));
}