# Quiz Prumo Civil

Quiz responsivo orientado por JSON, construído sem dependências externas. O fluxo atual tem seis perguntas, opções condicionais, telas de transição, resultado personalizado, oferta final, progresso dinâmico e eventos para Google Tag Manager.

## Executar

Requer Node.js 18 ou mais recente.

```bash
npm run dev
```

Acesse `http://127.0.0.1:5173`.

Para validar JavaScript, configuração e regras de negócio:

```bash
npm run check
```

## Configuração

Todo o conteúdo está em [`quiz-config.json`](quiz-config.json):

- `brand` e `theme`: logo, nome e cores;
- `intro`: textos da abertura;
- `stages`: etapas em ordem de exibição;
- `transitions`: conteúdos exibidos entre perguntas, sem alterar a contagem;
- `result.profiles`: perfis selecionados a partir das respostas;
- `result.personalization`: benefício, primeira aplicação e próximos passos;
- `result.offer`: entregáveis, bônus, ícones e aviso de responsabilidade;
- `result.cta`: botão final;
- `analytics`: integração com `dataLayer` e GTM.

Para criar uma etapa, adicione um objeto a `stages`. Para atualizar, edite-o; para remover, retire-o do array; para reordenar, mude sua posição. IDs precisam ser únicos e estáveis.

### Etapa em lista

```json
{
  "id": "preferencia",
  "type": "list",
  "eyebrow": "Etapa opcional",
  "title": "Qual opção combina com você?",
  "description": "Selecione uma alternativa.",
  "required": true,
  "options": [
    {
      "id": "opcao-a",
      "label": "Primeira opção",
      "scores": { "documentos": 1 }
    },
    {
      "id": "opcao-b",
      "label": "Segunda opção",
      "scores": { "obra": 1 }
    }
  ]
}
```

Para uma galeria, use `"type": "gallery"` e acrescente `image` e `alt` em cada opção. Uma etapa condicional usa `optionsSource` e `optionsByAnswer`; no fluxo atual, a última pergunta depende da resposta dada em `rotina`.

O resultado usa `profileSelection.method: "answer"`, portanto o perfil é escolhido diretamente pela resposta configurada. Enquanto `result.cta.url` estiver nulo ou vazio, o CTA permanece visível e desabilitado até a URL real do checkout ser informada.

Cada item de `result.offer.deliverables` e `result.offer.bonuses` declara um `icon`. Os ícones são SVGs Tabler locais, decorativos e validados por uma lista segura em `src/tabler-icons.mjs`; não há carregamento por CDN.

## Analytics / Tag Manager

Os eventos são enviados para `window.dataLayer`. Com o prefixo padrão, os principais são:

- `prumo_civil_quiz_loaded`
- `prumo_civil_quiz_started`
- `prumo_civil_quiz_step_viewed`
- `prumo_civil_quiz_answer_changed`
- `prumo_civil_quiz_step_completed`
- `prumo_civil_quiz_transition_viewed`
- `prumo_civil_quiz_transition_completed`
- `prumo_civil_quiz_completed`
- `prumo_civil_quiz_cta_clicked`

O payload utiliza IDs estáveis e não envia textos livres ou dados pessoais. Para carregar o contêiner do Google Tag Manager, informe um `containerId` válido, como `GTM-XXXXXXX`. Se o campo estiver vazio ou o script for bloqueado, o quiz continua funcionando normalmente.

`analytics.debug: true` mantém os eventos visíveis no console durante o desenvolvimento.

## Estrutura

```text
assets/                 Logo, favicon e fallback de imagem
src/app.js              Interface e navegação
src/quiz-core.mjs       Validação, progresso, perfil e analytics
tests/                  Testes unitários com node:test
quiz-config.json        Conteúdo e comportamento do quiz
server.mjs              Servidor local sem dependências
```
