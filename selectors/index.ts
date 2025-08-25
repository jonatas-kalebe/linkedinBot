// selectors.ts

export default {
  // ## LISTA E ITENS DE RESULTADOS DA BUSCA ##
  searchResultListText: "small.jobs-search-results-list__text",

  // Seletor para cada item individual da lista de vagas. Está correto.
  searchResultListItem: "li[data-occludable-job-id]",

  // SELETOR CRÍTICO CORRIGIDO: Encontra o link da vaga.
  searchResultListItemLink: ".job-card-container__link",

  jobTitle: ".job-details-jobs-unified-top-card__job-title",
  companyName: ".job-details-jobs-unified-top-card__company-name",
  jobDescription: "#job-details",
  easyApplyButtonEnabled: "button.jobs-apply-button:enabled",
  appliedToJobFeedback: ".artdeco-inline-feedback--success",

  // ## MODAL "EASY APPLY" (COM TODOS OS CAMPOS) ##
  checkbox: ".jobs-easy-apply-modal input[type='checkbox']",
  fieldset: ".jobs-easy-apply-modal fieldset",
  select: ".jobs-easy-apply-modal select",
  option: "option",
  nextButton: ".jobs-easy-apply-modal footer button[aria-label*='Próximo'], .jobs-easy-apply-modal footer button[aria-label*='Review']",
  submit: ".jobs-easy-apply-modal footer button[aria-label*='Enviar candidatura']",
  textInput: ".jobs-easy-apply-modal input[type='text'], .jobs-easy-apply-modal textarea",
  radioInput: "input[type='radio']",
  homeCity: ".jobs-easy-apply-modal input[id*='city-HOME-CITY']", // ADICIONADO DE VOLTA
  phone: ".jobs-easy-apply-modal input[id*='phoneNumber']", // ADICIONADO DE VOLTA
  documentUploadInput: "input[type='file'][id*='jobs-document-upload']", // ADICIONADO DE VOLTA

  // ## LOGIN E TELAS DE SEGURANÇA ##
  emailInput: "#username",
  passwordInput: "#password",
  loginSubmit: "button[type='submit']",
  skipButton: "button.secondary-action-new",
  challengePinInput: "input#input__phone_verification_pin",
  captcha: "#captcha-internal",

  // ## INDICADOR DE LOGIN BEM-SUCEDIDO ##
  feedUpdate: "main.scaffold-layout__main",

  keywordInput: 'input[class*="jobs-search-box__text-input"]',
  locationInput: 'input[class*="jobs-search-box__text-input"]',
  searchSubmitButton: 'button.jobs-search-box__submit-button',

  searchResultList: "div.scaffold-layout__list-container",


  enabledSubmitOrNextButton: ".jobs-easy-apply-modal footer button:enabled",

  documentUpload: ".jobs-easy-apply-modal div[class*='jobs-document-upload']",
  documentUploadLabel: "label[class*='jobs-document-upload']",

  followCompanyCheckbox: 'input[type="checkbox"]#follow-company-checkbox',

};