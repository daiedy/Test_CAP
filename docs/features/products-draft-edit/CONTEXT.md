# products-draft-edit: context

Date: 2026-09-07. Author: `architect`. Branch: `feature/products-draft-edit` (not created yet, `/spec` only).

## Request

Enable editing of Products on the Fiori Elements Object Page. The first pipeline run (`categories-code-list`, see `SUMMARY.md` and `VERIFICATION.md` in that folder) found that the Object Page of `CatalogService.Products` renders no Edit action in SAP Fiori elements for OData V4 because the entity is not draft-enabled; the OPA5 journey `app/products/webapp/test/integration/EditCategoryOnObjectPageJourney.js` is parked under `opaTest.skip` for that reason, and `docs/STATE.md` lists the item as open debt: "the decision about draft is a separate feature with an ADR". This feature takes that decision (draft on `CatalogService.Products` versus inline edit versus both), implements it, adapts the OData contract snapshot and the backend tests, un-skips the journey, and documents the consequences.

## Affected entities and services

Result of `mcp__cds-mcp__search_model` (`CatalogService.Products`), `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`, `UI-ARTIFACTS.md`, plus the compile and runtime experiment described below:

| Object | Exists now | What changes |
|---|---|---|
| `my.catalog.Products` (`db/schema.cds`) | `cuid, managed`, 7 business elements, associations `currency`, `category` | nothing; `db/` stays untouched (no annotations in `db/`) |
| `CatalogService.Products` (`srv/catalog-service.cds`) | `entity Products as projection on catalog.Products;`, CRUD, no draft, no actions | `@odata.draft.enabled` on the projection (recommended, ADR-0012). The compiler adds to the OData contract: key part `IsActiveEntity`, properties `HasActiveEntity`, `HasDraftEntity`, `DraftMessages`, contained navigation `DraftAdministrativeData`, navigation `SiblingEntity`, entity type `DraftAdministrativeData` (no entity set, `ContainsTarget="true"`), complex type `DRAFT_DraftAdministrativeData_DraftMessage`, bound actions `draftEdit`, `draftActivate`, `draftPrepare`, annotation `Common.DraftRoot` on `EntityContainer/Products`, `Common.SideEffects#alwaysFetchMessages`, `Common.Messages: DraftMessages`, `UI.Hidden` on the technical properties. At runtime a shadow entity `CatalogService.Products.drafts` is created in SQLite |
| `srv/annotations/Products.cds` | `@title`, `@mandatory`, `@assert.range`, `@assert.target`, `@Measures.ISOCurrency` | nothing. Verified: all assertions fire on `draftActivate` (HTTP 400) and on direct writes to active data; `@assert.range`/`@assert.target` violations on a draft PATCH are reported as `DraftMessages` with HTTP 200 |
| `CatalogService.Categories` | `@readonly` projection, `Capabilities.Insert/Update/DeleteRestrictions` | nothing. Verified: no `IsActiveEntity` on `Categories`, `POST /Categories` still 405, the generated `Common.ValueList` on `category_code` is unchanged |
| `srv/catalog-service.js` | does not exist (`HANDLERS.md`: all logic declarative) | still does not exist; no draft event handlers |
| `package.json` → `cds` | `"requires": {}` | nothing. cds 10.0.6 defaults apply: `fiori.lean_draft: true`, `bypass_draft: true`, `draft_new_action: false`, `draft_lock_timeout` 15 min, `draft_deletion_timeout` 30 d, `draft_messages: true` (`cds env get fiori`, `libx/_runtime/fiori/lean-draft.js`) |
| `app/products/annotations/Products.cds` | HeaderInfo, SelectionFields, LineItem, Facets, FieldGroups, `Common.Text`/`ValueListWithFixedValues` on `category` | nothing. Edit mode reuses the same FieldGroups; the category field becomes a single-select dropdown of names, as designed in `categories-code-list` |
| `app/products/webapp/manifest.json` | `ProductsList` (LR), `ProductsObjectPage` (OP, `editableHeaderContent: false`) | nothing for the recommended option. FE V4 shows Edit/Delete on the OP and Create/Delete plus the Editing Status filter on the LR automatically from `Common.DraftRoot`. `editableHeaderContent: false` stays (name and category are edited in the General Information section). Optional and only via Fiori MCP `execute_functionality`: `inlineEdit` (option C in ADR-0012), `settings > hideDraft` (rejected in ADR-0012, revisit later) |
| `app/products/webapp/localService/metadata.xml` | snapshot without draft artifacts | regenerated with `cds compile '*' --to edmx-v4 -s CatalogService -l en` |
| `app/products/webapp/localService/mockdata/Products.json` | 15 records without draft fields | unchanged. `@sap-ux/fe-mockserver-core` 1.7.15 (`dist/data/entitySets/entitySet.js`) defaults `IsActiveEntity: true`, `HasActiveEntity: true`, `HasDraftEntity: false` when the fields are missing, and `draftEntitySet.js` emulates `draftEdit`/`draftActivate`/discard |
| `test/catalog-service.test.js` | 13 tests; `POST /Products` without `IsActiveEntity`; `PATCH`/`DELETE` by `(ID)` | 4 tests change (explicit `IsActiveEntity: true`), 6 draft tests are added; see PLAN. Reason: with `bypass_draft: true` and `draft_new_action: false` a `POST /Products` without `IsActiveEntity` creates a draft (201, `IsActiveEntity: false`) and does not run `@mandatory`/`@assert.target`, so the three negative POST tests would go red |
| `test/metadata.test.js`, `test/__snapshots__/metadata.test.js.snap` | contract without draft | snapshot updated once (`npx vitest -u`) after the service change; the test code does not change |
| `app/products/webapp/test/integration/EditCategoryOnObjectPageJourney.js` | 5 tests under `opaTest.skip` | `opaTest` instead of `opaTest.skip`; a Cancel/discard test is added; page objects and `CategoryDropdown` are reused |
| `_i18n/*`, `app/products/webapp/i18n/*` | model labels en/ru | no new keys. `DraftAdministrativeData` labels (`Draft_*`) ship with `@sap/cds/_i18n` including `i18n_ru.properties`; Edit/Save/Cancel/Discard, Editing Status and draft indicator texts come from the `sap.fe` bundles |

