import {Page} from 'puppeteer';
import selectors from '../selectors';
import changeTextInput from './changeTextInput';
import {learnAndSave, UnlearnedQuestionError} from '../learning';

interface TextFields {
  [labelRegex: string]: string | number;
}

async function fillTextFields(page: Page, textFields: TextFields, resumeText: string): Promise<void> {
  const inputs = await page.$$(selectors.textInput);
  const handledInputs = new Set<string>();

  for (const input of inputs) {
    const id = await input.evaluate((el) => el.id);
    if (!id) continue;
    const label = await page.$eval(`label[for="${id}"]`, (el) => (el as HTMLElement).innerText.trim()).catch(() => '');
    if (!label) continue;

    for (const [labelRegex, value] of Object.entries(textFields)) {
      if (new RegExp(labelRegex, 'i').test(label)) {
        await changeTextInput(input, '', value.toString());
        handledInputs.add(id);
        break;
      }
    }
  }

  const requiredInputs = await page.$$(`${selectors.textInput}[required]`);
  for (const input of requiredInputs) {
    const id = await input.evaluate((el) => el.id);
    if (!id || handledInputs.has(id)) continue;

    const label = await page.$eval(`label[for="${id}"]`, (el) => (el as HTMLElement).innerText.trim()).catch(() => '');
    if (label) {
      try {
        // Passa o elemento 'input' para a função de aprendizagem
        const aiAnswer = await learnAndSave(page, input, 'TEXT_FIELDS', label, resumeText);

        // Se a IA retornou uma resposta (não foi intervenção humana), preenchemos o campo.
        if (aiAnswer !== null) {
        await changeTextInput(input, '', aiAnswer.toString());
        }
        handledInputs.add(id);
      } catch (error) {
        if (error instanceof UnlearnedQuestionError) throw error;
        console.error(`Erro ao tentar aprender o campo de texto: ${label}`, error);
      }
    }
  }
}

export default fillTextFields;