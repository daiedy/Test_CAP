# products-subcategories: plan

Date: 2026-10-09. Status: approved (user, 2026-10-09). Gate mode: autonomous (the user approves this plan). Issue: #8.

Shape (ADR-0018): one criterion per line under "Acceptance criteria", table rows only under "Steps"; explanations belong in `CONTEXT.md` or `research/`. `node scripts/check-feature-docs.mjs products-subcategories` verifies the shape at the phase 1 gate.

Contract rule: a step that changes the OData model (`db/*.cds`, `srv/**/*.cds`, `app/*/annotations/*.cds`) schedules `npx vitest -u` and `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` in the same phase, never in a later one; the sync test in `test/metadata.test.js` turns red at that phase's gate otherwise (PATTERNS "OData contract").

Figures: EDMX line counts were measured on a scratch copy (`research/scratch-experiment.md` section 5) with the recommended defaults D1-D4; test counts are expected values derived from `main` at `c7708c2` (145 backend tests in 11 files; 40 `opaTest`s + 2 QUnit = 42 in `npm run test:ui`). Each gate quotes its own measured figure. If the user overrides D3 or D4, the figures change as noted in "Decisions for the user".

## Decisions for the user

Approved by the user on 2026-10-09: D1-D6 as recommended, and the `SCREENS.md` "Open for the plan gate" items as D7-D9.

| # | Question (issue #8) | Recommended default | Reason |
|---|---|---|---|
| D1 | Subcategory list per category | 15 subcategories, table "D1 list" below; every seeded product gets one, table "D1 seed" | Two or three per category so that narrowing is visible in every category; ELECTRONICS uses the issue's own example (LAPTOPS, MICE, AUDIO); codes follow ADR-0010 |
| D2 | Is the subcategory mandatory? | No, optional (`@assert.target` and the consistency rule only, no `@mandatory`) | The Excel import (ADR-0021) keeps its documented columns and fixtures; API clients and existing tests that create products keep working; a reset after a category change leaves an empty value that must stay saveable; making it mandatory later is one annotation plus an import column |
| D3 | List Report column, filter, header description | Column "Subcategory" right after "Category" (+3 EDMX lines); no filter field; header description stays the category | The column is read-only and cheap; a filter field would be a dependent filter-bar value help (In parameter from the category filter, multi-value semantics) that deserves its own issue; the header keeps one line |
| D4 | On a category change: clear automatically or reject at Save? | Clear automatically: a `before('PATCH', Products.drafts)` handler empties a subcategory that does not belong to the new category, `Common.SideEffects` re-reads it; the `@assert` constraint still rejects a mismatch on every active write and at Save | Without the reset the stale value stays visible and the error appears only at Save (a draft PATCH of the category records no message, `research/scratch-experiment.md` section 3). The alternative "reject at Save" needs no handler and no SideEffects (30 EDMX lines fewer), but costs the user a failed Save |
| D5 | Draft (rule: FE editing) | No change: `Products` stays draft-enabled (ADR-0012), the subcategory is edited in the same draft | The root projection already has `@odata.draft.enabled` |
| D6 | ADR-0024: dependent value help, `@assert` constraint, draft reset | Accept (ADR-0024 accepted) | `research/framework-facts.md`; replaces the issue's handler for the consistency check with a declarative annotation |
| D7 | SCREENS item 1: false mismatch while the category is still empty | Option A: the constraint also guards `category.code is not null` (step 2); an empty category is reported only by the existing `@mandatory` check at Save | CQL `!=` is true against a null category, so a subcategory picked first on a new draft would get a message naming a category the product does not have, and a later category PATCH would not remove it (touched-only messages) |
| D8 | SCREENS item 2: silent reset | Accepted: the subcategory empties without a message; no controller extension | Announcing it needs controller code that ADR-0024 rejects; Subcategory is the next field after Category in reading order |
| D9 | SCREENS item 3: Subcategory offered in "Adapt Filters" | Accepted: no `UI.HiddenFilter`; `ui-verifier` records the behavior as V9 in `VERIFICATION.md`; the filter issue adds its test | D3 adds no filter field; hiding the property would be a second annotation to remove later |

D1 list (English `name`; `ru` names are written by `cap-backend-dev` in `my.catalog-Subcategories.texts.csv` and checked by `reviewer`):

