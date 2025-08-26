import {ElementHandle, Page} from 'puppeteer';

import selectors from '../selectors';
import {isElementFilled, learnAndSave, UnlearnedQuestionError} from "../learning";

async function fillBoolean(page: Page, booleans: { [key: string]: boolean }, resumeText: string): Promise<void> {
  const handledQuestions = new Set<string>();

  const fieldsets = await page.$$('fieldset');
  for (const fieldset of fieldsets) {
    const options = await fieldset.$$(selectors.radioInput);
    if (options.length !== 2) continue;

    const labelEl = await fieldset.$('legend > .t-14');
    if (!labelEl) continue;

    const label = await labelEl.evaluate(el => el.textContent?.trim() || '');
    if (!label) continue;

      for (const [labelRegex, value] of Object.entries(booleans)) {
        if (new RegExp(labelRegex, 'i').test(label)) {
          const valueToClick = value ? 'Yes' : 'No';
          const inputToClick = await fieldset.$(`input[value="${valueToClick}"]`);
          if (inputToClick) {
            await (inputToClick as ElementHandle<HTMLInputElement>).click();
            handledQuestions.add(label);
          }
          break;
        }
      }
    }

  for (const fieldset of fieldsets) {
    const requiredLabelEl = await fieldset.$('legend.fb-dash-form-element__label--is-required');
    if (requiredLabelEl) {
      const label = await requiredLabelEl.evaluate(el => el.textContent?.trim().replace(/\*/g, '').trim() || '');
      if (label && !handledQuestions.has(label)) {
        // ### LÓGICA DE VERIFICAÇÃO ADICIONADA AQUI ###
        if (await isElementFilled(fieldset)) {
          console.log(`- Campo "${label}" já preenchido (provavelmente pelo LinkedIn). Pulando.`);
          continue;
        }

        try {
          // Passa o elemento 'fieldset' para a função de aprendizagem
          const aiAnswer = await learnAndSave(page, fieldset, 'BOOLEANS', label, resumeText);

          // Se a IA retornou uma resposta, preenchemos o campo.
          if (aiAnswer !== null) {
          const valueToClick = (aiAnswer === 'true' || aiAnswer === true) ? 'Yes' : 'No';
          const inputToClick = await fieldset.$(`input[value="${valueToClick}"]`);
          if (inputToClick) await (inputToClick as ElementHandle<HTMLInputElement>).click();
          }
          handledQuestions.add(label);
        } catch (error) {
          if (error instanceof UnlearnedQuestionError) throw error;
          console.error(`Erro ao tentar aprender o campo booleano: ${label}`, error);
        }
      }
    }
  }
  const checkboxes = await page.$$(selectors.checkbox) as ElementHandle<HTMLInputElement>[];

  for (const checkbox of checkboxes) {
    const id = await checkbox.evaluate(el => el.id);
    const label = await page.$eval(`label[for="${id}"]`, el => el.innerText);

    for (const [labelRegex, value] of Object.entries(booleans)) {
      if (new RegExp(labelRegex, "i").test(label)) {
        const previousValue = await checkbox.evaluate(el => el.checked);

        if (value !== previousValue) {
          await checkbox.evaluate(el => el.click());
        }
      }
    }
  }

  const selects = await page.$$(selectors.select);

  for (const select of selects) {
    const options = (await select.$$(selectors.option));

    options.shift();

    if (options.length === 2) {
      const id = await select.evaluate(el => el.id);
      const label = await page.$eval(`label[for="${id}"]`, el => el.innerText);

      for (const [labelRegex, value] of Object.entries(booleans)) {
        if (new RegExp(labelRegex, "i").test(label)) {
          const option = await options[value ? 0 : 1].evaluate((el) => (el as HTMLOptionElement).value);

          await select.select(option);

          continue;
        }
      }
    }
  }
}

export default fillBoolean;
