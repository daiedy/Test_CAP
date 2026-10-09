# products-subcategories: context

Date: 2026-10-09. Author: `architect`. Branch: `feature/products-subcategories`. Issue: #8.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts are in `research/framework-facts.md` and `research/scratch-experiment.md`.

## Request
Object Page: a product gets a subcategory that depends on its category. A new code list `Subcategories` (each subcategory belongs to one category), `Products.subcategory` chosen from a dropdown that lists only the subcategories of the product's category, the server rejects a subcategory of another category, and the Object Page reacts when the category changes. Seed data for the existing categories and products, labels and messages in `en` and `ru`, tests on both layers, contract snapshot and `metadata.xml` regenerated.

## User decisions
Approved by the user on 2026-10-09 (`PLAN.md`, "Decisions for the user"): D1 the 15 subcategories and the seed assignment of every product; D2 the subcategory is optional; D3 a List Report column after Category, no filter field, header unchanged; D4 a subcategory of the old category is cleared on a draft category change; D6 ADR-0024 accepted; D7 the constraint also guards an empty category: `case when subcategory.code is not null and category.code is not null and subcategory.category.code != category.code then 'PRODUCTS_SUBCATEGORY_MISMATCH' end`; D8 the reset is silent, no controller code; D9 Subcategory stays available in "Adapt Filters" (no `UI.HiddenFilter`), `ui-verifier` records it as V9. The `ru` label and message wording from `SCREENS.md` "Texts" is fixed in PLAN step 2.

Fixed by existing decisions: `Products` stays draft-enabled (ADR-0012), the subcategory is edited inside the same draft, no draft change; codes `UPPER_SNAKE`, `String(20)` (ADR-0010); dropdown for a fixed code list without a maintenance screen (ADR-0011 part 2); `@restrict` and roles unchanged (ADR-0013): `Subcategories` is readable by any authenticated user like `Categories`.

## Affected entities and services
From `mcp__cds-mcp__search_model` (`Products`, `Categories`, `Subcategories`: no such definition yet) and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Object | Exists now | What changes |
|---|---|---|
| `my.catalog.Subcategories` | does not exist | new `: CodeList { key code : String(20); category : Association to Categories; }` in `db/schema.cds`; CSV `db/data/my.catalog-Subcategories.csv` (`code;name;category_code`) and `my.catalog-Subcategories.texts.csv` (`code;locale;name`, `ru` only) |
| `my.catalog.Products` | `name`, `description`, `price`, `currency`, `stock`, `rating`, `category`, `imageUrl` | add `subcategory : Association to Subcategories` (foreign key `subcategory_code`); `db/data/my.catalog-Products.csv` gets a `subcategory_code` column for all 15 rows |
| `CatalogService.Subcategories` | does not exist | `@readonly entity Subcategories as projection on catalog.Subcategories;` in `srv/catalog-service.cds`; labels in new `srv/annotations/Subcategories.cds` (referenced by a `using from` line like `Categories`) |
| `CatalogService.Products` | draft-enabled projection, `@restrict` Viewer/Editor, `importProducts` | `subcategory`: `@title`, `@assert.target`, `@assert: (case ...)` constraint in `srv/annotations/Products.cds`; no `@mandatory` (D2) |
| `srv/catalog-service.js` | `on READ Permissions`, `on importProducts` | add `before('PATCH', Products.drafts)` that clears a subcategory not belonging to the new category (D4, ADR-0024 decision 3) |
| `app/products/annotations/Products.cds` | `category` dropdown, `UI.FieldGroup #GeneralInfo`, `UI.LineItem` | `subcategory`: `Common.Text`, `#TextOnly`, `ValueListWithFixedValues`, hand-written `Common.ValueList` with `ValueListParameterIn` from `category_code`; `subcategory_code` after `category_code` in `#GeneralInfo` and in `UI.LineItem` (D3); `Common.SideEffects #CategoryChanged` (D4) |
| `app/products/annotations/Subcategories.cds` | does not exist | `code`: `Common.Text: name`, `#TextOnly` (ADR-0011); referenced from `app/products/annotations.cds` |
| `_i18n/*.properties` | 22 labels, 11 messages per language | labels `Products.subcategory`, `Subcategories.code`, `Subcategories.name`, `Subcategories.descr`, `Subcategories.category`; message `PRODUCTS_SUBCATEGORY_MISMATCH`; `en` and `ru` |
| `app/products/webapp/localService/` | `metadata.xml` 697 lines, mockdata for `Products`, `Categories`, `Categories_texts`, `Permissions` | `metadata.xml` regenerated in phases 2 and 3 (826 then 873 lines, `research/scratch-experiment.md` section 5); new `Subcategories.json`, `Subcategories_texts.json`; `subcategory_code` in `Products.json` |

