export default {
    // Seletor antigo e frágil: '.job-list-item a.job-link'
    // Seletor NOVO e robusto, focado em atributos de teste que raramente mudam
    jobListItemLink: 'ul[data-testid="job-list"] > li > a',

    // Seletores da página de detalhes (provavelmente ainda funcionam, mas podem precisar de ajuste)
    jobTitle: '.content-header h1.title',
    companyName: '.content-header .company',
    jobDescription: '#job-description',
};