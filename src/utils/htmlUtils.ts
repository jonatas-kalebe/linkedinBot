import * as cheerio from 'cheerio';


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

export function cleanHtmlForAnalysisCheerio(html: string): string {
    // 1. Carrega o HTML no Cheerio. É como abrir o DevTools no código.
    const $ = cheerio.load(html);

    // 2. Remoção Cirúrgica de Seções Inteiras.
    // Removemos tudo que é tipicamente "ruído" em uma página.
    $('script, style, noscript, header, footer, nav, aside, form, iframe, [aria-hidden="true"]').remove();

    // 3. Limpeza de Atributos.
    // Itera sobre TODAS as tags restantes no documento.
    $('*').each((index, element) => {
        const el = $(element);
        // Pega todos os atributos do elemento
        const attrs = el.attr();

        if (attrs) {
            for (const attrName in attrs) {
                // Mantém apenas os atributos estruturais mais importantes (class e id)
                // e remove todo o resto (style, data-*, onclick, etc.)
                if (attrName !== 'class' && attrName !== 'id') {
                    el.removeAttr(attrName);
                }
            }
        }
    });

    // 4. Tentativa de Isolar o Conteúdo Principal (A Otimização Mais Poderosa).
    // Tenta encontrar o contêiner principal da página e, se encontrar, usa apenas ele.
    let mainContent = $('main, article, #main, #content, .job-description, .content, .main-content').first();

    let finalHtml: string;

    if (mainContent.length > 0) {
        // Se encontramos um contêiner principal, usamos apenas o HTML dele.
        console.log('- Estratégia de limpeza: Conteúdo principal isolado com sucesso.');
        finalHtml = mainContent.html() || '';
    } else {
        // Se não, usamos o body inteiro, mas já limpo dos passos anteriores.
        console.log('- Estratégia de limpeza: Usando <body> limpo (contêiner principal não encontrado).');
        finalHtml = $('body').html() || '';
    }

    // 5. Compactação final
    return finalHtml.replace(/\s{2,}/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}