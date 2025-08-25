export default {
    searchResultListText: "small.jobs-search-results-list__text",

    // Seletor estável para cada item da lista
    searchResultListItem: "li[data-occludable-job-id]",

    // SELETOR CRÍTICO CORRIGIDO: Este seletor é mais robusto para encontrar o link do título.
    searchResultListItemLink: "div.job-card-container--clickable > a.job-card-list__title",

    // SELETOR CRÍTICO CORRIGIDO: Este seletor encontra o nome da empresa de forma mais confiável.
    searchResultListItemCompanyName: "span.job-card-container__primary-description",


    keywordInput: 'input[class*="jobs-search-box__text-input"]',
    locationInput: 'input[class*="jobs-search-box__text-input"]',
    searchSubmitButton: 'button.jobs-search-box__submit-button',

    searchResultList: "div.scaffold-layout__list-container",

    jobDescription: "div#job-details-content div.jobs-box__html-content",
    easyApplyButtonEnabled: "button.jobs-apply-button:enabled",
    appliedToJobFeedback: ".artdeco-inline-feedback--success",

    checkbox: ".jobs-easy-apply-modal input[type='checkbox']",
    fieldset: ".jobs-easy-apply-modal fieldset",
    select: ".jobs-easy-apply-modal select",
    nextButton: ".jobs-easy-apply-modal footer button[aria-label*='Próximo'], .jobs-easy-apply-modal footer button[aria-label*='Review']",
    submit: ".jobs-easy-apply-modal footer button[aria-label*='Enviar candidatura']",
    enabledSubmitOrNextButton: ".jobs-easy-apply-modal footer button:enabled",
    textInput: ".jobs-easy-apply-modal input[type='text'], .jobs-easy-apply-modal textarea",
    homeCity: ".jobs-easy-apply-modal input[id*='city-HOME-CITY']",
    phone: ".jobs-easy-apply-modal input[id*='phoneNumber']",
    documentUpload: ".jobs-easy-apply-modal div[class*='jobs-document-upload']",
    documentUploadLabel: "label[class*='jobs-document-upload']",
    documentUploadInput: "input[type='file'][id*='jobs-document-upload']",
    radioInput: "input[type='radio']",
    option: "option",
    followCompanyCheckbox: 'input[type="checkbox"]#follow-company-checkbox',

    captcha: "#captcha-internal",
    emailInput: "#username",
    passwordInput: "#password",
    loginSubmit: "button[type='submit']",
    skipButton: "button.secondary-action-new",
    challengePinInput: "input#input__phone_verification_pin",

    feedUpdate: "main.scaffold-layout__main",
};