| Category | Subcategories (`code`: name) |
|---|---|
| ELECTRONICS | `LAPTOPS`: Laptops; `MICE`: Mice; `AUDIO`: Audio |
| FURNITURE | `SEATING`: Seating; `LIGHTING`: Lighting; `DESK_ORGANIZATION`: Desk Organization |
| KITCHEN | `APPLIANCES`: Appliances; `DRINKWARE`: Drinkware; `CUTLERY`: Cutlery |
| ACCESSORIES | `BAGS`: Bags; `PHONE_ACCESSORIES`: Phone Accessories |
| SPORTS | `FITNESS`: Fitness; `OUTDOOR`: Outdoor |
| STATIONERY | `NOTEBOOKS`: Notebooks; `WRITING_INSTRUMENTS`: Writing Instruments |

D1 seed (`subcategory_code` per row of `db/data/my.catalog-Products.csv`):

| Product | Category | Subcategory |
|---|---|---|
| Laptop Pro 15 | ELECTRONICS | LAPTOPS |
| Wireless Mouse | ELECTRONICS | MICE |
| Bluetooth Speaker | ELECTRONICS | AUDIO |
| Wireless Earbuds | ELECTRONICS | AUDIO |
| Office Chair | FURNITURE | SEATING |
| Desk Lamp | FURNITURE | LIGHTING |
| Reading Lamp | FURNITURE | LIGHTING |
| Monitor Stand | FURNITURE | DESK_ORGANIZATION |
| Coffee Maker | KITCHEN | APPLIANCES |
| Water Bottle | KITCHEN | DRINKWARE |
| Kitchen Knife Set | KITCHEN | CUTLERY |
| Backpack | ACCESSORIES | BAGS |
| Smartphone Stand | ACCESSORIES | PHONE_ACCESSORIES |
| Yoga Mat | SPORTS | FITNESS |
| Notebook Set | STATIONERY | NOTEBOOKS |

No override was given, so the figures above (phase 2 826 lines, phase 3 873 lines) stand. D7 adds no EDMX line (the constraint has no contract footprint).

