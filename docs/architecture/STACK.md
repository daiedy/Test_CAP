# Стек и версии

Состояние на 2026-09-07. Версии обновляются через `release-check` (см. `docs/framework/UPDATES.md`), изменения фиксируются в `docs/CHANGELOG.md`.

## Среда

| Компонент | Версия | Примечание |
|---|---|---|
| Node.js | 22 LTS (22.23.2) | Установлен через Homebrew `node@22`. cds 10 и инструменты SAP требуют ≥ 22 |
| npm | 10.x | |
| `@sap/cds-dk` глобально | 10.0.7 | `npm i -g @sap/cds-dk@10`, даёт команду `cds` |
| Claude Code | 2.1.x | Плагины `ui5@claude-plugins-official`, `cap-developer@cap` на уровне проекта |

## Бэкенд

| Пакет | Версия | Зачем |
|---|---|---|
| `@sap/cds` | ^10 (10.0.6) | Runtime CAP. Ежегодный мажор, поддержка предыдущего мажора 12 месяцев |
| `@sap/cds-dk` | ^10 (10.0.7) | CLI: `cds watch`, `cds compile`, `cds add`, `cds lint` |
| `@cap-js/sqlite` | ^3 (3.0.2) | SQLite для разработки и тестов, драйвер `node:sqlite` по умолчанию |
| `@cap-js/cds-test` | ^1 (1.0.2) | `cds.test()` для тестов сервисов |
| `vitest`, `@vitest/coverage-v8` | ^5 | Основной раннер тестов по рекомендации capire с апреля 2026 |
| `eslint`, `@sap/eslint-plugin-cds` | ^10, ^4 | `cds lint`, конфиг `eslint.config.mjs` |
| `prettier` | ^3 | Формат JS |
| `@sap/cds-common-content` | ^3 (3.2.0) | ISO-справочники валют, стран, языков для `sap.common.*`; импорт в `db/schema.cds` |
| `express` | ^4 | Транзитивно для CAP |

База данных в разработке: SQLite in-memory, деплой CSV при каждом старте (`cds watch`). Файл `db.sqlite` создаётся только командой `cds deploy` и не коммитится. Продуктивная БД не выбрана (HANA Cloud по `mta.yaml`, решение отложено).

## UI

| Пакет | Версия | Зачем |
|---|---|---|
| SAPUI5 с CDN `https://ui5.sap.com` | актуальная, minUI5Version 1.136.0 | Fiori Elements V4 (`sap.fe.templates`), FLP sandbox |
| `@ui5/cli` | ^4 (4.0.65) | Сборка и сервер разработки |
| `@sap/ux-ui5-tooling` | ^1.32 | `fiori run`, прокси, appreload |
| `@sap-ux/ui5-middleware-fe-mockserver` | ^2 (2.4.16) | Мок OData V4 без бэкенда, `ui5-mock.yaml` |
| `@ui5/linter` | ^1 (1.23.5) | `ui5lint`, устаревшие API, CSP, manifest |
| `@sap-ux/eslint-plugin-fiori-tools` | ^10 | ESLint для Fiori-приложений (подключается на этапе 3) |
| `@sap/ux-specification` | ^1.144 | Схемы для Fiori tools и page editor |
| `@sap-ux/ui5-test-writer` | 1.9.6 | Генерация каркаса OPA5 page objects (`app/products`, фича `categories-code-list`) |
| `ui5-test-runner` | 5.14.0 | Запуск QUnit/OPA5 без браузера через `npm run test:ui` (`app/products`) |

## Инструменты агентов

| Инструмент | Версия | Роль |
|---|---|---|
| `@cap-js/mcp-server` (`cds-mcp`) | 0.0.5 | `search_model`, `search_docs` для CAP |
| `@sap-ux/fiori-mcp-server` (`fiori-mcp`) | 1.12.2 | Генерация и модификация Fiori Elements, `search_docs` |
| `@ui5/mcp-server` через плагин `ui5` | 0.2.18 | API, гайдлайны, `run_ui5_linter`, `run_manifest_validation` |
| `chrome-devtools-mcp` | 1.8.0 | Проверка UI в браузере |
| Плагин `ui5@claude-plugins-official` | 0.1.8 | 8 скиллов best practices UI5 |
| Плагин `cap-developer@cap` | 1.0.0 | Скилл разработки CAP от команды CAP |

Версии MCP закреплены в `.mcp.json` и поднимаются только через `release-check` (ADR-0009).

## Планируется на этапах 3–4

`wdio-ui5-service` (E2E), Renovate.
