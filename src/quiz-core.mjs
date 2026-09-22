const SUPPORTED_TYPES = new Set(["list", "gallery"]);
const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor", ...Object.getOwnPropertyNames(Object.prototype)]);
const ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

export class QuizConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuizConfigError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new QuizConfigError(message);
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSafeId(value) {
  return hasText(value) && ID_PATTERN.test(value) && !RESERVED_IDS.has(value);
}

function isSafeResourceUrl(value, { allowHash = false } = {}) {
  if (!hasText(value) || value.startsWith("//")) return false;
  if (value.startsWith("#")) return allowHash;
  try {
    return new URL(value, "https://quiz.local").protocol === "https:";
  } catch {
    return false;
  }
}

export function validateConfig(config) {
  assert(config && typeof config === "object" && !Array.isArray(config), "A configuração precisa ser um objeto JSON.");
  assert(config.quiz && hasSafeId(config.quiz.id), "Informe quiz.id com letras minúsculas, números, hífen ou underscore.");
  assert(hasText(config.quiz.name), "Informe quiz.name.");
  assert(config.brand && hasText(config.brand.name), "Informe brand.name.");
  if (config.brand.logo !== undefined) {
    assert(isSafeResourceUrl(config.brand.logo), "brand.logo deve usar caminho relativo ou HTTPS.");
  }
  assert(config.intro && hasText(config.intro.title), "Informe intro.title.");
  assert(Array.isArray(config.stages) && config.stages.length > 0, "Adicione pelo menos uma etapa em stages.");

  const stageIds = new Set();
  for (const [stageIndex, stage] of config.stages.entries()) {
    const stageLabel = `Etapa ${stageIndex + 1}`;
    assert(stage && typeof stage === "object", `${stageLabel} precisa ser um objeto.`);
    assert(hasSafeId(stage.id), `${stageLabel}: informe um id seguro com letras minúsculas, números, hífen ou underscore.`);
    assert(!stageIds.has(stage.id), `${stageLabel}: o id "${stage.id}" está duplicado.`);
    stageIds.add(stage.id);
    assert(SUPPORTED_TYPES.has(stage.type), `${stageLabel}: type deve ser "list" ou "gallery".`);
    assert(hasText(stage.title), `${stageLabel}: informe title.`);
    assert(Array.isArray(stage.options) && stage.options.length >= 2, `${stageLabel}: adicione pelo menos duas opções.`);

    const optionIds = new Set();
    for (const [optionIndex, option] of stage.options.entries()) {
      const optionLabel = `${stageLabel}, opção ${optionIndex + 1}`;
      assert(option && typeof option === "object", `${optionLabel} precisa ser um objeto.`);
      assert(hasSafeId(option.id), `${optionLabel}: informe um id seguro com letras minúsculas, números, hífen ou underscore.`);
      assert(!optionIds.has(option.id), `${optionLabel}: o id "${option.id}" está duplicado.`);
      optionIds.add(option.id);
      assert(hasText(option.label), `${optionLabel}: informe label.`);
      if (stage.type === "gallery") {
        assert(hasText(option.image), `${optionLabel}: informe image para uma galeria.`);
        assert(isSafeResourceUrl(option.image), `${optionLabel}: image deve usar caminho relativo ou HTTPS.`);
        assert(typeof option.alt === "string", `${optionLabel}: informe alt (pode ser vazio se a imagem for decorativa).`);
      }
    }
  }

  assert(config.result && config.result.profiles && typeof config.result.profiles === "object", "Informe result.profiles.");
  const profileEntries = Object.entries(config.result.profiles);
  assert(profileEntries.length > 0, "Adicione pelo menos um perfil de resultado.");
  for (const [profileId, profile] of profileEntries) {
    assert(hasSafeId(profileId), `Perfil "${profileId}": use um id seguro.`);
    assert(hasText(profile.title), `Perfil "${profileId}": informe title.`);
    assert(hasText(profile.description), `Perfil "${profileId}": informe description.`);
    assert(hasText(profile.image), `Perfil "${profileId}": informe image.`);
    assert(isSafeResourceUrl(profile.image), `Perfil "${profileId}": image deve usar caminho relativo ou HTTPS.`);
    assert(typeof profile.alt === "string", `Perfil "${profileId}": informe alt (pode ser vazio se a imagem for decorativa).`);
  }
  const profileIds = new Set(profileEntries.map(([profileId]) => profileId));
  for (const [stageIndex, stage] of config.stages.entries()) {
    for (const [optionIndex, option] of stage.options.entries()) {
      if (option.scores === undefined) continue;
      assert(option.scores && typeof option.scores === "object" && !Array.isArray(option.scores), `Etapa ${stageIndex + 1}, opção ${optionIndex + 1}: scores deve ser um objeto.`);
      for (const [profileId, score] of Object.entries(option.scores)) {
        assert(profileIds.has(profileId), `Etapa ${stageIndex + 1}, opção ${optionIndex + 1}: o perfil "${profileId}" não existe.`);
        assert(typeof score === "number" && Number.isFinite(score) && score >= 0, `Etapa ${stageIndex + 1}, opção ${optionIndex + 1}: a pontuação de "${profileId}" deve ser um número finito e não negativo.`);
      }
    }
  }
  assert(config.result.cta && hasText(config.result.cta.label), "Informe result.cta.label.");
  assert(hasText(config.result.cta.url), "Informe result.cta.url.");
  assert(isSafeResourceUrl(config.result.cta.url, { allowHash: true }), "result.cta.url deve usar caminho relativo ou HTTPS.");
  if (config.result.cta.target !== undefined) {
    assert(["_self", "_blank"].includes(config.result.cta.target), "result.cta.target deve ser _self ou _blank.");
  }

  return config;
}

export function getProgress(currentIndex, totalStages, isResult = false) {
  if (isResult) return 100;
  if (!Number.isInteger(totalStages) || totalStages <= 0) return 0;
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), totalStages - 1);
  return Math.round(((safeIndex + 1) / (totalStages + 1)) * 100);
}

export function findOption(stage, optionId) {
  return stage?.options?.find((option) => option.id === optionId);
}

export function resolveProfile(stages, answers, profiles) {
  const profileIds = Object.keys(profiles ?? {});
  if (profileIds.length === 0) return null;

  const totals = Object.assign(Object.create(null), Object.fromEntries(profileIds.map((profileId) => [profileId, 0])));
  for (const stage of stages ?? []) {
    const selectedOption = findOption(stage, answers?.[stage.id]);
    for (const [profileId, score] of Object.entries(selectedOption?.scores ?? {})) {
      if (Object.hasOwn(totals, profileId) && Number.isFinite(Number(score))) {
        totals[profileId] += Number(score);
      }
    }
  }

  return profileIds.reduce((winner, profileId) => {
    return totals[profileId] > totals[winner] ? profileId : winner;
  }, profileIds[0]);
}

export function buildAnalyticsEvent(eventName, context = {}) {
  const payload = { event: eventName };
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== "") {
      payload[key] = value;
    }
  }
  return payload;
}

export function getStageContext(config, stage, stageIndex, progressPercent) {
  return {
    quiz_id: config.quiz.id,
    quiz_name: config.quiz.name,
    stage_id: stage.id,
    stage_index: stageIndex + 1,
    stage_total: config.stages.length,
    question_type: stage.type,
    progress_percent: progressPercent
  };
}
