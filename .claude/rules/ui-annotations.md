---
paths:
  - "app/**/annotations.cds"
  - "app/**/annotations/**/*.cds"
---
# Application UI annotations (app/<app>/annotations/)

`app/<app>/annotations.cds` contains only `using from './annotations/<Entity>';` lines. The files `app/<app>/annotations/<Entity>.cds` contain `@UI.*`, `@Common.ValueList`, `@Common.Text`, `@Common.TextArrangement`.

## Before editing
1. `mcp__fiori-mcp__search_docs` for the needed term: `UI.LineItem`, `UI.Facets`, `UI.DataFieldForAction`, `Common.ValueList`, criticality.
2. `mcp__cds-mcp__search_model` for the entity: exact names of elements and associations.
3. `docs/registry/UI-ARTIFACTS.md`: which annotations are already set, so as not to create a second `LineItem` without a qualifier.
4. Read the PATTERNS rows, section "UI Fiori Elements".

## Rules
- The annotation target is always `CatalogService.<Entity>`, never `my.catalog.*`.
- Paths in annotations use a dot: `currency.name`, not `currency/name`.
- Every `Label` through i18n: `Label: '{i18n>Products.name}'`. Keys in `app/<app>/webapp/i18n/i18n.properties` and `i18n_ru.properties`. If the label matches the element's `@title`, do not specify `Label` at all.
- Association to a code list: `@Common.ValueList` + `@Common.Text` + `@Common.TextArrangement: #TextOnly` on the foreign key, so that the user does not see the UUID.
- Button: `DataFieldForAction` on a bound action of the service; a controller extension is not for this.
- Keep the existing formatting: field order, qualifiers, 2-space indentation style.
- Template: `templates/annotations-ui.cds`.

## After editing
- `cds compile srv --to json` without annotation warnings.
- Update `app/<app>/webapp/localService/metadata.xml`.
- `npm test` (the metadata snapshot changes deliberately), `npm run docs:registry`.
- Check the screen: `npm run watch`, open the FLP, if Chrome DevTools MCP is available take a screenshot into `docs/features/<name>/VERIFICATION.md`.

## Forbidden
- `@mandatory`, `@assert.*`, `@readonly`, `@restrict` here. Their place: `srv/annotations/`.
- Edits to `manifest.json` for what can be expressed with an annotation.
