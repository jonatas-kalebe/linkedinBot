import * as fs from 'fs';
import * as path from 'path';
import { getAIAnswer } from '../services/ai_service'; // Ajuste o caminho se necessário
import { ElementHandle, Page } from 'puppeteer';

type QuestionType = 'TEXT_FIELDS' | 'BOOLEANS' | 'MULTIPLE_CHOICE_FIELDS';

const learnedConfigPath = path.join(__dirname, '../../learned_config.json');

// Erro customizado para pular a vaga
export class UnlearnedQuestionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnlearnedQuestionError';
    }
}


async function getElementValue(element: ElementHandle, type: QuestionType): Promise<any> {
    switch (type) {
        case 'TEXT_FIELDS':
        case 'MULTIPLE_CHOICE_FIELDS':
            return element.evaluate(el => (el as HTMLInputElement | HTMLSelectElement).value);
        case 'BOOLEANS': // Para radio buttons (fieldset)
            const yes = await element.$('input[value="Yes"]');
            if (yes && await yes.evaluate(el => (el as HTMLInputElement).checked)) return 'Yes';
            const no = await element.$('input[value="No"]');
            if (no && await no.evaluate(el => (el as HTMLInputElement).checked)) return 'No';
            return null;
        default:
            return null;
    }
}

/**
 * Orquestra o processo de aprendizado: espera por intervenção humana e, se não houver, consulta a IA.
 * @returns A resposta da IA se utilizada, ou `null` se um humano interveio (pois o campo já está preenchido).
 */
export async function learnAndSave(
    page: Page,
    element: ElementHandle, // O elemento do Puppeteer (input, fieldset, etc.)
    type: QuestionType,
    questionLabel: string,
    resumeText: string
): Promise<any> {
    console.log(`❓ Nova pergunta (${type}) encontrada: "${questionLabel}"`);
    console.log('    Aguardando 20 segundos por uma resposta manual na janela do navegador...');

    const initialValue = await getElementValue(element, type);

    await page.waitForTimeout(20000); // Espera 20 segundos

    const finalValue = await getElementValue(element, type);

    // Verifica se o valor mudou e não está vazio
    if (finalValue && finalValue !== initialValue) {
        console.log(`🙋 Entrada manual detectada! Resposta: "${finalValue}"`);
        const config = JSON.parse(fs.readFileSync(learnedConfigPath, 'utf-8'));

        // Converte a resposta para o tipo correto antes de salvar
        let valueToSave = finalValue;
        if (type === 'BOOLEANS') {
            valueToSave = finalValue === 'Yes';
        }

        config[type][questionLabel] = valueToSave;
        fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));
        console.log(`💾 Pergunta e sua resposta foram salvas em learned_config.json.`);

        // Retorna null para indicar que a função de preenchimento não precisa fazer mais nada.
        return null;
    }

    // Se não houve intervenção humana, continua com a IA
    console.log('    Nenhuma entrada manual detectada. Consultando IA...');
    const aiAnswer = await getAIAnswer(questionLabel, type, resumeText);

    if (aiAnswer.toUpperCase() === 'PREENCHER') {
        const config = JSON.parse(fs.readFileSync(learnedConfigPath, 'utf-8'));
        config[type][questionLabel] = 'PREENCHER';
        fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));
        console.log(`💾 A IA não soube responder. Pergunta salva em learned_config.json para revisão manual.`);
        throw new UnlearnedQuestionError('A IA não conseguiu determinar a resposta, vaga pulada.');
    }

    console.log(`✅ IA respondeu: "${aiAnswer}". Salvando para uso futuro.`);
    const config = JSON.parse(fs.readFileSync(learnedConfigPath, 'utf-8'));
    config[type][questionLabel] = aiAnswer;
    fs.writeFileSync(learnedConfigPath, JSON.stringify(config, null, 2));

    return aiAnswer;
}