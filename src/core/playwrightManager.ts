import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Note que o retorno de `launchBrowser` é BrowserContext, que gerencia a sessão
export async function launchPlaywrightBrowser(): Promise<{ browser: BrowserContext; page: Page }> {
    console.log('🚀 Iniciando instância do navegador com Playwright...');
    const sessionPath = path.join(__dirname, '../../session_playwright'); // Pasta de sessão separada

    const browser = await chromium.launchPersistentContext(sessionPath, {
        headless: false,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
        viewport: { width: 1920, height: 1080 }
    });

    const page = browser.pages()[0] || await browser.newPage();
    console.log('✅ Navegador (Playwright) pronto.');
    return { browser, page };
}