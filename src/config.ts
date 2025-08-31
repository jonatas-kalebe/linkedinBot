export default {
  LINKEDIN_EMAIL: "seu_email@aqui.com",
  LINKEDIN_PASSWORD: "sua_senha_aqui",

  // Caminho para o seu arquivo .txt que contém o código LaTeX base do seu currículo.
  CV_LATEX_TEMPLATE_PATH: "C:\\Users\\jonat\\OneDrive\\Área de Trabalho\\linkedin-easy-apply-bot-main\\ResumeLatex.txt",

  // ### MODIFICAÇÃO 1: Múltiplas buscas ###
  // Em vez de uma única string, agora temos um array. O bot executará uma busca para cada item.
  SEARCH_QUERIES: [
        // --- Buscas Gerais e Amplas (Foco em Título e Remoto) ---
        "Java Developer Remote",

        "Spring Boot Developer Remote",
        "Angular Developer Remote International",
        "Fullstack Developer (Java Angular) Remote",

        "Java Developer Remote Europe",
        "Fullstack Java Angular Developer Remote Canada",
        "Desenvolvedor Java Remoto PJ",
        "Engenheiro de Software Fullstack Contractor Brasil Java",
        "Desenvolvedor Backend Java (PJ or Prestador de Serviços) Remoto"
  ],

  // Localização padrão, a IA fará a filtragem fina
  LOCATION: "Worldwide",
  JOB_DESCRIPTION_LANGUAGES: ["portuguese", "english"],
  SEARCH_INTERVAL_MINUTES: 20, // Pausa de 15 minutos entre os ciclos de busca completos


    AI_USER_PROFILE: `
  ### CONTEXTO DO PROFISSIONAL ###
  {
    "titulo": "Desenvolvedor de Software Fullstack (Java & Angular)",
    "anosDeExperienciaTotal": 4,
    "nivel": "Pleno",
    "formacao": "Ciência da Computação (Incompleto, 6º período)",
    "idiomas": ["Português (Nativo)", "Inglês (Fluente)"],
    "tecnologias": {
      "principais": ["Java", "Spring Boot", "Angular", "SQL"],
      "secundarias": ["Docker", "Git", "PostgreSQL", "APIs RESTful", "Microserviços"],
      "familiaridade": ["AWS", "Kubernetes", "CI/CD"]
    }
  }

  ### OBJETIVOS E REGRAS DE DECISÃO ###
  {
    "objetivoPrincipal": "Trabalhar 100% remotamente a partir do Brasil para empresas que paguem em moeda forte (USD, EUR, GBP) ou ofereçam um salário BRL muito acima da média do mercado brasileiro para a minha senioridade.",
    
    "cenariosAceitaveis": [
      {
        "nome": "PJ Internacional",
        "descricao": "Vaga PJ/Contractor para empresa estrangeira, permitindo trabalho do Brasil, com pagamento em moeda forte.",
        "prioridade": 10
      },
      {
        "nome": "CLT em Terceirizada para o Exterior",
        "descricao": "Vaga CLT em empresa no Brasil que atua como consultoria/terceirizada para clientes internacionais.",
        "prioridade": 8
      },
      {
        "nome": "PJ Brasil (Salário Alto)",
        "descricao": "Vaga PJ/Contractor para empresa brasileira com um pacote de remuneração significativamente acima da média.",
        "prioridade": 7
      },
      {
        "nome": "Junior no Exterior (Salário Mínimo Aceitável)",
        "descricao": "Aceito vaga de nível abaixo do meu (Júnior) se for para o exterior, 100% remota do Brasil, com salário mínimo de 3.000 USD/EUR.",
        "prioridade": 6
      }
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
      "Vagas que pedem 3-5 anos de experiência são ideais. Vagas para 6+ anos perdem pontos. Vagas para 1-2 anos só são válidas se se encaixarem no cenário 'Junior no Exterior'.",
      "Se a vaga for remota mas não especificar restrições de país ('Remote, Worldwide'), a nota deve ser ligeiramente reduzida pela incerteza, mas a vaga ainda é válida.",
      "Exigência de ensino superior completo deve reduzir a nota, mas não zerá-la."
    ]
  }
`
};