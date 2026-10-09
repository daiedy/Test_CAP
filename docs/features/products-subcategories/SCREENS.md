# products-subcategories: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task: "give a product a subcategory of its category" on the existing Object Page; the List Report only displays it. Designed against PLAN.md with the recommended defaults D1-D4 and ADR-0024 (proposed); deviations are listed under "Open for the plan gate", PLAN.md is not changed.

## Floorplan and duplication check
- Floorplan: the existing List Report + Object Page of `app/products` (`docs/registry/UI-ARTIFACTS.md`: targets `ProductsList`, `ProductsObjectPage`). No new page, fragment, extension, controller or manifest change. Form guidance: https://experience.sap.com/fiori-design-web/form/ and https://experience.sap.com/fiori-design-web/object-page/#forms (both from `mcp__fiori-mcp__search_docs`, "Grouping Fields with UI.FieldGroup and UI.ConnectedFields").
- Reused: the `category` presentation block (`Common.Text`, `#TextOnly`, `ValueListWithFixedValues`) in `app/products/annotations/Products.cds`, `app/products/annotations/Categories.cds` as the shape of `Subcategories.cds`, the OPA page object `pages/CategoryDropdown.js` and `data/CategoryTexts.js` as the shape of `data/SubcategoryTexts.js`.
- Not in scope (D3): a Subcategory filter field in `UI.SelectionFields`; it is a follow-up issue (dependent filter value help with multi-value In conditions).

## Screen: Object Page, section General Information
- Title and subtitle: unchanged. Header title = product name, header description = category name (D3); the subcategory is not in the header.
- Filters: none (Object Page).
- Field order in `UI.FieldGroup #GeneralInfo` (one form container, read top to bottom): Product Name, Description, Category, **Subcategory**, Rating, Image URL. Subcategory directly after Category so the dependent field is the next field in tab and reading order (form guideline above).
- Control: the Fiori elements fixed-values dropdown (typeahead popover with one name per row), the same control as Category ("Value Help as a Dropdown or Radio Button List"; ADR-0011 part 2). Radio buttons are excluded: "Radio buttons must not be used for value lists with dependencies defined by ... ValueListParameterIn" (same document).
- Label: `{i18n>Products.subcategory}` from `@title`, no `Label` on the `DataField` (rule: label equals `@title`). Not marked required (D2: no `@mandatory`, no asterisk); Category keeps its asterisk.
- What is shown instead of the code: the localized name only, `Common.Text: subcategory.name` + `#TextOnly` on `Products.subcategory`, and `Common.Text: name` + `#TextOnly` on `Subcategories.code` so dropdown rows show names ("Text and Text Arrangement", step "Showing only the Text"). The code (`LAPTOPS`) never appears on screen.
- Item order in the dropdown: the framework's order ("sorting for dropdowns follow[s] the Value Help Dialog logic", same document; the reproduced request in `research/scratch-experiment.md` section 3 uses `$orderby=code`), so not alphabetical by the localized name in `ru` (ADR-0011 known limitation). Not asserted.
- Actions: none new. Edit, Save, Cancel, Discard Draft are the standard draft actions (ADR-0012), hidden for non-editors (ADR-0013).
- Criticality and statuses: none.

### States of the Subcategory field

| # | State | Trigger | What the user sees | Source |
|---|---|---|---|---|
| S1 | Display, value set | display mode | the name, e.g. "Laptops", as read-only text | "Text and Text Arrangement" |
| S2 | Display, empty | product without subcategory (imported, or saved after a reset) | the framework's standard empty rendering, no custom placeholder text | expected, not verified: `ui-verifier` V10 |
| S3 | Edit, category set | Edit on an existing product | dropdown with the current name; opening it lists only the subcategories of the category (Electronics: Audio, Laptops, Mice); the value help request carries `$filter=category_code eq '<code>'` | "In/Out Mappings in the Common.ValueList Annotation", steps 5 and 10; `research/framework-facts.md` section 4 |
| S4 | Edit, category empty | Create, or the user clears the Category text | dropdown lists all 15 names, no category context per row; no In condition for an empty value | `research/framework-facts.md` section 4; PLAN "Risks" last row |
| S5 | Edit, category changed | user picks another category | right after the category PATCH the Subcategory field becomes empty: no message, no dialog, no reload, focus stays where the user put it; opening the dropdown now lists the new category's subcategories (Furniture: Seating, Lighting, Desk Organization) | "Side Effects", step 1 "the side effect request is sent immediately after the property was changed"; ADR-0024 decision 3 |
| S6 | Edit, category set to the one of an already chosen subcategory | only reachable from S4 (subcategory picked first) | the subcategory is kept | ADR-0024 decision 3; see "Open for the plan gate" item 1 for the message that may appear in S4 |
| S7 | Mismatch at Save | under D4 only through the API or the S4 path of plan-gate item 1 | Save fails, the page stays in edit mode with the draft; the error "The subcategory does not belong to the category of the product." is shown in the message popover (footer message button with the error count) and the Subcategory field gets the error value state; the user fixes it by choosing from the narrowed dropdown or clearing the field | "Using Messages in SAP Fiori Elements", steps 2 and 8 (bound messages in edit mode: message popover, navigation to the field); exact rendering of an activation 400 not measured: `ui-verifier` V5 |
| S8 | Read-only user | CatalogViewer | no Edit button (`UI.UpdateHidden`), field as S1/S2 | ADR-0013 |

