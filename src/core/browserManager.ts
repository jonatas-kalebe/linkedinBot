
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {Browser, Page} from 'puppeteer';
import {createCursor} from "ghost-cursor";
import * as fs from 'fs';
import * as path from 'path';


puppeteer.use(StealthPlugin());

export async function launchBrowser(): Promise<{ browser: Browser; page: Page }> {
    console.log('🚀 Iniciando instância do navegador (com stealth)...');
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: path.join(__dirname, '../../session'),
        args: [
            "--start-maximized",
                                ]
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});


    createCursor(page);     console.log('✅ Navegador pronto.');
    return {browser, page};
}

export async function takeScreenshotOnError(page: Page, errorName: string): Promise<void> {
    try {
        const screenshotDir = path.join(__dirname, '../../error_screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(screenshotDir, `${errorName}-${timestamp}.png`);
        await page.screenshot({path: screenshotPath, fullPage: true});
        console.error(`📷 Screenshot de erro salvo em: ${screenshotPath}`);
    } catch (e) {
        console.error("Falha ao tirar screenshot do erro.", e);
    }
}