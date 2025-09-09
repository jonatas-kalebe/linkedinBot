const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

export type CompanyStatus = 'discovered' | 'intelligence_gathered' | 'jobs_scraped' | 'failed'

export interface CompanyEntry {
    name: string
    domain: string
    source: string
    status: CompanyStatus
    careersUrl?: string
    isRemoteFriendly?: boolean
    techStack?: string[]
    lastUpdated: string
}

type Schema = {
    companies: CompanyEntry[]
}

// @ts-ignore
const adapter = new FileSync<Schema>('company_hunter_db.json')
const db = low(adapter)

db.defaults({ companies: [] }).write()

export const companyDB = {
    addDiscoveredCompanies(companies: { name: string; domain: string; source: string }[]) {
        let addedCount = 0
        const companiesInDb = db.get('companies')
        companies.forEach(company => {
            const exists = companiesInDb.find({ domain: company.domain }).value()
            if (!exists) {
                companiesInDb
                    .push({ ...company, status: 'discovered', lastUpdated: new Date().toISOString() })
                    .write()
                addedCount++
            }
        })
        if (addedCount > 0) console.log(`[DB] Adicionadas ${addedCount} novas empresas.`)
    },

    getNextCompanyForIntelligence(): CompanyEntry | undefined {
        return db.get('companies').find({ status: 'discovered' }).value()
    },

    getNextCompanyForJobScraping(): CompanyEntry | undefined {
        return db.get('companies')
            .value()
            .find((c: { status: string; careersUrl: any }) => c.status === 'intelligence_gathered' && c.careersUrl)
    },

    updateCompany(domain: string, updates: Partial<CompanyEntry>) {
        const company = db.get('companies').find({ domain })
        if (company.value()) company.assign({ ...updates, lastUpdated: new Date().toISOString() }).write()
    }
}
