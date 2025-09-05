import {BrowserContext, chromium, Page} from 'playwright';
import * as path from 'path';

export async function launchPlaywrightBrowser(): Promise<{ browser: BrowserContext; page: Page }> {
    console.log('🚀 Iniciando instância do navegador com Playwright...');
    const sessionPath = path.join(__dirname, '../../session_playwright');
    const browser = await chromium.launchPersistentContext(sessionPath, {
        headless: false,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
        viewport: {width: 1920, height: 1080}
    });

    const page = browser.pages()[0] || await browser.newPage();
    console.log('✅ Navegador (Playwright) pronto.');
    return {browser, page};
}