import * as fs from 'fs';
import * as path from 'path';
import { getAIAnswer } from '../services/ai_service'; // Ajuste o caminho se necessário
import { ElementHandle, Page } from 'puppeteer';

type QuestionType = 'TEXT_FIELDS' | 'BOOLEANS' | 'MULTIPLE_CHOICE_FIELDS';

const learnedConfigPath = path.join(__dirname, '../../learned_config.json');

// Erro customizado para pular a vaga quando a IA não sabe a resposta
export class UnlearnedQuestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnlearnedQuestionError';
  }
}
export async function isElementFilled(element: ElementHandle): Promise<boolean> {
    try {
        const value = await element.evaluate(el => {
            if (el.tagName === 'FIELDSET') { // Para Rádios
                const checkedRadio = el.querySelector('input[type="radio"]:checked') as HTMLInputElement;
                return checkedRadio ? checkedRadio.value : null;
            }
            // Para Inputs de Texto e Selects
            return (el as HTMLInputElement | HTMLSelectElement).value;
        });
        // Considera preenchido se tiver um valor que não seja o padrão de "selecione uma opção"
        return value !== null && value.trim() !== '' && value.toLowerCase() !== 'select an option';
    } catch (error) {
        return false;
    }
}
// Função auxiliar para obter o valor de diferentes tipos de elementos de formulário.
async function getElementValue(element: ElementHandle): Promise<string | null> {
    try {
        return await element.evaluate(el => {
            if (el.tagName === 'FIELDSET') { // Para Rádios
                const checkedRadio = el.querySelector('input[type="radio"]:checked') as HTMLInputElement;
                return checkedRadio ? checkedRadio.value : null;
            }
            // Para Inputs de Texto e Selects
            return (el as HTMLInputElement | HTMLSelectElement).value;
        });
    } catch (error) {
        console.warn('Não foi possível obter o valor do elemento.', error);
        return null;
    }
}

/**
 * Orquestra o processo de aprendizado: espera por intervenção humana e, se não houver, consulta a IA.
 * Garante que perguntas novas sejam sempre salvas.
 */
export async function learnAndSave(
  page: Page,
  element: ElementHandle,
  type: QuestionType,
  questionLabel: string,
  resumeText: string
): Promise<any> {
  const originalQuestionLabel = questionLabel.split('\n')[0].trim();
  console.log(`❓ Nova pergunta (${type}) encontrada: "${originalQuestionLabel}"`);
  console.log('    Aguardando 20 segundos por uma resposta manual na janela do navegador...');

  const initialValue = await getElementValue(element);
  await page.waitForTimeout(20000);
  const finalValue = await getElementValue(element);

  const config = JSON.parse(fs.readFileSync(learnedConfigPath, 'utf-8'));

  // 1. Verifica se houve intervenção humana
  if (finalValue !== null && String(finalValue).trim() !== '' && finalValue !== initialValue) {
    console.log(`🙋 Entrada manual detectada! Resposta: "${finalValue}"`);

    let valueToSave;
    if (type === 'BOOLEANS') {
        valueToSave = finalValue.toLowerCase() === 'yes';
    } else if (type === 'MULTIPLE_CHOICE_FIELDS') {
        valueToSave = await element.evaluate(el => {
            const select = el as HTMLSelectElement;
            return select.options[select.selectedIndex]?.innerText.trim() || finalValue;
        });
    }else valueToSave = finalValue;

    config[type][originalQuestionLabel] = valueToSave;
    fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));
    console.log(`💾 Pergunta e sua resposta foram salvas em learned_config.json.`);

    return null; // Humano preencheu, não é preciso fazer mais nada.
  }

  // 2. Se não houve intervenção, salva a pergunta para revisão manual ANTES de chamar a IA
  console.log('    Nenhuma entrada manual detectada. Salvando pergunta para revisão manual...');
  config[type][originalQuestionLabel] = 'PREENCHER';
  fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));

  // 3. Agora, tenta obter uma resposta melhor com a IA
  console.log('    Consultando IA...');
  const aiAnswer = await getAIAnswer(questionLabel, type, resumeText);

  // Se a IA falhou, o valor 'PREENCHER' já está salvo. Apenas pulamos a vaga.
  if (aiAnswer.toUpperCase() === 'PREENCHER') {
    console.log(`💾 A IA não soube responder. A pergunta já está salva em learned_config.json para sua revisão.`);
    throw new UnlearnedQuestionError('A IA não conseguiu determinar a resposta, vaga pulada.');
  }

  // 4. Se a IA teve sucesso, atualiza o 'PREENCHER' com a resposta da IA
  console.log(`✅ IA respondeu: "${aiAnswer}". Atualizando e salvando para uso futuro.`);
  config[type][originalQuestionLabel] = aiAnswer;
  fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));

  return aiAnswer; // Retorna a resposta da IA para ser usada imediatamente.
}