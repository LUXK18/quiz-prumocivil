import {
  buildAnalyticsEvent,
  findOption,
  getProgress,
  getStageOptions,
  getStageContext,
  resolveProfile,
  validateConfig
} from "./quiz-core.mjs";
import { TABLER_ICON_PATHS } from "./tabler-icons.mjs";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const elements = {
  card: document.querySelector(".quiz-card"),
  logo: document.querySelector("#brand-logo"),
  counter: document.querySelector("#step-counter"),
  counterText: document.querySelector("#step-counter-text"),
  loading: document.querySelector("#loading-screen"),
  intro: document.querySelector("#intro-screen"),
  introEyebrow: document.querySelector("#intro-eyebrow"),
  introTitle: document.querySelector("#intro-title"),
  introDescription: document.querySelector("#intro-description"),
  startButton: document.querySelector("#start-button"),
  startButtonLabel: document.querySelector("#start-button-label"),
  timeEstimate: document.querySelector("#time-estimate span"),
  question: document.querySelector("#question-screen"),
  fieldset: document.querySelector("#question-form fieldset"),
  stageEyebrow: document.querySelector("#stage-eyebrow"),
  stageTitle: document.querySelector("#stage-title"),
  stageDescription: document.querySelector("#stage-description"),
  legend: document.querySelector("#question-legend"),
  options: document.querySelector("#options"),
  validation: document.querySelector("#validation-message"),
  transition: document.querySelector("#transition-screen"),
  transitionEyebrow: document.querySelector("#transition-eyebrow"),
  transitionTitle: document.querySelector("#transition-title"),
  transitionDescription: document.querySelector("#transition-description"),
  transitionButton: document.querySelector("#transition-button"),
  transitionButtonLabel: document.querySelector("#transition-button-label"),
  result: document.querySelector("#result-screen"),
  resultVisual: document.querySelector("#result-visual"),
  resultImage: document.querySelector("#result-image"),
  resultEyebrow: document.querySelector("#result-eyebrow"),
  resultTitle: document.querySelector("#result-title"),
  resultDescription: document.querySelector("#result-description"),
  resultBenefit: document.querySelector("#result-benefit"),
  resultBenefitTitle: document.querySelector("#result-benefit-title"),
  resultBenefitDescription: document.querySelector("#result-benefit-description"),
  resultApplication: document.querySelector("#result-application"),
  resultApplicationLabel: document.querySelector("#result-application-label"),
  resultApplicationValue: document.querySelector("#result-application-value"),
  resultSteps: document.querySelector("#result-steps"),
  resultOffer: document.querySelector("#result-offer"),
  resultOfferEyebrow: document.querySelector("#result-offer-eyebrow"),
  resultOfferTitle: document.querySelector("#result-offer-title"),
  resultOfferDescription: document.querySelector("#result-offer-description"),
  resultDeliverables: document.querySelector("#result-deliverables"),
  resultBonusesSection: document.querySelector("#result-bonuses-section"),
  resultBonuses: document.querySelector("#result-bonuses"),
  resultResponsibility: document.querySelector("#result-responsibility"),
  resultClosing: document.querySelector("#result-closing"),
  resultCta: document.querySelector("#result-cta"),
  error: document.querySelector("#error-screen"),
  errorMessage: document.querySelector("#error-message"),
  retryButton: document.querySelector("#retry-button"),
  footer: document.querySelector("#quiz-footer"),
  progressValue: document.querySelector("#progress-value"),
  progressTrack: document.querySelector("#progress-track"),
  progressBar: document.querySelector("#progress-bar"),
  backButton: document.querySelector("#back-button"),
  nextButton: document.querySelector("#next-button"),
  nextLabel: document.querySelector("#next-button span"),
  toast: document.querySelector("#toast")
};

const state = {
  config: null,
  currentIndex: 0,
  answers: Object.create(null),
  stageVisits: Object.create(null),
  stageCompletions: Object.create(null),
  hasStarted: false,
  hasCompleted: false,
  resultProfileId: null,
  activeTransitionId: null,
  transitionVisits: Object.create(null),
  transitionLocked: false,
  toastTimer: null
};

