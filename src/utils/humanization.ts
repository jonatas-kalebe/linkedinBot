import {Page} from 'puppeteer';

/**
 * Aguarda por um período aleatório dentro de um intervalo, exibindo uma mensagem.
 * @param page Objeto da página do Puppeteer (atualmente não utilizado, mas mantido para futuras extensões).
 * @param minMillis Tempo mínimo de espera em milissegundos.
 * @param maxMillis Tempo máximo de espera em milissegundos.
 */
export const humanizedWait = async (page: Page, minMillis: number, maxMillis: number) => {
    const waitTime = Math.random() * (maxMillis - minMillis) + minMillis;
    console.log(`-- Humanizing: Aguardando por ${(waitTime / 1000).toFixed(2)} segundos...`);
    await new Promise(res => setTimeout(res, waitTime));
};

/**
 * Simula a digitação de um texto em um campo, caractere por caractere com delay aleatório.
 * @param page Objeto da página do Puppeteer.
 * @param selector O seletor CSS do campo de input.
 * @param text O texto a ser digitado.
 */
export async function typeLikeHuman(page: Page, selector: string, text: string) {
    for (const char of text) {
        await page.type(selector, char, {delay: Math.random() * 150 + 50});
    }
}

/**
 * Executa uma ação aleatória de "cobertura" para quebrar a monotonia do bot,
 * como visitar o feed, rolar a página ou simplesmente não fazer nada.
 * @param page Objeto da página do Puppeteer.
 */
export async function performCoverAction(page: Page) {
    const actions = ['visitFeed', 'scrollRandomly', 'doNothing', 'doNothing'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];

    console.log(`-- Humanizing: Executando ação de cobertura: ${randomAction}`);

    try {
        switch (randomAction) {
            case 'visitFeed':
                await page.goto('https://www.linkedin.com/feed/', {waitUntil: 'domcontentloaded', timeout: 60000});
                await humanizedWait(page, 5000, 15000);
                break;
            case 'scrollRandomly':
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * (Math.random() * 0.8));
                });
                await humanizedWait(page, 3000, 10000);
                break;
            case 'doNothing':
                await humanizedWait(page, 8000, 20000);
                break;
        }
    } catch (e) {
        console.warn(`Aviso: Falha na ação de cobertura. Continuando normalmente.`);
    }
}

/**
 * Verifica se a hora atual está dentro do "horário de trabalho" definido (dias úteis, das 8h às 18h).
 * @returns {boolean} True se estiver no horário de trabalho, false caso contrário.
 */
export function isWithinWorkingHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    if (day === 0 || day === 6) {
        return hour >= 11 && hour < 15;
        return false;
    }
    return hour >= 8 && hour < 19;
}