## Acceptance criteria
- [x] `Subcategories` is a `@readonly` code list of 15 rows with a category each, verified by test `test/catalog-service.test.js` "lists the 15 seeded subcategories with their category"
- [x] The value help request narrows by category, verified by test "narrows subcategories by category code as the value help does" (`ELECTRONICS` gives `AUDIO`, `LAPTOPS`, `MICE`)
- [x] Subcategory names are localized, verified by test "returns localized subcategory names with English fallback" (`ru` `LAPTOPS` = U+041D U+043E U+0443 U+0442 U+0431 U+0443 U+043A U+0438)
- [x] Subcategories cannot be created, verified by test "does not allow creating subcategories (@readonly)"
- [x] A CatalogViewer reads subcategories, verified by test "lets a CatalogViewer read subcategories"
- [x] Every seeded product has the subcategory of D1 seed, verified by test "returns the seeded subcategory of every product"
- [x] A product with a subcategory of its category is created, verified by test "creates a product with a subcategory of its category"
- [x] A product without a subcategory is created (D2), verified by test "creates a product without a subcategory"
- [x] A subcategory of another category is rejected with 400 `PRODUCTS_SUBCATEGORY_MISMATCH` on target `subcategory_code`, verified by test "rejects a subcategory of another category (PRODUCTS_SUBCATEGORY_MISMATCH)"
- [x] The mismatch message is Russian under `Accept-Language: ru`, verified by test "reports the subcategory mismatch in Russian"
- [x] An unknown subcategory code is rejected with `ASSERT_TARGET`, verified by test "rejects an unknown subcategory code (@assert.target)"
- [x] An active PATCH of the category alone that leaves a foreign subcategory is rejected, verified by test "rejects a category change that leaves a stale subcategory on an active product"
- [x] A draft PATCH of the category empties a subcategory of the old category (D4), verified by test "clears the subcategory when a draft changes the category"
- [x] A draft keeps a subcategory that belongs to the category it receives (D4), verified by test "keeps a subcategory that belongs to the category the draft gets"
- [x] A mismatched pair on a draft is a draft message and blocks activation with target `in/subcategory_code`, verified by test "reports a mismatched subcategory on the draft and rejects activation"
- [x] A draft changing category and subcategory together activates, verified by test "activates a draft whose category and subcategory change together"
- [x] A new draft with no category and a chosen subcategory records no `PRODUCTS_SUBCATEGORY_MISMATCH` message; choosing the matching category keeps the subcategory and the draft activates (D7), verified by test "records no mismatch for a subcategory chosen before the category and activates with the matching category"
- [x] The contract carries one subcategory ValueList with the `category_code` In parameter, `ValueListWithFixedValues` and the `CategoryChanged` side effect, verified by test `test/metadata.test.js` "narrows the subcategory value help by category and refreshes it on a category change"
- [x] `metadata.xml` is in sync after phase 2 (826 lines) and after phase 3 (873 lines), verified by test `test/metadata.test.js` "keeps app/products/webapp/localService/metadata.xml in sync with the model"
- [x] The List Report shows the subcategory name in its own column, verified by OPA5 "The List Report shows the subcategory by name"
- [x] In edit mode the subcategory dropdown lists only the three Electronics subcategories, verified by OPA5 "In edit mode the subcategory dropdown lists only the subcategories of the category"
- [x] Changing the category empties the subcategory and narrows the dropdown to the new category, verified by OPA5 "Changing the category empties the subcategory and narrows the list"
- [x] A saved new pair is shown by name in display mode, verified by OPA5 "Saving shows the new subcategory by name"
- [x] The journey restores Laptop Pro 15 to ELECTRONICS/LAPTOPS and leaves no draft, verified by OPA5 "Restoring the original pair leaves the data as seeded"
- [x] The Object Page shows the subcategory label and name in Russian, verified by OPA5 `RussianLocaleJourney` "The Object Page shows the subcategory in Russian"
- [x] The existing category edit journey still passes and restores LAPTOPS, verified by OPA5 `EditCategoryOnObjectPageJourney` "Restoring the original category leaves the data as seeded"
- [x] `npm test` green with 162 tests at the phase 2 gate and 163 at the phase 3 gate; `npm run test:ui` 49 passed (47 `opaTest` + 2 QUnit) at the phase 4 gate
- [x] `ui-verifier` confirms in `en` and `ru` the narrowed dropdown, the reset, the `$batch` value help request with `$filter=category_code eq '...'`, and a read-only field for `viewer`, and records the "Adapt Filters" observation V9 (D9), in `VERIFICATION.md`
- [x] Documentation updated: PATTERNS rows of ADR-0024 (if accepted), registry, STATE, CHANGELOG, SUMMARY

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | 2 Backend: model and data | `cap-backend-dev` | `db/schema.cds` (`Subcategories : CodeList { key code : String(20); category : Association to Categories; }`, `Products.subcategory : Association to Subcategories` after `category`); `db/data/my.catalog-Subcategories.csv` (`code;name;category_code`, 15 rows of D1 list), `db/data/my.catalog-Subcategories.texts.csv` (`code;locale;name`, 15 `ru` rows), `db/data/my.catalog-Products.csv` (`subcategory_code` column after `category_code`, D1 seed); if `cds add data` is used, normalize to `;`, `ru` only, no `descr` | Code list with selection from a list (ADR-0010); Reference to another entity; Translatable data texts | `cds compile srv --to json`, `npm run lint` |
| 2 | 2 Backend: service and semantics | `cap-backend-dev` | `srv/catalog-service.cds` (`@readonly entity Subcategories as projection on catalog.Subcategories;` after `Categories`, `using from './annotations/Subcategories';`); new `srv/annotations/Subcategories.cds` (`@title` on `code`, `name`, `descr`, `category`); `srv/annotations/Products.cds` (`subcategory @title: '{i18n>Products.subcategory}' @assert.target @assert: (case when subcategory.code is not null and category.code is not null and subcategory.category.code != category.code then 'PRODUCTS_SUBCATEGORY_MISMATCH' end)`; both null guards are required, `research/scratch-experiment.md` section 2 and D7); `_i18n/i18n.properties` + `_ru` and `_i18n/messages.properties` + `_ru` with these values (ru from `SCREENS.md` "Texts", written as plain words in the bundles): `Products.subcategory` and `Subcategories.code` en "Subcategory", ru "Podkategoriya" (U+041F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+044F); `Subcategories.name` en "Subcategory Name", ru "Nazvanie podkategorii" (U+041D U+0430 U+0437 U+0432 U+0430 U+043D U+0438 U+0435, space, U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438); `Subcategories.descr` en "Subcategory Description", ru "Opisanie podkategorii" (U+041E U+043F U+0438 U+0441 U+0430 U+043D U+0438 U+0435, space, the second word of `Subcategories.name`); `Subcategories.category` en "Category", ru the existing `Products.category` ru value (Kategoriya); `PRODUCTS_SUBCATEGORY_MISMATCH` en "The subcategory does not belong to the category of the product.", ru "Podkategoriya ne otnositsya k kategorii tovara." (the `Products.subcategory` ru value; U+043D U+0435; U+043E U+0442 U+043D U+043E U+0441 U+0438 U+0442 U+0441 U+044F; U+043A; U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438; U+0442 U+043E U+0432 U+0430 U+0440 U+0430; full stop) | Read-only; Association target existence check; Cross-field consistency check (ADR-0024 decision 2, proposed row); Texts | `cds compile srv --to json`, `npm run lint` |
| 3 | 2 Backend: draft reset (D4) | `cap-backend-dev` | `srv/catalog-service.js`: in `init()` before the `on` handlers, `this.before('PATCH', Products.drafts, ...)`: return unless `category_code` is in `req.data` and `subcategory_code` is not; read the draft's `subcategory_code` (`SELECT.one.from(req.subject)`); if set and `SELECT.one.from(Subcategories).where({ code, category_code: req.data.category_code })` finds nothing, set `req.data.subcategory_code = null`; JSDoc names ADR-0024 decision 3; no message, no `req.reject` | Dependent field reset on a draft (ADR-0024 decision 3, proposed row) | `npm run lint` |
| 4 | 2 Backend: contract | `cap-backend-dev` | `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u`), `app/products/webapp/localService/metadata.xml` (regenerated) in this phase | OData contract; metadata.xml snapshot update | `npm test` green including the sync test; `metadata.xml` 826 lines (+129/-0 against 697) |
| 5 | 2 Backend: tests | `test-backend` | `test/catalog-service.test.js`: `describe('CatalogService.Subcategories')` with the 5 tests of the first five criteria; `describe('CatalogService.Products subcategory')` with the 7 active-data tests; 5 tests in `describe('CatalogService.Products drafts')` (criteria 13-17; criterion 17: `POST` a new draft without category, `PATCH { subcategory_code: 'MICE' }`, `GET` shows no `PRODUCTS_SUBCATEGORY_MISMATCH` in `DraftMessages`, `PATCH { category_code: 'ELECTRONICS' }` keeps `MICE`, fill the mandatory fields, `draftActivate` 200); rows created per `it` deleted in `afterEach`; active payloads with `IsActiveEntity: true`; `DraftMessages` read with a `GET` after the PATCH | Service test (ADR-0002, ADR-0012) | `npm test`: 162 tests green (145 + 17) |
| 6 | 3 UI: annotations | `fiori-app-dev` | `app/products/annotations/Products.cds`: `subcategory @(Common.Text: subcategory.name, Common.TextArrangement: #TextOnly, Common.ValueListWithFixedValues: true, Common.ValueList: { Label: '{i18n>Products.subcategory}', CollectionPath: 'Subcategories', Parameters: [ InOut subcategory_code/'code', In category_code/'category_code', DisplayOnly 'name' ] })`; `{ Value: subcategory_code }` after `category_code` in `UI.FieldGroup #GeneralInfo` and in `UI.LineItem` (D3); `Common.SideEffects #CategoryChanged: { SourceProperties: [ category_code ], TargetProperties: [ 'subcategory_code', 'subcategory/name' ] }` (D4); new `app/products/annotations/Subcategories.cds` (`code`: `Common.Text: name`, `#TextOnly`); `app/products/annotations.cds` (`using from './annotations/Subcategories';`); layout per `SCREENS.md` | Value help from a code list (ADR-0011); Dependent value help (ADR-0024 decision 1); Table columns, filters, header, sections; Dependent field reset on a draft (ADR-0024 decision 3) | `cds compile '*' --to edmx-v4 -s CatalogService -l en`: exactly 4 `Common.ValueList` (one per foreign key), no bare `Path="subcategory"`; `npm run lint` in `app/products` |
| 7 | 3 UI: contract and mock | `fiori-app-dev` | `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u`), `app/products/webapp/localService/metadata.xml` (regenerated) in this phase; `webapp/localService/mockdata/Subcategories.json`, `Subcategories_texts.json` (arrays, from the CSVs), `Products.json` (`subcategory_code` per D1 seed) | OData contract; UI without backend (ADR-0008) | `npm test` green including the sync test; `metadata.xml` 873 lines (+47 against phase 2) |
| 8 | 3 UI: contract test | `test-backend` | `test/metadata.test.js`: "narrows the subcategory value help by category and refreshes it on a category change" (compact EDMX: the `Products/subcategory_code` ValueList contains the `ValueListParameterIn` record for `category_code`, `ValueListWithFixedValues` is true, one `Common.ValueList` on the property, the `CategoryChanged` side effect with both targets) | OData contract | `npm test`: 163 tests green |
| 9 | 4 UI tests: new journey | `test-ui` | `webapp/test/integration/SubcategoryDependsOnCategoryJourney.js` (6 `opaTest`s: the five OPA5 criteria plus Teardown), `webapp/test/integration/data/SubcategoryTexts.js` (en/ru names), `opaTests.qunit.js` (run before `DraftMarkerInListReportJourney`, it restores data); reuse `pages/CategoryDropdown.js` for the subcategory dropdown (generalize its name only if `sap.fe.test` needs a different field id) | User scenario | `npx cds serve --in-memory --port 4004` fresh, `npm run test:ui` in `app/products` |
| 10 | 4 UI tests: existing journeys | `test-ui` | `EditCategoryOnObjectPageJourney.js` (the restore step re-selects Laptops after Electronics; its Save after Furniture now saves an empty subcategory); `RussianLocaleJourney.js` (+1 `opaTest` "The Object Page shows the subcategory in Russian") | User scenario | `npm run test:ui`: 49 passed (47 `opaTest` + 2 QUnit), 0 skipped, no draft left |
| 11 | 5 Verification | `ui-verifier` | `docs/features/products-subcategories/VERIFICATION.md` | | `SCREENS.md` scenarios V1-V10 (V9 "Adapt Filters" recorded as an observation, D9); `en` and `ru` screenshots of the narrowed dropdown before and after a category change, the List Report column, `viewer` read-only; the value help `$batch` request with its `$filter`; console: no message that is new against the console section of the latest `VERIFICATION.md` on `main` (known noise: `initialLoad` boolean deprecation) |
| 12 | 5 Review | `reviewer` | `docs/features/products-subcategories/REVIEW.md` | | zero blocking findings; `ru` CSV names checked; the hand-written ValueList accepted only as ADR-0024 decision 1 |
| 13 | 6 Documentation | `docs-keeper` | `docs/architecture/PATTERNS.md` (three rows of ADR-0024 with examples, if accepted), `templates/annotations-ui.cds` (dependent value help block), `docs/registry` (`npm run docs:registry`), `docs/STATE.md`, `docs/CHANGELOG.md`, `SUMMARY.md` | | `node scripts/check-docs-fresh.mjs` |

