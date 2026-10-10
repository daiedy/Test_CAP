# products-subcategory-cascade: verification

Date: 2026-10-10. Agent: `ui-verifier`. Server: `npx cds serve --in-memory --port 4004` from the worktree (port was free), UI `http://localhost:4004/products/webapp/test/flpSandbox.html?sap-ui-log-level=WARNING`, Basic Auth priming for `alice` (editor), viewport 1600x1000, Chrome 155.

Screenshot note: the Chrome DevTools MCP `filePath` argument was rejected for this worktree ("not within any of the configured workspace roots"), so screenshots were taken inline and copied from the MCP result path into `screenshots/` with `cp`; contents are identical.

## Automated tests
Run by `docs-keeper` in phase 6 and by `reviewer` (REVIEW.md "Checked and in order" and "Re-review"):
```
npm test
 Test Files  11 passed (11)
      Tests  173 passed (173)
   (test/catalog-service.test.js 75, test/products-import.test.js 20, test/metadata.test.js 12)
```
```
npm run test:ui (reviewer, ui5-test-runner against npx cds serve --in-memory --port 4013)
 52 passed (50 opaTest + 2 QUnit), runner exit 0
npm run lint (app/products, ui5lint): Success! No findings detected.
npm run lint:js (app/products): 0 errors, 1 pre-existing warning (Component.js:14, keyboard hack)
```

