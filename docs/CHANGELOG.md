# Changelog

Формат: дата, область, что изменилось. Ведёт `docs-keeper`, дополняют все агенты. Новые записи сверху.

## 2026-09-07

### pipeline
- Конвейер агентов: 11 субагентов (`.claude/agents/`), общий скилл `project-protocol`, скиллы `feature`, `spec`, `add-entity`, `gen-docs`, `run-app`, `test-all`, `review`, `retro`, `release-check`, `debug-after-upgrade`, `upgrade-cds`, 11 правил по путям (`.claude/rules/`), шаблоны `templates/`, 9 ADR.
- Хуки в `.claude/settings.json` со скриптами `scripts/hooks/`: SessionStart (контекст и проверка окружения), PreToolUse (защита файлов, напоминание о реестре), PostToolUse (компиляция, prettier, eslint, ui5lint, паритет i18n, маркер устаревания реестра), SubagentStop (блок при ошибках линтера), Stop (реестр, STATE, CHANGELOG, `npm test`), PreCompact (чекпоинт в STATE).
- Наблюдатель релизов `scripts/watch-releases.mjs` (31 источник), `docs/framework/versions.json`, `docs/framework/UPDATES.md`, еженедельный workflow `.github/workflows/release-check.yml`.
- CLAUDE.md переписан как конституция (84 строки): карта документации, инварианты, команды, запреты.
- Установлены Node 22.23.2 и `@sap/cds-dk` 10.0.7. Плагины Claude Code `ui5@claude-plugins-official` и `cap-developer@cap` подключены на уровне проекта (`.claude/settings.json`).
- Добавлен `.mcp.json`: `cds-mcp` 0.0.5, `fiori-mcp` 1.12.2, `chrome-devtools` 1.8.0, версии закреплены.
- Добавлены `docs/architecture/*`, `docs/registry/*` (генерируются `scripts/gen-registry.mjs`), `scripts/check-docs-fresh.mjs`, `docs/STATE.md`, `docs/LESSONS.md`, `docs/decisions/`, `templates/`, `.claude/rules/`.
- План конвейера: `docs/ai-pipeline-plan.md`; из плана исключён внешний сервер памяти.

### docs
- Шаблоны `templates/*.cds` получили уникальные namespace `my.catalog.tpl.*`: CAP MCP компилирует все `.cds` проекта и падал на дубликатах. В LESSONS записан обход дефекта `run_manifest_validation` UI5 MCP 0.2.18.

### test
- Добавлены `test/catalog-service.test.js` (7 тестов: список, цена строкой, фильтр, создание с managed-полями, `@mandatory`, `@assert.range`, справочник валют) и `test/metadata.test.js` (снапшот EDMX в `test/__snapshots__/`, HTTP `$metadata` с английскими labels). `vitest.config.mjs` с `globals: true`.

### deps
- Добавлен `@sap/cds-common-content` 3.2.0: данные ISO для `sap.common.Currencies`, `Countries`, `Languages`; импорт в `db/schema.cds`. Без него value help валюты был пуст.
- Бэкенд переведён с `@sap/cds` 8 на 10 (`@cap-js/sqlite` 3, `@cap-js/cds-test` 1, Vitest 5, ESLint 10 с `@sap/eslint-plugin-cds`, Prettier 3). `package.json` теперь ESM (`"type": "module"`), `engines.node >= 22`.
- UI: `@ui5/cli` 4, `@sap/ux-ui5-tooling` 1.32, `@sap-ux/ui5-middleware-fe-mockserver` 2, `@ui5/linter` 1, `@sap-ux/eslint-plugin-fiori-tools` 10.

### db, srv
- `Products` использует аспект `cuid` вместо явного `key ID`. Титулы перенесены из `db/schema.cds` в `srv/annotations/Products.cds` и локализованы через `_i18n/i18n.properties` (en) и `i18n_ru.properties`.
- Добавлены `@assert.range` на `price` и `stock`. Добавлен `_i18n/messages.properties` для ключей ошибок.
- Удалена папка `srv/annotations/Products/` (ui, valuehelps, constraints).

### app
- UI-аннотации перенесены в `app/products/annotations/Products.cds` с точкой входа `app/products/annotations.cds`. Колонка `currency_code` убрана из LineItem (валюта видна в форматировании цены через `ISOCurrency`).
- `manifest.json`: `_version` 2.0.0, `minUI5Version` 1.136.0, удалён устаревший `synchronizationMode`. Bootstrap-параметры в html переведены на актуальное написание (`ui5lint --fix`).
- `Component.js`: `sap.ui.getCore().byId` заменён на `Element.getElementById` (автоисправление ui5lint, поведение сохранено).
- Мок-режим: удалены `localService/mockserver.js`, `test/initMockServer.js`, `test/mockServer.html`, `ui5-local.yaml`. Добавлен `ui5-mock.yaml` с `sap-fe-mockserver`; `ui5.yaml` теперь только прокси. `mockdata/Products.json` переведён в формат массива.
- `localService/metadata.xml` перегенерирован из cds 10 с английскими labels.

### repo
- Удалён чужой `ecosystem.config.js`. Из git убраны `db.sqlite-shm`, `db.sqlite-wal`; `.gitignore` дополнен (`*.sqlite-*`, `.claude/settings.local.json`, `.cds-upgrade/`).
- README переписан под новую структуру и команды.
