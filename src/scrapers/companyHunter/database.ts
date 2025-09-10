const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')


export type CompanyStatus =
    | 'discovered'              // Apenas encontrada.
    | 'intelligence_gathered'   // Encontramos a página de carreiras.
    | 'jobs_scraped'            // Já buscamos vagas nesta empresa neste ciclo.
    | 'failed';                 // Ocorreu um erro técnico.

export interface CompanyEntry {
    name: string;
    domain: string;
    source: string;
    status: CompanyStatus;
    careersUrl?: string;
    prospectEmail?: string; // << NOVO: Armazena e-mail de prospecção se 'careersUrl' não for encontrado
    lastUpdated: string;
}

type Schema = {
    companies: CompanyEntry[];
};

// @ts-ignore
const adapter = new FileSync<Schema>('company_hunter_db.json');
const db = low(adapter);

db.defaults({ companies: [] }).write();

export const companyDB = {
    addDiscoveredCompanies(companies: { name: string; domain: string; source: string }[]) {
        let addedCount = 0;
        const companiesInDb = db.get('companies');
        companies.forEach(company => {
            if (!company.domain) return;
            const exists = companiesInDb.find({ domain: company.domain }).value();
            if (!exists) {
                companiesInDb
                    .push({ ...company, status: 'discovered', lastUpdated: new Date().toISOString() })
                    .write();
                addedCount++;
            }
        });
        if (addedCount > 0) console.log(`[DB] Adicionadas ${addedCount} novas empresas.`);
    },

    getNextCompanyForIntelligence(): CompanyEntry | undefined {
        return db.get('companies').find({ status: 'discovered' }).value();
    },

    getNextCompanyForJobScraping(): CompanyEntry | undefined {
        return db.get('companies')
            .filter((c: CompanyEntry) => c.status === 'intelligence_gathered' && c.careersUrl)
            .value()[0]; // Pega o primeiro da lista
    },

    updateCompany(domain: string, updates: Partial<CompanyEntry>) {
        const company = db.get('companies').find({ domain });
        if (company.value()) {
            company.assign({ ...updates, lastUpdated: new Date().toISOString() }).write();
        }
    },

    resetScrapingStatus() {
        console.log('[DB] Reiniciando status das empresas para um novo ciclo.');
        const companies = db.get('companies');
        const companiesToReset = companies.filter((c: CompanyEntry) => c.status === 'jobs_scraped' || c.status === 'failed').value();

        companiesToReset.forEach((c: CompanyEntry) => {
            companies.find({ domain: c.domain })
                .assign({ status: 'discovered', lastUpdated: new Date().toISOString() })
                .write();
        });

        console.log(`[DB] Status de ${companiesToReset.length} empresas reiniciado.`);
    }
};