If the user overrides D4 with "reject at Save": in S5 the old name stays visible while the dropdown already lists the new category, nothing tells the user until Save, and S7 becomes the main path (PLAN "Overrides" lists the OPA changes).

## Screen: List Report, products table
- Title and subtitle: unchanged.
- Filters: unchanged, Product Name, Category, Price, Rating (4 of 5). No Subcategory filter (D3). The property is still offered in "Adapt Filters" (V4 lists main-entity properties there, "Adapting the Filter Bar (SAP Fiori Elements, V2 and V4)" step 2): see "Open for the plan gate" item 3.
- Columns in order (6 of 7): Product Name, Category, **Subcategory**, Price, Stock Quantity, Rating. Header "Subcategory" from `@title`, cell = name (`#TextOnly`). No `UI.Importance` on the new column, same as Category: on narrow screens Rating (Low) moves to the pop-in first, Subcategory with the None/Medium group second (UI5 API `sap.m.Table#autoPopinMode`; "Table Columns - Add, Configure, and Annotation Behavior" step 4: Importance defaults to None).
- Actions: unchanged (Create, Delete, Import from Excel, all editor-only).
- Empty state and errors: no new empty state; a product without subcategory shows the framework's standard empty cell (expected, not verified).
- Sorting by the column sorts by `code`, not by the localized name (ADR-0011 known limitation).

## Texts
Keys live in the root `_i18n` bundles (labels via `@title`, messages via `messages*.properties`), written by `cap-backend-dev` in phase 2 (PLAN step 2). The values below are the design proposal; backend roles do not read this file, so the orchestrator copies the `ru` wording into PLAN step 2 at the gate if the user wants it fixed. `test-ui` takes asserted values from the bundles as written. `ru` values are given as code points with a transliteration; the bundles hold the plain words, `data/SubcategoryTexts.js` holds backslash-u escapes (convention of `data/CategoryTexts.js`).

| Key | en | ru |
|---|---|---|
| `Products.subcategory` | Subcategory | U+041F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+044F (Podkategoriya) |
| `Subcategories.code` | Subcategory | same as `Products.subcategory` |
| `Subcategories.name` | Subcategory Name | U+041D U+0430 U+0437 U+0432 U+0430 U+043D U+0438 U+0435, U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438 (Nazvanie podkategorii) |
| `Subcategories.descr` | Subcategory Description | U+041E U+043F U+0438 U+0441 U+0430 U+043D U+0438 U+0435, then the second word of `Subcategories.name` (Opisanie podkategorii) |
| `Subcategories.category` | Category | same as the existing `Products.category` ru value (Kategoriya) |
| `PRODUCTS_SUBCATEGORY_MISMATCH` (messages) | The subcategory does not belong to the category of the product. | Podkategoriya ne otnositsya k kategorii tovara. Words: the `Products.subcategory` value; U+043D U+0435; U+043E U+0442 U+043D U+043E U+0441 U+0438 U+0442 U+0441 U+044F; U+043A; U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438; U+0442 U+043E U+0432 U+0430 U+0440 U+0430; full stop |

The pattern mirrors `Categories.code`/`.name`/`.descr`. No `webapp/i18n` key is needed (no manifest, fragment or extension text).

## Accessibility
Checklist of the `ui5-best-practices-accessibility` skill (eight topics); the `fiori-mcp` snapshot has no List Report / Object Page accessibility document, so the verdicts rest on the skill and the UI5 API.
1. Landmarks: unchanged, provided by the Fiori elements templates.
2. Labeling: the form label and the column header come from `@title` through the framework's FormElement and column; the dropdown popover is labelled by the framework. No icon-only control, image or custom input is added.
3. Heading levels: no new heading; the section title "General Information" stays.
4. Focus and keyboard: tab order Category, then Subcategory. Standard keyboard of the Fiori elements value help field (open with F4 or Alt+Down, arrows, Enter selects, Escape closes without change, typing narrows the list): expected, not customized, checked by `ui-verifier` V7. The reset (S5) does not move focus.
5. Keyboard shortcuts: none added.
6. Invisible messaging: the reset in S5 changes a field the user did not touch and is not announced to screen reader users. See "Open for the plan gate" item 2. The S7 error goes through the framework message model (message button, value state), no app code.
7. Reading order: DOM order equals visual order; the emptied Subcategory is the next field a keyboard or screen reader user reaches after Category, which is the mitigation for item 6.
8. Target size: no Link, ObjectStatus or ObjectIdentifier added.

