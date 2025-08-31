import {GoogleGenerativeAI} from '@google/generative-ai';
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
// Na sua função analyzeJobFit
  const prompt = `
  **TAREFA:** Você é um Agente de Carreira de IA, especialista em recrutamento técnico. Sua missão é analisar a VAGA DE EMPREGO abaixo com base no PERFIL DO USUÁRIO e suas regras, para calcular uma "nota de fit" de 0 a 10. A nota deve representar a probabilidade real de o candidato ser chamado para uma entrevista.

  ---
  **PERFIL DO USUÁRIO (Contexto, Objetivos e Regras):**
  ${userProfile}
  ---
  **DESCRIÇÃO DA VAGA:**
  ${jobDescription}
  ---

  **PROCESSO DE ANÁLISE (SIGA ESTRITAMENTE ESTA ORDEM):**

  **Passo 1: Análise de Idioma.**
  - Determine o idioma da vaga. Se não estiver em ${JSON.stringify(allowedLanguages)}, pare e retorne nota 0.

  **Passo 2: Verificação de Filtros Eliminatórios.**
  - Analise a vaga contra CADA UM dos 'filtrosEliminatorios' do perfil. Se QUALQUER um deles for verdadeiro (ex: a vaga é híbrida, exige residência nos EUA, é CLT padrão no Brasil), pare imediatamente todo o processo e retorne nota 0. Justifique qual filtro foi acionado. Se a vaga não falar nada de remoto considere que o filtro foi acionado e avaga é remota.

  **Passo 3: Identificação do Cenário.**
  - Se a vaga passou pelos filtros eliminatórios, determine em qual dos 'cenariosAceitaveis' do perfil ela melhor se encaixa. Este será o principal fator para a nota base. Se não se encaixar em nenhum, a nota é 0.

  **Passo 4: Cálculo da Nota Base.**
  - Com base no cenário identificado, defina uma nota base:
    - Cenário de prioridade 10 ('PJ Internacional'): Nota base entre 8 e 10.
    - Cenário de prioridade 8 ('CLT em Terceirizada'): Nota base entre 7 e 8.
    - Outros cenários: Nota base proporcional à prioridade.

  **Passo 5: Ajuste Fino da Pontuação (Heurísticas).**
  - A partir da nota base, faça pequenos ajustes usando a 'heuristicaDePontuacao':
    - **Tecnologias:** Compare as tecnologias. A vaga exige Java/Angular (as principais do perfil)? Ótimo, mantenha ou aumente +1 na nota. A vaga pede 5 anos de Python como principal? A nota deveria ter sido 0 no Passo 2, mas se por acaso passou, zere agora. Faltam tecnologias secundárias (AWS, K8s)? Reduza no máximo -1 ponto.
    - **Senioridade:** O perfil tem 4 anos. A vaga pede 3-5? Perfeito. Pede 6+? Reduza -2 pontos. Pede 1-2? Só é válida se for o cenário 'Junior no Exterior', caso contrário, reduza -3 pontos.
    - **Educação:** A vaga exige "Bachelor's degree completed"? Reduza -1 ponto.
    - **Ambiguidade de Localização:** A vaga é "Remote" sem especificar país? Mantenha a nota alta, mas adicione um alerta na justificativa sobre a incerteza.

  **Passo 6: Geração da Saída Final.**
  - Consolide sua análise em um objeto JSON. A justificativa ('reason') deve ser clara, explicando o cenário, a nota base e os ajustes feitos.

  **FORMATO DA SAÍDA (APENAS O OBJETO JSON):**
  {"fit": boolean, "fitScore": number (0-10), "language": "idioma_detectado", "reason": "Cenário: [Nome do Cenário]. Nota Base: [X]. Ajustes: [Ex: -1 por exigir graduação, +1 por match de tecnologia]."}
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
  **TAREFA:** Você é um "Ghostwriter" de Currículos Técnicos Sênior e um compilador LaTeX. Sua missão é reescrever e adaptar o template LaTeX do usuário para criar o currículo MAIS PERFEITO POSSÍVEL para a vaga de emprego específica.

  **DIRETRIZ PRINCIPAL: ALINHAMENTO AGRESSIVO E ESTRATÉGICO**
  Sua tarefa é REESCREVER a história de trabalho do usuário para que ela seja um ESPELHO quase perfeito dos requisitos e da linguagem da vaga. Isso significa que você deve **inferir, adaptar e especificar** as tecnologias e metodologias usadas nas experiências passadas do usuário para que correspondam exatamente ao que a vaga pede. Assuma que o usuário tem a competência técnica subjacente para validar estas adaptações.

  * **Exemplo Prático 1:** Se o perfil do usuário menciona uma experiência genérica como "Desenvolvimento de sistema de backend" e a VAGA exige "experiência com Java e Spring Boot para microserviços", você DEVE reescrever a descrição daquela experiência para ser: "Desenvolvimento e manutenção de microserviços de alta performance utilizando Java e Spring Boot, focando em escalabilidade e resiliência."
  * **Exemplo Prático 2:** Se a VAGA pede "experiência com Java EE e EJB" e o perfil do usuário tem experiência com Java, você DEVE adaptar a descrição para enfatizar o trabalho com "componentes robustos de backend seguindo a arquitetura Java EE, incluindo o uso de Enterprise JavaBeans (EJB) para lógica de negócio."
  * **Exemplo Prático 3:** Se a VAGA valoriza "metodologias ágeis como Scrum", você DEVE inserir nas descrições de experiência frases como "Atuando em um ambiente ágil, participando ativamente de cerimônias Scrum como Daily Stand-ups, Sprint Planning e Retrospectives."

  **REGRAS CRÍTICAS DE SAÍDA (NÃO QUEBRE ESTAS REGRAS):**
  1.  **SEM MARKDOWN:** Sua resposta DEVE ser APENAS o código LaTeX puro. A saída deve começar diretamente com \\documentclass{...} e não conter \`\`\`latex ou \`\`\`.
  2.  **ESCAPE DE CARACTERES ESPECIAIS:** Você DEVE escapar todos os caracteres especiais do LaTeX que aparecerem em texto normal: # $ % & _ { } ~ ^ \\.
  3.  **PACOTES ESSENCIAIS:** O preâmbulo do documento DEVE conter '\\usepackage[utf8]{inputenc}' e '\\usepackage{fontawesome5}'.
  4. Não mude o layout, as cores ou a estrutura do template LaTeX. Apenas preencha e adapte o conteúdo.

  **INSTRUÇÕES DE CONTEÚDO (APLIQUE O ALINHAMENTO AGRESSIVO):**
  1.  **Resumo Profissional:** Crie um Resumo Executivo altamente direcionado que posicione o candidato como a solução ideal e o encaixe perfeito para os desafios e requisitos descritos na vaga. Use as mesmas palavras-chave da vaga.
  2.  **Retrofit Tecnológico nas Experiências:** Para cada experiência profissional listada no template, reescreva os "bullet points" para refletir as tecnologias, arquiteturas e responsabilidades pedidas na VAGA. Transforme descrições genéricas em exemplos específicos que usam a stack tecnológica da vaga.
  3.  **Seção de Competências/Skills Dinâmica:** A seção de habilidades técnicas deve ser populada primariamente com as tecnologias listadas na VAGA, seguidas por outras competências relevantes do perfil do usuário. A ordem e a ênfase devem espelhar a prioridade da vaga.
  4.  **Idioma:** Adapte todo o texto para o idioma da vaga: '${jobLanguage}'.

  ---
  **PERFIL DO USUÁRIO (Base para adaptação):**
  ${userProfile}
  ---
  **TEMPLATE LATEX BASE (A estrutura a ser preenchida):**
  ${latexTemplate}
  ---
  **DESCRIÇÃO DA VAGA (O alvo a ser espelhado):**
  ${jobDescription}
  ---
  **CÓDIGO LATEX GERADO (COMECE DIRETAMENTE COM A PRIMEIRA LINHA DE CÓDIGO):**
`;
    // Adiciona uma etapa de limpeza final para remover qualquer markdown que a IA possa adicionar por teimosia
    const rawLatex = await generateContentWithFallback(prompt);
    return rawLatex.replace(/```latex/g, '').replace(/```/g, '').trim();
}