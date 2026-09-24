# products-rating-column: context

Date: 2026-09-25. Author: `architect`. Branch: `feature/products-rating-column`. Issue: #5 (`feature`, `prio:P2`, blocked by none).

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts are in `research/fe-rating-column.md` and `research/contract-delta.md`, read only by `architect` and `reviewer` unless a plan step names the file.

## Request

The List Report of the products app gets a column that shows each product's rating as stars (a `sap.m.RatingIndicator`); the user's wording is "a custom column with a rating (Rating Indicator)" (original in Russian in issue #5). `Products` has no rating element today, so the feature adds one to the model with values for the 15 seeded products, labels in `en` and `ru`, a range check for the scale, and shows it in the List Report table; under the recommended default a `CatalogEditor` also sets the rating on the Object Page through the existing draft edit flow, and a `CatalogViewer` sees it read-only.

## User decisions

Approved at the plan gate on 2026-09-25: all recommended defaults.

- Type and scale: `rating : Integer`, 0..5, whole stars, `@assert.range: [0, 5]`, `TargetValue: 5`.
- Who sets it: a `CatalogEditor` on the Object Page (`UI.FieldGroup #GeneralInfo`, 4th entry), optional, no `@mandatory`, no default.
- Column: annotation-driven (`UI.DataPoint #Rating` plus `UI.DataFieldForAnnotation`), no custom fragment, `manifest.json` unchanged; rows 2b, 3b, 3c of `PLAN.md` are not executed and no ADR is written.
- Drafts: `rating` joins the existing draft flow (ADR-0012), range enforced on `draftActivate`.
- UX (`SCREENS.md`): `![@UI.Importance]: #Low` on the column; unrated and 0 both render as five empty stars; no header facet; `ru` label is the word "Reyting" (U+0420 U+0435 U+0439 U+0442 U+0438 U+043D U+0433).

## Affected entities and services

Result of `mcp__cds-mcp__search_model` (`my.catalog.Products`, `CatalogService.Products`) and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Object | Exists now | What changes |
|---|---|---|
| `my.catalog.Products` (`db/schema.cds`) | `cuid, managed`; `name`, `description`, `price`, `currency`, `stock`, `category`, `imageUrl`; no rating | add `rating : Integer;` after `stock` (nullable, no default: a product without a rating is "not rated yet" and shows empty stars); no annotation in `db/` |
| `db/data/my.catalog-Products.csv` | 15 rows, `;`-separated, no `rating` column | add the column `rating` with whole-star values in 0..5 by hand (no generator run: it would rewrite the file comma-separated): `Laptop Pro 15` = 5 and `Yoga Mat` = 4 are pinned because the tests assert or reuse them; include at least one 0 and one 1 so empty and near-empty stars are visible; category counts stay as they are (`ELECTRONICS` 4) |
| `CatalogService.Products` (`srv/catalog-service.cds`) | draft-enabled projection without an explicit column list, `@restrict` READ for `CatalogViewer`, `*` for `CatalogEditor` | no change: the element joins the projection, the draft flow (ADR-0012) and both role grants automatically |
| `srv/annotations/Products.cds` | `@title`, `@mandatory`, `@assert.*` per element | add `rating @title: '{i18n>Products.rating}' @assert.range: [0, 5];` in the element list, no `@mandatory` |
| `_i18n/i18n.properties`, `_i18n/i18n_ru.properties` | 15 keys each, `Products.<element>` | add `Products.rating` (`en` "Rating", `ru` translation) to both, `#XFLD` comment, same change |
| `app/products/annotations/Products.cds` | one `annotate CatalogService.Products with @( Common.SemanticKey, UI.HeaderInfo, UI.SelectionFields, UI.LineItem with 4 `DataField`s, UI.Facets, UI.FieldGroup #GeneralInfo/#PricingStock/#AdminData )` block, the `category` block, the `UI.*Hidden` block | in the same first block: `UI.DataPoint #Rating: { Value: rating, TargetValue: 5, Visualization: #Rating }`; a fifth `UI.LineItem` entry `{ $Type: 'UI.DataFieldForAnnotation', Label: '{i18n>Products.rating}', Target: '@UI.DataPoint#Rating', ![@UI.Importance]: #Low }` as the last entry after `stock` (settled in `SCREENS.md`); the same record without importance as the 4th entry of `UI.FieldGroup #GeneralInfo`, after `category_code` and before `imageUrl`; no `UI.HeaderFacets`, no `Title`/`Description` on the DataPoint. `Label` is explicit because FE builds a `DataFieldForAnnotation` header from the record, not from the property's `@title`; it reuses the `_i18n` key, so no webapp i18n key is added |
| OData contract: `test/__snapshots__/metadata.test.js.snap`, `app/products/webapp/localService/metadata.xml` | 619 EDMX lines on `main` | phase 2 (backend): +6/-0 lines, `Property rating Edm.Int32`, `Common.Label`, `Validation.Minimum` 0, `Validation.Maximum` 5; phase 3 (UI): net +16 lines (DataPoint record, two `DataFieldForAnnotation` records, one `UI.Importance`) with a positional move of the neighbouring `Common.SemanticKey`/`SideEffects`/`Messages` block in the raw diff (`research/contract-delta.md`); both regenerated in their own phase |
| `test/catalog-service.test.js`, `test/metadata.test.js` | 26 and 6 tests; helpers `activeKey`, `draftKey`, `draftEdit()`, `as()`; compact EDMX comparison idiom | +4 service tests in phase 2, +1 contract test in phase 3 (names in `PLAN.md`) |
| `app/products/webapp/localService/mockdata/Products.json` | 15 records without `rating` | add `"rating": <same value as the CSV>` to every record (mock mode serves `metadata.xml` plus this file, ADR-0008) |
| `app/products/webapp/test/integration/` | 6 journeys, 25 `opaTest`s; `RussianLocaleJourney` and `CategoryShownAsNameJourney` call `iCheckColumns(undefined, ...)`, so a fifth column does not break them | new `RatingShownAsStarsJourney.js` (3 cases incl. teardown), registered in `opaTests.qunit.js` before `DraftMarkerInListReportJourney` (it only reads); one header assertion added to the first case of `RussianLocaleJourney.js`; the `ru` header text goes into `data/` as `\u` escapes like `CategoryTexts.js` |
| `app/products/webapp/manifest.json` | no `controlConfiguration`, no extension | byte-unchanged under the recommended way; changed only under the fragment alternative (open question 3) |
| `CatalogService.Permissions`, `UI.*Hidden`, `@requires`, `@restrict`, `.github/workflows/ci.yml`, the `run-app`/`test-all` curls, README | ADR-0013 | unchanged: nothing about authentication or authorization moves, so no caller outside the application needs an update |

Rendering facts for `ux-designer` and `fiori-app-dev` (sources in `research/fe-rating-column.md`): Fiori Elements V4 renders a `UI.DataFieldForAnnotation` whose target is a `UI.DataPoint` with `Visualization: #Rating` as a `sap.m.RatingIndicator` with `maxValue` = `TargetValue`; in the List Report cell and in a display-mode form it is `editable=false`; in an Object Page form in edit mode the same record renders an interactive `RatingIndicator` (FE edit style `RatingIndicator`, verified in the loaded UI5 1.152.0 sources); the tooltip is the framework text `T_COMMON_RATING_INDICATOR_TITLE_LABEL`, so no project key is needed for it; a header-facet DataPoint would stay read-only in edit mode, which is why the field lives in a FieldGroup.

## What already exists and is reused

From `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md` and the code:

- Validation: the `@assert.range` idiom of `Products.stock` (`srv/annotations/Products.cds`), enforced on `draftActivate` and on direct active writes; no handler. `srv/catalog-service.js` keeps its single `on READ Permissions` handler.
- Labels: the `_i18n` key convention `Products.<element>` in `en` and `ru`; one key serves `@title`, the column `Label` and the form label.
- Annotations: the existing `annotate CatalogService.Products with @( ... )` block in `app/products/annotations/Products.cds` gains entries; no second `UI.LineItem`, no qualifier, no new file.
- Backend tests: `activeKey()`, `draftKey()`, the `draftEdit()` helper and the `describe('CatalogService.Products drafts')` block, the `rejects negative stock (@assert.range)` shape (`rejectedWith(/400/)` plus `containSubset({ code: 'ASSERT_RANGE' })`), `defaults.auth = alice`; the compact-EDMX comparison in `test/metadata.test.js`.
- UI tests: `JourneyRunner.js`, the generated page objects `ProductsList.gen.js` and `ProductsObjectPage.gen.js`, the `iCheckColumns(count, { <header>: { header } })` idiom of `CategoryShownAsNameJourney.js`, the `data/CategoryTexts.js` shape for `ru` texts, `iStartMyApp('products-display')` and the teardown-only last case.
- Mock mode: the array-shaped fixtures in `localService/mockdata/` (rule `ui5-webapp.md`), synced with the CSV like `categories-code-list` did.
- Data: the hand-edited `;` CSV of `Products`; `cds add data` is not run (memory: it rewrites comma-separated with placeholders).

Nothing suitable exists for the star rendering itself, and nothing is written for it: FE renders `sap.m.RatingIndicator` from the annotation. It would be a mistake to write anew: a fragment or formatter for the stars, a `before` handler for the range, a webapp i18n key for the column header, a second `UI.LineItem` or a qualified copy of it, a controller extension, a change to the `Permissions` singleton or the `UI.*Hidden` annotations, a new OPA page object while `iCheckCells`/`iCheckField` resolve the controls.

## Applicable patterns

Rows from `docs/architecture/PATTERNS.md`:

- "New entity" (the element, CSV and test parts of the row apply to an added element; example `db/schema.cds` → `Products`, ADR-0003) for `rating : Integer` and the CSV column.
- "Format or range check" (`@assert.range` in `srv/annotations/<Entity>.cds`, example `Products.stock`, ADR-0004) for `[0, 5]`.
- "Drafts" (ADR-0012): no change; the element joins the root projection's draft flow; tests address active data with `IsActiveEntity=true`.
- "Authorization" (ADR-0013): no change; both grants cover the new element.
- "Table columns, filters, header, sections" (`@UI.LineItem`, `@UI.FieldGroup` in `app/<app>/annotations/<Entity>.cds`, ADR-0004) for the `UI.DataPoint #Rating` and the two `DataFieldForAnnotation` records. First use of a `UI.DataPoint` in this project: `docs-keeper` adds the term and this feature to the row's Way and Example in phase 6; no ADR, the way is the same file and the same block.
- "Texts" (`_i18n`, `en` and `ru` in the same change) for `Products.rating`.
- "Service test", "OData contract", "metadata.xml snapshot update" for the tests and the two regenerations per phase.
- "User scenario" (OPA5 on `sap.fe.test`, `npm run test:ui` against `cds serve`) for the journey.
- "UI without backend" (ADR-0008) for the mock fixture.
- "Custom section or column" (`ext/fragment/<Name>.fragment.xml` + `controlConfiguration` via Fiori MCP) and "Manifest change" (ADR-0007): only under the fragment alternative of open question 3; for content an annotation expresses, CLAUDE.md invariant 6 makes that row the wrong one, so choosing it needs a proposed ADR (see `PLAN.md`, "Decisions that require an ADR").

## Relevant lessons

- `docs/LESSONS.md` "Pending" is empty (retro of 2026-09-23). Transferred rules applied here: a scratchpad figure names its phase (`research/contract-delta.md`); the snapshot and `metadata.xml` are regenerated in the phase that changes the model; the console criterion compares against the latest `VERIFICATION.md` on `main`.
- "Pending upstream": `run_manifest_validation` of UI5 MCP 0.2.18 is broken (matters only for the fragment alternative, `ui5lint` is the check); UI5 1.152.0 logs the `Permissions/isEditor` `$select` error once per page load (known console noise for the verifier); `fiori-mcp` outages have happened, the fallback (CDN debug sources of the loaded version) was used here for two facts that the MCP documentation does not cover: the edit style of a Rating DataPoint in a form and the `sap.fe.test` matchers, both marked "CDN 1.152.0" in `research/fe-rating-column.md`.
- Memory (`.claude/agent-memory/architect/`): `cds add data` rewrites CSV comma-separated with placeholders (do not run it for one column); test counts go stale, so the plan re-derives them (64 backend `it`s and 25 `opaTest`s on `main` at `831dd42`, STATE still says 57 because `test/backlog.test.js` came after that line was written); `@assert.range` targets on `draftActivate` are `in/<field>`, match by suffix.

## Open questions

1. Scale and type. Recommended: `Integer`, `@assert.range: [0, 5]`, `TargetValue: 5` (whole stars; the edit control clicks whole stars; matches `stock`). Alternative `Decimal(2, 1)` for half stars: the CSV and tests carry strings (`'4.5'`), `@assert.range: [0, 5]` unchanged, `TargetValue: 5` unchanged; rows 1 and 2 of the plan change their type and payloads, nothing else.
2. Who sets the rating. Recommended: a `CatalogEditor` on the Object Page, in the `GeneralInfo` field group, through the existing draft edit flow; `rating` is optional (no `@mandatory`, no default). Alternative "read-only data from the CSV": `@readonly` on `rating` in `srv/annotations/Products.cds`, no `@assert.range` (CDS ignores input for read-only elements, so the range would never fire), no `FieldGroup` entry, the two negative backend tests become one test "ignores a rating in the payload (@readonly)", no verifier edit scenario (plan rows 2b and 3b).
3. Annotation column or custom column fragment. Recommended: the annotation column (`UI.DataPoint #Rating` + `DataFieldForAnnotation`), which is what the words "Rating Indicator" mean in Fiori Elements, leaves `manifest.json` byte-unchanged, gives sorting and personalization for free and reuses the same record on the Object Page. Alternative, the literal "custom column": `ext/fragment/RatingColumn.fragment.xml` with `<RatingIndicator value="{rating}" maxValue="5" editable="false"/>`, a `controlConfiguration` column in `ProductsList` written through Fiori MCP `list_functionality` → `execute_functionality`, a webapp i18n key for the header, `ui5lint` instead of the broken `run_manifest_validation`, `UI-ARTIFACTS.md` gains the app's first extension, the Object Page still needs the DataPoint for stars (two mechanisms for one field), and a proposed ADR records the deviation from invariant 6 (plan row 3c).
4. Drafts. `CatalogService.Products` carries `@odata.draft.enabled` (ADR-0012); the new element joins the draft edit flow automatically, the range is enforced on `draftActivate` (HTTP 400) and reported as a `DraftMessages` entry on a draft `PATCH`; no draft configuration changes. Recommended: confirm, nothing to decide beyond that.