function setVisibleScreen(screen) {
  [elements.loading, elements.intro, elements.question, elements.transition, elements.result, elements.error].forEach((item) => {
    item.hidden = item !== screen;
  });
  screen.classList.remove("screen-enter");
  requestAnimationFrame(() => screen.classList.add("screen-enter"));
}

function scrollToQuizTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  elements.card.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
}

function text(element, value = "") {
  element.textContent = value;
}

function applyTheme(config) {
  const theme = config.theme ?? {};
  const root = document.documentElement;
  const variables = {
    "--color-primary": theme.primary,
    "--color-primary-dark": theme.primaryDark,
    "--color-accent": theme.accent,
    "--color-surface": theme.surface,
    "--color-background": theme.background,
    "--color-text": theme.text,
    "--color-muted": theme.muted
  };

  for (const [name, value] of Object.entries(variables)) {
    if (typeof value === "string" && value.trim()) root.style.setProperty(name, value);
  }

  document.documentElement.lang = config.quiz.locale || "pt-BR";
  document.title = config.quiz.documentTitle || config.quiz.name;
  elements.logo.src = config.brand.logo || "assets/logo.svg";
  elements.logo.alt = config.brand.logoAlt || config.brand.name;
}

function getStorageKey() {
  return `quiz-state:${state.config.quiz.id}`;
}

function restoreAnswers() {
  if (!state.config.quiz.persistAnswers) return;
  try {
    const stored = JSON.parse(localStorage.getItem(getStorageKey()) ?? "null");
    if (!stored || stored.version !== state.config.version || typeof stored.answers !== "object") return;
    const restoredAnswers = Object.create(null);

    for (const stage of state.config.stages) {
      const optionId = stored.answers[stage.id];
      if (findOption(stage, optionId, restoredAnswers)) restoredAnswers[stage.id] = optionId;
    }

    state.answers = restoredAnswers;
  } catch {
    state.answers = Object.create(null);
  }
}

function persistAnswers() {
  if (!state.config.quiz.persistAnswers) return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({ version: state.config.version, answers: state.answers }));
  } catch {
    // Storage may be unavailable in privacy modes. The quiz remains functional.
  }
}

function eventName(suffix) {
  const prefix = state.config?.analytics?.eventPrefix?.trim();
  return prefix ? `${prefix}_${suffix}` : `quiz_${suffix}`;
}

function track(suffix, context = {}) {
  if (!state.config?.analytics?.enabled) return;
  try {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    const payload = buildAnalyticsEvent(eventName(suffix), {
      quiz_id: null,
      quiz_name: null,
      stage_id: null,
      stage_index: null,
      stage_total: null,
      question_type: null,
      progress_percent: null,
      stage_visit_number: null,
      stage_completion_number: null,
      transition_id: null,
      transition_visit_number: null,
      option_id: null,
      result_id: null,
      cta_id: null,
      cta_target: null,
      error_code: null,
      ...context,
      quiz_event_id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      quiz_timestamp: new Date().toISOString()
    });
    window.dataLayer.push(payload);
    if (state.config.analytics.debug) console.info(`[quiz analytics] ${payload.event}`, payload);
  } catch (error) {
    console.warn("[quiz] Não foi possível registrar o evento de analytics.", error);
  }
}

