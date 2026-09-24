---
paths:
  - "db/**/*.cds"
---
# Domain model (db/)

Applies to `db/schema.cds`, `db/common.cds`, `db/<module>.cds`. For CSV data see `data.md`.

## Before editing
1. MCP first, as routed by protocol section 3: the affected entities and associations, then the construct you use (aspect, composition, localized, calculated element).
2. Read `docs/registry/DOMAIN-MODEL.md`: do not duplicate entities and types, reuse existing ones.
3. Make sure the task has a specification `docs/features/<name>/PLAN.md`.

## Rules
- `CONVENTIONS.md` section 3 in full. Key points: `cuid, managed`, PascalCase plural for entities, camelCase elements, lengths on all strings, `Association to` in singular, `Composition of many` in plural.
- Code lists for the user: `sap.common.CodeList`, not `enum` (PATTERNS: "Code list with selection from a list").
- Money: `Decimal(15, 2)` + `currency : Currency`.
- No `@UI.*`, `@Common.*`, `@title`, `@mandatory` annotations in `db/`. Semantics in `srv/annotations/<Entity>.cds`, presentation in `app/<app>/annotations/`.
- New domain module: a separate file `db/<module>.cds` with `namespace my.catalog.<module>;`.
- Template: `templates/entity.cds`.

## After editing
- `cds compile db --to json` without errors, then `npm run lint`.
- Generate or update the CSV: `cds add data --filter <Entity> --records 10`, then replace the placeholders with real values (see `data.md`).
- Update the snapshot `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml`.
- Update or add the service test and the metadata snapshot (`npx vitest -u` only deliberately).
- `npm run docs:registry`.

## Forbidden
- Changing the type of an existing element or deleting it without an ADR and an entry in `docs/CHANGELOG.md`.
- Exposing `db/` entities directly without a projection in the service.
- `cds add sample`.
