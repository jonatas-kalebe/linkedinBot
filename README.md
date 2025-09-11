Claro, aqui está um README completo e detalhado para o seu projeto, explicando tudo o que é necessário para configurá-lo e executá-lo localmente.

-----

# 🤖 Job Application Automation Bot

Este é um bot de automação avançado projetado para encontrar, analisar e se candidatar a vagas de emprego em diversas plataformas. Ele utiliza inteligência artificial para avaliar a compatibilidade das vagas com um perfil de usuário predefinido, gera currículos em LaTeX personalizados e automatiza o processo de candidatura.

## ✨ Funcionalidades

* **Scraping Multi-plataforma:** Busca vagas de emprego em sites como LinkedIn, RemoteOK, WeWorkRemotely, Programathor e Gupy.
* **Análise de Vagas com IA:** Utiliza o Gemini para analisar a descrição das vagas e calcular uma "nota de fit" de 0 a 10, representando a probabilidade de o candidato ser chamado para uma entrevista.
* **Geração de Currículos em LaTeX:** Cria currículos em LaTeX personalizados para cada vaga, destacando as habilidades e experiências mais relevantes.
* **Autocorreção de Selectors:** Tenta corrigir automaticamente os seletores de CSS quebrados, garantindo que o bot continue funcionando mesmo com mudanças no layout dos sites.
* **Descoberta de Empresas (Company Hunter):** Módulo experimental que descobre e qualifica novas empresas para buscar vagas de emprego.

## ⚙️ Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

