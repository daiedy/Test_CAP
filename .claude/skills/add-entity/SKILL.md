---
name: add-entity
description: Короткий рабочий поток для новой сущности CAP по паттерну «Новая сущность»: модель, проекция, семантические аннотации, i18n, данные, UI-аннотации, тесты, реестр. Используй для простых сущностей без сложной логики; для остального /feature.
argument-hint: <Имя сущности и поля>
disable-model-invocation: true
---

# Новая сущность: $ARGUMENTS

Следуй паттерну «Новая сущность» из `docs/architecture/PATTERNS.md` и правилам `.claude/rules/db-model.md`.

1. `mcp__cds-mcp__search_model` по имени сущности и похожим именам; `docs/registry/DOMAIN-MODEL.md`. Если сущность или её аналог есть, остановись и сообщи.
2. `db/schema.cds`: `entity <Name> : cuid, managed { ... }` по `templates/entity.cds`. Справочники через `sap.common.CodeList`, деньги через `Decimal(15, 2)` + `Currency`.
3. `srv/catalog-service.cds`: проекция; `srv/annotations/<Name>.cds` по `templates/annotations-semantic.cds`; ключи в `_i18n/i18n.properties` и `i18n_ru.properties`.
4. Данные: `cds add data --filter <Name> --records 10`, затем замени плейсхолдеры реальными значениями, UUID оставь.
5. UI: `app/products/annotations/<Name>.cds` по `templates/annotations-ui.cds`, подключи в `app/products/annotations.cds`. Страницу для новой сущности добавляй только через Fiori MCP (`list_functionality` → `execute_functionality`), затем `run_manifest_validation`.
6. Проверки: `cds compile srv --to json`, `npm run lint`, обновление снимка `cds compile srv --to edmx-v4 -l en > app/products/webapp/localService/metadata.xml`, тест в `test/catalog-service.test.js` (список, создание, обязательные поля), `npx vitest -u` для снапшота metadata с записью в CHANGELOG, `npm test`, `npm run lint` в `app/products`.
7. `npm run docs:registry`, строки в `docs/CHANGELOG.md`, обновление `docs/STATE.md`.

Отчёт по форме протокола.
