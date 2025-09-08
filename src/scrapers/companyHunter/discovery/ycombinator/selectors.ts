export default {
    // O seletor para o card da empresa. Focar no href é mais estável.
    companyCard: 'a[href^="/companies/"]',

    // Seletor relativo ao card para pegar o nome da empresa
    companyName: 'span[class*="_name_"]',

    // Seletor para o botão de aceitar cookies, que pode bloquear a página
    cookieButton: '#accept-button-selector', // Exemplo, precisa ser verificado
};