Consumers of the OData contract: only `app/products` in this repository; the OPA5 journeys and `npm run start-mock` consume the `metadata.xml` snapshot.

## What already exists and is reused

From `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md`, `search_model` and the test sources:

- Draft choreography of the CAP Node.js runtime (lean draft): `.drafts` shadow entity, `draftEdit`/`draftActivate`/`draftPrepare`, draft lock (`DRAFT_ALREADY_EXISTS`, HTTP 409), garbage collection, `DraftAdministrativeData` and its translated labels. One annotation, no code.
- Declarative validations already in `srv/annotations/Products.cds`: they run on activation without any handler (verified).
- `sap.fe.templates.ObjectPage` edit mode and `sap.fe.templates.ListReport` draft UI: Edit, Save, Cancel with discard confirmation, Create, Delete, Editing Status filter, draft indicator. No controller extension, no custom button.
- The complete edit journey `EditCategoryOnObjectPageJourney.js` with page objects `pages/ProductsObjectPage.gen.js`, `pages/ProductsList.gen.js`, `pages/CategoryDropdown.js`, test data `data/CategoryTexts.js`, runner `pages/JourneyRunner.js`, and the `sap.fe.test` API (`onHeader().iExecuteEdit()`, `iSeeObjectPageInEditMode()`, `onFooter().iExecuteSave()`, `onFooter().iExecuteCancel()`, `iConfirmCancel()`).
- Test scaffolding in `test/catalog-service.test.js`: `newProduct` payload, `without()` helper, `defaults.auth`, the `rejectedWith(/400/)` + `containSubset({ code, target })` idiom from LESSONS.
- Mock mode as configured by ADR-0008: only `metadata.xml` is regenerated.

