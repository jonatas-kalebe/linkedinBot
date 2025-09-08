declare module 'wappalyzer' {
    // Esta interface define a estrutura de uma tecnologia detectada
    export interface Technology {
        name: string;
        slug: string;
        [key: string]: any;
    }

    // Define o resultado da análise
    export interface AnalysisResult {
        technologies: Technology[];
    }

    // Define os dados que passamos para o método analyze
    export interface AnalyzeOptions {
        url: string;
        html: string;
        headers: object;
    }

    // Define a classe Wappalyzer
    export default class Wappalyzer {
        constructor(options?: any);
        init(): Promise<this>;
        destroy(): Promise<void>;
        analyze(data: AnalyzeOptions): Promise<AnalysisResult>;
    }
}