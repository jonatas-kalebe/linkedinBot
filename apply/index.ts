import { Page } from 'puppeteer';

import selectors from '../selectors';
import fillFields from '../apply-form/fillFields';
import waitForNoError from '../apply-form/waitForNoError';
import clickNextButton from '../apply-form/clickNextButton';

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
}

async function apply({ page, link, formData, shouldSubmit }: Params): Promise<void> {
  await page.goto(link, { waitUntil: 'load', timeout: 60000 });

  try {
    await clickEasyApplyButton(page);
  } catch {
    console.log(`Easy apply button not found in posting: ${link}`);
    return;
  }

  await page.waitForSelector(`${selectors.easyApplyModal}`, { timeout: 15000 });


  // This loop logic is correct and will work on both modal and full-page forms.
  for (let currentPage = 1; currentPage <= 10; currentPage++) {
    console.log(`Preenchendo página ${currentPage} do formulário...`);
    await fillFields(page, formData);

    const isSubmitButtonVisible = await page.$(
      `${selectors.easyApplyModal} ${selectors.submit}, ${selectors.submit}`
    );

    if (isSubmitButtonVisible) {
      console.log('Página de envio/revisão alcançada.');
      break; // Sai do loop, pois chegou na última página
    }

    try {
      await clickNextButton(page);
    } catch (error) {
      console.log('Não foi possível encontrar o botão "Próximo" ou "Revisar". Assumindo que esta é a última página.');
      break; // Sai do loop se não houver mais botão de próximo
    }

    await waitForNoError(page).catch(noop);
  }

  const submitButton = await page.$(
    `${selectors.easyApplyModal} ${selectors.submit}, ${selectors.submit}`
  );

  if (!submitButton) {
    throw new Error('Submit button not found');
  }

  if (shouldSubmit) {
    await submitButton.click();
  }
}

export default apply;
