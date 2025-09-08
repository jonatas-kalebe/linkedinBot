import { Page } from 'puppeteer';

export interface DiscoveredCompany {
    name: string;
    domain: string;
}

export interface DiscoveryModule {
    name: string;
    discover(page: Page): Promise<DiscoveredCompany[]>;
}