## Decisions that require an ADR
- ADR-0024 "Dependent value help between code lists" (`docs/decisions/ADR-0024-dependent-value-help.md`, accepted by the user on 2026-10-09): decision 1 hand-written `Common.ValueList` with `ValueListParameterIn` on the dependent association, dropdown kept (the ADR-0011 part 1 exception made concrete); decision 2 cross-field consistency with an `@assert: (case ...)` constraint instead of a handler; decision 3 reset of the dependent field on a draft PATCH plus `Common.SideEffects` (follows D4).
- `.claude/rules/ui-annotations.md` says a ValueList on a code-list association is "never written by hand"; after acceptance it needs one sentence naming the ADR-0024 exception. The file is protected: a user-started `PIPELINE_ALLOW_PROTECTED=1` edit; until then the reviewer reads ADR-0024 as the exception.

## Risks
| Risk | Detection | Response |
|---|---|---|
| The fixed-values dropdown ignores the In parameter at runtime (finding is source-read, `research/framework-facts.md` section 4) | OPA5 step 9 "lists only the subcategories of the category" red | Stop and return to the user: drop `ValueListWithFixedValues` for `subcategory` (dialog) or keep the dropdown unfiltered with the server check only |
| The reset is not visible without reload (SideEffects target or text path wrong) | OPA5 step 9 "empties the subcategory" red; `ui-verifier` `$batch` shows no GET of `subcategory_code` | Fix the SideEffects targets in phase 3; do not add controller code |
| Constraint written without its null guards rejects every product without a subcategory, or flags a subcategory picked before the category | Tests "creates a product without a subcategory" and "records no mismatch for a subcategory chosen before the category and activates with the matching category" red | Use the exact expression of step 2 |
| `EditCategoryOnObjectPageJourney` saves Laptop Pro 15 with an empty subcategory and the restore loses LAPTOPS | Step 9 or 10 assertion of the seeded pair; row values in later journeys | Step 10 re-selects Laptops; journeys run before `DraftMarkerInListReportJourney` |
| A future import column `subcategory` would rethrow `PRODUCTS_SUBCATEGORY_MISMATCH` as a whole-file 400 (`validationErrors` maps only `ASSERT_*` codes) | Not reachable in this feature: the import has no subcategory column (D2) | Record in `SUMMARY.md` as a note for any later import extension |
| New draft: with an empty category the dropdown lists all 15 subcategories (no In condition for an empty value) | `ui-verifier` on Create | Expected; no message while the category is empty (D7), the reset keeps a subcategory whose category is then chosen (criteria 14 and 17) and clears any other |

## Open questions
- None: D1-D9 were approved by the user on 2026-10-09. The one-sentence edit of the protected `.claude/rules/ui-annotations.md` (see "Decisions that require an ADR") waits for a user-started session and does not block phase 2.
