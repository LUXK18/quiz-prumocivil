import { hasTablerIcon } from "./tabler-icons.mjs";

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

function getConfiguredOptionGroups(stage) {
  if (Array.isArray(stage?.options)) {
    return [{ answerId: null, options: stage.options }];
  }

  if (!stage?.optionsByAnswer || typeof stage.optionsByAnswer !== "object" || Array.isArray(stage.optionsByAnswer)) {
    return [];
  }

  return Object.entries(stage.optionsByAnswer).map(([answerId, options]) => ({ answerId, options }));
}

function getAllConfiguredOptions(stage) {
  return getConfiguredOptionGroups(stage).flatMap(({ options }) => (Array.isArray(options) ? options : []));
}

function validateOptionGroup(stage, options, groupLabel) {
  assert(Array.isArray(options) && options.length >= 2, `${groupLabel}: adicione pelo menos duas opções.`);

  const optionIds = new Set();
  for (const [optionIndex, option] of options.entries()) {
    const optionLabel = `${groupLabel}, opção ${optionIndex + 1}`;
    assert(option && typeof option === "object" && !Array.isArray(option), `${optionLabel} precisa ser um objeto.`);
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

function validateOfferItems(items, groupLabel) {
  assert(Array.isArray(items) && items.length > 0, `${groupLabel}: adicione pelo menos um item.`);

  for (const [itemIndex, item] of items.entries()) {
    const itemLabel = `${groupLabel}, item ${itemIndex + 1}`;
    assert(item && typeof item === "object" && !Array.isArray(item), `${itemLabel} precisa ser um objeto.`);
    assert(hasText(item.title), `${itemLabel}: informe title.`);
    assert(hasText(item.description), `${itemLabel}: informe description.`);
    assert(hasTablerIcon(item.icon), `${itemLabel}: informe um ícone Tabler suportado.`);
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
  const stagesById = new Map();
  for (const [stageIndex, stage] of config.stages.entries()) {
    const stageLabel = `Etapa ${stageIndex + 1}`;
    assert(stage && typeof stage === "object" && !Array.isArray(stage), `${stageLabel} precisa ser um objeto.`);
    assert(hasSafeId(stage.id), `${stageLabel}: informe um id seguro com letras minúsculas, números, hífen ou underscore.`);
    assert(!stageIds.has(stage.id), `${stageLabel}: o id "${stage.id}" está duplicado.`);
    stageIds.add(stage.id);
    assert(SUPPORTED_TYPES.has(stage.type), `${stageLabel}: type deve ser "list" ou "gallery".`);
    assert(hasText(stage.title), `${stageLabel}: informe title.`);

    const usesStaticOptions = stage.options !== undefined;
    const usesDynamicOptions = stage.optionsSource !== undefined || stage.optionsByAnswer !== undefined;
    assert(usesStaticOptions !== usesDynamicOptions, `${stageLabel}: configure options ou optionsSource/optionsByAnswer, mas não ambos.`);

    if (usesStaticOptions) {
      validateOptionGroup(stage, stage.options, stageLabel);
    } else {
      assert(stage.optionsSource && typeof stage.optionsSource === "object" && !Array.isArray(stage.optionsSource), `${stageLabel}: informe optionsSource.`);
      assert(hasSafeId(stage.optionsSource.stageId), `${stageLabel}: optionsSource.stageId deve ser um id seguro.`);
      assert(stage.optionsSource.match === "optionId", `${stageLabel}: optionsSource.match deve ser "optionId".`);

      const sourceStage = stagesById.get(stage.optionsSource.stageId);
      assert(sourceStage, `${stageLabel}: optionsSource.stageId deve apontar para uma etapa anterior.`);
      assert(stage.optionsByAnswer && typeof stage.optionsByAnswer === "object" && !Array.isArray(stage.optionsByAnswer), `${stageLabel}: informe optionsByAnswer como objeto.`);

      const sourceAnswerIds = new Set(getAllConfiguredOptions(sourceStage).map((option) => option.id));
      const optionBranches = Object.entries(stage.optionsByAnswer);
      assert(optionBranches.length > 0, `${stageLabel}: adicione opções em optionsByAnswer.`);

      for (const [answerId, options] of optionBranches) {
        assert(hasSafeId(answerId), `${stageLabel}: a chave "${answerId}" de optionsByAnswer não é um id seguro.`);
        assert(sourceAnswerIds.has(answerId), `${stageLabel}: a resposta "${answerId}" não existe na etapa de origem.`);
        validateOptionGroup(stage, options, `${stageLabel}, resposta "${answerId}"`);
      }

      for (const answerId of sourceAnswerIds) {
        assert(Object.hasOwn(stage.optionsByAnswer, answerId), `${stageLabel}: faltam opções para a resposta "${answerId}" da etapa de origem.`);
      }
    }

    stagesById.set(stage.id, stage);
  }

  assert(config.result && config.result.profiles && typeof config.result.profiles === "object" && !Array.isArray(config.result.profiles), "Informe result.profiles.");
  const profileEntries = Object.entries(config.result.profiles);
  assert(profileEntries.length > 0, "Adicione pelo menos um perfil de resultado.");
  for (const [profileId, profile] of profileEntries) {
    assert(hasSafeId(profileId), `Perfil "${profileId}": use um id seguro.`);
    assert(profile && typeof profile === "object" && !Array.isArray(profile), `Perfil "${profileId}" precisa ser um objeto.`);
    assert(hasText(profile.title), `Perfil "${profileId}": informe title.`);
    assert(hasText(profile.description), `Perfil "${profileId}": informe description.`);
    if (profile.image !== undefined && profile.image !== null) {
      assert(hasText(profile.image), `Perfil "${profileId}": image deve ser um texto não vazio.`);
      assert(isSafeResourceUrl(profile.image), `Perfil "${profileId}": image deve usar caminho relativo ou HTTPS.`);
    }
    if (profile.alt !== undefined && profile.alt !== null) {
      assert(typeof profile.alt === "string", `Perfil "${profileId}": alt deve ser um texto.`);
    }
  }
  const profileIds = new Set(profileEntries.map(([profileId]) => profileId));

  const profileSelection = config.result.profileSelection;
  if (profileSelection !== undefined) {
    assert(profileSelection && typeof profileSelection === "object" && !Array.isArray(profileSelection), "result.profileSelection precisa ser um objeto.");
    assert(profileSelection.method === "answer", 'result.profileSelection.method deve ser "answer".');
    assert(hasSafeId(profileSelection.stageId), "result.profileSelection.stageId deve ser um id seguro.");
    assert(profileSelection.profileKey === "optionId", 'result.profileSelection.profileKey deve ser "optionId".');

    const profileStage = stagesById.get(profileSelection.stageId);
    assert(profileStage, `result.profileSelection.stageId aponta para a etapa inexistente "${profileSelection.stageId}".`);
    for (const option of getAllConfiguredOptions(profileStage)) {
      assert(profileIds.has(option.id), `A opção "${option.id}" da etapa "${profileSelection.stageId}" não possui um perfil correspondente.`);
    }
  }

  for (const [stageIndex, stage] of config.stages.entries()) {
    for (const { answerId, options } of getConfiguredOptionGroups(stage)) {
      for (const [optionIndex, option] of options.entries()) {
        if (option.scores === undefined) continue;
        const optionLabel = answerId === null
          ? `Etapa ${stageIndex + 1}, opção ${optionIndex + 1}`
          : `Etapa ${stageIndex + 1}, resposta "${answerId}", opção ${optionIndex + 1}`;
        assert(option.scores && typeof option.scores === "object" && !Array.isArray(option.scores), `${optionLabel}: scores deve ser um objeto.`);
        for (const [scoreId, score] of Object.entries(option.scores)) {
          assert(hasSafeId(scoreId), `${optionLabel}: a chave de pontuação "${scoreId}" não é um id seguro.`);
          if (profileSelection === undefined) {
            assert(profileIds.has(scoreId), `${optionLabel}: o perfil "${scoreId}" não existe.`);
          }
          assert(typeof score === "number" && Number.isFinite(score) && score >= 0, `${optionLabel}: a pontuação de "${scoreId}" deve ser um número finito e não negativo.`);
        }
      }
    }
  }
  if (config.result.offer !== undefined) {
    const offer = config.result.offer;
    assert(offer && typeof offer === "object" && !Array.isArray(offer), "result.offer precisa ser um objeto.");
    assert(hasText(offer.title), "Informe result.offer.title.");
    assert(hasText(offer.description), "Informe result.offer.description.");
    validateOfferItems(offer.deliverables, "result.offer.deliverables");
    validateOfferItems(offer.bonuses, "result.offer.bonuses");
  }
  assert(config.result.cta && hasText(config.result.cta.label), "Informe result.cta.label.");
  const ctaUrl = config.result.cta.url;
  assert(ctaUrl === undefined || ctaUrl === null || typeof ctaUrl === "string", "result.cta.url deve ser um texto, null ou omitido.");
  if (hasText(ctaUrl)) {
    assert(isSafeResourceUrl(ctaUrl, { allowHash: true }), "result.cta.url deve usar caminho relativo ou HTTPS.");
  }
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

export function getStageOptions(stage, answers = {}) {
  if (Array.isArray(stage?.options)) return stage.options;
  if (stage?.optionsSource?.match !== "optionId") return [];
  if (!stage.optionsByAnswer || typeof stage.optionsByAnswer !== "object" || Array.isArray(stage.optionsByAnswer)) return [];

  const sourceOptionId = answers?.[stage.optionsSource.stageId];
  if (!hasSafeId(sourceOptionId) || !Object.hasOwn(stage.optionsByAnswer, sourceOptionId)) return [];

  const options = stage.optionsByAnswer[sourceOptionId];
  return Array.isArray(options) ? options : [];
}

export function findOption(stage, optionId, answers = {}) {
  return getStageOptions(stage, answers).find((option) => option.id === optionId);
}

export function resolveProfile(stages, answers, profiles, profileSelection) {
  const profileIds = Object.keys(profiles ?? {});
  if (profileIds.length === 0) return null;

  if (profileSelection?.method === "answer" && profileSelection.profileKey === "optionId") {
    const selectedStage = stages?.find((stage) => stage.id === profileSelection.stageId);
    const selectedOption = findOption(selectedStage, answers?.[profileSelection.stageId], answers);
    return selectedOption && Object.hasOwn(profiles, selectedOption.id) ? selectedOption.id : null;
  }

  const totals = Object.assign(Object.create(null), Object.fromEntries(profileIds.map((profileId) => [profileId, 0])));
  for (const stage of stages ?? []) {
    const selectedOption = findOption(stage, answers?.[stage.id], answers);
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
