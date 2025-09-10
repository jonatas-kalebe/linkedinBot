// ARQUIVO: src/scrapers/companyHunter/database.ts

import * as fs from 'fs/promises'; // Usando a versão de Promises do File System
import * as path from 'path';

// --- DEFINIÇÃO DOS TIPOS (sem alterações) ---
export type CompanyStatus =
  | 'discovered'
  | 'intelligence_gathered'
  | 'jobs_scraped'
  | 'failed';

export interface CompanyEntry {
    name: string;
    domain: string;
    source: string;
    status: CompanyStatus;
    careersUrl?: string;
    prospectEmail?: string;
    lastUpdated: string;
}

type Schema = {
    companies: CompanyEntry[];
};

// --- NOVA LÓGICA SEM LOWDB ---
const dbFilePath = path.join(__dirname, 'company_hunter_db.json');
let dbCache: Schema | null = null; // Cache em memória para evitar leituras repetidas do disco

/**
 * Lê o banco de dados do arquivo JSON para o cache, se ainda não tiver sido lido.
 */
async function readDb(): Promise<Schema> {
    if (dbCache) {
        return dbCache;
    }
    try {
        const fileContent = await fs.readFile(dbFilePath, 'utf-8');
        dbCache = JSON.parse(fileContent);
        return dbCache!;
    } catch (error: any) {
        // Se o arquivo não existir, é a primeira execução. Criamos um DB vazio.
        if (error.code === 'ENOENT') {
            dbCache = { companies: [] };
            return dbCache;
        }
        // Se for outro erro, lançamos para ser tratado
        throw error;
    }
}

/**
 * Escreve o estado atual do cache de volta para o arquivo JSON.
 */
async function writeDb(): Promise<void> {
    if (dbCache) {
        await fs.writeFile(dbFilePath, JSON.stringify(dbCache, null, 2));
    }
}

// --- LÓGICA DO BANCO DE DADOS (AGORA 100% NATIVA) ---
export const companyDB = {
    async addDiscoveredCompanies(companies: { name: string; domain: string; source: string }[]) {
        const data = await readDb();
        let addedCount = 0;

        companies.forEach(company => {
            if (!company.domain) return;
            const exists = data.companies.find(c => c.domain === company.domain);
            if (!exists) {
                data.companies.push({ ...company, status: 'discovered', lastUpdated: new Date().toISOString() });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            await writeDb();
            console.log(`[DB] Adicionadas ${addedCount} novas empresas.`);
        }
    },

    async getNextCompanyForIntelligence(): Promise<CompanyEntry | undefined> {
        const data = await readDb();
        return data.companies.find(c => c.status === 'discovered');
    },

    async getNextCompanyForJobScraping(): Promise<CompanyEntry | undefined> {
        const data = await readDb();
        return data.companies.find(c => c.status === 'intelligence_gathered' && c.careersUrl);
    },

    async updateCompany(domain: string, updates: Partial<CompanyEntry>) {
        const data = await readDb();
        const company = data.companies.find(c => c.domain === domain);
        if (company) {
            Object.assign(company, updates, { lastUpdated: new Date().toISOString() });
            await writeDb();
        }
    },

    async resetScrapingStatus() {
        const data = await readDb();
        data.companies.forEach(company => {
            if (company.status === 'jobs_scraped' || company.status === 'failed') {
                company.status = 'discovered';
            }
        });
            await writeDb();
        }
};