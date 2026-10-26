---
paths:
  - "srv/**/*.cds"
---
# Services and semantic annotations (srv/*.cds, srv/annotations/*.cds)

File `srv/<name>-service.cds`: projections, actions, functions, authorization. File `srv/annotations/<Entity>.cds`: `@title`, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`. Determine which part the edit belongs to and apply the corresponding block.

## Before editing
1. MCP first, as routed by protocol section 3: the service and entity, then the annotation or construct (`@restrict`, bound action, `excluding`, `@assert.range`).
2. `docs/registry/SERVICES.md`: check whether an action or projection for this task already exists.
3. Check the row in `docs/architecture/PATTERNS.md`, section "Service and logic".

## Service (`srv/<name>-service.cds`)
- One projection per entity, expose only the needed fields.
- Bound action is preferred over unbound. Action names are camelCase verbs: `reorder`, `publish`.
- `@requires` on the service, `@restrict` on projections. Mock users in `package.json` → `cds.requires.auth.users`.
- UI annotations are forbidden in this file. Nothing but `using`, `service`, projections, actions, `@requires`, `@restrict`, `@readonly`, `@odata.draft.enabled`, the service header and doc comments.
- Service header (ADR-0029 decision 3): a doc comment, `@protocol: 'odata-v4'`, `@title: '<English API name>'`, `@Core.SchemaVersion: '<package.json version>'`. Actions, types, their elements and singletons carry their one-sentence doc comment at the definition; developer notes are `//` lines.
- Import of semantics: `using from './annotations/<Entity>';` at the end of the file.
- Template: `templates/service.cds`.

## Semantics (`srv/annotations/<Entity>.cds`)
- Titles live on the projection, so tools reading `my.catalog.*` directly do not see them; the registry generator takes them from the first projection.
- `annotate CatalogService.<Entity> with { ... }`, only `@title: '{i18n>Entity.element}'`, `@mandatory`, `@assert.format`, `@assert.range`, `@assert.target`, `@readonly`, `@Measures.ISOCurrency`.
- Descriptions are one-sentence English doc comments `/** ... */` above the `annotate` statement (the projection) and above each own element; never `@description` or `@Core.Description` (ADR-0029 decision 2).
- i18n keys are added to `_i18n/i18n.properties` and `_i18n/i18n_ru.properties` in the same change.
- Template: `templates/annotations-semantic.cds`.

## After editing
- `cds compile srv --to json`, `npm run lint`, update the `metadata.xml` snapshot, `npm test`, `npm run docs:registry`.

## Forbidden
- `@UI.*`, `@Common.ValueList`, `@Common.Text` here. Their place: `app/<app>/annotations/`.
- A second service for the sake of one entity. A new service only for a different set of users (ADR).
