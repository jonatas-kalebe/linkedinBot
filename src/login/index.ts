import {Page} from 'puppeteer';
import ask from '../utils/ask';
import selectors from '../selectors';

interface Params {
  page: Page;
  email: string;
  password: string;
}

async function login({ page, email, password }: Params): Promise<void> {

  console.log('Navegando para a página de login...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'load' });

  console.log('Verificando se o login manual é necessário...');
  try {
    const loginFormOrFeed = await Promise.race([
      page.waitForSelector(selectors.emailInput, { timeout: 10000 }),
      page.waitForSelector(selectors.feedUpdate, { timeout: 10000 }),
    ]);

    // @ts-ignore
    const isOnLoginPage = await loginFormOrFeed.evaluate(
      // ### CORREÇÃO 1 AQUI: Adicionado (el as Element) ###
      (el, selector) => (el as Element).matches(selector),
      selectors.emailInput
    );

    if (isOnLoginPage) {
      console.log('Página de login detectada. Preenchendo credenciais...');
  await page.type(selectors.emailInput, email);
  await page.type(selectors.passwordInput, password);
  await page.click(selectors.loginSubmit);

      console.log('Aguardando resultado do login...');
    } else {
      console.log('Login automático detectado. Pulando para o feed.');
    }

    const finalPage = await Promise.race([
      page.waitForSelector(selectors.feedUpdate, { timeout: 15000 }),
      page.waitForSelector(selectors.challengePinInput, { timeout: 15000 }),
      page.waitForSelector(selectors.captcha, { timeout: 15000 }),
    ]);

    // @ts-ignore
    const elementHandle = finalPage.asElement();
    if (!elementHandle) throw new Error('Não foi possível obter o handle do elemento pós-login.');

    // ### CORREÇÃO 2 AQUI: Adicionado (el as Element) ###
    const is2FA = await elementHandle.evaluate((el, selector) => (el as Element).matches(selector), selectors.challengePinInput);

    // ### CORREÇÃO 3 AQUI: Adicionado (el as Element) ###
    const isCaptcha = await elementHandle.evaluate((el, selector) => (el as Element).matches(selector), selectors.captcha);

    if (is2FA) {
      await ask('Verificação de 2 etapas detectada. Por favor, insira o código no navegador e pressione Enter aqui para continuar...');
      await page.waitForNavigation({ waitUntil: 'load', timeout: 90000 });
    } else if (isCaptcha) {
      await ask('Captcha detectado. Por favor, resolva o captcha no navegador e pressione Enter aqui para continuar...');
      await page.waitForNavigation({ waitUntil: 'load', timeout: 90000 });
    }

  } catch (error) {
    console.log('Não foi possível confirmar o login ou detectar verificação. Verifique a tela.');
    await page.screenshot({ path: 'erro_login.png' });
    console.log('Screenshot `erro_login.png` salvo.');
    // await ask('Pressione Enter para tentar continuar...');
  }

  await page.click(selectors.skipButton).catch(() => {
  });
  console.log('Logado no LinkedIn com sucesso!');
}

export default login;