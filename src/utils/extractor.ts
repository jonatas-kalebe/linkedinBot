// src/utils/extractor.ts

import {Page} from 'puppeteer';

/**
 * Extrai texto de um elemento de forma segura. Se o seletor não for encontrado,
 * lança um erro customizado que pode ser capturado para acionar a auto-correção.
 * @param page A instância da página do Puppeteer.
 * @param selectors O objeto contendo os seletores.
 * @param selectorKey A chave do seletor a ser usado.
 * @param goal Uma descrição do que estamos tentando extrair.
 * @returns O texto extraído.
 */
export async function safeExtract(page: Page, selectors: any, selectorKey: keyof typeof selectors, goal: string): Promise<string> {
    const selector = selectors[selectorKey];
    if (!selector) {
        throw new Error(`SelectorError: Chave de seletor "${selectorKey.toString}" não encontrada.`);
    }
    try {
        await page.waitForSelector(selector, {timeout: 7000});
        return await page.$eval(selector, el => (el as HTMLElement).innerText.trim());
    } catch (error) {
        throw new Error(`SelectorError: Falha ao tentar "${goal}" com a chave "${selectorKey.toString}" (seletor: "${selector}")`);
    }
}