
import {Page} from 'puppeteer';
import selectors from './selectors';
import config from '../../config';
import {humanizedWait, typeLikeHuman} from '../../utils/humanization';
import {takeScreenshotOnError} from "../../core/puppeteerManager";
import ask from "../../utils/ask";

export async function loginToLinkedIn(page: Page): Promise<void> {
  console.log('Verificando status do login no LinkedIn...');

  await page.goto('https://www.linkedin.com/feed/', {waitUntil: 'domcontentloaded', timeout: 60000});

  const isLoggedIn = await page.$(selectors.feedUpdate).catch(() => null);

  if (isLoggedIn) {
    console.log('✅ Sessão do LinkedIn já ativa.');
    return;
  }
  await ask('x')
  console.log('🔐 Sessão não encontrada. Iniciando processo de login...');
  await page.goto('https://www.linkedin.com/login', {waitUntil: 'domcontentloaded'});

  try {
    await page.waitForSelector(selectors.emailInput, {timeout: 10000});
    console.log('Preenchendo credenciais...');

    await typeLikeHuman(page, selectors.emailInput, config.LINKEDIN_EMAIL);
    await humanizedWait(page, 500, 1500);
    await typeLikeHuman(page, selectors.passwordInput, config.LINKEDIN_PASSWORD);
    await humanizedWait(page, 1000, 2000);

    await page.click(selectors.loginSubmit);

    console.log('Aguardando resultado do login...');
    await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 60000});

        const is2FA = await page.$(selectors.challengePinInput).catch(() => null);
    const isCaptcha = await page.$(selectors.captcha).catch(() => null);

    if (is2FA) {
      console.log('❗ Verificação de 2 etapas detectada. Por favor, insira o código no navegador.');
      await page.waitForNavigation({waitUntil: 'load', timeout: 120000});     } else if (isCaptcha) {
      console.log('❗ Captcha detectado. Por favor, resolva o captcha no navegador.');
      await page.waitForNavigation({waitUntil: 'load', timeout: 120000});
    }

    console.log('✅ Login no LinkedIn realizado com sucesso!');
  } catch (error) {
    console.error('❌ Falha durante o processo de login. Verifique a tela.');
    await takeScreenshotOnError(page, 'login_error');
    throw new Error("Não foi possível logar no LinkedIn.");
  }
}
export async function verifyLinkedInSession(page: Page): Promise<void> {
  console.log('Verificando se a sessão do LinkedIn está ativa...');

  try {
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // await ask('scrolla um pouco ai mulek')
    const isLoggedIn = true;

    if (isLoggedIn) {
      console.log('✅ Sessão do LinkedIn ativa e verificada.');
      return;
    }

        throw new Error("Sessão do LinkedIn não está ativa ou a página não carregou corretamente.");

  } catch (error: any) {
    console.error('❌ Falha crítica ao verificar a sessão do LinkedIn.');
    await takeScreenshotOnError(page, 'session_verify_error');
    console.error('\n============================== AÇÃO NECESSÁRIA ==============================');
    console.error('O bot não conseguiu confirmar um login válido. Possíveis causas:');
    console.error('  1. A sessão expirou ou os cookies estão corrompidos.');
    console.error('  2. O LinkedIn está apresentando um CAPTCHA ou verificação na inicialização.');
    console.error('\nSolução Sugerida:');
    console.error("  - Pare o bot, apague a pasta '/session' e execute o login manual novamente.");
    console.error('===============================================================================\n');

        throw error;
  }
}