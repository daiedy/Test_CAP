# products-draft-edit: context

Date: 2026-09-07. Author: `architect`. Branch: `feature/products-draft-edit`.

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

Author: `ux-designer`, 2026-09-07. The architect's inputs (existing floorplans only, the FE V4 draft UI that appears with `Common.DraftRoot`, the edit-mode field list, error presentation, `en`/`ru` without new keys, the four open design questions) have been taken into account; the user's decisions of 2026-09-07 (full draft, standard draft UI, `editableHeaderContent: false`, Create verified manually only) are the frame. Deviations from PLAN are listed at the end of the section.

Floorplan: the existing List Report `ProductsList` and Object Page `ProductsObjectPage` on `/Products` (`docs/registry/UI-ARTIFACTS.md`). No new page, fragment, controller extension or `manifest.json` edit. One user task: change an existing product on its Object Page and either save or discard the change. The Create and Delete actions and the Editing Status filter come with the draft contract as documented FE behavior; they are described here so that `ui-verifier` knows what "correct" looks like, but they are not a second user task of this feature (Create gets its own journey later, see "Design decisions"). Freestyle UI5 is not needed: everything is produced by the service contract.

### Guidelines the design relies on

From `mcp__fiori-mcp__search_docs` (snapshot of the SAPUI5 / SAP Fiori elements documentation; full topic URL `https://ui5.sap.com/#/topic/<id>`, ids truncated to 7 characters in the snapshot). Three queries (draft indicator placement without a semantic key, draft lock dialogs, keyboard shortcuts) returned "embeddings service failed to initialize" in this session; statements that depend on them are marked "not verified" below and are confirmed by `ui-verifier`, not assumed.

| Source | What it says | Where applied |
|---|---|---|
| "Draft Handling" (topic `ed9aa41`) | a draft is created automatically when the user starts Create or Edit; Save persists the draft to the active entity; without `DiscardAction` the framework discards with the OData Delete of the draft; `PreparationAction` runs backend validation on Enter; technical input errors block Save; `sap.fe.app.hideDraft` hides filters, the Apply button and the "Draft saved" footer message while drafts keep working; design guidance https://experience.sap.com/fiori-design-web/draft-handling/ | whole section; the `hideDraft` decision |
| "Prerequisites for Using SAP Fiori Elements (OData V4)" and the FE FAQ | "edit scenarios require a draft-enabled service"; the location of messages (footer popover vs dialog) depends on message type, state, template and page mode | rationale (ADR-0012); message presentation |
| "Fiori Elements — Editing Status (List Report / Draft Administrative Data)" | a static "Editing Status" filter is added to the filter bar of every draft-enabled List Report; default and reset value "All"; values All, Own Draft, Locked by Another User, Unsaved Changes by Another User, Unchanged; in a responsive table the status is shown in the key column; for Own Draft / Locked / Unsaved the line item shows the user, with a link to a popover with full name and time; fallbacks technical user name, then "another user"; the popover must be keyboard reachable | Screen 1, filter and indicator |
| "Toggling Between Draft and Saved Values" (topic `fd3950a`) | the filter also offers "All (Hiding Drafts)": only saved objects are listed, a saved object with a draft shows "Return to Draft"; on the Object Page a "Saved Version / Draft" toggle with a popover is shown when a draft exists | Screen 1 and 2 |
| "Configuring Display of Editing Status in List Report Tables" | responsive table: status in the column of the first `Common.SemanticKey`; the fallback to the HeaderInfo Title column is documented for OData V2 only | the "draft indicator placement" note (`Products` has no semantic key) |
| "Disabling the Editing Status Filter" (topic `8eb695a`) | the filter can be removed with `Capabilities.NavigationRestrictions` on `DraftAdministrativeData`; consequence: users can no longer find drafts | rejected, see "Design decisions" |
| "Toggling the Editability of Header Fields" | OData V4 default is an editable header; `editableHeaderContent: false` disables it; fields keep their own read-only rules either way | decision 1 |
| "Configure Confirmation Popups" (topic `9a53662`) | draft discard confirmations; 412 handling needs `Prefer: handling=strict` messages from the backend (not used here); i18n keys `ST_KEEP_DRAFT_MESSAGE_EDIT` etc. are FE-owned | Screen 2, Cancel |
| "Handling Inconsistent Input" | parse and format errors (letters in a number, overflow) are collected by the message manager and block Save until corrected; business errors come back from the server as state messages | validation table |
| "Enable 'Create Object' Dialog in List Report (OData V4)" and "Create Mode Options" | `creationMode: CreationDialog` needs a manifest change; drafts are not maintained for dialog-created objects; the create page is the default when navigation exists | decision 4 |
| `get_guidelines` UI5 MCP | only standard controls, data binding and i18n; no inline scripts, no custom CSS | theme and style |
| Skill `ui5-best-practices-accessibility` (labeling, keyboard, invisible-message, reading-order) | labels, focus, F6 groups, announcements | accessibility checklist |

