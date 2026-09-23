import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  QuizConfigError,
  buildAnalyticsEvent,
  findOption,
  getProgress,
  getStageContext,
  getStageOptions,
  resolveProfile,
  validateConfig
} from "../src/quiz-core.mjs";

function createConfig() {
  return {
    version: 1,
    quiz: { id: "quiz-teste", name: "Quiz teste" },
    brand: { name: "Marca" },
    intro: { title: "Introdução" },
    stages: [
      {
        id: "q1",
        type: "list",
        title: "Pergunta 1",
        required: true,
        options: [
          { id: "a", label: "A", scores: { alpha: 2 } },
          { id: "b", label: "B", scores: { beta: 2 } }
        ]
      },
      {
        id: "q2",
        type: "gallery",
        title: "Pergunta 2",
        required: true,
        options: [
          { id: "c", label: "C", image: "c.svg", alt: "C", scores: { alpha: 1 } },
          { id: "d", label: "D", image: "d.svg", alt: "D", scores: { beta: 3 } }
        ]
      }
    ],
    result: {
      cta: { label: "Abrir", url: "https://example.com" },
      profiles: {
        alpha: { title: "Alpha", description: "Perfil Alpha", image: "alpha.svg", alt: "Perfil Alpha" },
        beta: { title: "Beta", description: "Perfil Beta", image: "beta.svg", alt: "Perfil Beta" }
      }
    }
  };
}

function createDynamicConfig() {
  const config = createConfig();
  config.stages.push({
    id: "q3",
    type: "list",
    title: "Pergunta dinâmica",
    required: true,
    optionsSource: { stageId: "q1", match: "optionId" },
    optionsByAnswer: {
      a: [
        { id: "a-alpha", label: "A favorece Alpha", scores: { alpha: 4 } },
        { id: "a-beta", label: "A favorece Beta", scores: { beta: 1 } }
      ],
      b: [
        { id: "b-alpha", label: "B favorece Alpha", scores: { alpha: 1 } },
        { id: "b-beta", label: "B favorece Beta", scores: { beta: 4 } }
      ]
    }
  });
  return config;
}

function enableAnswerProfileSelection(config) {
  config.stages[0].options[0].id = "alpha";
  config.stages[0].options[1].id = "beta";
  config.result.profileSelection = {
    method: "answer",
    stageId: "q1",
    profileKey: "optionId"
  };
  return config;
}

function addOffer(config) {
  config.result.offer = {
    title: "Oferta",
    description: "Descrição da oferta",
    deliverables: [
      { icon: "ruler-measure", title: "Entrega", description: "Descrição da entrega" }
    ],
    bonuses: [
      { icon: "robot", title: "Bônus", description: "Descrição do bônus" }
    ]
  };
  return config;
}

test("valida o quiz-config.json entregue com o projeto", () => {
  const configUrl = new URL("../quiz-config.json", import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, "utf8"));
  assert.doesNotThrow(() => validateConfig(config));
  assert.equal(config.stages.length, 6);
  assert.equal([...config.result.offer.deliverables, ...config.result.offer.bonuses].length, 7);
  assert.ok([...config.result.offer.deliverables, ...config.result.offer.bonuses].every((item) => item.icon));
});

test("aceita uma configuração válida", () => {
  const config = createConfig();
  assert.equal(validateConfig(config), config);
});

test("rejeita IDs de etapa duplicados", () => {
  const config = createConfig();
  config.stages[1].id = "q1";
  assert.throws(() => validateConfig(config), QuizConfigError);
});

test("rejeita uma galeria sem imagem", () => {
  const config = createConfig();
  delete config.stages[1].options[0].image;
  assert.throws(() => validateConfig(config), /informe image/);
});

test("rejeita IDs reservados que poderiam colidir com o protótipo", () => {
  const config = createConfig();
  config.stages[0].id = "constructor";
  assert.throws(() => validateConfig(config), /id seguro/);
});

test("rejeita pontuação para perfil inexistente", () => {
  const config = createConfig();
  config.stages[0].options[0].scores = { typo: 2 };
  assert.throws(() => validateConfig(config), /não existe/);
});

test("aceita perfis sem imagem ou texto alternativo", () => {
  const config = createConfig();
  delete config.result.profiles.alpha.image;
  delete config.result.profiles.alpha.alt;
  assert.doesNotThrow(() => validateConfig(config));
});

test("rejeita imagem insegura quando o perfil a fornece", () => {
  const config = createConfig();
  config.result.profiles.alpha.image = "javascript:alert(1)";
  assert.throws(() => validateConfig(config), /caminho relativo ou HTTPS/);
});

test("rejeita protocolo inseguro em CTA e imagens", () => {
  const config = createConfig();
  config.result.cta.url = "javascript:alert(1)";
  assert.throws(() => validateConfig(config), /caminho relativo ou HTTPS/);
});

test("aceita CTA desabilitado com URL nula ou vazia", () => {
  const config = createConfig();
  config.result.cta.url = null;
  assert.doesNotThrow(() => validateConfig(config));

  config.result.cta.url = "";
  assert.doesNotThrow(() => validateConfig(config));
});

