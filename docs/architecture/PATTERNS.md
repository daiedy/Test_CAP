# Pattern catalogue: one task, one way

For every recurring task there is exactly one approved way here. An agent that meets a task from the table uses the specified way and example. If the way does not fit, work stops and an ADR is created, not a second way. Links to examples point to the current code; the registry in `docs/registry/` shows what already exists.

## Data model

| Task | Way | Example | Decision |
|---|---|---|---|
| New entity | `entity X : cuid, managed { ... }` in `db/schema.cds`; projection in the service; labels in `srv/annotations/X.cds`; UI in `app/<app>/annotations/X.cds`; data `cds add data --filter X --records N`; test `test/<service>.test.js` | `db/schema.cds` → `Products` | ADR-0003 |
| Code list with selection from a list | Entity `: sap.common.CodeList` with key `code`, association from the main entity, `@Common.ValueList` and `@Common.Text` in UI annotations | `Currency` pattern from `@sap/cds/common` | ADR-0003 |
| Internal status not chosen by the user | `enum` in the element type, UPPER_SNAKE values | not in code | |
| Monetary amount | `Decimal(15, 2)` + `currency : Currency` + `@Measures.ISOCurrency: currency_code` | `Products.price` (historical `Decimal(10, 2)`) | |
| Calculated value | Calculated element `total : Decimal = price * quantity` in the schema; `virtual` + `after READ` only if the expression is impossible in SQL | not in code | |
| Parent-child relationship (document) | `Composition of many Items on items.parent = $self` in the parent, `parent : Association to Parent` in the children | not in code | |
| Reference to another entity | `Association to Target` in the singular | `Products.currency` | |
| Translatable data texts | `localized String(N)`, CSV `<Entity>.texts` | not in code | |

## Service and logic

| Task | Way | Example | Decision |
|---|---|---|---|
| Mandatory field | `@mandatory` in `srv/annotations/<Entity>.cds` | `srv/annotations/Products.cds` | ADR-0004 |
| Format or range check | `@assert.format`, `@assert.range` in `srv/annotations/<Entity>.cds`; a `before` handler only if it cannot be expressed with an annotation | `Products.stock @assert.range: [0, 1000000]` | ADR-0004 |
| Association target existence check | `@assert.target` | | |
| Read-only | `@readonly` on the projection in the service | | |
| Authorization | `@requires: 'authenticated-user'` on the service, `@restrict` on the entity; mock users in `package.json` → `cds.requires.auth.users` | `srv/catalog-service.cds` | |
| Action on a single record | Bound action in the projection: `actions { action reorder(amount: Integer) }`; handler `this.on('reorder', 'Products', ...)`; in the UI `DataFieldForAction` | not in code, template `templates/service.cds` | |
| Action on a set or without context | Unbound `action` in the service, only if a bound one is impossible | | |
| Business logic error | `req.reject(400, 'KEY', [args])`, key in `_i18n/messages.properties` | `templates/handler.js` | |
| Logging | `const LOG = cds.log('catalog')`; `LOG.info`, `LOG.warn`, `LOG.error` | `templates/handler.js` | |
| Shared function for several handlers | `srv/lib/<topic>.js`, named export, JSDoc, unit test; check `docs/registry/REUSE-CATALOG.md` before creating | | |
| Drafts | `@odata.draft.enabled` only on the root projection of the FE application that edits the data; never on the parent and the children of a composition at the same time | | |
| Side effect after write | `this.after('CREATE', 'Entity', ...)` or an `srv.emit` event; no manual transactions | | |

## UI Fiori Elements

| Task | Way | Example | Decision |
|---|---|---|---|
| New application | Fiori MCP `generate_fiori_app_cap`; never by hand | `app/products` | ADR-0007 |
| Table columns, filters, header, sections | `@UI.LineItem`, `@UI.SelectionFields`, `@UI.HeaderInfo`, `@UI.Facets` + `@UI.FieldGroup` in `app/<app>/annotations/<Entity>.cds` | `app/products/annotations/Products.cds` | ADR-0004 |
| Value selection from a code list | `@Common.ValueList` with `CollectionPath` to the CodeList, `@Common.Text` + `@Common.TextArrangement: #TextOnly` so that the UUID is not shown | `Products.currency_code` | |
| Action button | `DataFieldForAction` in LineItem or Identification on a bound action; controller extension only for purely client-side behavior | | |
| Manifest change (FCL, initialLoad, pages) | Fiori MCP `list_functionality` → `get_functionality_details` → `execute_functionality`; then `run_manifest_validation` | `app/products/webapp/manifest.json` | ADR-0007 |
| Custom section or column | `ext/fragment/<Name>.fragment.xml` + `controlConfiguration` via Fiori MCP | | |
| Client-side logic | `ext/controller/<Page>Ext.js` (without `.controller.`), registration via Fiori MCP | | |
| Value formatting | `model/formatter.js`, in XML via `core:require` | | |
| Texts | `webapp/i18n/i18n.properties` + `i18n_ru.properties`, keys `<page>.<element>.<property>` | `webapp/i18n/` | |

## UI freestyle UI5

| Task | Way | Example | Decision |
|---|---|---|---|
| New application | UI5 MCP `create_ui5_app` inside `app/`, JavaScript | | ADR-0005 |
| Any control | First `get_api_reference` of the UI5 MCP, then the `ui5-best-practices` skill | | |
| Table | Selection matrix from the `ui5-best-practices-tables` skill: `sap.m.Table` for ≤ 100 rows, `sap.ui.mdc.Table` for OData V4 with p13n | | |
| Accessibility | `ui5-best-practices-accessibility` checklist before review | | |

## Tests

| Task | Way | Example | Decision |
|---|---|---|---|
| Service test | `test/<service>.test.js`, `cds.test(import.meta.dirname + '/..')`, HTTP via `GET/POST`, assertions `expect(...).to...` | `test/catalog-service.test.js` | ADR-0002 |
| OData contract | `test/metadata.test.js` with an edmx snapshot | `test/metadata.test.js` | ADR-0002 |
| Formatter or extension | QUnit in `webapp/test/unit/` | | |
| User scenario | OPA5 journey in `webapp/test/integration/`, pages on `sap.fe.test.*` | | |
| End-to-end scenario | wdi5 against `cds watch`, a minimum of scenarios | | |

## Infrastructure

| Task | Way | Example | Decision |
|---|---|---|---|
| Run for development | `npm run watch` in the root, UI at http://localhost:4004/products/webapp/test/flpSandbox.html | | |
| UI without backend | `npm run start-mock` in `app/products`, mock from `localService` | `app/products/ui5-mock.yaml` | ADR-0008 |
| metadata.xml snapshot update | `cds compile srv --to edmx-v4 > app/products/webapp/localService/metadata.xml` after any model change | | |
| Dependency update | Only via `release-check` and Renovate, MCP versions are pinned | | ADR-0009 |
| Deployment | Not configured; `mta.yaml` is a draft. Any deployment work starts with an ADR | | |
