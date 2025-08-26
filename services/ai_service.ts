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
    **PERSONA E OBJETIVO:** Você é um assistente de carreira pragmático. Sua única função é analisar o perfil, o currículo e uma pergunta de um formulário de emprego e fornecer a resposta mais lógica e curta possível.

    **REGRAS DE OURO:**
    1.  **FORMATO É TUDO:** Sua resposta deve ser *APENAS* o valor a ser preenchido. Sem explicações, sem frases, sem "Com base em...".
    2.  **LÓGICA DE ESCOLHA:**
        - Se a pergunta incluir "Opções disponíveis: [...]", você **DEVE** escolher a opção mais lógica da lista e retornar seu texto exato. Para "Email address", a resposta óbvia é o e-mail da lista.
        - Se for sobre anos de experiência, use o perfil e o currículo para encontrar a informação e retorne **APENAS UM NÚMERO**.
        - Se for uma pergunta de Sim/Não (BOOLEAN), retorne **APENAS** 'true' ou 'false'.
    3.  **IDIOMA:** Responda no mesmo idioma da pergunta. Se a pergunta for "Numero di telefono cellulare", sua resposta deve ser o número de telefone.
    4.  **PLANO B:** Se a informação for impossível de deduzir, retorne a palavra exata 'PREENCHER'. Não invente.

    **EXEMPLOS:**
    - Pergunta: "Qual seu nível de inglês? Opções disponíveis: [Básico, Conversação, Fluente]"
    - Sua Resposta: Fluente
    - Pergunta: "Years of experience with Spring Boot?"
    - Sua Resposta: 4
    - Pergunta: "Email address Opções disponíveis: [meu.email@exemplo.com]"
    - Sua Resposta: meu.email@exemplo.com

    ---
    **MEU PERFIL (config.ts):**
    ${userProfile}

    ---
    **MEU CURRÍCULO:**
    ${resumeText}

    ---
    **PERGUNTA DO FORMULÁRIO:**
    - Tipo de Resposta Esperada: ${questionType}
    - Pergunta: "${questionLabel}"

    **SUA RESPOSTA:**
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().trim();

    console.log(`🤖 Resposta da IA (Gemini 1.5 Flash) para "${questionLabel.split('\n')[0]}": ${text}`);

        if (!text || text.length > 200) {
            return 'PREENCHER';
        }

        return text;
    } catch (error) {
        console.error('Erro ao chamar a API do Gemini:', error);
        return 'PREENCHER';
    }
}