## Theme and tokens
Standard Fiori elements controls, `sap_horizon`, no CSS, no custom colors, no extension. `mcp__ui5-mcp-server__get_guidelines` has no theming rule beyond data binding and no globals; nothing here needs an ADR.

## OPA5 selectors and labels
For `test-ui` (PLAN steps 9-10). "Probe" means the id pattern is inferred from the Category equivalent and is confirmed on the running app before the assertion is relied on.

| Purpose | Call or selector |
|---|---|
| Form | `onForm({ section: 'GeneralInfo' })` |
| Field | `{ property: 'subcategory_code' }` (the foreign key, never the association) |
| List Report column | `onTable().iCheckColumns(undefined, { subcategory_code: { header: 'Subcategory' } })` |
| List Report rows | `onTable().iCheckRows({ name: 'Laptop Pro 15', category_code: 'Electronics', subcategory_code: 'Laptops' }, 1)`; `iCheckRows({ subcategory_code: 'Audio' }, 2)` (Bluetooth Speaker, Wireless Earbuds) |
| Open the dropdown | `onForm(generalInfo).iOpenValueHelp({ property: 'subcategory_code' })` |
| Dropdown control | `sap.m.Table`, id `/subcategory_code::Popover::.*SuggestTable$/`, `isDialogElement(true)`, rows `sap.m.ColumnListItem` (probe). `pages/CategoryDropdown.js` hardcodes `category_code` in `DROPDOWN_TABLE_ID` and in its descriptions: make the property a parameter instead of copying the file |
| Items, Electronics | `['Audio', 'Laptops', 'Mice']` (order-independent compare, as `iSeeItems` does) |
| Items, Furniture | `['Seating', 'Lighting', 'Desk Organization']` |
| Empty after the reset | `iCheckField({ property: 'subcategory_code' }, '')` (probe: if the field builder compares `null` with `''`, assert the empty inner input with `OpaBuilder` instead) |
| Not required | `iCheckField(subcategoryField, 'Laptops', { required: false })` in edit mode (optional; drop if the state matcher rejects `false`) |
| Saved pair | `iSeeObjectPageInDisplayMode()`, `iCheckField(subcategoryField, 'Desk Organization')`, `iCheckField({ property: 'category_code' }, 'Furniture')`, `onHeader().iCheckTitle('Laptop Pro 15', 'Furniture')` |
| ru label | List Report: `iCheckColumns(undefined, { subcategory_code: { header: <ru Products.subcategory> } })`; Object Page: `OpaBuilder` on `sap.m.Label` with that text inside the form element whose id ends with `FormElement::DataField::subcategory_code` (probe) |
| ru name | Coffee Maker (KITCHEN): `iCheckField(subcategoryField, <ru name of APPLIANCES from my.catalog-Subcategories.texts.csv>)` |

Journey `SubcategoryDependsOnCategoryJourney` (5 cases + teardown), on Laptop Pro 15:
1. "The List Report shows the subcategory by name": column header and the two row checks above.
2. "In edit mode the subcategory dropdown lists only the subcategories of the category": press the row, Edit, field shows "Laptops", open the dropdown, Electronics items, close it by selecting "Laptops" again (no value change).
3. "Changing the category empties the subcategory and narrows the list": choose "Furniture" in the Category dropdown, Subcategory empty, open the Subcategory dropdown, Furniture items, select "Desk Organization" (a two-word name), field shows it.
4. "Saving shows the new subcategory by name": Save, saved-pair checks.
5. "Restoring the original pair leaves the data as seeded": Edit, choose "Electronics", Subcategory empty, select "Laptops", Save, display shows Electronics and Laptops; no draft left.

`EditCategoryOnObjectPageJourney`: after its Furniture save Laptop Pro 15 has an empty subcategory (S5 then Save); its restore case selects "Laptops" in the Subcategory dropdown after "Electronics" and asserts it in display mode. `RussianLocaleJourney`: one case "The Object Page shows the subcategory in Russian" on Coffee Maker (label and name rows above).

