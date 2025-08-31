export function cleanHtmlForAnalysis(html: string): string {
    let cleanedHtml = html;

    // 1. Remove todas as tags <script> e seu conteúdo
    cleanedHtml = cleanedHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    // 2. Remove todas as tags <style> e seu conteúdo
    cleanedHtml = cleanedHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');


    // 4. Remove atributos 'src' que contêm dados em base64 (muito importante para o tamanho)
    cleanedHtml = cleanedHtml.replace(/src="data:[^"]+"/gi, 'src="about:blank"');

    // 5. Remove atributos de eventos inline (onclick, onmouseover, etc.)
    cleanedHtml = cleanedHtml.replace(/\s(on\w+)=("([^"]*)"|'([^']*)'|[^\s>]+)/gi, '');

    // 6. Remove SVGs inline, que podem ser muito grandes
    cleanedHtml = cleanedHtml.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');

    // 7. Remove múltiplos espaços em branco e quebras de linha para compactar o resultado
    cleanedHtml = cleanedHtml.replace(/\s{2,}/g, ' ').replace(/\n\s*\n/g, '\n');

    return cleanedHtml;
}