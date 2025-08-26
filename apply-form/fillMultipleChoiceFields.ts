import {Page} from 'puppeteer';
import selectors from '../selectors';
import {isElementFilled, learnAndSave, UnlearnedQuestionError} from '../learning';

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

    // ### CORREÇÃO 1: FILTRO MUITO MAIS ROBUSTO ###
    // Ignora variações de email, telefone e cidade em múltiplos idiomas.
    if (/e-mail|email address|indirizzo email|phone|telefone|código do país|país|country code|city|cidade/i.test(label)) {
        // Se for um dropdown de email, apenas seleciona a única opção válida
        if(/e-mail|email address|indirizzo email/i.test(label)) {
            const emailOption = await select.$('option:not([value="Select an option"])');
            if(emailOption) {
                const emailValue = await emailOption.evaluate(el => (el as HTMLOptionElement).value);
                await select.select(emailValue);
            }
        }
        handledSelects.add(id);
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
        if (await isElementFilled(select)) {
          console.log(`- Campo "${label}" já preenchido (provavelmente pelo LinkedIn). Pulando.`);
          continue;
        }

            try {
            const availableOptions = await select.$$eval('option', options =>
                options.map(o => o.innerText.trim()).filter(t => t !== '' && !/select an option|selecione uma opção/i.test(t))
            );

            // ### CORREÇÃO 2: LIMPEZA DO LABEL ###
            // Pega apenas a primeira linha do label para evitar duplicação.
            const cleanedLabel = label.split('\n')[0].trim();
            const questionWithOptions = `${cleanedLabel}\nOpções disponíveis: [${availableOptions.join(', ')}]`;

            const aiAnswer = await learnAndSave(page, select, 'MULTIPLE_CHOICE_FIELDS', questionWithOptions, resumeText);

            if (aiAnswer !== null) {
            const optionToSelect = await select.$$eval(selectors.option, (options, val) => {
              const opt = (options as HTMLOptionElement[]).find(o => o.innerText.toLowerCase().includes(val.toLowerCase()));
                    return opt ? opt.value : null;
                }, aiAnswer);

                if (optionToSelect) {
                    await select.select(optionToSelect);
                } else {
                    console.warn(`IA sugeriu "${aiAnswer}", mas não encontrei uma opção correspondente para "${label}".`);
                }
            }
            handledSelects.add(id);
            } catch (error) {
                if (error instanceof UnlearnedQuestionError) throw error;
                console.error(`Erro ao tentar aprender o campo de múltipla escolha: ${label}`, error);
            }
        }
    }
}

export default fillMultipleChoiceFields;