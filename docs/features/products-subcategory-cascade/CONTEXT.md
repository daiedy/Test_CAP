# products-subcategory-cascade: context

Date: 2026-10-10. Author: `architect`. Branch: `feature/products-subcategory-cascade`.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens are in `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts are in `research/framework-facts.md`.

## Request
The user (plain description, no GitHub issue): "The subcategory must be disabled while no category is selected. If the category changes, the subcategory is cleared and disabled." At the plan gate the user added: "check whether both fields are mandatory, they must be mandatory", so Category and Subcategory are both mandatory. It builds on `products-subcategories` (#8, ADR-0024): the subcategory dropdown lists only the subcategories of the product's category, and a draft category change already empties a subcategory of another category (`resetStaleSubcategory` plus `Common.SideEffects #CategoryChanged`). New: on the Object Page (create mode, opened by Create on the List Report, and edit mode) Subcategory is disabled while the category is empty and mandatory once a category is chosen; on the server `subcategory` becomes `@mandatory`, so no saved product, from any path, lacks a category or a subcategory or holds a subcategory of another category.

## User decisions
Answered at the plan gate on 2026-10-10:
- D1 = A: a category change clears the subcategory; Subcategory is disabled only while the category is empty and enabled again as soon as a category is chosen.
- D2 = A: the disabled state is `Common.FieldControl` 0 (a disabled input), no hint text (SCREENS Q2 = A); SCREENS Q3 = A.
- D3 = A: no new server rule for the disabled state beyond what the mandatory requirement needs.
- D4 = A: an active write that changes the category keeps being rejected unless it carries a subcategory of the new category (ADR-0024 decision 3 as accepted).
- D5 = A: `@odata.draft.enabled` on `CatalogService.Products` stays as it is (ADR-0012).
- D6: ADR-0025 accepted.
- New requirement: Category and Subcategory are both mandatory. Category already is (`@mandatory`); Subcategory gets `@mandatory` in `srv/annotations/Products.cds` (invariant 5) and the UI expression becomes `(category.code is null ? 0 : 7)`. Facts checked: all 15 seeded products in `db/data/my.catalog-Products.csv` and all 15 mock products in `app/products/webapp/localService/mockdata/Products.json` have a subcategory.
- D7 = A (answered 2026-10-10, before phase 2): the import workbook gets a mandatory `subcategory` column (subcategory code); a row with an empty subcategory or a subcategory of another category is reported for its row; `README.md` and the workbook fixtures are updated.

## Affected entities and services
Result of `mcp__cds-mcp__search_model` (`CatalogService.Products`), `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md` and the scratch runs of `research/framework-facts.md` sections 5 and 7:

| Object | Exists now | What changes |
|---|---|---|
| `srv/annotations/Products.cds`, `CatalogService.Products.subcategory` | `@assert.target`, `@assert` constraint `PRODUCTS_SUBCATEGORY_MISMATCH`, optional | `@mandatory` (phase 2): active create or update without a subcategory and `draftActivate` without one answer 400 `ASSERT_MANDATORY` (`subcategory_code`, `in/subcategory_code` on activation); the constraint stays unchanged; EDMX +1 line (static `FieldControlType/Mandatory`, 875 lines) |
| `app/products/annotations/Products.cds`, `subcategory @(...)` | Text, TextArrangement, ValueListWithFixedValues, hand-written ValueList | `Common.FieldControl: (category.code is null ? 0 : 7)` (phase 3, ADR-0025): disabled while the category is empty, mandatory marker once enabled; it replaces the static `Mandatory` in EDMX, the server keeps enforcing `@mandatory`; 884 lines (+10 against 874, +10 -1 against phase 2) |
| `resetStaleSubcategory` (`srv/catalog-service.js`, `before('PATCH', Products.drafts)`) | clears a stored subcategory of another category on a draft category change, also on `category_code: null` | unchanged; measured with `@mandatory`: the reset writes no draft message (`DraftMessages` stays `[]`), the empty subcategory is reported at `draftActivate` |
| `importProducts` (`srv/catalog-service.js`, `srv/lib/products-import.js`) | columns `name`, `description`, `price`, `currency`, `stock`, `category`, `rating`, `imageUrl`; `validationErrors` maps only `ASSERT_*` codes to rows | measured: with `@mandatory` every row of a valid workbook fails with `Row N, column "subcategory_code": Provide the missing value.`; D7 = A adds a mandatory `subcategory` column (`IMPORT_COLUMNS`, `MANDATORY_COLUMNS`), lets `validationErrors` map `PRODUCTS_SUBCATEGORY_MISMATCH` to a row, updates `README.md` |
| `test/catalog-service.test.js` (66) | `newProduct` payload without a subcategory, used by the create, validation, draft and authorization tests; "creates a product without a subcategory" | `newProduct` gets `subcategory_code: 'LIGHTING'` (a Furniture subcategory); "creates a product without a subcategory" becomes "rejects a product without a subcategory (@mandatory)"; +7 tests (73); a draft test whose activation now also misses the subcategory adapts its expectation |
| `test/fixtures/build-workbooks.mjs`, `products-import-{valid,invalid}.xlsx`, `test/products-import.test.js` (20) | header without `subcategory` | D7 = A: `subcategory` column in `HEADER`, `VALID_ROWS`, `INVALID_ROWS`, fixtures regenerated; the mandatory-column expectations count 6 |
| `test/metadata.test.js` (11) | `annotationsOf(compact, target)` | +1 contract test for the FieldControl expression (12) |
| OPA5 `SubcategoryDependsOnCategoryJourney.js`, `EditCategoryOnObjectPageJourney.js`, `pages/ObjectPageForm.js` | "In edit mode ..." asserts `{ required: false }`; "Saving shows the new name ..." saves Furniture with an empty subcategory | +3 `opaTest`s (create mode, category chosen, category emptied); `{ required: true }`; the category journey picks a Furniture subcategory before Save |