## Manual scenario check
| # | Scenario | Result | Evidence |
|---|---|---|---|
| Home | `#Shell-home` | not re-checked this run (unchanged shell); entry through `#products-display` worked, list shows 15 products | `screenshots/01-list-en.png` |
| V1 en | Create on the List Report | passed: Category has the asterisk; Subcategory label visible, input `disabled=true`, no `aria-required`, no asterisk; a11y snapshot: `combobox "Subcategory" disabled` (V9 S1 part) | `screenshots/02-v1-create-disabled-en.png` |
| V2 en | Click, F4, Alt+Down on disabled Subcategory | passed with a limit: the MCP click on the disabled combobox times out ("did not become interactive"), `focus()` does not take it, F4 and Alt+Down with focus elsewhere opened nothing; no new request was recorded (request list stayed at 45 entries). A real mouse click on the greyed input was not possible with this tool | none |
| V3 en | Category by keyboard (F4, ArrowDown, Enter), Tab | passed: Category "Electronics", Subcategory becomes enabled with `aria-required=true`, focus lands on Subcategory after Tab; F4 lists Audio, Laptops, Mice only. No `Subcategories` request before the category was chosen | `screenshots/03-v3-category-chosen-dropdown-en.jpg` |
| V4 en | Type category, Tab (R1) | recorded: typing the full name "Furniture" then Tab leaves focus on Rating (Subcategory skipped once), Subcategory is enabled afterwards, Shift+Tab reaches Subcategory. Typing the partial text "Furn" does not complete to Furniture through the MCP (value stays "Furn", Category invalid, Subcategory stays disabled) | none |
| V7 en (create, category set, no subcategory) | Fill name, price, currency, stock, Category Electronics, press Create | message popover opens by itself with one entry: "Provide the missing value." / "Subcategory"; the Subcategory field gets the red error state; footer button shows 1 error; page stays in the draft | `screenshots/04-v7a-save-category-set-no-subcat-en.jpg` |
| V6 (create variant) | In the same draft clear Category (End, Shift+Home, Backspace), Tab | passed for the state: Subcategory disabled again, no asterisk, empty; request `PATCH {"category_code":null}` plus the side-effect `GET ...$select=DraftMessages,subcategory_code&$expand=subcategory` in ONE `$batch` (reqid 155), both 2xx | `screenshots/05-v6a-create-category-cleared-stale-message-en.jpg` |
| V7 en (create, category empty) | Press Create | see Finding F1: popover "Messages" with three entries: "Multiple errors occurred, see details below." (general), "Provide the missing value." / "Subcategory", "Provide the missing value." / "Category"; message strip with the summary; Category red; Subcategory (disabled, no asterisk) carries a message but shows no red state | `screenshots/06-v7b-save-category-empty-popover-en.jpg` |
| V5 en | Edit Laptop Pro 15, Category Electronics to Furniture (F4, ArrowDown, Enter) | passed: before the change Subcategory is enabled, `aria-required=true`, value Laptops (a11y name "Subcategory:*" in edit mode); after: Category Furniture, Subcategory empty, enabled, required; header subtitle became Furniture. One `$batch` (reqid 168): `PATCH Products(...IsActiveEntity=false) {"category_code":"FURNITURE"}` then `GET Products(...)?$select=DraftMessages,subcategory_code&$expand=subcategory($select=code,name)` returned `subcategory_code:null`, `DraftMessages:[]` (204 and 200). Dropdown content for the new category not re-opened here (covered by V3 for Electronics and the earlier feature) | `screenshots/07-v5-edit-category-changed-en.jpg` |
| V7 en (edit, category set, no subcategory) | In the V5 draft press Save | message popover opens by itself: ONE entry "Provide the missing value." / "Subcategory"; Subcategory red and enabled; footer 1 error. This is the useful message (field is enabled and required) | `screenshots/08-v7c-edit-save-category-set-no-subcat-en.jpg` |
| V6 en (edit) | Same draft, clear Category (End, Shift+Home, Backspace, Tab) | passed for the state: Category empty, Subcategory empty and disabled (`disabled=true`, no asterisk), polled 4 times over 1.2 s: never shows a value. R2 (old name flashing) NOT observable here because the V5 step had already emptied the subcategory; footer still shows 1 stale error (Subcategory message from the V7c Save) | `screenshots/09-v6-edit-category-cleared-en.jpg` |
| V7 en (edit, category empty) | Save | same as the create variant, see F1: three entries (summary, Subcategory, Category); Category red; Subcategory disabled with no red state | `screenshots/10-v7d-edit-save-category-empty-en.jpg` |
| V7 cleanup | Discard Draft, then `GET Products?$filter=name eq 'Laptop Pro 15'` | passed: Laptop Pro 15 is `ELECTRONICS` / `LAPTOPS` as seeded; 0 drafts left | curl output |
| V8 viewer | `viewer` (own isolated context) opens Laptop Pro 15 | passed: Object Page in display mode, "Subcategory: Laptops" as plain text, 0 visible inputs, only the Share button (no Edit, no Delete) | `screenshots/12-v8-viewer-objectpage-en.jpg` |
| V8 alice display | `alice` Object Page of Laptop Pro 15 before Edit | passed: "Subcategory" / "Laptops" as text (a11y snapshot), Edit and Delete present | (snapshot text) |
| V8 Adapt Filters | List Report, Adapt Filters, Add Filter "Subcat", ArrowDown, Enter, F4, ArrowDown, Enter | passed: Subcategory filter is offered and renders as a multi-value combo box; the value "Audio" became a token. Dialog cancelled afterwards, nothing persisted | `screenshots/11-v8-adapt-filters-subcategory-en.jpg` |
| ru V1 | `?sap-ui-language=ru`, Создать | passed: labels "Категория:*", "Подкатегория:" (no asterisk), Subcategory combobox disabled | `screenshots/13-v1-create-disabled-ru.jpg` |
| ru V3 | Category Канцелярия by keyboard, Tab, F4 | passed: Subcategory enabled and required ("Подкатегория:*"), list "Блокноты", "Письменные принадлежности" | `screenshots/14-v3-category-chosen-dropdown-ru.jpg` |
| ru V7 | Создать with Category set, Subcategory empty | message popover localized: "Укажите недостающее значение." / "Подкатегория" (plus the other empty required fields of this unfilled draft), "Произошло несколько ошибок, подробности см. ниже." | `screenshots/15-v7-create-save-messages-ru.jpg` |
| ru V6 | Clear Category in the create draft | passed: Subcategory greyed and empty again | `screenshots/16-v6-create-category-cleared-ru.jpg` |
| ru V5 | Edit Laptop Pro 15, Category Электроника to Спорт (F4, ArrowUp, Enter) | passed: header subtitle "Спорт", Subcategory empty, enabled, "Подкатегория:*"; draft discarded (Сбросить) afterwards | `screenshots/17-v5-edit-category-changed-ru.jpg` |
| V9 S2 | a11y snapshot after the category is set | passed: `combobox "Subcategory"` not disabled, `required` | (snapshot text) |

