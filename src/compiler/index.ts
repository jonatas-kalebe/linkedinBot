import { spawn } from 'cross-spawn';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Compila um código LaTeX em um arquivo PDF usando uma instalação local de LaTeX (MiKTeX).
 * Esta versão considera a compilação um sucesso se o arquivo PDF for gerado, mesmo que existam erros não fatais.
 */
export async function compileLatexToPdf(latexCode: string, outputFilePath: string): Promise<void> {
  console.log(`  - Compilando LaTeX localmente para ${path.basename(outputFilePath)}...`);
  const outputDir = path.dirname(outputFilePath);
  const jobName = path.basename(outputFilePath, '.pdf');
  const tempTexFile = path.join(outputDir, `${jobName}.tex`);

  fs.writeFileSync(tempTexFile, latexCode);

  return new Promise((resolve, reject) => {
    const pdflatex = spawn('pdflatex', [
      '-interaction=nonstopmode',
      '-output-directory',
      outputDir,
      '-jobname',
      jobName,
      tempTexFile
    ]);

    let stdoutLog = '';
    pdflatex.stdout.on('data', (data) => {
      stdoutLog += data.toString();
    });

    pdflatex.on('close', (code) => {
      // Limpa os arquivos auxiliares após a tentativa
      try {
        fs.unlinkSync(tempTexFile);
        const logFile = path.join(outputDir, `${jobName}.log`);
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
        const auxFile = path.join(outputDir, `${jobName}.aux`);
        if (fs.existsSync(auxFile)) fs.unlinkSync(auxFile);
      } catch (e) {}

      // ### LÓGICA DE VERIFICAÇÃO DEFINITIVA ###
      // A única coisa que importa é se o arquivo PDF foi criado.
      if (fs.existsSync(outputFilePath)) {
        if (code !== 0) {
          // Se o código não for 0, significa que houve avisos ou erros não fatais.
          console.warn(`  - ⚠️  PDF compilado com sucesso, mas com avisos. Verifique o documento gerado.`);
        } else {
          console.log('  - ✅ PDF compilado com sucesso!');
        }
        resolve(); // SUCESSO!
      } else {
        // Se o PDF não existe, então foi uma falha catastrófica.
        console.error('  - ❌ Erro de compilação do LaTeX detectado (nenhum PDF gerado).');
        console.error('--- INÍCIO DO LOG DE ERRO LATEX ---');
        console.error(stdoutLog);
        console.error('--- FIM DO LOG DE ERRO LATEX ---');
        reject(new Error('Falha catastrófica na compilação do LaTeX. O código gerado pela IA provavelmente era inválido.'));
      }
    });

    pdflatex.on('error', (err) => {
      reject(new Error(`Erro ao executar pdflatex. Verifique se o MiKTeX está instalado e no PATH do sistema. Erro: ${err.message}`));
    });
  });
}