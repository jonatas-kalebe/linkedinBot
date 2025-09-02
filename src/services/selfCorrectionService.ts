import * as fs from 'fs';
import * as path from 'path';
import {Page} from 'puppeteer';
import {generateWithRetry} from "./geminiService";
import {cleanHtmlForAnalysisCheerio} from "../utils/htmlUtils";


interface CorrectionContext {
    siteName: string;
    failedUrl: string;
    goal: string;
    brokenSelectorKey: string;
    selectorsFilePath: string;
}

// << CORREÇÃO: A interface de resultado agora é genérica >>
// Ela aceita um tipo 'T', que será a forma específica do nosso objeto de seletores.
interface CorrectionResult<T> {
    path: string;
    selectors: T;
}

/**
 * Tenta corrigir um arquivo de seletores quebrado usando a IA.
 * @param page A instância da página do Puppeteer.
 *- O prompt permanece o mesmo
 * @param context O contexto da falha.
 * @returns {Promise<CorrectionResult<T> | null>} O caminho para o arquivo temporário e o objeto de seletores corrigido.
 */
// << CORREÇÃO: A função agora é genérica, recebendo o tipo <T> >>
export async function attemptSelfCorrection<T>(page: Page, context: CorrectionContext): Promise<CorrectionResult<T> | null> {
    console.warn(`\n--- 🤖 INICIANDO CICLO DE AUTO-CORREÇÃO para [${context.siteName}] ---`);
    console.warn(`- Motivo: Falha ao tentar "${context.goal}" com a chave "${context.brokenSelectorKey}"`);

    try {
        const selectorsFileContent = fs.readFileSync(context.selectorsFilePath, 'utf-8');
        const rawPageHtml = await page.content();
        const cleanedHtml = cleanHtmlForAnalysisCheerio(rawPageHtml);

        const prompt = `
          **TAREFA:** Você é um Engenheiro de Software Sênior, especialista em Web Scraping. Um seletor de CSS em um dos meus scripts quebrou porque o layout do site mudou. Sua missão é analisar o HTML da página e corrigir o arquivo de seletores para que ele volte a funcionar.

          **CONTEXTO:**
          - Site: ${context.siteName}
          - URL da Falha: ${context.failedUrl}
          - Objetivo no Momento da Falha: ${context.goal}
          - Chave do Seletor que Falhou: "${context.brokenSelectorKey}"

          **ENTRADAS:**
          1. CONTEÚDO DO ARQUIVO DE SELETORES ATUAL (QUEBRADO):
          \`\`\`typescript
          ${selectorsFileContent}
          \`\`\`

          2. **HTML LIMPO E ESTRUTURAL DA PÁGINA ONDE O ERRO OCORREU:**
          \`\`\`html
          ${cleanedHtml} 
          \`\`\`

          **INSTRUÇÕES DE SAÍDA:**
          - Sua resposta deve ser **APENAS O CÓDIGO COMPLETO E CORRIGIDO** do arquivo de seletores.
          - Não inclua nenhuma explicação, introdução, ou markdown como \`\`\`typescript.
          - A resposta deve começar diretamente com "export default {" e terminar com "};".
        `;

        // A lógica de limpeza do markdown da IA já está aqui
        const rawCorrectedCode = await generateWithRetry(prompt);
        let correctedCode = rawCorrectedCode;
        const codeBlockRegex = /```(?:typescript|json)?\s*([\s\S]*?)\s*```/;
        const match = rawCorrectedCode.match(codeBlockRegex);

        if (match && match[1]) {
            correctedCode = match[1];
        } else {
            correctedCode = rawCorrectedCode.replace(/^```(typescript|json)?\s*$/gm, '').replace(/^```\s*$/gm, '');
        }
        correctedCode = correctedCode.trim();

        if (!correctedCode.startsWith('export default {')) {
            console.error('- ❌ A IA retornou uma resposta em formato inválido após a limpeza. Abortando correção.');
            return null;
        }

        const tempFileName = `${path.basename(context.selectorsFilePath, '.ts')}.${Date.now()}.ts`;
        const tempFilePath = path.join(path.dirname(context.selectorsFilePath), tempFileName);

        fs.writeFileSync(tempFilePath, correctedCode);
        console.log(`- ✅ IA retornou uma correção. Salvo em arquivo temporário: ${tempFileName}`);

        // << CORREÇÃO DO BUG: Carrega o novo módulo aqui e retorna o objeto >>
        try {
            delete require.cache[require.resolve(tempFilePath)];
            const newSelectors = require(tempFilePath).default;
            console.log('- Módulo de seletores temporário carregado com sucesso.');

            // Retornamos o caminho E o objeto de seletores, garantindo ao TypeScript que ele tem o tipo T.
            return { path: tempFilePath, selectors: newSelectors as T };

        } catch (e) {
            console.error('- ❌ Falha ao carregar o arquivo de seletores temporário gerado pela IA.', e);
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); // Limpa o arquivo inválido
            return null;
        }

    } catch (error) {
        console.error("- ❌ Erro catastrófico durante o processo de auto-correção:", error);
        return null;
    }
}