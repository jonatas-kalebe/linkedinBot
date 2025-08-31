import * as cheerio from 'cheerio';


export function cleanHtmlForAnalysis(html: string): string {
    let cleanedHtml = html;

    cleanedHtml = cleanedHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    cleanedHtml = cleanedHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');


    cleanedHtml = cleanedHtml.replace(/src="data:[^"]+"/gi, 'src="about:blank"');

    cleanedHtml = cleanedHtml.replace(/\s(on\w+)=("([^"]*)"|'([^']*)'|[^\s>]+)/gi, '');

    cleanedHtml = cleanedHtml.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');

    cleanedHtml = cleanedHtml.replace(/\s{2,}/g, ' ').replace(/\n\s*\n/g, '\n');

    return cleanedHtml;
}

export function cleanHtmlForAnalysisCheerio(html: string): string {
    const $ = cheerio.load(html);

    $('script, style, noscript, header, footer, nav, aside, form, iframe, [aria-hidden="true"]').remove();

    $('*').each((index, element) => {
        const el = $(element);
        const attrs = el.attr();

        if (attrs) {
            for (const attrName in attrs) {
                if (attrName !== 'class' && attrName !== 'id') {
                    el.removeAttr(attrName);
                }
            }
        }
    });

    let mainContent = $('main, article, #main, #content, .job-description, .content, .main-content').first();

    let finalHtml: string;

    if (mainContent.length > 0) {
        console.log('- Estratégia de limpeza: Conteúdo principal isolado com sucesso.');
        finalHtml = mainContent.html() || '';
    } else {
        console.log('- Estratégia de limpeza: Usando <body> limpo (contêiner principal não encontrado).');
        finalHtml = $('body').html() || '';
    }

    return finalHtml.replace(/\s{2,}/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}