Discard Draft of the VerifierTemp draft: done, no draft left (list returned).

## Import dialog (en)
Method note: the MCP `upload_file` rejected the worktree path (workspace roots), so the fixture was served from a throw-away local node server on :4010 (stopped), fetched in the page and set on the dialog's file input with `DataTransfer` plus a `change` event; the dialog then showed the file name and Tab, Enter on its "Import from Excel" button sent it. A first attempt with a hand-typed base64 copy was corrupted ("The file is not an Excel workbook", `PRODUCTS_IMPORT_NOT_XLSX`) and is not evidence.

| Scenario | Result | Evidence |
|---|---|---|
| `products-import-invalid.xlsx` | passed: nothing imported (active count stays 15). Error dialog lists: "No products were imported. Correct the rows listed below and import the file again."; Row 3 name "Provide the missing value."; Row 4 stock "Enter a value between 0 and 1000000."; Row 5 category "Target with this key doesn't exist."; Row 5 subcategory "The subcategory does not belong to the category of the product."; Row 6 price "Value abc is not a valid Decimal(15,2)"; Row 7 name duplicate "yoga MAT"; **Row 8, column "subcategory": Provide the missing value.**; **Row 9, column "subcategory": The subcategory does not belong to the category of the product.** Observation: row 5 has an unknown category and also gets a subcategory mismatch message (two messages for one cause); harmless, noted for the backend owner | `screenshots/18-import-invalid-en.jpg` (rows 3 to 7 visible; rows 8 and 9 read from the message list DOM text) |
| `products-import-valid.xlsx` | passed: Information dialog "Products imported: 3."; List Report count 15 to 18; imported rows carry subcategories (Import USB-C Hub Electronics/Laptops, Import Resistance Bands Sports/Fitness, Import Desk Organizer Stationery/Writing instruments); the three rows remain in the in-memory DB of the stopped server (no cleanup needed) | `screenshots/19-import-valid-en.jpg` |

## Findings
- F1 (to be assessed in the verdict): with an empty Category the activation reports `ASSERT_MANDATORY` for both Category and Subcategory. The Subcategory entry points at a field that is disabled and shows no required marker, and the field shows no error state, so the message cannot be acted on until a category is chosen. Also, a `Provide the missing value / Subcategory` draft message from an earlier failed Create stays in the popover after the category is cleared (`DraftMessages` of reqid 155 still contains `ASSERT_MANDATORY` on `subcategory_code`), and after a category is chosen again the error remains (footer "1 error") until the subcategory is picked and the draft revalidates.

## Network evidence (`$batch` request lines)
```
POST $batch [PATCH Products(...IsActiveEntity=false) {"category_code":"ELECTRONICS"}; GET Products(...)?$select=DraftMessages,subcategory_code&$expand=subcategory($select=code,name)] -> 204, 200 (one batch; create mode, reqid 145)
GET Subcategories?$select=category_code,code,name&$count=true&$orderby=name&$filter=category_code eq 'ELECTRONICS'&$skip=0&$top=100 -> 200 (3 rows; first Subcategories request of the session, only after the category was chosen; reqid 146)
POST $batch [PATCH {"category_code":null}; GET ...$select=DraftMessages,subcategory_code...] -> 204, 200; DraftMessages carries ASSERT_MANDATORY on subcategory_code (reqid 155)
POST $batch [PATCH {"category_code":"FURNITURE"}; GET ...] -> 204, 200; subcategory_code null, DraftMessages [] (edit mode, reqid 168)
POST $batch [POST Products/CatalogService.importProducts] invalid workbook -> 400 MULTIPLE_ERRORS (expected); valid workbook -> 200 "Products imported: 3."
```

