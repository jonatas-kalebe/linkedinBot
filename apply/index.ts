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
    console.log(`Easy apply button not found in posting: ${link}`);
    return;
  }

  await page.waitForSelector(`${selectors.easyApplyModal}`, { timeout: 15000 });


    for (let currentPage = 1; currentPage <= 10; currentPage++) {
    console.log(`Preenchendo página ${currentPage} do formulário...`);
      await fillFields(page, formData, resumeText);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const isSubmitButtonVisible = await page.$(selectors.submit);

    if (isSubmitButtonVisible) {
      console.log('Página de envio/revisão alcançada.');
      break;
    }

    try {
      await clickNextButton(page);
    } catch (error) {
      console.log('Não foi possível encontrar o botão "Próximo". Verificando se é a última página...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      const finalSubmitCheck = await page.$(selectors.submit);
      if (finalSubmitCheck) {
        console.log('Botão de envio encontrado após verificação final.');
        break;
      } else {
        throw new Error('Não foi possível encontrar um botão para avançar ou finalizar a candidatura.');
    }
    }
    await waitForNoError(page).catch(noop);
  }

    const submitButton = await page.waitForSelector(selectors.submit, {visible: true, timeout: 10000});

  if (!submitButton) {
    throw new Error('Botão "Submit" não foi encontrado na página final.');
  }

  if (shouldSubmit) {
    await submitButton.click();

    console.log('Candidatura enviada. Aguardando confirmação do LinkedIn...');
    await page.waitForSelector(selectors.appliedToJobFeedback, {timeout: 15000});

    await new Promise(resolve => setTimeout(resolve, 2000));

  } else {
    console.log('Modo de simulação (dry run). O botão "Enviar" não foi clicado.');
  }

  } catch (error: any) {
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
