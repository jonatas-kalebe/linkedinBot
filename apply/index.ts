import {Page} from 'puppeteer';

import selectors from '../selectors';
import fillFields from '../apply-form/fillFields';
import waitForNoError from '../apply-form/waitForNoError';
import clickNextButton from '../apply-form/clickNextButton';
import fs from "fs";
import path from "path";

const noop = () => { };

async function clickEasyApplyButton(page: Page): Promise<void> {
  const candidates = [
    selectors.easyApplyButtonEnabled,
    selectors.easyApplyButtonId,
    selectors.easyApplyButtonAria
  ];

  await page.waitForFunction(
    (sels) => sels.some((s) => !!document.querySelector(s)),
    { timeout: 15000 },
    candidates
  );

  await page.evaluate((sels) => {
    const el =
      sels
        .map((s) => document.querySelector<HTMLElement>(s))
        .find((n) => !!n) || null;
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.click();
    }
  }, candidates);

  await page.waitForFunction(
    (sels) => sels.some((s) => !!document.querySelector(s)),
    { timeout: 15000 },
    [selectors.easyApplyModal, selectors.easyApplyHeader, selectors.enabledSubmitOrNextButton]
  );
}

export interface ApplicationFormData {
  phone: string;
  cvPath: string;
  homeCity: string;
  coverLetterPath: string;
  yearsOfExperience: { [key: string]: number };
  languageProficiency: { [key: string]: string };
  requiresVisaSponsorship: boolean;
  booleans: { [key: string]: boolean };
  textFields: { [key: string]: string };
  multipleChoiceFields: { [key: string]: string };
}

interface Params {
  page: Page;
  link: string;
  formData: ApplicationFormData;
  shouldSubmit: boolean;
  resumeText: string;
}

async function apply({page, link, formData, shouldSubmit, resumeText}: Params): Promise<void> {
  try {
  await page.goto(link, { waitUntil: 'load', timeout: 60000 });

  try {
    await clickEasyApplyButton(page);
  } catch {
      console.log(`Botão "Easy Apply" não encontrado na vaga: ${link}`);
    return;
  }

  await page.waitForSelector(`${selectors.easyApplyModal}`, { timeout: 15000 });

    // ### LÓGICA DE LOOP TOTALMENTE REFEITA ###
    // Um loop 'while' que roda até 20 vezes (um limite de segurança alto)
    // ou até encontrar o botão de submeter.
    let currentPage = 1;
    while (currentPage <= 20) { // Limite de segurança para evitar loops infinitos
    console.log(`Preenchendo página ${currentPage} do formulário...`);
      await fillFields(page, formData, resumeText);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 1. VERIFICA SE É A PÁGINA FINAL (com botão de submeter)
      const submitButton = await page.$(selectors.submit);
      if (submitButton) {
        console.log('Página de envio/revisão alcançada. Finalizando...');
  if (shouldSubmit) {
    await submitButton.click();

    console.log('Candidatura enviada. Aguardando confirmação do LinkedIn...');
    await page.waitForSelector(selectors.appliedToJobFeedback, {timeout: 15000});

    await new Promise(resolve => setTimeout(resolve, 2000));

  } else {
    console.log('Modo de simulação (dry run). O botão "Enviar" não foi clicado.');
  }
        return; // **SUCESSO!** Sai da função apply.
      }

      // 2. SE NÃO FOR A PÁGINA FINAL, PROCURA O BOTÃO DE AVANÇAR
      try {
        await clickNextButton(page);
      } catch (error) {
        // Se não encontrou nem "Enviar" nem "Avançar", o bot está preso.
        throw new Error('Não foi possível encontrar um botão para avançar ou finalizar a candidatura.');
      }

      await waitForNoError(page).catch(noop);
      currentPage++;
    }

    // Se o loop atingir o limite de 20 páginas, lança um erro de segurança.
    throw new Error('A candidatura excedeu o limite de 20 páginas. Abortando.');

  } catch (error: any) {
    if (error.name === 'UnlearnedQuestionError') {
        // Se o erro for de uma pergunta nova, ele será relançado para o index.ts tratar
        throw error;
    }

    // Para todos os outros erros, salva o HTML
    console.error(`❌ Ocorreu um erro inesperado ao tentar aplicar para a vaga: ${link}`);
    console.error(`Detalhes do erro: ${error.message}`);

    try {
      const logDir = path.join(__dirname, '..', 'error_logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, {recursive: true});
      }

      const fileName = `error-page-${Date.now()}.html`;
      const filePath = path.join(logDir, fileName);
      const htmlContent = await page.content();
      fs.writeFileSync(filePath, htmlContent);

      console.log(`📄 O HTML da página no momento do erro foi salvo em: ${filePath}`);

    } catch (saveError: any) {
      console.error(`Falha ao salvar o arquivo HTML do erro: ${saveError.message}`);
    }

    throw error;
  }
}

export default apply;