* **[Node.js](https://nodejs.org/en/)** (versão 18.x ou superior)
* **[NPM](https://www.npmjs.com/get-npm)** ou **[Yarn](https://yarnpkg.com/getting-started/install)**
* **Uma distribuição LaTeX:**
    * **Windows:** [MiKTeX](https://miktex.org/download)
    * **Mac:** [MacTeX](http://www.tug.org/mactex/)
    * **Linux:** Instale o `texlive-full` através do seu gerenciador de pacotes (ex: `sudo apt-get install texlive-full` em sistemas baseados em Debian).

## 🚀 Instalação e Configuração

Siga os passos abaixo para configurar e rodar o projeto localmente:

### 1\. Clone o Repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DA_PASTA_DO_PROJETO>
```

### 2\. Instale as Dependências

Usando npm:

```bash
npm install
```

Ou usando yarn:

```bash
yarn install
```

### 3\. Crie o Arquivo de Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto. Este arquivo **não deve** ser enviado para o repositório.

```
GEMINI_API_KEY=SUA_CHAVE_API_AQUI
```

### 4\. Obtenha sua Chave da API do Gemini

1.  Acesse o [Google AI Studio](https://aistudio.google.com/).
2.  Faça login com sua conta do Google.
3.  Clique em "**Get API Key**" no menu à esquerda.
4.  Clique em "**Create API key**".
5.  Copie a chave gerada e cole no seu arquivo `.env`.

### 5\. Crie o Arquivo de Configuração Principal

Na pasta `src`, crie um arquivo chamado `config.ts`. Este arquivo conterá todas as configurações do bot.

Copie e cole o seguinte conteúdo no seu `src/config.ts`:

```typescript
export default {
    LINKEDIN_EMAIL: "seu_email@aqui.com",
    LINKEDIN_PASSWORD: "sua_senha_aqui",
    CV_LATEX_TEMPLATE_PATH: "C:\\Caminho\\Completo\\Para\\O\\Seu\\ResumeLatex.txt",
    LINKEDIN_SEARCH_QUERIES: [
        "Java Developer Remote",
        "SpringBoot Developer Remote",
        "Angular Developer Remote International",
        "Fullstack Developer (Java Angular) Remote",
        "Java Developer Remote Europe",
        "Fullstack Java Angular Developer Remote Canada",
        "Desenvolvedor Java Remoto PJ",
        "Engenheiro de Software Fullstack Contractor Brasil Java",
        "Desenvolvedor Backend Java (PJ ou Prestador de Serviços) Remoto"
    ],
    WWR_SEARCH_QUERIES: [
        "java",
        "angular",
        "full-stack",
        "backend",
        "frontend"
    ],
    REMOKEOK_SEARCH_QUERIES: [
        "java",
        "angular",
        "fullstack",
        "backend",
        "software engineer"
    ],
    PROGRAMATHOR_SEARCHES: [
        { keyword: 'Java', contract: 'PJ', expertise: 'Pleno' },
        { keyword: 'Java', contract: 'PJ', expertise: 'Sênior' },
        { keyword: 'Angular', contract: 'PJ', expertise: 'Pleno' },
        { keyword: 'Angular', contract: 'PJ', expertise: 'Sênior' }
    ],
    REMOTIVE_SEARCHES: [
        { tags: 'java', locations: 'Brazil' },
        { tags: 'angular', locations: 'Brazil' },
        { tags: 'fullstack', locations: 'Worldwide' },
        { tags: 'backend', locations: 'Worldwide' },
    ],
    THEMUSE_SEARCH_QUERIES: [
        "Java",
        "Angular",
        "SpringBoot",
        "Software Engineer"
    ],
    WELLFOUND_SEARCH_QUERIES: [
        "Java Developer",
        "Angular Developer",
        "Fullstack Developer",
        "Backend Engineer"
    ],
    GUPY_SEARCH_QUERIES: [
        "Java",
        "Angular",
        "Desenvolvedor Java Remoto",
        "Desenvolvedor Angular Remoto",
        "Engenheiro de Software Remoto",
        "Fullstack Developer",
        "Backend Developer Pleno"
    ],
    LOCATION: "Worldwide",
    JOB_DESCRIPTION_LANGUAGES: [
        "portuguese",
        "english"
    ],
    SEARCH_INTERVAL_MINUTES: 20,
    AI_USER_PROFILE: `### CONTEXTO DO PROFISSIONAL ###
    {
        "titulo": "Desenvolvedor de Software Fullstack (Java & Angular)",
        "anosDeExperienciaTotal": 4,
        "nivel": "Pleno",
        "formacao": "Ciência da Computação (Incompleto, 6º período)",
        "idiomas": ["Português (Nativo)", "Inglês (Fluente)"],
        "tecnologias": {
            "principais": ["Java", "SpringBoot", "Angular", "SQL"],
            "secundarias": ["Docker", "Git", "PostgreSQL", "APIs RESTful", "Microserviços"],
            "familiaridade": ["AWS", "Kubernetes", "CI/CD"]
        }
    }

    ### OBJETIVOS E REGRAS DE DECISÃO ###
    {
        "objetivoPrincipal": "Trabalhar 100% remotamente a partir do Brasil para empresas que paguem em moeda forte (USD, EUR, GBP) ou ofereçam um salário BRL muito acima da média do mercado brasileiro para a minha senioridade.",
        "cenariosAceitaveis": [
            { "nome": "PJ Internacional", "descricao": "Vaga PJ/Contractor para empresa estrangeira, permitindo trabalho do Brasil, com pagamento em moeda forte.", "prioridade": 10 },
            { "nome": "CLT em Terceirizada para o Exterior", "descricao": "Vaga CLT em empresa no Brasil que atua como consultoria/terceirizada para clientes internacionais.", "prioridade": 8 },
            { "nome": "PJ Brasil (Salário Alto)", "descricao": "Vaga PJ/Contractor para empresa brasileira com um pacote de remuneração significativamente acima da média.", "prioridade": 7 },
            { "nome": "Júnior no Exterior (Salário Mínimo Aceitável)", "descricao": "Aceito vaga de nível abaixo do meu (Júnior) se for para o exterior, 100% remoto do Brasil, com salário mínimo de 3.000 USD/EUR.", "prioridade": 6 }
        ],
        "filtrosEliminatorios": [
            "Se a vaga não for 100% remota, a nota é 0.",
            "Se a vaga for remota mas exigir residência em um país/região que não seja o Brasil (ex: 'Remote, US Only', 'EU residents only'), a nota é 0.",
            "Se a vaga for no Brasil e o regime for CLT com salário padrão de mercado (não explicitamente alto), a nota é 0.",
            "Se a vaga exigir cidadania ou visto de trabalho para outro país, a nota é 0.",
            "Se a tecnologia principal exigida não for Java ou Angular, a nota é 0."
        ],
        "heuristicaDePontuacao": [
            "A nota de fit deve refletir a probabilidade REAL de o meu currículo ser selecionado.",
            "A falta de tecnologias secundárias (Docker, AWS, K8s) deve penalizar POUCO a nota. A ausência de tecnologias principais (Java, Spring, Angular) deve penalizar MUITO.",
            "Vagas que pedem 3-5 anos de experiência são ideais. Vagas para 6+ anos perdem pontos. Vagas para 1-2 anos só são válidas se se encaixarem no cenário 'Júnior no Exterior'.",
            "Se a vaga for remota mas não especificar restrições de país ('Remote, Worldwide'), a nota deve ser ligeiramente reduzida pela incerteza, mas a vaga ainda é válida.",
            "Exigência de ensino superior completo deve reduzir a nota, mas não zerá-la."
        ]
    }`
};
```

### 6\. Crie o seu Template LaTeX

Na raiz do projeto, crie um arquivo chamado `ResumeLatex.txt`. Este será o template do seu currículo.

Um exemplo de template pode ser encontrado em repositórios como o [**Deedy-Resume**](https://github.com/deedy/Deedy-Resume). Você precisará adaptar o template para que ele contenha placeholders que o bot irá substituir. Por exemplo: `{NOME}`, `{EMAIL}`, `{TELEFONE}`, etc.

**Importante:** Atualize o caminho para este arquivo na variável `CV_LATEX_TEMPLATE_PATH` no seu `src/config.ts`.

## ▶️ Executando o Projeto

Após seguir todos os passos de instalação e configuração, você pode iniciar o bot com o seguinte comando:

```bash
npm start
```

ou

```bash
yarn start
```

O bot iniciará o navegador, fará o login no LinkedIn (se necessário) e começará a buscar e analisar as vagas de emprego. Os currículos gerados e os links das vagas compatíveis serão salvos na pasta `generated_cvs`.

## 📄 Estrutura dos Arquivos Criados

* **`.env`:** Armazena suas chaves de API secretas.
* **`src/config.ts`:** Contém todas as configurações do bot, incluindo suas credenciais do LinkedIn, queries de busca e o perfil do usuário para a IA.
* **`ResumeLatex.txt`:** O template do seu currículo em LaTeX.

## ⚠️ Solução de Problemas

* **Erro de compilação do LaTeX:** Verifique se sua distribuição LaTeX está instalada corretamente e se o comando `pdflatex` está disponível no PATH do sistema.
* **Falha no login do LinkedIn:** O LinkedIn pode solicitar verificação em duas etapas (2FA) ou CAPTCHA. Se isso acontecer, você precisará resolver manualmente no navegador que o bot abrirá.
* **Erros de "Selector Not Found":** Se os sites atualizarem o layout, os seletores de CSS podem quebrar. O bot tentará se autocorrigir, mas pode ser necessário ajustar os seletores manualmente nos arquivos `selectors.ts` das respectivas pastas de scrapers.