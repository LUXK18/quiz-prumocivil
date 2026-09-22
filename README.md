# Rota Quiz

Quiz responsivo orientado por JSON, construído sem dependências externas. O projeto implementa os dois layouts do wireframe (`list` e `gallery`), resultado personalizado, progresso dinâmico e eventos para Google Tag Manager.

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
- `result.profiles`: perfis calculados a partir das respostas;
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
      "scores": { "litoral": 2 }
    },
    {
      "id": "opcao-b",
      "label": "Segunda opção",
      "scores": { "natureza": 2 }
    }
  ]
}
```

Para uma galeria, use `"type": "gallery"` e acrescente `image` e `alt` em cada opção. Os nomes usados em `scores` devem corresponder às chaves de `result.profiles`.

## Analytics / Tag Manager

Os eventos são enviados para `window.dataLayer`. Com o prefixo padrão, os principais são:

- `rota_quiz_loaded`
- `rota_quiz_started`
- `rota_quiz_step_viewed`
- `rota_quiz_answer_changed`
- `rota_quiz_step_completed`
- `rota_quiz_completed`
- `rota_quiz_cta_clicked`

O payload utiliza IDs estáveis e não envia textos livres ou dados pessoais. Para carregar o contêiner do Google Tag Manager, informe um `containerId` válido, como `GTM-XXXXXXX`. Se o campo estiver vazio ou o script for bloqueado, o quiz continua funcionando normalmente.

`analytics.debug: true` mantém os eventos visíveis no console durante o desenvolvimento.

## Estrutura

```text
assets/                 Ilustrações locais e logo
src/app.js              Interface e navegação
src/quiz-core.mjs       Validação, progresso, perfil e analytics
tests/                  Testes unitários com node:test
quiz-config.json        Conteúdo e comportamento do quiz
server.mjs              Servidor local sem dependências
```
