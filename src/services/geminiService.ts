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
// ... (imports e a função generateContentWithFallback permanecem os mesmos) ...

// ### FUNÇÃO DE ANÁLISE REESCRITA PARA RETORNAR UMA NOTA DE FIT ###
export async function analyzeJobFit(
  jobDescription: string,
  userProfile: string,
  allowedLanguages: string[]
): Promise<{ fit: boolean; fitScore: number; language: string; reason: string }> {
  const prompt = `
    **TAREFA:** Você é um recrutador técnico sênior. Sua tarefa é analisar a vaga de emprego e o perfil do candidato para determinar uma "nota de fit" de 0 a 10 e se o candidato deve prosseguir.

    **CRITÉRIOS DE AVALIAÇÃO:**
    1.  **Idioma:** Primeiro, determine o idioma da vaga. Se não estiver na lista de 'IDIOMAS PERMITIDOS', a nota é 0 e 'isFit' é false.
    2.  **Senioridade:** O candidato tem 4 anos de experiência. Vagas que pedem 3-5 anos são ideais (nota 8-10). Vagas que pedem 1-2 anos são júnior demais (nota 3-5). Vagas que pedem 6+ anos são sênior demais (nota 2-4). Vagas que não especificam são neutras (nota 6-7).
    3.  **Tecnologias Essenciais:** O perfil do candidato é forte em Java, Spring Boot, SQL e APIs RESTful. A vaga DEVE listar estas como requisitos principais para uma nota alta.
    4.  **Tecnologias Secundárias:** O perfil menciona Docker, AWS, Kubernetes. A presença destes na vaga aumenta a nota.
    5.  **Alinhamento de Função:** O candidato busca vagas de backend. Vagas "Full-Stack" com foco em backend são aceitáveis, mas vagas com foco em frontend devem ter nota baixa.

    **FORMATO DA SAÍDA:**
    Retorne um objeto JSON com o formato: {"fit": boolean, "fitScore": number (0-10), "language": "idioma_detectado", "reason": "Justificativa curta para a nota"}
    - 'fit' deve ser 'true' apenas se a nota for 5 ou maior.

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
    return { fit: false, fitScore: 0, language: 'unknown', reason: 'Erro de análise da IA.' };
}
}

export async function generateLatexCV(jobDescription: string, userProfile: string, latexTemplate: string, jobLanguage: string): Promise<string> {
  const prompt = `
    **TAREFA:** Você é um compilador LaTeX. Sua única função é adaptar o template LaTeX fornecido para uma vaga de emprego específica.

    **REGRAS CRÍTICAS DE SAÍDA (NÃO QUEBRE ESTAS REGRAS SOB NENHUMA CIRCUNSTÂNCIA):**
    1.  **SEM MARKDOWN:** A sua resposta DEVE ser APENAS o código LaTeX puro. NÃO inclua \`\`\`latex no início ou \`\`\` no final. A resposta deve começar diretamente com a primeira linha de código LaTeX do template, como \\documentclass{...}.
    2.  **ESCAPE DE CARACTERES ESPECIAIS:** Você DEVE escapar todos os caracteres especiais do LaTeX que aparecerem em texto normal. Os caracteres são: # $ % & _ { } ~ ^ \\. Exemplo: "R&D" deve ser escrito como "R\\&D". Verifique o texto da vaga e do perfil com atenção.
    3.  **PACOTES ESSENCIAIS:** O preâmbulo do documento DEVE conter '\\usepackage[utf8]{inputenc}' e '\\usepackage{fontawesome5}'. Verifique se eles estão presentes.

    **INSTRUÇÕES DE CONTEÚDO:**
    - Mantenha a estrutura geral do template.
    - Adapte o resumo profissional para conectar as habilidades do usuário com os requisitos da vaga.
    - Priorize as habilidades mencionadas na vaga na seção de competências.
    - Adapte todo o texto para o idioma da vaga: '${jobLanguage}'.

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
    **CÓDIGO LATEX GERADO (COMECE DIRETAMENTE COM A PRIMEIRA LINHA DE CÓDIGO):**
  `;
    // Adiciona uma etapa de limpeza final para remover qualquer markdown que a IA possa adicionar por teimosia
    const rawLatex = await generateContentWithFallback(prompt);
    return rawLatex.replace(/```latex/g, '').replace(/```/g, '').trim();
}