## Verifier scenarios
In addition to the PLAN criteria; `en` and `ru` (`sap-ui-language=ru`) unless stated; every draft opened here is discarded.
- V1 (editor) Laptop Pro 15, Edit: Subcategory dropdown shows Audio, Laptops, Mice; screenshot; the value help `$batch` contains the Subcategories GET with `$filter=category_code eq 'ELECTRONICS'`.
- V2 (editor) change Category to Furniture: Subcategory empties without reload, message or dialog; `$batch` shows the side-effect GET of `subcategory_code` and `subcategory/name`; the dropdown lists Seating, Lighting, Desk Organization; screenshots before and after. Also pick Furniture and immediately a subcategory with the keyboard: the chosen value must survive the side-effect read.
- V3 (editor) Create: Category empty, the dropdown lists all 15; pick "Mice", then Category "Electronics": record whether an error appears on Subcategory after "Mice" and whether it stays after "Electronics" (plan-gate item 1); then Category "Furniture": Subcategory empties.
- V4 (editor) clear the Category text in edit mode: Subcategory empties; Save reports the mandatory Category (existing behavior).
- V5 S7 rendering, only if reachable in the UI (V3 path): message button, popover text, field value state, page stays in edit mode.
- V6 (viewer) Object Page: no Edit; Subcategory shows the name read-only. List Report: Subcategory column present.
- V7 keyboard: Tab from Category lands on Subcategory; F4 and Alt+Down open the list; arrows and Enter select; Escape closes without change; typing "La" narrows to Laptops.
- V8 List Report column order Name, Category, Subcategory, Price, Stock Quantity, Rating; at tablet width Rating pops in before Subcategory.
- V9 Adapt Filters: record whether Subcategory is offered and, if added, whether its dropdown narrows by the Category filter values (observation only, plan-gate item 3).
- V10 a product with an empty subcategory (V3 draft before saving, or a row after the OPA run if any): record the display and table rendering of the empty value.
- Console: no message that is new against the latest `VERIFICATION.md` on `main` (known noise: `initialLoad` boolean deprecation).

## UX risks

| Risk | How to notice |
|---|---|
| The dropdown ignores the In parameter (PLAN risk 1) | OPA case 2 red; V1 shows 15 items |
| The reset is not visible without reload (side-effect target wrong) | OPA case 3 red; V2 `$batch` has no GET of `subcategory_code` |
| A false mismatch error in S4 that stays after the matching category is chosen | V3; plan-gate item 1 |
| The silent reset goes unnoticed, especially with a screen reader | V2 and V7; plan-gate item 2 |
| A side-effect read arriving after a fast subcategory pick overwrites it with empty | V2 second half |
| Subcategory reachable as an untested filter via Adapt Filters | V9; plan-gate item 3 |
| In S4 the 15 names carry no category context, so a user may pick one that the next category choice clears | V3; accepted: Category comes first in the form and is mandatory |

## Open for the plan gate
None of the architect's defaults contradicts a Fiori design guideline found in the snapshot (dropdown for a fixed list, In parameter, TextOnly, field order, optional field, column without filter). Three design consequences need a decision:
1. **False mismatch on an empty category (D2 + ADR-0024 decision 2).** The constraint guards only `subcategory.code is not null`; with an empty category CQL `!=` is true for any subcategory (`research/scratch-experiment.md` section 2), so picking a subcategory before the category (S4, the dropdown lists all 15) records `PRODUCTS_SUBCATEGORY_MISMATCH` on the field, a message that names a category the product does not have yet. When the matching category is then chosen, the reset keeps the subcategory but the category PATCH does not touch `subcategory_code`, so under `assert_touched_only` the message probably stays while Save succeeds (inferred from section 3 of the same file, not measured). "Using Messages in SAP Fiori Elements" step 2: after the user edits, the backend "must revalidate changed fields and add/remove state messages". Option A (recommended): extend the guard with `and category.code is not null` in PLAN step 2; the empty category is then reported only by the existing mandatory check at Save, and the active-write behavior does not change (a subcategory without category already fails with `ASSERT_MANDATORY`, section 3). Option B: keep the expression and record the behavior in V3.
2. **Silent reset (D4) versus accessibility topic 6 (invisible messaging).** S5 clears a field the user did not touch, without a visible or announced message. Announcing it needs controller-extension code, which ADR-0024 rejects for the reset and the project avoids ("Fiori Elements by default"). Recommended: accept; the mitigation is the reading order (Subcategory is the next field after Category). Alternative: an extension with `InvisibleMessage`, a new ADR.
3. **"Adapt Filters" exposes Subcategory although D3 has no filter field.** The dependent filter value help is then usable without the test ADR-0024 decision 1 asks for. Recommended: accept and record V9 in `VERIFICATION.md`; the filter issue adds the test. Alternative: `UI.HiddenFilter` on `subcategory_code` until that issue.

## Open questions for the user
- Plan-gate items 1-3 above (recommended: A, accept, accept).
- The `ru` wording of the labels and of `PRODUCTS_SUBCATEGORY_MISMATCH` in "Texts": approve, or the backend chooses (PLAN step 2 does not fix it).
