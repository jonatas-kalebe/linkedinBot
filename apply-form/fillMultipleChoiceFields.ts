import {Page} from 'puppeteer';
import selectors from '../selectors';
import {learnAndSave, UnlearnedQuestionError} from '../learning';

interface MultipleChoiceFields {
  [labelRegex: string]: string;
}

async function fillMultipleChoiceFields(page: Page, multipleChoiceFields: MultipleChoiceFields, resumeText: string): Promise<void> {
  const selects = await page.$$(selectors.select);
    const handledSelects = new Set<string>();

  for (const select of selects) {
    const id = await select.evaluate((el) => el.id);
      if (!id) continue;
      const label = await page.$eval(`label[for="${id}"]`, (el) => (el as HTMLElement).innerText.trim()).catch(() => '');
      if (!label) continue;

    if (/e-mail|phone|telefone|código do país|city|cidade/i.test(label)) {
        handledSelects.add(id); // Marca como "ignorado" para não ser aprendido
        continue;
    }

    for (const [labelRegex, value] of Object.entries(multipleChoiceFields)) {
      if (new RegExp(labelRegex, 'i').test(label)) {
        const optionToSelect = await select.$$eval(selectors.option, (options, val) => {
          const opt = (options as HTMLOptionElement[]).find(o => o.innerText.toLowerCase().includes(val.toLowerCase()));
            return opt ? opt.value : null;
        }, value);

        if (optionToSelect) {
          await select.select(optionToSelect);
            handledSelects.add(id);
        }
          break;
      }
    }
  }

    const requiredSelects = await page.$$(`${selectors.select}[required]`);
    for (const select of requiredSelects) {
        const id = await select.evaluate((el) => el.id);
        if (!id || handledSelects.has(id)) continue;

        const label = await page.$eval(`label[for="${id}"]`, (el) => (el as HTMLElement).innerText.trim()).catch(() => '');
        if (label) {
            try {
            const availableOptions = await select.$$eval('option', options =>
                options.map(o => o.innerText).filter(t => t.trim() !== '' && !/select/i.test(t))
            );

            // Cria uma pergunta mais contextual para a IA
            const questionWithOptions = `${label}\nOpções disponíveis: [${availableOptions.join(', ')}]`;

            const aiAnswer = await learnAndSave(page, select, 'MULTIPLE_CHOICE_FIELDS', questionWithOptions, resumeText);

            const optionToSelect = await select.$$eval(selectors.option, (options, val) => {
              const opt = (options as HTMLOptionElement[]).find(o => o.innerText.toLowerCase().includes(val.toLowerCase()));
                    return opt ? opt.value : null;
                }, aiAnswer);

                if (optionToSelect) {
                    await select.select(optionToSelect);
                    handledSelects.add(id);
                } else {
                    console.warn(`IA sugeriu "${aiAnswer}", mas não encontrei uma opção correspondente para "${label}".`);
                }
            } catch (error) {
                if (error instanceof UnlearnedQuestionError) throw error;
                console.error(`Erro ao tentar aprender o campo de múltipla escolha: ${label}`, error);
            }
        }
    }
}

export default fillMultipleChoiceFields;