# products-details-section: context

Date: 2026-10-12 (revision 2; revision 1 of 2026-10-11 is in git at `cc23ef0`). Author: `architect`. Branch: `feature/products-details-section` (worktree, phases 2-3 of revision 1 committed at `59b51fc` and `001f961`, verification round 1 at `cc23ef0`). Issue: #9.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens are in `SCREENS.md` (`ux-designer`). Measurements and rejected mechanisms are in `research/typed-form-facts.md` (this revision) and `research/framework-facts.md` (revision 1 facts that stay valid).

## Request
Issue #9: "Object Page: a new section Details, dependent on the subcategory". The product shows the attributes of its subcategory (a laptop: screen size, memory, storage; a chair: material, maximum load, colour) on the existing Object Page of `app/products`, read-only for a `CatalogViewer`, edited inside the product draft by a `CatalogEditor`. Revision 1 built it as an editable table; the user rejected the table after verification round 1 and asked for form fields generated from the subcategory, with typed values and value lists.

## User decisions
Fixed on 2026-10-11 and still valid: reading (a), dynamic attributes reusable across subcategories through `SubcategoryAttributes`; units on the attribute, Latin, not localized (`in` for inches); `CatalogViewer` read-only, `CatalogEditor` edits in the draft; `@odata.draft.enabled` on `Products` only (D9); `SubcategoryAttributes : cuid` with `@assert.unique.pair` (D3); section label "Details" / "Kharakteristiki" between "Pricing & Stock" and "Administrative Data" (D6); ADR-0026 decisions 1, 2 and 5.
Replaced or retired by revision 2: D1 by U3, D4 by U4, D7 (seed) by D17, ADR-0026 decisions 3, 4, 6 and 7 by ADR-0027 (D18); D5 (Create before a subcategory) moot; D2 kept as the API guard of D15.

Decided on 2026-10-12 (verbatim in intent, not reopened):
- U1: the Details section is form fields generated from the subcategory, like "General Information" (label above value in display, labelled inputs in edit); one generic custom section fragment (`ext/fragment/<Name>.fragment.xml` through Fiori MCP); no table, no Create/Delete, no attribute dropdown; the fragment knows no attribute; a JS factory builds each form element by the attribute's value type; `sap.ui.layout.form.Form` with `ColumnLayout` (never `SimpleForm`); display/edit from `ui>/isEditable`; a counter "Filled N of M".
- U2: the server creates a row for every attribute assigned to the product's subcategory as soon as the subcategory is set in the draft, extending the existing draft handler (`resetStaleSubcategory`); field order per subcategory.
- U3 (replaces D1): on a subcategory change rows of common attributes keep their values, the others are deleted, the missing ones created; the user gets a warning.
- U4 (replaces D4): empty values are allowed; display shows the empty indicator; the counter counts filled rows.
- U5: the value type is a property of the attribute: code list `DetailValueTypes` (`TEXT`, `INTEGER`, `DECIMAL`, `LIST`, localized); `DetailAttributes` gets the type and, for numbers, min, max and scale; `ProductDetails` stores text, number (Decimal) and list value in separate columns; server validation declarative (`@assert`); client validation through UI5 types chosen by the factory (locale-aware); no hand-written regex.
- U6: allowed values per attribute in a new entity with localized texts; LIST attributes are edited with `sap.m.ComboBox` bound to the attribute's values, typed text must match an item (error value state) plus the server membership check; one list per attribute shared by all subcategories.
- U7: type on the attribute, a separate numeric column, UI5 types instead of JS regex.
- Addition (2026-10-12): value type `MULTI_LIST` next to `LIST`; `CONNECTIVITY` is MULTI_LIST; the selected values live normalized in a child composition of the detail row, each validated declaratively (belongs to the attribute, only on MULTI_LIST rows, no duplicate per row); edited with `sap.m.MultiComboBox` (syncing its keys with the child entities is the one piece of custom JS beyond the factory); display joins the names with a comma; "filled" means at least one value.

Approved at the plan gate on 2026-10-12 (revision 2, user: "approved"), every decision at its PLAN recommended default (the `SCREENS.md` questions are merged into them):
- D10: rows stay unchanged while the subcategory is empty; the U3 rule applies once when a new subcategory is set; `details` leaves `#CategoryChanged`.
- D11: `MATERIAL` is `MULTI_LIST`.
- D12: INTEGER attributes get the server whole-number branch `PRODUCTS_DETAIL_VALUE_NOT_INTEGER`.
- D13: products without rows get them at the first Edit (`after('EDIT')` fill); `importProducts` untouched.
- D14: field order by `SubcategoryAttributes.position`, copied by the handler to `ProductDetails.position @readonly`.
- D15: the ADR-0026 API guards stay (`PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE`, `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS`).
- D16: warning `PRODUCTS_DETAILS_VALUES_REMOVED` (`req.warn`, target `subcategory_code`) only when a filled value is removed.
- D17: seed of `research/typed-form-facts.md` section 8 with the SCREENS ranges and lists (42 list values, 45 rows, 7 selections), numbers and bounds `Decimal(15, 3)`.
- D18: ADR-0027 accepted; it supersedes ADR-0026 decisions 3, 4, 6 and 7; ADR-0026 gets an amendment section in phase 6.
- D19: format, decimals and bounds checked on the client by the per-row UI5 Decimal type; the server keeps range, whole-number, column-type and list-membership checks with texts without placeholders.
- D20: the counter on its own line under the section title, neutral text.
- D21: UI5 default number grouping.
- D22: Latin designations stay Latin in `ru` list names.
- D23: no undo hint in the warning.

