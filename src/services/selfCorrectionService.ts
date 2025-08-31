// src/services/selfCorrectionService.ts

import * as fs from 'fs';
import * as path from 'path';
import {Page} from 'puppeteer';
import {generateWithRetry} from "./geminiService";
import {cleanHtmlForAnalysis} from "../utils/htmlUtils";


interface CorrectionContext {
    siteName: string;
    failedUrl: string;
    goal: string;
    brokenSelectorKey: string;
    selectorsFilePath: string;
}

/**
 * Tenta corrigir um arquivo de seletores quebrado usando a IA, salvando o resultado
 * em um arquivo temporário.
 * @param page A instância da página do Puppeteer.
 * @param context O contexto da falha.
 * @returns {Promise<string | null>} O caminho para o arquivo temporário corrigido ou null se falhar.
 */
export async function attemptSelfCorrection(page: Page, context: CorrectionContext): Promise<string | null> {
    console.warn(`\n--- 🤖 INICIANDO CICLO DE AUTO-CORREÇÃO para [${context.siteName}] ---`);
    console.warn(`- Motivo: Falha ao tentar "${context.goal}" com a chave "${context.brokenSelectorKey}"`);

    try {
        const selectorsFileContent = fs.readFileSync(context.selectorsFilePath, 'utf-8');
        const rawPageHtml = await page.content();

        // << ALTERAÇÃO AQUI >>
        // Limpa o HTML antes de usá-lo no prompt
        console.log(`- Limpando HTML da página... Tamanho original: ${Math.round(rawPageHtml.length / 1024)}KB`);
        const cleanedHtml = cleanHtmlForAnalysis(rawPageHtml);
        console.log(`- HTML limpo! Novo tamanho: ${Math.round(cleanedHtml.length / 1024)}KB`);

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

        const rawCorrectedCode = await generateWithRetry(prompt);
        let correctedCode = rawCorrectedCode;
        const codeBlockRegex = /```(?:typescript|json)?\s*([\s\S]*?)\s*```/;
        const match = rawCorrectedCode.match(codeBlockRegex);

        if (match && match[1]) {
            // Se encontrou um bloco de código markdown, extrai apenas o conteúdo.
            correctedCode = match[1];
        } else {
            // Se não encontrou um bloco, apenas remove as linhas com ``` como uma segurança extra.
            correctedCode = rawCorrectedCode
                .replace(/^```(typescript|json)?\s*$/gm, '') // Remove a linha de abertura do bloco
                .replace(/^```\s*$/gm, ''); // Remove a linha de fechamento do bloco
        }
        correctedCode = correctedCode.trim(); // Remove espaços/linhas em branco no início e no fim.
        // << FIM DA MELHORIA >>


        if (!correctedCode.startsWith('export default {')) {
            console.error('- ❌ A IA retornou uma resposta em formato inválido após a limpeza. Abortando correção.');
            console.error('--- RESPOSTA INVÁLIDA RECEBIDA ---');
            console.error(correctedCode);
            console.error('---------------------------------');
            return null;
        }

        const tempFileName = `${path.basename(context.selectorsFilePath, '.ts')}.${Date.now()}.ts`;
        const tempFilePath = path.join(path.dirname(context.selectorsFilePath), tempFileName);

        fs.writeFileSync(tempFilePath, correctedCode);
        console.log(`- ✅ IA retornou uma correção. Salvo em arquivo temporário: ${tempFileName}`);

        return tempFilePath;

    } catch (error) {
        console.error("- ❌ Erro catastrófico durante o processo de auto-correção:", error);
        return null;
    }
}