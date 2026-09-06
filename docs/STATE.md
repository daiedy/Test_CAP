# Состояние проекта

Обновляется агентом `docs-keeper` в конце каждой задачи и хуком PreCompact. Первые 40 строк выводятся в начале каждой сессии.

## Где мы

- Дата: 2026-09-07
- Ветка: main, этапы 0–4 конвейера закоммичены 2026-09-07
- Текущая фаза конвейера: этапы 0–4 плана реализованы (окружение, конституция, агенты и скиллы, хуки и тесты бэкенда, наблюдатель релизов). Не сделано: тесты UI (OPA5, ui5-test-runner, wdi5), CI для тестов, упаковка в плагин (этап 5)
- Активная фича: нет. Следующий шаг: первый прогон `/feature «Categories как справочник с value help»` для обкатки конвейера; после него `/retro`

## Что работает

- Бэкенд на cds 10.0.6, Node 22: `npm run watch`, `npm run lint`, `npm test` (9 тестов, снапшот $metadata), `npm run docs:registry`
- UI: `npm start` (прокси) и `npm run start-mock` (мок-сервер SAP) в `app/products`; `ui5lint` без ошибок
- Плагины Claude Code на уровне проекта: `ui5`, `cap-developer`; MCP: `cds-mcp`, `fiori-mcp`, `chrome-devtools` (после перезапуска сессии)
- Конвейер: 11 субагентов в `.claude/agents`, 12 скиллов, 11 правил по путям, 6 хуков в `.claude/settings.json`, реестр `docs/registry`, наблюдатель релизов `scripts/watch-releases.mjs` и workflow `release-check.yml`

## Открытый долг

| Пункт | Решение | Кто |
|---|---|---|
| CSP: inline-скрипты в `webapp/index.html` и `webapp/test/flpSandbox.html` (4 предупреждения ui5lint) | Прогнать скилл `modernize-flp-sandbox` из плагина `ui5-modernization` первой задачей конвейера | пользователь решает, ставить ли плагин |
| Хак клавиатуры для кнопки Explore в `Component.js` (setTimeout, внутренний id ushell) | Осознанное решение автора. Не трогать без запроса; альтернатива через `CommandExecution` описана в LESSONS | пользователь |
| `Products.price` Decimal(10, 2) вместо конвенции Decimal(15, 2) | Оставлено, ADR-0003. Менять при первой миграции модели | architect |
| `mta.yaml`, `xs-security.json` черновики без зависимостей продуктива | Отдельный ADR перед работой по деплою | пользователь |
| Тестов UI нет (QUnit, OPA5, wdi5); `@sap-ux/ui5-test-writer`, `ui5-test-runner`, `wdio-ui5-service` не установлены | Первая фича с UI: `test-ui` ставит инструменты и создаёт `webapp/test/` с Test Starter | test-ui |
| Нет CI для `npm test` и линтеров (есть только `release-check.yml`) | Добавить `ci.yml`: `npm ci --ignore-scripts`, lint, test, ui5lint | пользователь решает |
| Хуки, MCP и субагенты проверены в живой сессии 2026-09-07 только точечными вызовами, полный `/feature` не прогонялся | Первый `/feature` покажет; после него `/retro` | пользователь |
| `run_manifest_validation` UI5 MCP 0.2.18 падает с ошибкой схемы draft-06 | Обход через `ui5lint`; ждать новую версию `@ui5/mcp-server` через `release-check` | release-watcher |
| Мок-данные `localService/mockdata/Products.json` содержат 5 записей с placeholder-картинками | Синхронизировать с `db/data` CSV при следующем изменении модели | fiori-app-dev |

## Накопленные решения

См. `docs/decisions/`. Ключевые: cds 10 + Node 22 (ADR-0001), Vitest + cds-test (ADR-0002), аннотации разделены на семантику в `srv/annotations` и UI в `app/<app>/annotations` (ADR-0004), JavaScript и ESM (ADR-0005), Fiori Elements V4 через Fiori MCP (ADR-0007), мок через `sap-fe-mockserver` (ADR-0008), MCP-first и закреплённые версии (ADR-0009).

## Сессии
