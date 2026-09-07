---
name: add-entity
description: Short workflow for a new CAP entity following the "New entity" pattern: model, projection, semantic annotations, i18n, data, UI annotations, tests, registry. Use for simple entities without complex logic; for everything else use /feature.
argument-hint: <Entity name and fields>
disable-model-invocation: true
---

# New entity: $ARGUMENTS

Follow the "New entity" pattern from `docs/architecture/PATTERNS.md` and the rules in `.claude/rules/db-model.md`.

1. `mcp__cds-mcp__search_model` by the entity name and similar names; `docs/registry/DOMAIN-MODEL.md`. If the entity or its analogue already exists, stop and report.
2. `db/schema.cds`: `entity <Name> : cuid, managed { ... }` following `templates/entity.cds`. Code lists via `sap.common.CodeList`, money via `Decimal(15, 2)` + `Currency`.
3. `srv/catalog-service.cds`: projection; `srv/annotations/<Name>.cds` following `templates/annotations-semantic.cds`; keys in `_i18n/i18n.properties` and `i18n_ru.properties`.
4. Data: `cds add data --filter <Name> --records 10`, then replace the placeholders with real values, keep the UUIDs.
5. UI: `app/products/annotations/<Name>.cds` following `templates/annotations-ui.cds`, include it in `app/products/annotations.cds`. Add a page for the new entity only via Fiori MCP (`list_functionality` → `execute_functionality`), then `run_manifest_validation`.
6. Checks: `cds compile srv --to json`, `npm run lint`, snapshot update `cds compile srv --to edmx-v4 -l en > app/products/webapp/localService/metadata.xml`, a test in `test/catalog-service.test.js` (list, create, mandatory fields), `npx vitest -u` for the metadata snapshot with an entry in CHANGELOG, `npm test`, `npm run lint` in `app/products`.
7. `npm run docs:registry`, lines in `docs/CHANGELOG.md`, update of `docs/STATE.md`.

Report in the protocol format.