What would be a mistake to write anew: a `before`/`on` handler for `NEW`, `EDIT`, `PATCH`, `SAVE`, `DISCARD` (nothing to add: validations are declarative); a second projection of `Products` "for editing"; `Common.DraftRoot`, `Common.DraftNode`, `IsActiveEntity` or `DraftAdministrativeData` written by hand in `srv/` or `app/`; an own `Edit` button (`DataFieldForAction` or controller extension); i18n keys for the Draft labels or for Edit/Save/Cancel; `IsActiveEntity` fields in `mockdata/Products.json`; an `@odata.draft.enabled` on `Categories` (read-only code list, and PATTERNS forbids draft on more than the root); a `cds` configuration block just to make the old tests pass (see ADR-0012 alternatives).

## Applicable patterns

Rows from `docs/architecture/PATTERNS.md`:

| Step | Pattern | Status |
|---|---|---|
| Enable drafts | "Drafts": `@odata.draft.enabled` only on the root projection of the FE application that edits the data; never on parent and children at once | exists; `Products` is the only root, no compositions |
| Validations in edit mode | "Mandatory field", "Format or range check", "Association target existence check": annotations in `srv/annotations/<Entity>.cds` | exists, already applied; nothing to add |
| `Categories` stays read-only | "Read-only" | exists, unchanged |
| Contract change | "OData contract": `test/metadata.test.js` snapshot, deliberate `vitest -u`, CHANGELOG line | exists |
| Backend tests | "Service test" | exists; the convention for addressing active data of a draft-enabled entity is new: ADR-0012 |
| Mock snapshot | "metadata.xml snapshot update", "UI without backend" (ADR-0008) | exists |
| UI scenario | "User scenario": OPA5 journey on `sap.fe.test.*`, `npm run test:ui` while `npm run watch` runs | exists |
| Manifest change (only if the user picks inline edit or `hideDraft`) | "Manifest change (FCL, initialLoad, pages)": Fiori MCP `list_functionality` → `execute_functionality` (ADR-0007) | exists; not needed for the recommended option |
| Choice of editing approach (draft vs inline edit vs both), where the annotation lives, how non-Fiori clients and tests address active data, whether to hide the draft UI | no row | ADR needed: `docs/decisions/ADR-0012-products-draft-editing.md` (proposed) |

## Verified by experiment (scratchpad copy of `db/`, `srv/`, `_i18n/`, `app/products/annotations*`; the project was not changed)

Compile: `cds compile '*' --to edmx-v4 -s CatalogService -l en` with and without `annotate CatalogService.Products with @odata.draft.enabled;` (cds-dk 10.0.7, compiler 7.0.3). Diff, 131 added lines, nothing removed:

- `Products`: `<PropertyRef Name="IsActiveEntity"/>` added to the key; properties `IsActiveEntity` (default `true`), `HasActiveEntity`, `HasDraftEntity`, `DraftMessages : Collection(DRAFT_DraftAdministrativeData_DraftMessage)`; navigations `DraftAdministrativeData` (`ContainsTarget="true"`) and `SiblingEntity`; `NavigationPropertyBinding Path="SiblingEntity" Target="Products"`.
- New `EntityType DraftAdministrativeData` (key `DraftUUID`, 8 properties) with `Common.Label`s; no `EntitySet` for it (`GET /DraftAdministrativeData` answers 400).
- Bound actions `draftPrepare(SideEffectsQualifier)`, `draftActivate`, `draftEdit(PreserveChanges)` on `CatalogService.Products`.
- `Common.DraftRoot { ActivationAction: CatalogService.draftActivate, EditAction: CatalogService.draftEdit, PreparationAction: CatalogService.draftPrepare }` on `CatalogService.EntityContainer/Products`; `Common.SideEffects#alwaysFetchMessages` and `Common.Messages Path="DraftMessages"` on the entity; `Common.AddressViaNavigationPath` on the container; `UI.Hidden` on `IsActiveEntity`, `HasActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData`; `Core.Computed` on `DraftMessages`.
- `Categories`, `Categories_texts`, `Currencies`, the `Common.ValueList` on `category_code` and all `app/` annotations: byte-identical.