## Affected entities and services
Result of `mcp__cds-mcp__search_model` (returns the pre-feature model in this worktree; the committed revision 1 model was read from `db/schema.cds` and `srv/`), `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md` and the scratch of `research/typed-form-facts.md`:

| Object | Exists now (`cc23ef0`) | What changes |
|---|---|---|
| `my.catalog.Products` | `details : Composition of many ProductDetails` | unchanged |
| `my.catalog.DetailValueTypes` | does not exist | `CodeList { key code : String(20); }`, CSV with `TEXT`, `INTEGER`, `DECIMAL`, `LIST`, `MULTI_LIST` and `ru` texts |
| `my.catalog.DetailAttributes` | `code`, `name`, `unit`, `subcategories` | + `valueType`, `minValue`, `maxValue : Decimal(15, 3)`, `scale : Integer`, `values : Association to many DetailListValues`; CSV gets the columns (research section 8) |
| `my.catalog.DetailListValues` | does not exist | `CodeList { key code : String(30); attribute : Association to DetailAttributes; position : Integer; }`, 42 rows + `ru` texts (SCREENS "List values") |
| `my.catalog.SubcategoryAttributes` | `cuid`, `subcategory`, `attribute`, `@assert.unique.pair` | + `position : Integer` (1-3 per subcategory) |
| `my.catalog.ProductDetails` | `product`, `attribute`, `value : String(100)` | `value` removed; + `position : Integer`, `textValue : String(100)`, `numberValue : Decimal(15, 3)`, `listValue : Association to DetailListValues`, `selections : Composition of many ProductDetailSelections on selections.detail = $self`; CSV 45 rows |
| `my.catalog.ProductDetailSelections` | does not exist | `cuid { detail : Association to ProductDetails; value : Association to DetailListValues; }`, CSV 7 rows |
| `CatalogService` (`srv/catalog-service.cds`) | `ProductDetails` with the root `@restrict`; `@readonly` `DetailAttributes`, `SubcategoryAttributes { *, attribute.name as attributeName }` | + `ProductDetailSelections` with the root `@restrict`; + `@readonly` `DetailListValues`, `DetailValueTypes`; `SubcategoryAttributes` plain projection (no `attributeName`) |
| `srv/annotations/ProductDetails.cds` | `attribute` constraint (`NOT_ASSIGNED`, `DUPLICATE`), `value @mandatory` | `attribute` unchanged; `value` gone; `position @readonly`; typed constraints on `textValue`, `numberValue`, `listValue` (+ `@assert.target`); `ProductDetailSelections.value @mandatory @assert.target @assert`; titles (ADR-0027 decision 4) |
| `srv/annotations/Products.cds` | `subcategory` constraint with `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` | unchanged (API guard, D15) |
| `srv/annotations/DetailAttributes.cds`, `SubcategoryAttributes.cds`, new `DetailListValues.cds`, `DetailValueTypes.cds` | titles | new titles; `attributeName` title gone |
| `srv/catalog-service.js` | `before('PATCH', Products.drafts)` → `resetStaleSubcategory` | the same registration also reconciles the rows; new `after('EDIT', Products)` fills missing rows (ADR-0027 decision 3, research section 4) |
| `_i18n/i18n*.properties`, `_i18n/messages*.properties` | revision 1 keys | labels: remove `Products.facet.details`, `ProductDetails.typeName`, `typeNamePlural`, `value`, `SubcategoryAttributes.attributeName`; add the new titles; messages: keep the three ADR-0026 keys, add `PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH`, `PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE`, `PRODUCTS_DETAIL_VALUE_NOT_INTEGER`, `PRODUCTS_DETAIL_VALUE_NOT_IN_LIST`, `PRODUCTS_DETAIL_SELECTION_DUPLICATE`, `PRODUCTS_DETAILS_VALUES_REMOVED` |
| `app/products/annotations/Products.cds` | facet `Details` on `details/@UI.LineItem`; `details` in `#CategoryChanged`; `#SubcategoryChanged` | facet removed; `details` out of `#CategoryChanged` (D10); `#SubcategoryChanged` kept (re-reads the fragment) |
| `app/products/annotations/ProductDetails.cds`, `SubcategoryAttributes.cds` | table presentation, the hand-written value list | deleted (and their `using` lines); new `DetailListValues.cds` (`code @Common.Text: name #TextOnly`) |
| `app/products/webapp/manifest.json` | no custom section | custom section `Details` through Fiori MCP only (the revision 1 "no manifest diff" no longer holds) |
| `app/products/webapp/ext/fragment/` | `RatingRangeFilter.*` | new `DetailsForm.fragment.xml` + `DetailsForm.js` |
| `app/products/webapp/i18n/i18n*.properties` | app texts | section title, counter, combo box error text (`en`, `ru`) |
| `metadata.xml`, snapshot | 1287 lines | 1591 measured on the scratch (phase 2); phase 3 unchanged |
| `test/catalog-service.test.js` (96, 21 in the details `describe`), `test/metadata.test.js` (14) | | details `describe` 33 (13 kept, 5 rewritten, 15 new, 3 removed); two contract tests rewritten |
| OPA5 (56 `opaTest` + 2 QUnit) | `ProductDetailsSectionJourney.js` (5), `RussianLocaleJourney` details test | journey deleted; new `ProductDetailsFormJourney.js` (7 with teardown), `pages/ProductDetailsForm.js`; the `ru` test rewritten |
| `localService/mockdata` | revision 1 JSON | JSON for the new and changed entities (not a gate) |