function installTagManager(config) {
  const analytics = config.analytics;
  if (!analytics?.enabled || !analytics.containerId) return;
  if (!/^GTM-[A-Z0-9]+$/i.test(analytics.containerId)) {
    console.warn("[quiz] containerId do GTM ignorado: formato inválido.");
    return;
  }

  try {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    if (document.querySelector("script[data-quiz-gtm]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.dataset.quizGtm = "true";
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(analytics.containerId)}`;
    document.head.append(script);
  } catch (error) {
    console.warn("[quiz] O Google Tag Manager não pôde ser inicializado.", error);
  }
}

function renderIntro() {
  const { intro } = state.config;
  const answeredCount = state.config.stages.filter((stage) => state.answers[stage.id]).length;
  const hasCompletedAnswers = answeredCount === state.config.stages.length;
  text(elements.introEyebrow, intro.eyebrow);
  text(elements.introTitle, intro.title);
  text(elements.introDescription, intro.description);
  text(
    elements.startButtonLabel,
    hasCompletedAnswers ? "Ver meu resultado novamente" : answeredCount ? "Continuar de onde parei" : intro.buttonLabel
  );
  text(elements.timeEstimate, intro.timeEstimate);
  elements.counter.hidden = true;
  elements.footer.hidden = true;
  setVisibleScreen(elements.intro);
  scrollToQuizTop();
}

function createCheckIcon() {
  const icon = document.createElement("span");
  icon.className = "option-check";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7" /></svg>';
  return icon;
}

function handleImageError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = "true";
  image.src = "assets/image-fallback.svg";
  image.alt = "Imagem indisponível";
}

function createListOption(stage, option, index) {
  const label = document.createElement("label");
  label.className = "list-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = `question-${stage.id}`;
  input.value = option.id;
  input.required = stage.required !== false;
  input.checked = state.answers[stage.id] === option.id;
  input.addEventListener("change", handleOptionChange);

  const visual = document.createElement("span");
  visual.className = "option-visual list-option-visual";

  const number = document.createElement("span");
  number.className = "option-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const labelText = document.createElement("span");
  labelText.className = "option-label";
  labelText.textContent = option.label;

  visual.append(number, labelText, createCheckIcon());
  label.append(input, visual);
  return label;
}

function createGalleryOption(stage, option) {
  const label = document.createElement("label");
  label.className = "gallery-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = `question-${stage.id}`;
  input.value = option.id;
  input.required = stage.required !== false;
  input.checked = state.answers[stage.id] === option.id;
  input.addEventListener("change", handleOptionChange);

  const visual = document.createElement("span");
  visual.className = "option-visual gallery-option-visual";

  const imageWrap = document.createElement("span");
  imageWrap.className = "gallery-image-wrap";
  const image = document.createElement("img");
  image.src = option.image;
  image.alt = option.alt;
  image.loading = "eager";
  image.addEventListener("error", handleImageError);
  imageWrap.append(image, createCheckIcon());

  const labelText = document.createElement("span");
  labelText.className = "gallery-label";
  labelText.textContent = option.label;

  visual.append(imageWrap, labelText);
  label.append(input, visual);
  return label;
}

function clearDependentAnswers(sourceStageId) {
  const sourcesToClear = [sourceStageId];
  const visited = new Set();

  while (sourcesToClear.length) {
    const sourceId = sourcesToClear.shift();
    if (visited.has(sourceId)) continue;
    visited.add(sourceId);

    state.config.stages.forEach((stage) => {
      if (stage.optionsSource?.stageId !== sourceId) return;
      delete state.answers[stage.id];
      sourcesToClear.push(stage.id);
    });
  }
}

function handleOptionChange(event) {
  const stage = state.config.stages[state.currentIndex];
  const previousOptionId = state.answers[stage.id];
  state.answers[stage.id] = event.currentTarget.value;
  if (previousOptionId !== event.currentTarget.value) clearDependentAnswers(stage.id);
  elements.validation.hidden = true;
  elements.options.classList.remove("options-invalid");
  persistAnswers();
  track("answer_changed", {
    ...getStageContext(state.config, stage, state.currentIndex, getProgress(state.currentIndex, state.config.stages.length)),
    option_id: event.currentTarget.value
  });
}

function updateProgress(progress) {
  text(elements.progressValue, `${progress}%`);
  elements.progressBar.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
}

function renderStage({ focus = true } = {}) {
  const stage = state.config.stages[state.currentIndex];
  const progress = getProgress(state.currentIndex, state.config.stages.length);

  text(elements.stageEyebrow, stage.eyebrow ?? `Etapa ${state.currentIndex + 1}`);
  text(elements.stageTitle, stage.title);
  text(elements.stageDescription, stage.description);
  text(elements.legend, stage.title);
  elements.fieldset.setAttribute("aria-required", String(stage.required !== false));
  elements.fieldset.setAttribute("aria-describedby", "stage-description validation-message");
  text(elements.counterText, `Etapa ${state.currentIndex + 1} de ${state.config.stages.length}`);
  elements.stageDescription.hidden = !stage.description;
  elements.counter.hidden = false;
  elements.footer.hidden = false;
  elements.validation.hidden = true;
  elements.options.className = `options options-${stage.type}`;
  elements.options.replaceChildren();

  getStageOptions(stage, state.answers).forEach((option, index) => {
    elements.options.append(stage.type === "gallery" ? createGalleryOption(stage, option) : createListOption(stage, option, index));
  });

  elements.backButton.disabled = state.currentIndex === 0;
  text(elements.nextLabel, state.currentIndex === state.config.stages.length - 1 ? "Ver meu resultado" : "Continuar");
  updateProgress(progress);
  setVisibleScreen(elements.question);
  scrollToQuizTop();

  state.stageVisits[stage.id] = (state.stageVisits[stage.id] ?? 0) + 1;
  track("step_viewed", {
    ...getStageContext(state.config, stage, state.currentIndex, progress),
    stage_visit_number: state.stageVisits[stage.id]
  });

  if (focus) requestAnimationFrame(() => elements.stageTitle.focus({ preventScroll: true }));
}

function getTransitionAfterStage(stageId) {
  return state.config.transitions?.find((transition) => transition.afterStageId === stageId) ?? null;
}

function resolveTransitionContent(transition) {
  const variant = transition.variants?.find(({ when }) => {
    return when && state.answers[when.stageId] === when.optionId;
  });
  return { ...transition, ...variant };
}

function renderTransition(transition) {
  const content = resolveTransitionContent(transition);
  state.activeTransitionId = transition.id;
  state.transitionVisits[transition.id] = (state.transitionVisits[transition.id] ?? 0) + 1;

  text(elements.transitionEyebrow, content.eyebrow);
  text(elements.transitionTitle, content.title);
  text(elements.transitionDescription, content.description);
  text(elements.transitionButtonLabel, content.buttonLabel ?? "Continuar");
  elements.counter.hidden = true;
  elements.footer.hidden = true;
  elements.transitionButton.disabled = false;
  setVisibleScreen(elements.transition);
  scrollToQuizTop();

  track("transition_viewed", {
    quiz_id: state.config.quiz.id,
    stage_id: state.config.stages[state.currentIndex].id,
    stage_index: state.currentIndex + 1,
    stage_total: state.config.stages.length,
    progress_percent: getProgress(state.currentIndex, state.config.stages.length),
    transition_id: transition.id,
    transition_visit_number: state.transitionVisits[transition.id]
  });
  requestAnimationFrame(() => elements.transitionTitle.focus({ preventScroll: true }));
}

function continueTransition() {
  if (state.transitionLocked || !state.activeTransitionId) return;
  const transitionId = state.activeTransitionId;
  state.transitionLocked = true;
  elements.transitionButton.disabled = true;
  track("transition_completed", {
    quiz_id: state.config.quiz.id,
    stage_id: state.config.stages[state.currentIndex].id,
    stage_index: state.currentIndex + 1,
    stage_total: state.config.stages.length,
    transition_id: transitionId
  });

  window.setTimeout(() => {
    state.activeTransitionId = null;
    if (state.currentIndex === state.config.stages.length - 1) {
      renderResult();
    } else {
      state.currentIndex += 1;
      renderStage();
    }
    state.transitionLocked = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
}

function setTransitionLock(locked) {
  state.transitionLocked = locked;
  elements.nextButton.disabled = locked;
  elements.backButton.disabled = locked || state.currentIndex === 0;
}

function goNext() {
  if (state.transitionLocked) return;
  const stage = state.config.stages[state.currentIndex];
  const selectedId = state.answers[stage.id];

  if (stage.required !== false && !selectedId) {
    elements.validation.hidden = false;
    elements.options.classList.remove("options-invalid");
    requestAnimationFrame(() => elements.options.classList.add("options-invalid"));
    elements.validation.focus?.();
    track("validation_failed", getStageContext(state.config, stage, state.currentIndex, getProgress(state.currentIndex, state.config.stages.length)));
    return;
  }

  setTransitionLock(true);
  state.stageCompletions[stage.id] = (state.stageCompletions[stage.id] ?? 0) + 1;
  track("step_completed", {
    ...getStageContext(state.config, stage, state.currentIndex, getProgress(state.currentIndex, state.config.stages.length)),
    stage_visit_number: state.stageVisits[stage.id] ?? 1,
    stage_completion_number: state.stageCompletions[stage.id],
    option_id: selectedId ?? null
  });

  window.setTimeout(() => {
    const transition = getTransitionAfterStage(stage.id);
    if (transition) {
      renderTransition(transition);
    } else if (state.currentIndex === state.config.stages.length - 1) {
      renderResult();
    } else {
      state.currentIndex += 1;
      renderStage();
    }
    setTransitionLock(false);
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
}

function goBack() {
  if (state.transitionLocked || state.currentIndex === 0) return;
  const fromStage = state.config.stages[state.currentIndex];
  track("back_clicked", getStageContext(state.config, fromStage, state.currentIndex, getProgress(state.currentIndex, state.config.stages.length)));
  state.currentIndex -= 1;
  renderStage();
}

function isSafeCtaUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function createTablerIcon(iconName) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("result-item-icon-svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const pathData of TABLER_ICON_PATHS[iconName] ?? []) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }

  return svg;
}

function createResultItems(container, items, itemClass) {
  container.replaceChildren();
  (items ?? []).forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = itemClass;
    const icon = document.createElement("span");
    icon.className = "result-item-icon";
    icon.append(createTablerIcon(item.icon));
    const copy = document.createElement("div");
    copy.className = "result-item-copy";
    const title = document.createElement("h4");
    const description = document.createElement("p");
    text(title, item.title);
    text(description, item.description);
    copy.append(title, description);
    listItem.append(icon, copy);
    container.append(listItem);
  });
}

function renderResultPersonalization(result) {
  const benefitConfig = result.personalization?.benefit;
  const benefitAnswer = benefitConfig ? state.answers[benefitConfig.sourceStageId] : null;
  const benefit = benefitConfig?.contentByAnswer?.[benefitAnswer];
  elements.resultBenefit.hidden = !benefit;
  if (benefit) {
    text(elements.resultBenefitTitle, benefit.title);
    text(elements.resultBenefitDescription, benefit.description);
  }

  const applicationConfig = result.personalization?.firstApplication;
  const applicationStage = applicationConfig
    ? state.config.stages.find((stage) => stage.id === applicationConfig.sourceStageId)
    : null;
  const applicationOption = applicationStage
    ? findOption(applicationStage, state.answers[applicationStage.id], state.answers)
    : null;
  elements.resultApplication.hidden = !applicationOption;
  if (applicationOption) {
    text(elements.resultApplicationLabel, applicationConfig.label);
    text(elements.resultApplicationValue, applicationOption.label);
    elements.resultSteps.replaceChildren();
    (applicationConfig.steps ?? []).forEach((step) => {
      const item = document.createElement("li");
      text(item, step);
      elements.resultSteps.append(item);
    });
  }
}

function renderResultOffer(result) {
  const offer = result.offer;
  elements.resultOffer.hidden = !offer;
  if (!offer) return;

  text(elements.resultOfferEyebrow, offer.eyebrow);
  text(elements.resultOfferTitle, offer.title);
  text(elements.resultOfferDescription, offer.description);
  createResultItems(elements.resultDeliverables, offer.deliverables, "result-item");
  createResultItems(elements.resultBonuses, offer.bonuses, "result-item result-item-bonus");
  elements.resultBonusesSection.hidden = !offer.bonuses?.length;
  text(elements.resultResponsibility, offer.responsibility);
  elements.resultResponsibility.hidden = !offer.responsibility;
  text(elements.resultClosing, result.closing);
  elements.resultClosing.hidden = !result.closing;
}

function renderResult() {
  const { result } = state.config;
  const profileId = resolveProfile(state.config.stages, state.answers, result.profiles, result.profileSelection);
  const profile = result.profiles[profileId];
  state.resultProfileId = profileId;

  text(elements.resultEyebrow, result.eyebrow);
  text(elements.resultTitle, profile.title);
  text(elements.resultDescription, profile.description);
  const hasProfileImage = typeof profile.image === "string" && profile.image.trim();
  elements.resultVisual.hidden = !hasProfileImage;
  if (hasProfileImage) {
    delete elements.resultImage.dataset.fallbackApplied;
    elements.resultImage.src = profile.image;
    elements.resultImage.alt = profile.alt ?? "";
    elements.resultImage.addEventListener("error", handleImageError, { once: true });
  } else {
    elements.resultImage.removeAttribute("src");
    elements.resultImage.alt = "";
  }
  renderResultPersonalization(result);
  renderResultOffer(result);
  text(elements.resultCta.querySelector("span"), result.cta.label);

  if (isSafeCtaUrl(result.cta.url)) {
    elements.resultCta.href = result.cta.url;
    elements.resultCta.removeAttribute("aria-disabled");
  } else {
    elements.resultCta.href = "#";
    elements.resultCta.setAttribute("aria-disabled", "true");
  }
  elements.resultCta.target = result.cta.target === "_blank" ? "_blank" : "_self";
  if (elements.resultCta.target === "_blank") elements.resultCta.rel = "noopener noreferrer";

  elements.counter.hidden = false;
  text(elements.counterText, "Resultado pronto");
  elements.footer.hidden = false;
  elements.footer.classList.add("footer-result");
  elements.backButton.closest(".navigation-actions").hidden = true;
  updateProgress(100);
  setVisibleScreen(elements.result);
  scrollToQuizTop();

  if (!state.hasCompleted) {
    state.hasCompleted = true;
    track("completed", {
      quiz_id: state.config.quiz.id,
      quiz_name: state.config.quiz.name,
      stage_total: state.config.stages.length,
      progress_percent: 100,
      result_id: profileId
    });
  }
  requestAnimationFrame(() => elements.resultTitle.focus({ preventScroll: true }));
}

function startQuiz() {
  if (!state.hasStarted) {
    state.hasStarted = true;
    track("started", {
      quiz_id: state.config.quiz.id,
      quiz_name: state.config.quiz.name,
      stage_total: state.config.stages.length
    });
  }

  const firstUnansweredIndex = state.config.stages.findIndex((stage) => !state.answers[stage.id]);
  if (firstUnansweredIndex === -1) {
    renderResult();
    return;
  }
  state.currentIndex = firstUnansweredIndex;
  renderStage();
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  text(elements.toast, message);
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function bindEvents() {
  elements.startButton.addEventListener("click", startQuiz);
  elements.nextButton.addEventListener("click", goNext);
  elements.backButton.addEventListener("click", goBack);
  elements.transitionButton.addEventListener("click", continueTransition);
  elements.retryButton.addEventListener("click", initialize);
  elements.resultCta.addEventListener("click", (event) => {
    if (elements.resultCta.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      showToast("O link de acesso ainda não foi configurado.");
      return;
    }
    track("cta_clicked", {
      quiz_id: state.config.quiz.id,
      result_id: state.resultProfileId,
      cta_id: "result-primary",
      cta_target: state.config.result.cta.target ?? "_self"
    });
  });
}

function showError(error) {
  console.error(error);
  text(elements.errorMessage, error?.message ?? "Revise o arquivo quiz-config.json e tente novamente.");
  elements.counter.hidden = true;
  elements.footer.hidden = true;
  setVisibleScreen(elements.error);
  track("error", {
    quiz_id: state.config?.quiz?.id,
    error_code: error?.name === "QuizConfigError" ? "invalid_config" : "load_failed"
  });
}

async function initialize() {
  elements.card.setAttribute("aria-busy", "true");
  setVisibleScreen(elements.loading);
  try {
    const response = await fetch("quiz-config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Falha ao carregar a configuração (${response.status}).`);
    state.config = validateConfig(await response.json());
    applyTheme(state.config);
    restoreAnswers();
    installTagManager(state.config);
    track("loaded", {
      quiz_id: state.config.quiz.id,
      quiz_name: state.config.quiz.name,
      stage_total: state.config.stages.length
    });
    renderIntro();
  } catch (error) {
    showError(error);
  } finally {
    elements.card.setAttribute("aria-busy", "false");
  }
}

bindEvents();
initialize();
