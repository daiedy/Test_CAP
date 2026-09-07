# Code and file conventions

The single source of rules about how files in this repository look. Path rules in `.claude/rules/` refer here and must not contradict this document. A deviation is allowed only through a new ADR in `docs/decisions/`.

## 1. Languages

| What | Language |
|---|---|
| Identifiers in CDS, JS, XML, i18n keys | English |
| Comments in code, commit messages | English |
| Documentation in `docs/`, CLAUDE.md, rules, skills and agents | English |
| Texts for the user | only through i18n: `en` by default, `ru` translation |

## 2. Repository structure

```
db/schema.cds                     domain model, namespace my.catalog
db/common.cds                     shared project types and aspects (created when first needed)
db/data/<namespace>-<Entity>.csv  test data, generated with `cds add data --records N`
srv/<name>-service.cds            service: projections, actions, functions, @requires/@restrict
srv/<name>-service.js             handlers of the same service, class extends cds.ApplicationService
srv/annotations/<Entity>.cds      semantic annotations of the entity: @title, @mandatory, @assert.*, @readonly
srv/lib/<topic>.js                reusable logic without dependency on req/res
_i18n/i18n.properties             backend texts (labels), _i18n/i18n_ru.properties translation
_i18n/messages.properties         req.reject error messages, _i18n/messages_ru.properties
app/<app>/annotations.cds         entry point of the application UI annotations, only `using from`
app/<app>/annotations/<Entity>.cds  UI annotations: @UI.*, @Common.ValueList, @Common.Text
app/<app>/webapp/manifest.json    only through Fiori MCP or Fiori tools
app/<app>/webapp/ext/controller/<Page>Ext.js   FE controller extensions, no .controller. in the name
app/<app>/webapp/ext/fragment/<Name>.fragment.xml
app/<app>/webapp/model/formatter.js
app/<app>/webapp/i18n/i18n.properties, i18n_ru.properties
app/<app>/webapp/test/            testsuite.qunit.*, unit/, integration/ (OPA5)
app/<app>/webapp/localService/    metadata.xml (snapshot), mockdata/<EntitySet>.json (array)
test/<service>.test.js            backend tests on @cap-js/cds-test and Vitest
test/__snapshots__/               $metadata snapshots
templates/                        reference files of every type
scripts/                          pipeline scripts (ESM, Node 22)
docs/                             documentation, see ARCHITECTURE.md
```

Annotation split rule: everything that describes the meaning of data and validation (labels, mandatory, assert, readonly, restrict) lives in `srv/annotations/`. Everything that describes presentation (LineItem, Facets, FieldGroups, HeaderInfo, SelectionFields, ValueList, Text) lives in `app/<app>/annotations/`. Service files and `db/schema.cds` contain no UI annotations.

## 3. CDS

- Indent 2 spaces, one element per line, annotations aligned by `@`.
- `namespace my.catalog;` in `db/schema.cds`. New domain modules get a sub-namespace `my.catalog.<module>` in a separate file `db/<module>.cds`.
- Entities: PascalCase, plural (`Products`, `Categories`). Types and aspects: PascalCase singular. Elements: camelCase.
- Key: `cuid` (`key ID : UUID`). Composite keys only for text and code tables.
- Audit: the `managed` aspect. Time intervals: `temporal`.
- Associations: `Association to Target` with a singular name (`category`), the foreign key is automatically `category_ID`. Compositions: `Composition of many Items` with a plural name.
- User-facing code lists: an entity based on `sap.common.CodeList` with key `code`, not `enum`. `enum` only for internal statuses the user does not edit.
- Money: `Decimal(15, 2)` plus `currency : Currency` and `@Measures.ISOCurrency: currency_code` in the annotations. The existing `price : Decimal(10, 2)` stays until a separate ADR.
- Strings always with a length: `String(100)`. Localizable texts: `localized String(255)`.
- Every element has `@title: '{i18n>Entity.element}'` in `srv/annotations/<Entity>.cds`, not in the schema.
- Service: `service CatalogService @(path: '/catalog')` is not set, the default path is `/odata/v4/<service>`. One projection per entity; expose only the needed fields via `excluding` or an explicit list.
- No `cds add sample`. Data only via `cds add data --records <N>` followed by editing the values.