## What already exists and is reused
- `Categories` code list (`db/schema.cds`, `srv/annotations/Categories.cds`, `app/products/annotations/Categories.cds`, both CSVs): the exact template for `Subcategories` in every layer.
- The `category` presentation block in `app/products/annotations/Products.cds` (`Text`, `#TextOnly`, `ValueListWithFixedValues`): copied for `subcategory`, plus the In parameter.
- `@assert.target` (as on `category`, `currency`) and the framework's `ASSERT_TARGET` message; the new consistency rule is an `@assert` constraint, no handler (`research/framework-facts.md` section 1).
- `srv/catalog-service.js` class and `init()` order; `docs/registry/HANDLERS.md` has no `PATCH`/`UPDATE` handler on `Products`, so the reset handler is new and the only one for that event.
- Tests: helpers `active()`, `activeKey()`, `draftKey()`, `as()` and the draft `describe` in `test/catalog-service.test.js`; the compact-EDMX idiom of `test/metadata.test.js`.
- OPA5: `pages/CategoryDropdown.js` (select an item, list items of an open dropdown), `data/CategoryTexts.js` (en/ru names) as the shape for `data/SubcategoryTexts.js`, `EditCategoryOnObjectPageJourney.js` as the edit-flow reference.
- `srv/lib/products-import.js`: not touched; the import keeps its documented columns, imported products get no subcategory (D2).
- Nothing suitable exists for a dependent value help or a field reset on a draft: ADR-0024 (accepted 2026-10-09).

## Applicable patterns
- "Code list with selection from a list" (ADR-0003, ADR-0010) for `Subcategories`; "Reference to another entity" for `Products.subcategory` and `Subcategories.category`; "Translatable data texts" for the CSVs.
- "Association target existence check" (`@assert.target`); "Read-only" (`@readonly` projection).
- "Value help from a code list" (ADR-0011) for `Common.Text`/`#TextOnly`/`ValueListWithFixedValues` and for `Subcategories.code`; the hand-written ValueList with an In parameter is the ADR-0011 part 1 exception in the shape of ADR-0024 decision 1 (accepted; PATTERNS row "Dependent value help" added by `docs-keeper` in step 13).
- Consistency between two fields: ADR-0024 decision 2 (accepted; PATTERNS row "Cross-field consistency check", step 13).
- Reset of a dependent field on a draft: ADR-0024 decision 3 (accepted; PATTERNS row "Dependent field reset on a draft", step 13); "Refresh after an action" covers SideEffects only for actions.
- "Table columns, filters, header, sections" for `#GeneralInfo` and `UI.LineItem`; "Drafts" (unchanged); "Service test", "OData contract", "User scenario"; "metadata.xml snapshot update"; "Texts".

## Relevant lessons
- `docs/LESSONS.md` has no pending entry for this area. Pending upstream entries do not apply (the mismatch is a single top-level error, not a collected `details[]` list).
- TESTING "cds 10 specifics": a `POST` without `IsActiveEntity: true` creates a draft and skips checks; activation targets are prefixed `in/`; `DraftMessages` is read with a `GET`, not from the PATCH response; OPA5 runs need a fresh server and leave no draft behind.
- Agent memory `cds-add-data-localized`: `cds add data` writes comma CSV with random locales; normalize to `;` and `ru` only.

## Open questions
None: D1-D9 and ADR-0024 were approved on 2026-10-09. The protected `.claude/rules/ui-annotations.md` sentence for the ADR-0024 exception waits for a user-started session and does not block implementation.