### Design decisions (answers to the open questions of step 2)

1. **Keep `editableHeaderContent: false`: yes.** `name` and `category_code` are already the first and third fields of "General Information"; an editable header would show a second input for the title and a second dropdown for the category on the same screen, and the page object assertion `iCheckTitle` in the journey reads the display header. The image is a URL, not an upload, so nothing is gained for `imageUrl` either. No manifest change.
2. **`hideDraft`: no.** The Editing Status filter and the row indicator are the only visible cue that a draft exists; hiding them would hide exactly the state that breaks `iCheckRows(15)` and confuses a user who sees draft data in a row without knowing why. The "Draft saved" footer text is also the only feedback that a field change reached the server. Revisit only if end users report the filter as noise; then via Fiori MCP `settings > hideDraft`, not by hand.
3. **Inline edit: follow-up only (option C of ADR-0012), not in this feature.** Candidates for a later evaluation on the running app: `stock` and `price` in the List Report table for quick corrections. The documentation lists restrictions (no inline edit while a draft exists, no FCL) that need explanation to the user, and the manifest change needs `execute_functionality`; that is a separate plan.
4. **Create flow: acceptable as-is (New Page), verified manually, no journey in this feature.** A product has seven business fields in two sections; the empty Object Page in create mode reuses the same form the user already knows from Edit, mandatory markers included. A creation dialog would need a manifest change, does not keep a draft, and would duplicate the form for eight fields. The Create journey is a follow-up (listed in ADR-0012 consequences).
5. **Editing Status filter: kept.** Not disabled via `NavigationRestrictions` (guideline above); it stays as the fourth filter, within the "no more than 5" rule.
6. **No `Common.SemanticKey` in this feature.** `Products` has no business key besides the UUID; `name` is not unique. The draft indicator is expected in the "Product Name" column via the HeaderInfo Title fallback (not verified, see Screen 1). If `ui-verifier` finds no indicator in any column, that is a question for the architect (a semantic key would be a UI annotation change outside this plan), not a reason for the verifier to change annotations. Verified outcome 2026-09-07 (`ui-verifier`, `VERIFICATION.md` scenarios 4 and 6): confirmed, no draft or lock marker text renders in the List Report row without a `Common.SemanticKey`, in either the own-draft or the locked-by-another-user case; the Object Page compensates for the lock case (header "Locked" button and popover) but there is no List Report row indicator today. Escalated to `docs/STATE.md` "Open debt" as a follow-up decision for the user, not fixed in this feature.

### Screen 1. List Report "Products" (`ProductsList`)

Title and subtitle unchanged: `UI.HeaderInfo.TypeNamePlural` "Products" in the table title, `appTitle` as the page title.

Filters, in filter bar order (4 of the allowed 5): **Editing Status** (static, added by FE, always first), `name`, `category_code`, `price`. The three model filters behave exactly as designed in `categories-code-list`.

| Property of the "Editing Status" filter | Behavior |
|---|---|
| Label | "Editing Status" from the `sap.fe` bundle; not a model label, no i18n key of ours |
| Control | single-select dropdown (FE `FilterField` with fixed values), no conditions tab, no value help dialog |
| Options | All (default), Own Draft, Locked by Another User, Unsaved Changes by Another User, Unchanged, All (Hiding Drafts) (the last one from the "Toggling" guideline) |
| Semantics | All: active records without draft plus own drafts (the FE list query `IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`, seen in the CONTEXT experiment); Own Draft: only my drafts; Locked by Another User: active records whose draft belongs to someone else and whose lock (15 min, cds default) is still valid; Unsaved Changes by Another User: same, lock expired; Unchanged: active records without any draft; All (Hiding Drafts): every active record with its saved data, drafts hidden. The exact `$filter` strings are FE-owned and not verified; `ui-verifier` reads them from the `$batch` body |
| Empty value | cannot be empty: clearing the field resets it to "All" (guideline) |
| Default value | "All"; we set no `Common.FilterDefaultValue`, none exists for a static filter |
| "Adapt Filters" | the field is listed under "Editing Status"; hiding it is a user choice we do not prevent |
| Interaction with the Go button | as for the other filters (`liveMode` debt in STATE is unchanged) |