Editing surfaces (`manifest.json`): only the Object Page form; no inline edit, mass edit, creation row or creation dialog. Display surfaces (List Report column, display mode, "Adapt Filters") are not affected by a FieldControl.

## What already exists and is reused
- `resetStaleSubcategory`: the server-side clearing for every draft path, UI or API, including an emptied category; reused unchanged, a second `PATCH Products.drafts` handler is a duplicate.
- `@mandatory` (already on `category`) and the `@assert` constraint: the declarative server guarantees; `subcategory` gets the same `@mandatory`, no handler.
- `Common.SideEffects #CategoryChanged` and the hand-written `Common.ValueList` with the `category_code` In parameter: unchanged; a second side effect or ValueList on `subcategory_code` is a review error.
- `importProducts` row mapping (`columnOf`, `validationErrors`, `PRODUCTS_IMPORT_ROW_INVALID`, `PRODUCTS_IMPORT_MISSING_COLUMN`): extended for the new column, no new message key.
- Test helpers `active()`, `activeKey()`, `draftKey()`, `readDraft()`, `messageCodes()`, `named()`, `without()`; `annotationsOf()`; workbook helpers `workbook()`, `fileParameter()`, `generatedRow()`.
- OPA5 helpers `chooseCategory`, `chooseSubcategory`, `seeSavedPair`; page objects `ObjectPageForm` (`iSeeFormFieldEmpty`, never `iCheckField(field, '')`) and `CategoryDropdown`; test data `data/CategoryTexts`, `data/SubcategoryTexts`.
- No new i18n key: the disabled state needs no text (D2), `ASSERT_MANDATORY` is the framework's message.

## Applicable patterns
- "Field editable only when another field is filled": ADR-0025 (accepted 2026-10-10); the PATTERNS row is added in phase 6.
- "Mandatory field" (`@mandatory` in `srv/annotations/<Entity>.cds`).
- "Dependent field reset on a draft" and "Cross-field consistency check" (ADR-0024): unchanged.
- "Bulk create from a file" and "Business logic error" (ADR-0021): the import column and the row mapping of a project message key.
- "Drafts" (ADR-0012), "OData contract", "metadata.xml snapshot update": the model changes in phase 2 and phase 3, each regenerates the snapshot and `metadata.xml` in its own phase.
- "Service test" (ADR-0002, ADR-0012 draft idiom) and "User scenario" (OPA5 on `sap.fe.test`).

## Relevant lessons
- LESSONS 2026-10-09 (pending): a rendering claim needs a measurement; the disabled and required rendering is source-read from UI5 1.153.0 and confirmed by OPA5 and `ui-verifier`.
- LESSONS 2026-10-09 (pending): in a worktree the Bash guard refuses compound commands; run plain commands or a `node <file>` script.
- PATTERNS "Cross-field consistency check": an `@assert` draft message shows on the next `GET`; `@mandatory` writes none on a draft `PATCH` (measured), it fails at `draftActivate`.
- TESTING: `onForm().iCheckField(field, '')` passes for any value; an empty field is asserted with `iSeeFormFieldEmpty`.
- PATTERNS "User scenario": commit a field before `iExecuteCancel`; journeys leave no draft; OPA5 runs against `cds serve`, never `cds watch`.

## Open questions
None: D1-D7 are answered (see "User decisions").
