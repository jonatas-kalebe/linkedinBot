import { spawn } from 'cross-spawn';
import * as fs from 'fs';
import * as path from 'path';

export function compileLatexToPdf(latexCode: string, outputFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const outputDir = path.dirname(outputFilePath);
        const jobName = path.basename(outputFilePath, '.pdf');
        const tempTexFile = path.join(outputDir, `${jobName}.tex`);

        fs.writeFileSync(tempTexFile, latexCode);
        console.log(`  - Compilando LaTeX para ${path.basename(outputFilePath)}...`);

        const pdflatex = spawn('pdflatex', [
            '-interaction=nonstopmode',
            '-output-directory',
            outputDir,
            '-jobname',
            jobName,
            tempTexFile
        ]);

        pdflatex.on('close', (code) => {
            try {
                fs.unlinkSync(tempTexFile);
                fs.unlinkSync(path.join(outputDir, `${jobName}.aux`));
                fs.unlinkSync(path.join(outputDir, `${jobName}.log`));
            } catch (e) {}

            if (code === 0) {
                console.log('  - ✅ PDF compilado com sucesso!');
                resolve();
            } else {
                reject(new Error(`Falha na compilação do LaTeX. Verifique o arquivo .log para detalhes.`));
            }
        });

        pdflatex.on('error', (err) => {
            reject(new Error(`Erro ao executar pdflatex. Verifique se o MiKTeX está instalado e no PATH do sistema. Erro: ${err.message}`));
        });
    });
}