Table (`UI.LineItem`, unchanged, 4 of the allowed 7): `name`, `category_code` shown as the category name, `price` with currency, `stock`. No new column. What changes per row:

| Row state | What the user sees |
|---|---|
| Active record without draft | as today |
| Own draft (Edit started, not saved) | the row shows the **draft data** (for example the new category), and a "Draft" marker below the product name in the "Product Name" cell. Expected placement (not verified): FE V4 renders the draft indicator in the column of the first semantic key, and when there is none in the column bound to the HeaderInfo Title (`name`). Pressing the row opens the draft on the Object Page in edit mode |
| Locked by another user | the row shows the **saved data** plus "Locked by <user>" (technical user name from `DraftAdministrativeData/InProcessByUser`, since the sandbox has no user master data); the user name is a link that opens a popover with the user and the lock time. Pressing the row opens the saved version in display mode |
| Unsaved changes by another user (lock expired) | same, with "Unsaved changes by <user>"; pressing Edit on the Object Page offers to take over (see Screen 2) |
| Own draft of a **new** record (Create, not saved, navigated back) | a row with an empty "Product Name" cell carrying only the "Draft" marker, empty category, empty price and stock. It is counted in the table: the title reads "Products (16)" and `iCheckRows(15)` fails; to a user it looks like a broken product. This is why every manual Create test ends with Cancel (discard) or Delete, and why `test-ui` and `ui-verifier` start from a fresh `npm run watch` (in-memory database, PLAN "Data hygiene") |

Actions in the table toolbar (right side, standard order): **Create** (new; opens the Object Page in create mode, see Screen 2a), **Delete** (as before; enabled when rows are selected, confirmation dialog, deletes the selected active records or discards selected own drafts), table settings. No row actions, no `DataFieldForAction` of ours. Row navigation to the Object Page as today; the target differs by row state as in the table above.

Empty states and errors:

- "Own Draft" selected while no draft exists (the normal state after a clean start): the standard FE table message "No data found. Try adjusting the filter settings" (FE text, no key of ours); the table title reads "Products (0)". `ui-verifier` records this as the expected empty state, not as a defect.
- "Locked by Another User" / "Unsaved Changes by Another User": empty unless the lock scenario below is staged; same message.
- Delete of an active record whose draft belongs to another user: the server answers 403 `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` (CONTEXT runtime table); FE shows the message in a dialog and the row stays. Rare in this project, listed for completeness.
- Backend unavailable: the standard request error dialog; no text of ours.

### Screen 2. Object Page "Product" (`ProductsObjectPage`)

Header (`UI.HeaderInfo`, unchanged): Title `name`, Description = category name (`TextOnly`), image from `imageUrl`. Header content is never editable (decision 1).

Header actions in display mode: **Edit** (new, primary), **Delete** (as before), Share (as before). When a draft exists next to the saved version FE additionally shows the "Saved Version / Draft" toggle described in the "Toggling" guideline; it is FE-owned behavior, we neither configure nor test it beyond a screenshot if it appears.

Sections (`UI.Facets`, unchanged): "General Information", "Pricing & Stock", "Administrative Data". Edit mode reuses the same FieldGroups; there is no separate edit layout.