Runtime (`cds serve` of the scratchpad copy, cds 10.0.6, mocked users `alice`/`bob`):

| Request | Result | Consequence |
|---|---|---|
| `POST /Products {valid payload}` without `IsActiveEntity` | 201, `IsActiveEntity: false`, `HasActiveEntity: false` (a new draft, not an active record) | the existing test "creates a product ..." would pass by accident but leave a draft; `DELETE /Products(ID)` on it answers 403 `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` |
| `POST /Products` without `name`, or with `category_code: 'UNKNOWN'`, without `IsActiveEntity` | 201 draft; no `ASSERT_MANDATORY`/`ASSERT_TARGET` | the three negative POST tests go red unless the payload says `IsActiveEntity: true` |
| `POST /Products { IsActiveEntity: true, ...valid }` | 201, `IsActiveEntity: true`, active record; `$count` grows | the fix for the tests |
| `POST /Products { IsActiveEntity: true }` without `name` / with `UNKNOWN` category | 400 `ASSERT_MANDATORY` target `name` / 400 `ASSERT_TARGET` target `category_code` | negative tests keep their assertions |
| `PATCH /Products(<ID>) { stock: -1 }` on a seeded record (no draft) | 400 `ASSERT_RANGE` | "rejects negative stock" keeps passing; `IsActiveEntity` defaults to `true` in keys |
| `GET /Products?$count=true` while drafts exist | counts active records only (15) | "lists the 15 seeded products" keeps passing; drafts of new records are invisible to that query but visible to the FE list query `IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null` |
| `POST /Products(ID=<id>,IsActiveEntity=true)/CatalogService.draftEdit { PreserveChanges: true }` | 201, draft with `HasActiveEntity: true`; active shows `HasDraftEntity: true`, `DraftAdministrativeData.InProcessByUser: 'alice'` | draft cycle for the new tests |
| `PATCH /Products(ID=<id>,IsActiveEntity=false) { category_code: 'UNKNOWN' }` | 200 with `DraftMessages: [{ code: 'ASSERT_TARGET', ... }]` | validations on drafts are messages, not errors |
| `PATCH` draft `{ name: null }` | 200, no message | `@mandatory` is not checked on drafts |
| `POST .../CatalogService.draftActivate` with `UNKNOWN` category / `name: null` / `stock: -1` | 400 `ASSERT_TARGET` / `ASSERT_MANDATORY` (target `in/name`) / `ASSERT_RANGE` (target `in/stock`) | activation enforces every annotation; assert on `code`, match `target` with a suffix |
| `draftActivate` with valid data | 200, `IsActiveEntity: true`, `modifiedBy: 'alice'`, `HasDraftEntity: false`, new value persisted | |
| `bob`: `draftEdit` or `PATCH` active while `alice` holds the draft | 409 `DRAFT_ALREADY_EXISTS` | draft lock test |
| `alice`: `PATCH` active while her own draft exists | 409 `DRAFT_ALREADY_EXISTS` | bypass-draft writes are blocked by any lock |
| `DELETE /Products(ID=<id>,IsActiveEntity=false)` | 204 (discard) | cleanup in tests |
| `DELETE /Products(<id>)` on an active without draft | 204 | |
| `POST /Categories` | 405 | `@readonly` unaffected |
| `CDS_FIORI_DRAFT_NEW_ACTION=true cds serve` | no `draftNew` action in `$metadata`, POST still created a draft | the environment override did not reach the compiler; the alternative would need `package.json` configuration and was not verified |

## Relevant lessons

From `docs/LESSONS.md`:

- Retro item 8 (2026-09-07): "Object Page without draft has no edit mode ... `architect` checks `@odata.draft.enabled` before the plan and puts it into 'Decisions for the user'". This feature is that decision.
- "The metadata.xml snapshot must be built from the whole model" and "`cds.load('*')` in the contract test": the draft annotation goes into `srv/catalog-service.cds`, so both `cds compile srv` and `cds compile '*'` show it; a placement in `app/` would be invisible to `cds compile srv` and to the registry generator.
- "`cds.test` (fetch) errors carry `code` and `target`": the new negative tests bind to `ASSERT_MANDATORY`, `ASSERT_TARGET`, `ASSERT_RANGE`, `DRAFT_ALREADY_EXISTS`, not to a bare status.
- "Teardown of an OPA journey must be a separate last `opaTest`" and "journeys against the live stack change in-memory data": the edit journey restores the original category; a failed run can leave a draft that changes the row count of the List Report, so `npm run watch` is restarted before a re-run.
- "`$filter` of the FE V4 filter bar is only visible inside `$batch`": `ui-verifier` looks for `draftEdit`, `PATCH ...IsActiveEntity=false` and `draftActivate` inside `$batch`, not as separate requests.
- "`run_manifest_validation` UI5 MCP 0.2.18 fails": relevant only if the user picks inline edit or `hideDraft` (manifest change); then `ui5lint` is the check.
- "Fixed-values dropdown in FE V4 is a typeahead table": the `CategoryDropdown` page object already handles the form field in edit mode (`iOpenValueHelp`, `iSelectItem`).
- "`npm start` (:8080) does not start the app from the FLP sandbox": journeys and verification run against `npm run watch` on :4004.

## Screens (if there is a UI)

To be filled in by `ux-designer` (step 2 of the PLAN). Inputs from `architect`:

- Existing floorplans only: List Report `ProductsList` and Object Page `ProductsObjectPage` on `/Products`. No new page, fragment or controller extension. With the recommended option no `manifest.json` change at all.
- What FE V4 adds by itself once `Common.DraftRoot` is present (to be described and turned into verifier scenarios): Object Page header actions Edit and Delete; footer Save and Cancel in edit mode, Cancel opens the discard confirmation when the draft has changes; "Draft saved" indication; List Report toolbar Create and Delete; Editing Status filter in the filter bar (options All, Own Draft, Locked by Another User, Unsaved Changes by Another User, Unchanged, All (Hiding Drafts)); draft indicator in the title column of the table for rows with a draft; "Saved Version / Draft" toggle on the Object Page when a draft exists.
- Field behavior in edit mode: `name`, `description`, `imageUrl` inputs; `category_code` single-select dropdown of localized names (mandatory marker); `price` with `currency_code` value help dialog (Currencies); `stock` numeric; Administrative Data read-only (`managed`, `Core.Computed`). Header (`name`, `category_code` description, image) stays display-only because `editableHeaderContent: false`; the designer decides whether to keep it (recommendation: keep, both fields are in General Information).
- Error presentation: `@mandatory` and `@assert.range` are client-side checks in FE (required, `Validation.Minimum/Maximum`), `@assert.target` is unreachable with the dropdown; server errors on Save (400) appear in the message popover and highlight the field; `DraftMessages` from `Common.Messages` are fetched with `alwaysFetchMessages`.
- Locales: `en` and `ru`; all new texts come from `sap.fe` and `@sap/cds` bundles, no new i18n keys expected. Confirm in `ru` that Edit/Save/Cancel, the discard popover, the Editing Status filter and its options are translated.
- Open design questions for the designer: keep `editableHeaderContent: false`; leave the standard draft UI (no `hideDraft`); is the Create flow (empty draft opened in the Object Page) acceptable as-is for a product catalog, or should it be verified only and left out of the automated journeys (architect's recommendation: verify manually, no Create journey in this feature); accessibility checklist for edit mode (labels, required, keyboard: Edit, Tab to Category, arrows, Enter, Save; focus after Save/Cancel).

## Open questions

Listed as "Decisions for the user" in `PLAN.md`; the plan is written for the recommended answers (full draft on `CatalogService.Products`, explicit `IsActiveEntity: true` in tests, standard draft UI, no manifest change, Create flow verified manually only).
