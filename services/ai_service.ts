import {GoogleGenerativeAI} from '@google/generative-ai';
import * as dotenv from 'dotenv';
import config from '../config';

dotenv.config();

class ApiKeyNotSetError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyNotSetError';
    }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new ApiKeyNotSetError('A variável de ambiente GEMINI_API_KEY não foi definida. Crie um arquivo .env.');
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash-latest'});

type QuestionType = 'TEXT_FIELDS' | 'BOOLEANS' | 'MULTIPLE_CHOICE_FIELDS';

export async function getAIAnswer(
    questionLabel: string,
    questionType: QuestionType,
    resumeText: string
): Promise<string> {
    const userProfile = JSON.stringify(config, null, 2);

    const prompt = `
    Você é um assistente de carreira especialista em preencher candidaturas de emprego. Sua tarefa é responder a uma pergunta de um formulário de emprego com base no meu perfil e currículo.

    **REGRAS E FORMATO DA RESPOSTA:**
    1.  **Seja direto.** Sua resposta deve ser apenas o texto que seria inserido no campo, nada mais.
    2.  **Use apenas o contexto fornecido.** Não invente experiências.
    3.  **Para perguntas BOOLEANAS (sim/não):** Responda APENAS com 'true' ou 'false'.
    4.  **Para perguntas de TEXTO sobre "anos de experiência" ou "years of experience":** Analise meu perfil e currículo para a tecnologia/habilidade mencionada e responda APENAS com um número.
    5.  **Para perguntas sobre SALÁRIO:** Com base no cargo, minha experiência e localização, pesquise e forneça uma faixa salarial realista. Responda apenas com o valor numérico (ex: "90000", "15000").
    6.  **Para perguntas de MÚLTIPLA ESCOLHA:** A pergunta incluirá as opções disponíveis no formato "[Opção A, Opção B, Opção C]". Sua resposta deve ser EXATAMENTE uma das opções fornecidas, a que melhor corresponder ao meu perfil.
    7.  **Para perguntas sobre CÓDIGO DE PAÍS / DDI:** Use a informação do meu telefone no perfil. Ex: Se o telefone for "+5562...", o código do país é "Brazil (+55)". Responda com o texto exato da opção.
    8.  **Se a informação não estiver disponível ou você não tiver certeza:** Responda com a palavra exata 'PREENCHER'.

    ---
    **MEU PERFIL (config.ts):**
    ${userProfile}

    ---
    **MEU CURRÍCULO:**
    ${resumeText}

    ---
    **PERGUNTA DO FORMULÁRIO:**
    - **Tipo de Resposta Esperada:** ${questionType}
    - **Pergunta:** "${questionLabel}"

    **SUA RESPOSTA:**
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().trim();

        console.log(`🤖 Resposta da IA (Gemini 1.5 Flash) para "${questionLabel}": ${text}`);

        if (!text || text.length > 200) {
            return 'PREENCHER';
        }

        return text;
    } catch (error) {
        console.error('Erro ao chamar a API do Gemini:', error);
        return 'PREENCHER';
    }
}