## Browser console
Baseline: console section of `products-subcategories/VERIFICATION.md` at `4657c4c` (read on the ru Object Page load with `sap-ui-log-level=WARNING`). Known noise named there and seen again: `initialLoad` boolean deprecation, sandbox 404s (`/appconfig/fioriSandboxConfig.json`, `/sap/bc/lrep/flex/*`, `/sap/bc/ui2/flp;sap-metrics-only`), `Semantic Object not valid` for `Products('Laptop Pro 15')`, `Unknown qualified name Edm.String` on `Subcategories/code` and `/name` (4 messages) with `Binding not ready - template:if _VHUI>/tableAriaLabel`, once per opened value help. Not re-listed.

New against that baseline: errors 0 attributable to the feature (the only `[error]` entries are the known ushell `AddBookmarkButton` FUTURE FATAL deprecation and the 404 resource load). Warnings new in wording but not related to this feature, all from standard List Report or ushell startup and the Adapt Filters "Add Filter" list: `page stack is empty ...` (NavContainer, startup), `View is generated without a component`, `Unknown child EntitySet ... FilterDefaultValue`, `Invalid empty segment - /Products//Products/rating`, `$editState ... unsupported operators`, `[FUTURE FATAL] PropertyInfo validation is disabled` (filter bar and table), `Some of the Control's properties are missing. Can't build Symbol ID`, `Variant back reference not defined on the filter bar` (2), `Function call is not cancelable` (PersonalizationV2), `synchronous loading is deprecated` (ResourceModel), and 5x `setSelectedItem is called without valid ListItem parameter` (triggered by typing into the Adapt Filters "Add Filter" combo box with the MCP keyboard). None mentions `FieldControl`, `subcategory_code` dynamic control, `SideEffects` or the import dialog. Limit: the baseline file recorded only the Object Page load, so the List Report startup messages cannot be compared line by line; they are standard FE V4 startup noise, unrelated to this feature's code (no change in the filter bar, table or manifest). The Object Page loads (create, edit, viewer, ru) were not re-read for console after each navigation except the first en list and the final list load; Object Page warnings seen: only `Semantic Object not valid`.

Failed network requests (>= 400): the known sandbox 404s and the expected 400 of the invalid import; no `$batch` of the form scenarios returned >= 400.

## Assessment of F1 (message pointing at a disabled field)
What the popover shows: Save with an empty Category lists "Provide the missing value." for Category and for Subcategory (plus the summary), because both are `@mandatory` and both are empty; Subcategory is disabled, has no required marker and no red state, so its entry cannot be acted on until a category is chosen. With a category chosen and no subcategory the popover shows exactly one entry on the enabled, required, red Subcategory (the intended UX). A subcategory message that was raised earlier also stays in the footer count after the category is cleared; this is standard Fiori Elements draft-message behaviour (draft messages come from the server's last `DraftMessages` and are replaced on the next validation), no evidence otherwise.
Severity: low (cosmetic, no data effect, the user can fix it by filling Category, whose entry is shown right next to it). Owner: `fiori-app-dev` (message presentation) with `architect` deciding whether `@mandatory` on a field that is disabled by ADR-0025 should report at all; the server-side alternative (suppress the subcategory message while `category_code` is null) would be `cap-backend-dev` and contradicts the user's explicit requirement that both are mandatory. Does not block "ready for review"; recommend recording it in `SUMMARY.md` as a known behaviour and letting the user decide.

## Not covered
V2 mouse click on the disabled Subcategory (the MCP cannot click a disabled element; F4/Alt+Down with focus elsewhere only), V6 R2 flash (the subcategory was already empty in the edit run; in the create run no value existed), V4 partial-text typeahead (the MCP does not complete "Furn"), console reads for each separate navigation, ru console, V9 a11y snapshot for edit mode only (create S1 and S2 done), the Tab-skips-disabled check from Category with a real disabled state (confirmed through V4 only: after full typing + Tab the focus went to Rating).

## Verdict
Ready for review. Defects: none blocking. Findings for the user: F1 (low severity, see assessment), the row-5 double message in the import (two messages for an unknown category), and the Subcategory a11y name differing between create ("Subcategory") and edit ("Subcategory:*") mode, which is framework label rendering.
