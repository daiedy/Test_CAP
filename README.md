# Product Catalog

Full-stack приложение на SAP CAP (Node.js, OData V4) с интерфейсом SAP Fiori Elements V4. Одновременно площадка для агентного конвейера разработки CAP-приложений на Claude Code (см. `docs/ai-pipeline-plan.md` и `CLAUDE.md`).

## Требования

- Node.js 22 LTS, npm 10
- `@sap/cds-dk` 10 глобально: `npm i -g @sap/cds-dk@10`

## Быстрый старт

```bash
npm install
cd app/products && npm install && cd ../..
npm run watch
```

Откройте http://localhost:4004/products/webapp/test/flpSandbox.html#products-display. Сервис: http://localhost:4004/odata/v4/catalog/, метаданные: `/odata/v4/catalog/$metadata`.

## Режимы запуска UI

| Режим | Команда | Адрес |
|---|---|---|
| Через CAP | `npm run watch` в корне | http://localhost:4004/products/webapp/test/flpSandbox.html |
| UI5 tooling с прокси на CAP | `npm start` в `app/products` при запущенном `npm run watch` | http://localhost:8080/test/flpSandbox.html |
| Без бэкенда (мок) | `npm run start-mock` в `app/products` | http://localhost:8080/test/flpSandbox.html |

Мок-режим использует `@sap-ux/ui5-middleware-fe-mockserver` с `webapp/localService/metadata.xml` и `webapp/localService/mockdata/*.json`. После изменения модели обновите снимок: `cds compile srv --to edmx-v4 -l en > app/products/webapp/localService/metadata.xml`.

## Команды

Корень:

| Команда | Что делает |
|---|---|
| `npm run watch` | CAP-сервер с автоперезапуском, SQLite in-memory |
| `npm test` | Тесты бэкенда (Vitest + @cap-js/cds-test) |
| `npm run lint` | `cds lint` |
| `npm run docs:registry` | Регенерация `docs/registry/*.md` из модели и исходников |
| `npm run build` | `cds build --production` |

`app/products`:

| Команда | Что делает |
|---|---|
| `npm start` | UI5 dev server с прокси на :4004 |
| `npm run start-mock` | UI5 dev server с мок-сервером |
| `npm run lint` | `ui5lint` |
| `npm run build` | Сборка в `dist/` |

## Структура

```
db/            модель данных (my.catalog) и тестовые данные CSV
srv/           сервис CatalogService, семантические аннотации, хендлеры
app/products/  Fiori Elements приложение и его UI-аннотации
_i18n/         тексты бэкенда (en, ru)
test/          тесты бэкенда
docs/          архитектура, паттерны, реестр, решения, состояние
templates/     эталонные файлы для новых артефактов
scripts/       скрипты конвейера (реестр, хуки, наблюдатель релизов)
.claude/       агенты, скиллы, правила, хуки Claude Code
```

Подробности в `docs/architecture/`, правила работы в `CLAUDE.md`.

## Деплой

`mta.yaml` и `xs-security.json` являются черновиками под Cloud Foundry и пока не пригодны для деплоя. См. `docs/architecture/ARCHITECTURE.md`.
