---
paths:
  - "srv/**/*.cds"
---
# Services and semantic annotations (srv/*.cds, srv/annotations/*.cds)

File `srv/<name>-service.cds`: projections, actions, functions, authorization. File `srv/annotations/<Entity>.cds`: `@title`, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`. Determine which part the edit belongs to and apply the corresponding block.

## Before editing
1. `mcp__cds-mcp__search_model` for the service and entity: existing projections, actions, annotations.
2. `mcp__cds-mcp__search_docs` for the specific annotation or construct (`@restrict`, bound action, `excluding`, `@assert.range`).
3. `docs/registry/SERVICES.md`: check whether an action or projection for this task already exists.
4. Check the row in `docs/architecture/PATTERNS.md`, section "Service and logic".

## Service (`srv/<name>-service.cds`)
- One projection per entity, expose only the needed fields.
- Bound action is preferred over unbound. Action names are camelCase verbs: `reorder`, `publish`.
- `@requires` on the service, `@restrict` on projections. Mock users in `package.json` → `cds.requires.auth.users`.
- UI annotations are forbidden in this file. Nothing but `using`, `service`, projections, actions, `@requires`, `@restrict`, `@readonly`, `@odata.draft.enabled`.
- Import of semantics: `using from './annotations/<Entity>';` at the end of the file.
- Template: `templates/service.cds`.

## Semantics (`srv/annotations/<Entity>.cds`)
- `annotate CatalogService.<Entity> with { ... }`, only `@title: '{i18n>Entity.element}'`, `@mandatory`, `@assert.format`, `@assert.range`, `@assert.target`, `@readonly`, `@Measures.ISOCurrency`, `@Core.Description`.
- i18n keys are added to `_i18n/i18n.properties` and `_i18n/i18n_ru.properties` in the same change.
- Template: `templates/annotations-semantic.cds`.

## After editing
- `cds compile srv --to json`, `npm run lint`, update the `metadata.xml` snapshot, `npm test`, `npm run docs:registry`.

## Forbidden
- `@UI.*`, `@Common.ValueList`, `@Common.Text` here. Their place: `app/<app>/annotations/`.
- A second service for the sake of one entity. A new service only for a different set of users (ADR).
