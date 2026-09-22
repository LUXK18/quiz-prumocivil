import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  QuizConfigError,
  buildAnalyticsEvent,
  getProgress,
  getStageContext,
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

test("valida o quiz-config.json entregue com o projeto", () => {
  const configUrl = new URL("../quiz-config.json", import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, "utf8"));
  assert.doesNotThrow(() => validateConfig(config));
  assert.equal(config.stages.length, 3);
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

test("rejeita perfil sem texto alternativo da imagem", () => {
  const config = createConfig();
  delete config.result.profiles.alpha.alt;
  assert.throws(() => validateConfig(config), /informe alt/);
});

test("rejeita protocolo inseguro em CTA e imagens", () => {
  const config = createConfig();
  config.result.cta.url = "javascript:alert(1)";
  assert.throws(() => validateConfig(config), /caminho relativo ou HTTPS/);
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
