# Changelog

Формат: дата, область, что изменилось. Ведёт `docs-keeper`, дополняют все агенты. Новые записи сверху.

## 2026-09-07

### db, srv (фича `categories-code-list`, фаза 2, шаги 3–6)
- `db/schema.cds`: новая сущность `my.catalog.Categories : sap.common.CodeList` с `key code : String(20)` (ADR-0010). `Products.category` переведён с `String(50)` на `Association to Categories`; внешний ключ `category_code : String(20)` генерирует компилятор.
- Данные: `db/data/my.catalog-Categories.csv` (6 кодов `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY`, названия en, алфавитный порядок) и `my.catalog-Categories.texts.csv` (6 строк, только локаль `ru`); в `my.catalog-Products.csv` колонка `category` переименована в `category_code`, значения заменены кодами, ID и остальные колонки без изменений.
- `srv/catalog-service.cds`: явная проекция `@readonly entity Categories` (нужна для `@assert.target` и титулов). `srv/annotations/Products.cds`: `@assert.target` на `category`. Новый `srv/annotations/Categories.cds`: титулы `code`/`name`/`descr`; ключи `Categories.code`, `Categories.name`, `Categories.descr` в `_i18n/i18n.properties` и `i18n_ru.properties`. Хендлеров нет. Изменение контракта OData и снапшот `test/__snapshots__` фиксирует `test-backend` (шаг 7).

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
- Фича `categories-code-list`, шаг 7 (`test-backend`): `test/catalog-service.test.js` расширен с 7 до 13 тестов. Новые: «lists the 6 seeded categories», «returns localized category names with English fallback» (`Accept-Language` `ru`, `en` и fallback `de` → английское имя), «filters products by category code» (замена «filters by category»), «expands the category of a product», «rejects a product without a category» (`ASSERT_MANDATORY`), «rejects an unknown category code» (`ASSERT_TARGET`), «does not allow creating categories» (405); «creates a product with the mandatory fields…» и «rejects a product without a name» переведены на `category_code`. Снапшот `test/__snapshots__/metadata.test.js.snap` обновлён `npx vitest -u` осознанно: контракт OData изменён, `Products.category` (String 50) заменён на `category_code` (String 20) и навигацию `category`; добавлены наборы `Categories`, `Categories_texts`, `Capabilities.*Restrictions` на `Categories`, сгенерированный `Common.ValueList` с `CollectionPath="Categories"` на `category_code`; старый ValueList на `Products` удалён. `Common.Text`/`TextArrangement`/`ValueListWithFixedValues` появятся после шагов 9–10, снапшот обновится повторно в шаге 14.
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