| Field (section) | Display mode | Edit mode | Required marker | Validation layer |
|---|---|---|---|---|
| Product Name (General) | text | single-line input, max 100 | yes (`@mandatory`) | empty: FE required check on Save plus server `ASSERT_MANDATORY` on activation |
| Description (General) | text | single-line input, max 500 | no | none |
| Category (General) | name | single-select dropdown of the six localized names, as designed in `categories-code-list` | yes | empty: as for name; an unknown value cannot be typed (fixed list), so `@assert.target` stays a server-side safety net |
| Image URL (General) | text (the image itself is only in the header) | single-line input, max 500 | no | none; no URL format check exists in the model and none is added |
| Price (Pricing & Stock) | amount with currency | decimal input; `Validation.Minimum 0` / `Maximum 99999999.99` from `@assert.range` are type constraints of the OData V4 model, so a negative or too large value is expected to fail client-side with the framework's range text (not verified; the verifier records whether the error appears before or after Save) | yes | as above; server `ASSERT_RANGE` on activation as fallback |
| Currency (Pricing & Stock) | code | input with type-ahead and value help dialog on `Currencies` (as today's generated ValueList) | yes | empty: required check; unknown code: dialog validation |
| Stock Quantity (Pricing & Stock) | integer | integer input; the `Int32` type has no range constraint, so `-1` is accepted by the client, the draft PATCH answers 200 with a `DraftMessages` entry `ASSERT_RANGE` (CONTEXT runtime table) that FE fetches through `Common.SideEffects#alwaysFetchMessages` and shows immediately as an error on the field and in the message popover; Save is then rejected with 400 `ASSERT_RANGE` | yes | server, on PATCH (message) and on activation (error) |
| Created At / Created By / Changed At / Changed By (Administrative Data) | values | read-only (`Core.Computed`), rendered as text, not as disabled inputs | no | none. In the sandbox `cds watch` serves anonymous users, so after a UI save "Changed By" reads `anonymous`; expected, not a defect |

Footer in edit mode (FE standard `OverflowToolbar`, appears only in edit mode): left side the **message button** (icon with the message count; present only while messages exist) and the **draft indicator** text ("Saving draft..." then "Draft saved", `sap.m.DraftIndicator`, shown for a moment after every field change); right side **Save** (emphasized) and **Cancel**. Nothing is added or reordered.

Behavior:

| Step | What happens | Network (inside `$batch`) |
|---|---|---|
| Edit | the page switches to edit mode; header actions disappear, the footer appears; the fields of the table above become inputs; focus is expected on the first editable field (Product Name; not verified, FE behavior) | `POST Products(ID=...,IsActiveEntity=true)/CatalogService.draftEdit { PreserveChanges: true }` → 201 |
| Change a field and leave it | the value is sent immediately; the footer shows "Draft saved"; the header title and description follow the draft (`name`, category) because they are bound to the same context | `PATCH Products(ID=...,IsActiveEntity=false)` → 200, with `DraftMessages` when a range or target rule is violated |
| Save | all client-side checks first (required fields, technical parse errors): if any fail, the fields get the error state, the message popover opens and no request is sent; otherwise activation; on success the page returns to display mode on the same product, the header shows the new values, no toast of ours (FE shows none for Save) | `POST Products(ID=...,IsActiveEntity=false)/CatalogService.draftActivate` → 200; on a server rule 400 with `code` `ASSERT_*`, target `in/<field>` mapped by FE to the field |
| Cancel with a persisted change | a popover anchored to the Cancel button asks to discard; its primary button discards the draft and returns to display mode with the saved values (header included); Esc or a click outside keeps the draft and the edit mode | `DELETE Products(ID=...,IsActiveEntity=false)` → 204 |
| Cancel without any change | returns to display mode directly; FE skips the confirmation when the draft has no changes (PLAN risk for the journey's `iConfirmCancel`; the test-ui note applies: make sure the PATCH was sent before Cancel) | same DELETE |
| Back navigation (shell Back, browser Back) while in edit mode | corrected 2026-09-07 (verified by `ui-verifier`): a persisted draft change triggers an FE V4 1.152 "Warning" dialog with Save / Keep Draft / Discard Draft, not a silent keep; choosing Keep Draft returns to the List Report with the draft intact (FE draft principle: leaving does not lose data, but the user is asked first) | the dialog itself is client-side; "Keep Draft" causes none beyond the list refresh, "Save" and "Discard Draft" trigger the corresponding requests |
| Reload of the page in edit mode | the URL points to the draft key (`IsActiveEntity=false`); the page reopens in edit mode with the draft | `GET` of the draft |
| Delete (display mode) | confirmation dialog (FE text); on confirm the record is deleted and the app navigates back to the List Report | `DELETE Products(ID=...,IsActiveEntity=true)` → 204 |

Messages and the message popover: FE V4 collects three kinds of messages. (1) Technical input errors (letters in Stock, overflow): value state Error on the field immediately, listed in the popover, Save blocked client-side. (2) State messages from the draft (`DraftMessages`, `Common.Messages`): appear after the PATCH that caused them, bound to the field (error state and text under the field) and listed in the popover grouped by section; they disappear when the value is corrected. (3) Errors of Save (400 on `draftActivate`): shown the same way, the popover opens automatically; a message without a field target is listed under the page's general group. Transient errors of actions (for example the 409 of a lock, or a 5xx) are shown in a message dialog, not in the popover (FE FAQ, message location rule). All texts are FE or CAP texts; the CAP `ASSERT_*` messages exist in `en` and `ru` in `@sap/cds/_i18n/messages*.properties` (checked: `ASSERT_MANDATORY`, `ASSERT_RANGE`, `ASSERT_TARGET` translated). Known bundle gap: `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are English in `messages_ru.properties` (framework file); if they ever surface in `ru`, that is a CAP limitation to record, not something to patch in the project.

Draft lock (another user holds the draft, not verified by MCP in this session, confirmed by the verifier scenario below): the Object Page of the saved version shows the lock indicator ("Locked by <user>") in the header area or the Edit action is not offered; if Edit is pressed while the lock is valid, FE shows a message dialog that the object is locked by that user and stays in display mode; the server would answer 409 `DRAFT_ALREADY_EXISTS` to a forced `draftEdit` (CONTEXT runtime table). After the lock timeout (15 min) FE offers a confirmation to take over the unsaved changes (`draftEdit` with `PreserveChanges: false`, which discards the other user's draft). Either presentation (hidden Edit or a lock dialog) is acceptable; an unexplained 409 in the console with no user-visible message is a finding.

### Screen 2a. Object Page in create mode (Create flow, manual verification only)

1. Create in the List Report toolbar creates an empty draft and opens the Object Page in edit mode. Header: the framework's placeholder title for a new object (FE text; a name typed into Product Name replaces it after the PATCH), no description, the placeholder image. All three sections are shown; Administrative Data is empty (nothing is computed before activation).
2. Required markers on Product Name, Category, Price, Currency, Stock Quantity (the five `@mandatory` elements from `search_model`); Description and Image URL optional. No defaults: `currency_code` and `category_code` start empty, there is no `default` in the model and none is proposed (a default currency would be a model decision for the architect, not a UI one).
3. Footer: the primary button reads **Create** instead of Save (FE create mode), plus Cancel.
4. Create with an empty Category (or any required field): blocked client-side; the field is marked and the popover lists it (PLAN criterion). Create with everything filled: activation, the page switches to display mode of the new active product, the URL changes to `IsActiveEntity=true`; the List Report then shows 16 rows until the product is deleted (verifier cleanup: Delete on the Object Page).
5. Cancel on a new draft: discards it (`DELETE ...IsActiveEntity=false`) and navigates back to the List Report with 15 rows. Whether the discard popover is shown for an untouched new draft is FE logic (not verified); both variants are acceptable, the outcome (no 16th row) is what counts.

Network: `POST Products {}` → 201 with `IsActiveEntity: false`, `HasActiveEntity: false` (CONTEXT runtime table, first row), then PATCHes, then `draftActivate` or `DELETE`.

### What the user sees instead of technical keys

| Technical element | Where it could show | What is shown | Provided by |
|---|---|---|---|
| `ID` (UUID) | nowhere in the UI; only in the URL `Products(ID=...,IsActiveEntity=...)` | the product name as title, the category as description | `UI.HeaderInfo` (unchanged) |
| `IsActiveEntity`, `HasActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData` | table settings, filters, forms | hidden (`UI.Hidden`, added by the compiler); the user sees the Editing Status filter and the row marker instead | contract |
| `DraftUUID`, `InProcessByUser`, `LastChangedByUser`, timestamps | the "Locked by" popover | user name and time as formatted by FE; labels from the `Draft_*` keys of `@sap/cds/_i18n` (`en` and `ru` present, checked) | CAP + FE |
| `SiblingEntity`, `DraftMessages` | never rendered as such | draft toggle and messages | FE |
| `createdBy`, `modifiedBy` | Administrative Data | the user id text (`anonymous` in the sandbox, `alice` in tests) | `managed` labels from `@sap/cds/_i18n` |
| `category_code`, `currency_code` | form, header, table | category name (`TextOnly`); currency code with the code list dialog, as today | `categories-code-list` design |

Criticality and statuses: none of ours. The draft marker, the "Locked by" text and the value states use the standard FE/UI5 semantics of `sap_horizon`; no `UI.Criticality`, no custom colors or icons.

### Locales and texts

No new i18n keys, confirmed. Every text this feature makes visible has an owner already:

| Text | Owner | `ru` |
|---|---|---|
| Edit, Delete, Save, Create, Cancel, the discard popover, the message button, "New" placeholder title, message popover groups | `sap.fe.core` / `sap.fe.templates` / `sap.fe.macros` bundles, loaded from the CDN with `sap-ui-language` | shipped by SAP; confirmed by `ui-verifier` on screen (`?sap-ui-language=ru`), not from a local file (the UI5 bundles are not in the repository) |
| "Editing Status" label and its six options, "Draft", "Locked by", "Unsaved changes by", the popover with user and time, "No data found" | same | same |
| "Saving draft..." / "Draft saved" | `sap.m` (`DraftIndicator`) | same |
| `ASSERT_MANDATORY`, `ASSERT_RANGE`, `ASSERT_TARGET` message texts | `@sap/cds/_i18n/messages*.properties` (server picks the locale from `Accept-Language`, which UI5 sends from `sap-ui-language`) | present, checked |
| `Draft_*` labels of `DraftAdministrativeData` | `@sap/cds/_i18n/i18n*.properties` | present, checked. They are not reachable in the UI (the navigation is `UI.Hidden`, and the draft-metadata filters are "not available with CAP services" per the guideline); `ui-verifier` confirms them with `curl -H 'Accept-Language: ru' http://localhost:4004/odata/v4/catalog/$metadata` instead of a screen |
| Field labels, section titles, "Products"/"Product" | `_i18n/i18n.properties`, `_i18n/i18n_ru.properties` (existing keys `Products.*`) | present |
| `DRAFT_ALREADY_EXISTS`, `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` | `@sap/cds/_i18n/messages_ru.properties` | English fallback in the framework file (bundle gap, see Screen 2); not reachable in the normal UI flow |

Mock mode (`npm run start-mock`, step 6) does not serve `ru` (STATE, known limitation); the `ru` checks run against `npm run watch` only.

### Theme and style

Theme `sap_horizon` (`webapp/index.html`, `test/flpSandbox.html`), only the standard FE controls that the draft contract brings (footer toolbar, message popover, draft indicator, object marker, filter field). No custom CSS, no colors, no icons, no `CommandExecution` of ours: FE already registers its own keyboard shortcuts for the standard actions (documented as "Keyboard Shortcuts" in the FE documentation; not retrievable in this session, so not verified; the verifier notes whether Ctrl+E / Ctrl+S work, without making it a criterion).

### Accessibility: `ui5-best-practices-accessibility` checklist

The feature adds no XML view, fragment or controller, so all eight topics are covered by FE and the standard controls; `ui-verifier` checks the rendered result with the accessibility tree and the keyboard (Chrome DevTools MCP).

| Topic | Provided by FE and standard controls | Checked by `ui-verifier` |
|---|---|---|
| Landmarks | `ObjectPageLayout` sets the page regions; the footer toolbar is a `toolbar` role inside the page; the discard popover and the message popover are dialogs with their own labels | nothing additional |
| Labeling | Save, Cancel, Edit, Delete, Create are text buttons (no tooltip needed); the message button is icon-only and must expose an accessible name and the count (FE sets it); every input keeps the form label association and `aria-required` from `FieldControl: Mandatory`; the category dropdown keeps the `combobox` role from `categories-code-list`; the "Locked by" popover has a title | in the accessibility tree: the message button has a name and the count is part of it; Product Name, Category, Price, Currency, Stock are announced as required; a field with an error exposes `aria-invalid` and its error text is read when the field gets focus |
| Heading levels | page title and section titles by FE | nothing additional |
| Focus & keyboard | Tab order equals DOM order: header actions, sections, footer; F6 / Shift+F6 jump between header, each section and the footer; after Edit focus is expected on the first editable field; after Save and after Cancel focus must land on a visible control of the page (expected: the Edit button); Esc in the discard popover closes it and returns focus to Cancel; Esc in the message popover returns focus to the message button; Enter on a message entry moves focus to the field | keyboard-only scenario: Tab to Edit, Enter; Tab to Category, `Alt+Down`, arrows, Enter; Tab to Save, Enter; where focus lands after Save; repeat with Cancel and confirm the popover by keyboard; a focus that ends on `body` after Save or Cancel is a finding |
| Keyboard shortcuts | FE-owned; none of ours | optional note on Ctrl+E / Ctrl+S |
| Invisible messaging | "Draft saved" is rendered by `sap.m.DraftIndicator`; validation errors change value states; the message popover announces its content when opened | whether "Draft saved", the message count and the discard popover are announced by the screen reader layer (accessibility tree live regions); if FE stays silent, record it as an FE limitation, do not propose `InvisibleMessage` (no controller in this app) |
| Reading order | footer after the sections, label before field, popover content title then text then buttons | nothing additional |
| Target size | standard button and field sizes; the draft marker and the "Locked by" link in the table are FE object markers | the "Locked by" link is reachable by keyboard and has an adequate size in the responsive table |

### Scenarios for `ui-verifier` (step 9, `en` unless stated)

Order as in PLAN step 9. Data is restored after every scenario; network evidence comes from `$batch` bodies (`list_network_requests` with `resourceTypes: ["xhr","fetch"]`, then `get_network_request`; LESSONS: the FE `$filter` and the draft actions are visible only inside `$batch`).

1. **Edit exists and works.** Open Laptop Pro 15. Expect Edit and Delete in the header (screenshot "OP display with Edit"). Press Edit: edit mode, the seven inputs of the table above editable, Administrative Data read-only, header not editable (screenshot "OP edit mode"). `$batch` contains `draftEdit` with 201.
2. **Change and save.** Choose Furniture in Category, leave the field: "Draft saved" appears, `PATCH ...IsActiveEntity=false` with 200. Press Save: display mode, Category "Furniture" in the field and in the header description, `draftActivate` with 200. Restore Electronics the same way.
3. **Cancel with the discard confirmation.** Edit, choose Kitchen, leave the field (PATCH sent), Cancel: the popover with the discard button (screenshot "discard popover"); confirm: display mode with the previous values, `DELETE ...IsActiveEntity=false` with 204. Then Edit and Cancel without any change: display mode without a popover.
4. **Draft indicator and Editing Status.** Edit Laptop Pro 15, change Description, navigate back with the shell Back button: the List Report row shows the changed description and the "Draft" marker below the name (screenshot "LR with Editing Status and draft indicator"); note in which column the marker appears (decision 6). Editing Status "Own Draft" lists exactly this row, "Unchanged" lists 14 rows, "All (Hiding Drafts)" lists 15 rows with the saved description, "All" lists 15 rows with the draft data. Open the row: the draft opens in edit mode; Cancel (discard) clears the marker.
5. **Create flow (manual).** Create: Object Page in create mode, five required markers, "Create" in the footer. Press Create with Category empty: blocked client-side, message on the field and in the popover. Fill all required fields (name "Verifier Lamp", category Furniture, price 10, currency EUR, stock 1), Create: display mode, the List Report shows 16 rows. Delete the product from its Object Page: 15 rows. Then Create again and Cancel immediately: 15 rows, `DELETE ...IsActiveEntity=false` in `$batch`.
6. **Lock by another user (proposed addition to PLAN step 9, see deviations).** With the browser on the List Report as the anonymous sandbox user, run in a terminal `curl -u bob: -H 'Content-Type: application/json' -d '{"PreserveChanges":true}' 'http://localhost:4004/odata/v4/catalog/Products(ID=<id of Water Bottle>,IsActiveEntity=true)/CatalogService.draftEdit'` (mocked auth accepts `bob` without a password, as the backend tests do with `alice`). Press Go: the Water Bottle row shows "Locked by bob" with the popover link; Editing Status "Locked by Another User" lists it. Open it: saved version in display mode; Edit is either not offered or answers with a lock message; no unexplained console error. Clean up within the 15-minute lock: `curl -u bob: -X DELETE 'http://localhost:4004/odata/v4/catalog/Products(ID=<id>,IsActiveEntity=false)'`; the marker disappears after Go. If the sandbox does not treat the browser as a different user than `bob` (both would need to be `anonymous` for that, which they are not), record the observation and fall back to the backend test as the only lock evidence.
7. **Validation feedback.** In edit mode set Stock Quantity to `-1` and leave the field: expect an error on the field right after the PATCH (`DraftMessages`), the message button with count 1, the popover entry navigating to the field; Save rejected with 400 `ASSERT_RANGE` if attempted. Clear Product Name and Save: blocked with a required-field error; note whether the block is client-side (no request) or a 400 `ASSERT_MANDATORY`. Set Price to `-1`: note whether the error is client-side (type constraint) or server-side. Correct everything and Cancel.
8. **`ru` (`?sap-ui-language=ru`).** Repeat 1, 3 and 4 briefly: Edit, Save, Cancel, the discard popover, the Editing Status label and its options, the "Draft" marker, the "No data found" message and the required-field message are Russian; the `ASSERT_RANGE` text from scenario 7 is Russian; no `[key]` placeholders anywhere; `$metadata` with `Accept-Language: ru` shows Russian `Draft_*` labels.
9. **Keyboard and accessibility** as in the checklist table (on Laptop Pro 15, restoring the category at the end).
10. **Console and network.** No console error mentioning `Products`, `draft`, `DraftAdministrativeData`, `IsActiveEntity` or the edit flow; the pre-existing sandbox 404s and the ushell deprecation warning (`categories-code-list/VERIFICATION.md`) are not findings. All draft requests 2xx except the deliberately provoked 400 of scenario 7.

### Coverage by `test-ui` (step 7) versus manual verification

| Scenario | OPA5 (`EditCategoryOnObjectPageJourney.js`, un-skipped) | Manual (`ui-verifier`) |
|---|---|---|
| Edit visible and enabled; edit mode | test "The object page of Laptop Pro 15 offers Edit" | 1 |
| Category is a required dropdown of six names; selection shows the name | test "In edit mode Category is a mandatory dropdown of the six names" | 1 |
| Save persists; field and header show the new name | test "Saving shows the new name in the field and in the header" | 2 |
| Cancel discards a persisted change after confirmation | new test "Cancel discards the change" (PLAN step 7) | 3 |
| Restore of the seeded value; teardown last | tests "Restoring the original category leaves the data as seeded", "Teardown" | 2 |
| Draft indicator, Editing Status options, back navigation with a draft | not covered (would need a new journey and leaves data in a draft state between tests) | 4 |
| Create and discard, Create and delete | not covered (decision 4) | 5 |
| Lock by another user | backend test only (PLAN step 4, `bob` vs `alice`) | 6 (proposed) |
| Validation feedback, message popover | not covered (the journey stays on the category) | 7 |
| `ru`, keyboard, accessibility tree, console, `$batch` bodies | not covered by OPA | 8, 9, 10 |
| Filter, name display and `ru` journeys of `categories-code-list` | unchanged, must still pass with the Editing Status field present (`iCheckFilterField` checks named fields only) | not repeated |

### Deviations from PLAN and what the architect must update

- Validation layer refinement (CONTEXT input said `@mandatory` and `@assert.range` are client-side): `@assert.range` on `stock` (Integer) is expected server-side, but visible immediately after the PATCH through `DraftMessages`, not only on Save; on `price` (Decimal) it is expected client-side through the type constraints. Not verified; scenario 7 records the actual layer. No criterion changes, the wording of the `ui-verifier` criterion may say "client- or server-side, in both cases on the field and in the popover".
- Proposed addition to step 9: the lock scenario 6 via `curl -u bob:` against the running `cds watch`, which makes "Locked by Another User" reproducible in the UI although the browser is anonymous. The PLAN risk table currently says it cannot be reproduced; if the architect accepts the scenario, the risk row and the `ui-verifier` criterion get the addition; otherwise scenario 6 is dropped.
- `ru` criterion refinement: the `Draft_*` labels are not reachable through the Editing Status filter or the table settings (`UI.Hidden` on `DraftAdministrativeData`, draft-metadata filters unavailable for CAP); they are confirmed via `$metadata` with `Accept-Language: ru`.
- Expected but not verified in this session (Fiori MCP search unavailable): draft indicator placement in the "Product Name" column without a semantic key; the lock dialog texts; FE keyboard shortcuts. `ui-verifier` records the facts; a missing indicator is escalated to the architect (decision 6), not fixed by annotation.
- Administrative Data after a UI save shows `anonymous` as "Changed By" (sandbox user); the verifier must not flag it.
- Framework bundle gap: `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated in `@sap/cds/_i18n/messages_ru.properties`; candidate for `docs/LESSONS.md` (upstream inbox), no project change.

## Open questions

Listed as "Decisions for the user" in `PLAN.md`; the plan is written for the recommended answers (full draft on `CatalogService.Products`, explicit `IsActiveEntity: true` in tests, standard draft UI, no manifest change, Create flow verified manually only).
