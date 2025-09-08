// Usamos "import type" para obter os tipos sem causar erros de runtime.
import type { Low } from 'lowdb';

export type CompanyStatus = 'discovered' | 'intelligence_gathered' | 'jobs_scraped' | 'failed';

export interface CompanyEntry {
    name: string;
    domain: string;
    source: string;
    status: CompanyStatus;
    careersUrl?: string;
    isRemoteFriendly?: boolean;
    techStack?: string[];
    lastUpdated: string;
}

type Schema = {
    companies: CompanyEntry[];
};

let db: Low<Schema> | null = null;

async function getDB(): Promise<Low<Schema>> {
    if (db) {
        return db;
    }
    // Carrega dinamicamente o CÓDIGO REAL do lowdb em tempo de execução
    const { Low } = await import('lowdb');
    const { JSONFile } = await import('lowdb/node');

    const adapter = new JSONFile<Schema>('company_hunter_db.json');
    db = new Low<Schema>(adapter, { companies: [] });

    await db.read();
    return db;
}

export const companyDB = {
    async addDiscoveredCompanies(companies: { name: string, domain: string, source: string }[]) {
        const database = await getDB();
        let addedCount = 0;

        companies.forEach(company => {
            const exists = database.data.companies.some(c => c.domain === company.domain);
            if (!exists) {
                database.data.companies.push({
                    ...company,
                    status: 'discovered',
                    lastUpdated: new Date().toISOString()
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            console.log(`[DB] Adicionadas ${addedCount} novas empresas.`);
            await database.write();
        }
    },

    async getNextCompanyForIntelligence(): Promise<CompanyEntry | undefined> {
        const database = await getDB();
        await database.read();
        return database.data.companies.find(c => c.status === 'discovered');
    },

    async getNextCompanyForJobScraping(): Promise<CompanyEntry | undefined> {
        const database = await getDB();
        await database.read();
        return database.data.companies.find(c => c.status === 'intelligence_gathered' && c.careersUrl);
    },

    async updateCompany(domain: string, updates: Partial<CompanyEntry>) {
        const database = await getDB();
        const company = database.data.companies.find(c => c.domain === domain);
        if (company) {
            Object.assign(company, updates, { lastUpdated: new Date().toISOString() });
            await database.write();
        }
    }
};