test("aceita ícones Tabler suportados nos cards da oferta", () => {
  const config = addOffer(createConfig());
  assert.doesNotThrow(() => validateConfig(config));
});

test("rejeita cards da oferta sem ícone ou com ícone desconhecido", () => {
  const missingIcon = addOffer(createConfig());
  delete missingIcon.result.offer.deliverables[0].icon;
  assert.throws(() => validateConfig(missingIcon), /ícone Tabler suportado/);

  const unknownIcon = addOffer(createConfig());
  unknownIcon.result.offer.bonuses[0].icon = "<svg>inseguro</svg>";
  assert.throws(() => validateConfig(unknownIcon), /ícone Tabler suportado/);
});

test("reserva 100% para o resultado e mantém progresso monotônico", () => {
  assert.equal(getProgress(0, 4), 20);
  assert.equal(getProgress(1, 4), 40);
  assert.equal(getProgress(3, 4), 80);
  assert.equal(getProgress(0, 4, true), 100);
  assert.equal(getProgress(0, 0), 0);
});

test("resolve o perfil pela soma dos pesos das opções", () => {
  const config = createConfig();
  assert.equal(resolveProfile(config.stages, { q1: "a", q2: "c" }, config.result.profiles), "alpha");
  assert.equal(resolveProfile(config.stages, { q1: "b", q2: "d" }, config.result.profiles), "beta");
});

test("seleciona as opções dinâmicas pela resposta da etapa de origem", () => {
  const config = createDynamicConfig();
  const dynamicStage = config.stages[2];

  assert.deepEqual(getStageOptions(dynamicStage, { q1: "a" }).map(({ id }) => id), ["a-alpha", "a-beta"]);
  assert.deepEqual(getStageOptions(dynamicStage, { q1: "b" }).map(({ id }) => id), ["b-alpha", "b-beta"]);
  assert.deepEqual(getStageOptions(dynamicStage, {}), []);
  assert.equal(findOption(dynamicStage, "b-beta", { q1: "b" })?.label, "B favorece Beta");
  assert.equal(findOption(dynamicStage, "a-alpha", { q1: "b" }), undefined);
});

test("inclui a opção dinâmica selecionada na resolução por pontuação", () => {
  const config = createDynamicConfig();
  assert.equal(
    resolveProfile(config.stages, { q1: "a", q2: "d", q3: "a-alpha" }, config.result.profiles),
    "alpha"
  );
});

test("valida cobertura e referências das opções dinâmicas", () => {
  const missingBranch = createDynamicConfig();
  delete missingBranch.stages[2].optionsByAnswer.b;
  assert.throws(() => validateConfig(missingBranch), /faltam opções para a resposta "b"/);

  const unknownBranch = createDynamicConfig();
  unknownBranch.stages[2].optionsByAnswer.typo = unknownBranch.stages[2].optionsByAnswer.a;
  assert.throws(() => validateConfig(unknownBranch), /resposta "typo" não existe/);

  const forwardReference = createDynamicConfig();
  forwardReference.stages[2].optionsSource.stageId = "q4";
  assert.throws(() => validateConfig(forwardReference), /etapa anterior/);

  const ambiguousOptions = createDynamicConfig();
  ambiguousOptions.stages[2].options = ambiguousOptions.stages[0].options;
  assert.throws(() => validateConfig(ambiguousOptions), /mas não ambos/);
});

test("valida pontuações declaradas dentro de ramos dinâmicos", () => {
  const config = createDynamicConfig();
  config.stages[2].optionsByAnswer.a[0].scores = { typo: 2 };
  assert.throws(() => validateConfig(config), /perfil "typo" não existe/);
});

test("resolve o perfil diretamente pela resposta configurada", () => {
  const config = enableAnswerProfileSelection(createConfig());
  config.stages[1].options[0].scores = { organizacao: 2 };
  assert.doesNotThrow(() => validateConfig(config));
  assert.equal(
    resolveProfile(config.stages, { q1: "alpha", q2: "d" }, config.result.profiles, config.result.profileSelection),
    "alpha"
  );
  assert.equal(resolveProfile(config.stages, {}, config.result.profiles, config.result.profileSelection), null);
});

test("exige um perfil correspondente para cada resposta usada na seleção direta", () => {
  const config = enableAnswerProfileSelection(createConfig());
  config.stages[0].options[0].id = "gamma";
  assert.throws(() => validateConfig(config), /não possui um perfil correspondente/);
});

test("desempata resultados pela ordem declarada dos perfis", () => {
  const config = createConfig();
  assert.equal(resolveProfile(config.stages, {}, config.result.profiles), "alpha");
});

test("remove undefined e strings vazias, mas preserva null para limpar o dataLayer", () => {
  assert.deepEqual(buildAnalyticsEvent("quiz_started", { quiz_id: "x", option_id: null, note: "" }), {
    event: "quiz_started",
    quiz_id: "x",
    option_id: null
  });
});

test("gera contexto estável de etapa", () => {
  const config = createConfig();
  assert.deepEqual(getStageContext(config, config.stages[1], 1, 67), {
    quiz_id: "quiz-teste",
    quiz_name: "Quiz teste",
    stage_id: "q2",
    stage_index: 2,
    stage_total: 2,
    question_type: "gallery",
    progress_percent: 67
  });
});