## 4. Backend JavaScript

- ESM (`"type": "module"` in package.json). Import: `import cds from '@sap/cds'`.
- Handlers in a class: `export default class CatalogService extends cds.ApplicationService { async init() { ...; return super.init() } }`.
- Order in `init()`: `before` validations, then `on` actions, then `after` side effects. One handler per event and entity.
- Errors: `req.reject(400, 'PRODUCT_STOCK_NEGATIVE', [args])`. The message key is in `_i18n/messages.properties`. No strings in code.
- Logging: `const LOG = cds.log('catalog')` at module level. `console.*` is forbidden.
- Database queries through `cds.ql` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), no raw SQL and no manual transactions.
- Shared code in `srv/lib/<topic>.js` with named exports and JSDoc on every exported function.
- Formatting: Prettier, config `.prettierrc` in the root. Style: 2 spaces, single quotes, semicolons, width 100.

## 5. UI

- Fiori Elements V4 by default. Freestyle UI5 only when a screen cannot be expressed with floorplans; the decision is recorded in the feature specification.
- A new application is created only through Fiori MCP `generate_fiori_app_cap`. `manifest.json` edits only through `list_functionality` → `execute_functionality`; a manual edit is allowed only when no suitable function exists, and `run_manifest_validation` is mandatory afterwards.
- JavaScript, not TypeScript (ADR-0005). Revisit with the first freestyle UI5 application.
- XML views only. Modules via `sap.ui.define`, no global access (`sap.ui.getCore()`, `jQuery.sap.*` are forbidden). Asynchronous loading.
- FE controller extension: file `ext/controller/<Page>Ext.js`, without the `.controller.` infix, otherwise the module does not load.
- Formatters in `model/formatter.js`, wired in XML via `core:require`.
- All texts through `i18n`. Keys: `<page>.<element>.<property>` for the UI, `<Entity>.<element>` for model labels.
- `ui5lint` without errors for every changed file. Known debt (CSP inline scripts in the test html files) is recorded in `docs/STATE.md`.
- UI5 version in manifest `minUI5Version` 1.136.0; the CDN uses the current version without pinning (ADR-0006).

## 6. Tests

- Backend: `test/<service>.test.js`, Vitest, `const { GET, POST, expect, defaults } = cds.test(import.meta.dirname + '/..')` as the first line after the cds import. One `describe` per entity or action. Test data from `db/data`.
- Contract snapshot: `test/metadata.test.js` compares `cds compile '*' --to edmx-v4 -s CatalogService -l en` with the snapshot. Changed deliberately via `vitest -u` with a CHANGELOG entry.
- UI: QUnit for formatters and extensions in `webapp/test/unit/`, OPA5 journeys in `webapp/test/integration/`, Test Starter is mandatory.
- The test name describes behavior: `rejects negative stock`, not `test1`.

## 7. Git

- Branch `feature/<kebab-name>`, one feature. Commits in conventional commits style: `feat(srv): add Categories code list`. Scopes: `db`, `srv`, `app`, `test`, `docs`, `pipeline`, `deps`.
- One commit per phase of the feature workflow. No `git add -A` over the project; only the files of the phase. Exception: `.claude/agent-memory/**` (shared agent memory, versioned on purpose) is committed together with the phase in which the agent wrote it.
- Not committed: `node_modules/`, `gen/`, `dist/`, `*.sqlite*`, `.claude/settings.local.json`, `.env`.

## 8. Documentation

- Every code change is accompanied by: an updated registry (`npm run docs:registry`), an entry in `docs/CHANGELOG.md`, an up-to-date `docs/STATE.md`.
- A new pattern or a deviation from an existing one: an ADR by the template `docs/decisions/ADR-0000-template.md`.
- A lesson learned (an agent mistake or non-obvious framework behavior): an entry in `docs/LESSONS.md` with a date and a link to the source.
