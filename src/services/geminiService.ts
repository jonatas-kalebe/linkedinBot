import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('A variável de ambiente GEMINI_API_KEY não foi definida.');
}

const genAI = new GoogleGenerativeAI(apiKey);


const models = [
//    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
];
let currentModelIndex = 0;

async function generateContentWithFallback(prompt: string): Promise<string> {
  while (currentModelIndex < models.length) {
    try {
      const modelName = models[currentModelIndex];
      console.log(`🧠  Consultando a IA com o modelo: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      console.warn(`⚠️  Modelo ${models[currentModelIndex]} falhou ou atingiu o limite. Tentando o próximo...`);
      currentModelIndex++;
      if (currentModelIndex >= models.length) {
        throw new Error('Todos os modelos da IA falharam ou atingiram o limite de uso.');
      }
    }
  }
  throw new Error('Não foi possível obter resposta de nenhum modelo da IA.');
}

// ### FUNÇÃO DE ANÁLISE REESCRITA E MAIS INTELIGENTE ###
export async function analyzeJobFit(jobDescription: string, userProfile: string, allowedLanguages: string[]): Promise<{ isFit: boolean; language: string; reason: string }> {
  const prompt = `
    **TAREFA:** Você é um recrutador sênior. Analise a vaga e o perfil do usuário e retorne um objeto JSON.

    **PASSOS:**
    1. Determine o idioma principal da 'DESCRIÇÃO DA VAGA'.
    2. Verifique se o idioma detectado está na lista de 'IDIOMAS PERMITIDOS'. Se não estiver, o 'isFit' é false.
    3. Analise se as tecnologias, nível de experiência e tipo de trabalho da vaga são compatíveis com o 'PERFIL DO USUÁRIO'.
    4. Retorne um objeto JSON com o formato: {"isFit": boolean, "language": "idioma_detectado", "reason": "motivo_da_decisão"}

    **EXEMPLOS DE SAÍDA:**
    - {"isFit": true, "language": "portuguese", "reason": "Compatível com Java, Sênior e remoto."}
    - {"isFit": false, "language": "german", "reason": "Idioma não permitido."}
    - {"isFit": false, "language": "english", "reason": "A vaga exige 10 anos de experiência, o perfil tem 4."}

    ---
    **IDIOMAS PERMITIDOS:**
    ${JSON.stringify(allowedLanguages)}
    ---
    **PERFIL DO USUÁRIO:**
    ${userProfile}
    ---
    **DESCRIÇÃO DA VAGA:**
    ${jobDescription}
    ---
    **SAÍDA (APENAS O OBJETO JSON):**
  `;

  try {
    const rawResponse = await generateContentWithFallback(prompt);
    const cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedResponse);
    return result;
  } catch (error) {
    console.error("Erro ao processar resposta da IA. Retornando 'não fit'.", error);
    return { isFit: false, language: 'unknown', reason: 'Erro de análise da IA.' };
}
}

export async function generateLatexCV(jobDescription: string, userProfile: string, latexTemplate: string, jobLanguage: string): Promise<string> {
  const prompt = `
    **TAREFA:** Você é um especialista em LaTeX e recrutamento. Adapte o template de currículo em LaTeX fornecido para que ele seja perfeito para a descrição da vaga.
    **INSTRUÇÕES:** Mantenha a estrutura geral. Adapte o resumo profissional para conectar as habilidades do usuário com os requisitos da vaga. Priorize as habilidades mencionadas na vaga. Adapte o texto para o idioma da vaga: '${jobLanguage}'.
    **SAÍDA:** Retorne APENAS o código LaTeX completo e válido. Não inclua explicações, comentários ou a tag \`\`\`latex.
    ---
    **PERFIL DO USUÁRIO:**
    ${userProfile}
    ---
    **TEMPLATE LATEX BASE:**
    ${latexTemplate}
    ---
    **DESCRIÇÃO DA VAGA:**
    ${jobDescription}
    ---
    **CÓDIGO LATEX GERADO:**
  `;
  return await generateContentWithFallback(prompt);
}