Not affected: `importProducts` (D13), the List Report, `Permissions`, authentication (new sets under `@requires: 'authenticated-user'`; no external caller changes).

## What already exists and is reused
- `resetStaleSubcategory` and its `before('PATCH', Products.drafts)` registration in `srv/catalog-service.js` (`docs/registry/HANDLERS.md`): extended, not duplicated; the reconciliation runs after it in the same registration.
- The ADR-0026 constraint shape (`exists ... $self`, null guards) and the ADR-0024 pair form (`listValue.attribute.code != attribute.code`) for the typed and membership rules; no handler checks values.
- The explicit child projection with the root's `@restrict` (ADR-0026 decision 2) for the second level.
- `Subcategories` (a `CodeList` with a parent association) as the shape of `DetailListValues`; `Common.Text` + `#TextOnly` on a code-list key (ADR-0011).
- `Common.SideEffects #SubcategoryChanged` with `TargetEntities: [ details ]` (revision 1) re-reads the new section.
- `ext/fragment/RatingRangeFilter.*` (feature `products-rating-filter`, `UI-ARTIFACTS.md`): the module shape (named pure functions, `core:require`, no controller extension) for `DetailsForm.js`.
- Test helpers of `test/catalog-service.test.js` (module scope since revision 1: `active()`, `activeKey()`, `draftKey()`, `draftEdit()`, `readDraft()`, `messageCodes()`, `as()`), `annotationsOf()` in `test/metadata.test.js`; `data/DetailAttributeTexts.js` for OPA names.
- The two older journeys keep the Wireless Earbuds choice (`EditCategoryOnObjectPageJourney.js`, `SubcategoryDependsOnCategoryJourney.js`); Earbuds' three seeded rows are empty, so a subcategory round trip ends with the same content.
- Nothing in `srv/lib/` applies.

## Applicable patterns
- "New entity", "Code list with selection from a list" (ADR-0003, ADR-0010), "Translatable data texts", "Parent-child relationship (document)" (second level, ADR-0027 decision 1).
- "Read-only", "Authorization" (child grants per level), "Drafts" (ADR-0012).
- "Association target existence check", "Mandatory field" (selection value), "Cross-field consistency check" (typed and membership rules).
- "Dependent field reset on a draft" (extended by the row reconciliation, ADR-0027 decision 3; a new PATTERNS row in phase 6).
- "Value help from a code list" (`DetailListValues` key text), "Refresh after an action" (side-effect shape).
- "Custom section or column" (`ext/fragment/DetailsForm.*` + Fiori MCP), with the module shape of "Custom filter field".
- "Texts", "OData contract", "metadata.xml snapshot update" (phase 2 only), "Service test", "User scenario", "Finish a feature".
- ADR needed: ADR-0027 (proposed).

## Relevant lessons
- LESSONS 2026-10-10: every status, code and target of the criteria is measured (research section 3); plan-gate answers are reconciled in SCREENS by the `ux-designer` in step 1b.
- LESSONS 2026-10-09: `cds add data` writes into the protected `mta.yaml`; CSVs by hand, UUIDs from `crypto.randomUUID()`; in a worktree the Bash guard refuses compound commands: run plain commands or a `node <file>` script.
- Revision 1 research section 7: a bare `"` in a `;` CSV swallows rows; the list names contain parentheses and dots but no quotes.
- TESTING: activation targets are matched by suffix, `code` exactly; a child `POST` writes no draft message, a `PATCH` does; messages of a failed activation stay until the element is touched.
- TESTING: OPA5 against `npx cds serve --in-memory --port 4004`, never `cds watch`; journeys restore seeded values and leave no draft.
- Protocol section 3: fiori-mcp `search_docs` is down (embeddings) on 2026-10-12; the UI5 facts come from the 1.153.0 CDN debug sources, marked "not verified by MCP"; step 7 proves them in the browser.

## Open questions
None.
