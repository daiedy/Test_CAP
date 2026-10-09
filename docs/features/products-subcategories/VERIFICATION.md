# products-subcategories: verification

Date: 2026-10-09. Agent: `ui-verifier`. Server: fresh `npx cds serve --in-memory --port 4004` from the worktree; UI `http://localhost:4004/products/webapp/test/flpSandbox.html` (loaded with `sap-ui-log-level=WARNING`), user `alice` (CatalogEditor) via Basic Auth priming, viewport 1600x1000.

Baseline for the console: no `VERIFICATION.md` exists on `main` (only the template), so the baseline is the known noise named in the task (the `initialLoad` boolean deprecation) plus the known sandbox 404s.

Home page (`screenshots/00-home.png`): only the "Product Catalog" tile, no SAP demo tiles; the tile opens `#products-display`.

## Scenario status
| # | Scenario | Result | Screenshot |
|---|---|---|---|
| V1 en | Laptop Pro 15, Edit, open Subcategory dropdown | passed: lists Audio, Laptops, Mice only | `03-v1-dropdown-electronics-en.png` |
| V2 en | Category Electronics to Furniture | passed: Subcategory empty at once (no reload, no dialog, no message, header description became "Furniture"); dropdown then lists Desk Organization, Lighting, Seating; Furniture to Kitchen then Tab, F4, pick Cutlery: value survives the side-effect read (inputs read back `Kitchen` / `Cutlery`) | `04-v2-before-category-change-en.png`, `05-v2-after-category-change-en.png`, `06-v2-dropdown-furniture-en.jpeg`, `07-v2-kitchen-tab-f4-en.jpeg` |
| V4 | Clear Category text in edit mode | passed: PATCH `category_code:null` then GET of `subcategory_code`; Subcategory empties; Save keeps the page in edit mode and the message popover shows "Provide the missing value." for Category (existing behavior). Note: Cmd+A + Backspace through the MCP removed only one character ("Kitche", client-side invalid state, no PATCH); the field was cleared with repeated Backspace | `08-v4-category-cleared-en.jpeg`, `09-v4-save-mandatory-en.jpeg` |
| V3 | Create (editor) | passed: Category empty, Subcategory dropdown lists all 15 (blank row plus 15 names); picked "Mice" first: no message, no error state, no footer message button (D7 confirmed); then Category "Electronics": Mice kept, still no message; then Category "Furniture": Subcategory emptied. Typing "Mice" + Enter selects through the keyboard | `10-v3-create-all15-en.jpeg`, `11-v3-mice-first-en.jpeg`, `12-v3-then-electronics-en.jpeg`, `13-v3-then-furniture-en.jpeg` |
| V10 | Empty subcategory display | passed: after Create (name VerifierTemp, Furniture, no subcategory) the Object Page shows "-" (en dash) for Subcategory and for the other empty fields (Description, Image URL), same rendering as the framework standard; the row is deleted again at the end (see Cleanup) | `14-v10-empty-subcategory-display-en.jpeg` |
| V5 | Mismatch at Save | not reachable through the UI: the V3 path (Mice first, then Electronics) records no message (D7), and every category change either keeps a matching subcategory or empties it, so the dropdown cannot produce a mismatched pair; S7 rendering is covered by the backend tests only (draft message `in/subcategory_code`) | |
| V6 | viewer read-only | passed: List Report has the Subcategory column and no Create / Import from Excel / Delete buttons; Object Page of Laptop Pro 15 shows "Subcategory: Laptops" as plain text, no Edit and no Delete button (only Share), 0 visible inputs | `15-v6-viewer-list-en.jpeg`, `16-v6-viewer-objectpage-en.jpeg` |
| V7 | Keyboard | Tab from Category lands on Subcategory; F4 opens the list; ArrowDown+Enter selects; typing "Mice" + Enter selects (V3); Escape closes the list (V2). Alt+Down and typing a prefix such as "La" not exercised | `07-v2-kitchen-tab-f4-en.jpeg` |
| V8 | List Report column order, narrow widths | passed: order Product Name, Category, Subcategory, Price, Stock Quantity, Rating (header row of `01-list-report-en.png`, `18-v9-adapt-filters-en.jpeg`). Pop-in behind "Show Details" by viewport width (observation, viewer tab): 1700 and 1600 all six columns; 1500 Rating hidden; 1400 Rating and Stock Quantity hidden; 1300 Rating, Stock Quantity, Price hidden (Name, Category, Subcategory shown); 800 only Product Name shown. Rating pops in before Subcategory, as designed. No scenario broke | `17-v8-narrow-800-en.jpeg` |
| V8 re-check (UI.Importance #Low) | List Report column pop-in order after review fix (uncommitted `UI.Importance #Low` on Subcategory), fresh server on :4006, editor `alice`, `en` | passed: pop-in order is Rating, Subcategory, Stock Quantity, Price, Category; Product Name never. Visible columns by viewport width in the table below. Supersedes the earlier V8 row on the order (there Subcategory stayed before Price/Stock Quantity at 1300 because it had no Importance) | `19-v8-recheck-1400-en.png`, `20-v8-recheck-1300-en.png` |
| V9 | Adapt Filters (observation, D9) | Subcategory IS offered in the "Add Filter" list of "Adapt Filters" (Currency, Description, ID, Image URL, Stock Quantity, Subcategory). Added, it renders as a multi-value combo box that lists all 15 subcategories (no Category filter was set, so no narrowing is expected here); not tested with a Category filter set; no UI.HiddenFilter, as decided in D9 | `18-v9-adapt-filters-en.jpeg`, `19-v9-subcategory-filter-added-en.jpeg` |
| ru | `sap-language=ru` (editor) | passed: List Report headers "Название, Категория, Подкатегория, Цена, Остаток, Рейтинг" and Russian subcategory names in the cells; Object Page label "Подкатегория:"; Edit on Laptop Pro 15: dropdown lists only "Аудио, Мыши, Ноутбуки"; Category changed to "Мебель": Subcategory field empty (a11y snapshot: no value) and the dropdown lists "Кресла и стулья, Организация рабочего места, Освещение"; draft discarded | `20-ru-list-report.jpeg`, `21-ru-dropdown-electronics.jpeg`, `22-ru-after-category-change.jpeg` |

Observation (not a defect): when a dropdown opens, the framework pre-highlights a row and shows it in the input (for example "Кресла и стулья" / "Desk Organization" in `22-...`, `06-...`); the field is only committed on Enter, Escape restores the empty value.


### V8 re-check, visible columns by width (header cells with a rendered box; the rest sit behind Show Details)

| Width px | Visible | Behind Show Details |
|---|---|---|
| 1700 | Product Name, Category, Subcategory, Price, Stock Quantity, Rating | none |
| 1600 | Product Name, Category, Subcategory, Price, Stock Quantity, Rating | none |
| 1500 | Product Name, Category, Subcategory, Price, Stock Quantity | Rating |
| 1400 | Product Name, Category, Price, Stock Quantity | Rating, Subcategory |
| 1300 | Product Name, Category, Price, Stock Quantity | Rating, Subcategory |
| 1200 | Product Name, Category, Price, Stock Quantity | Rating, Subcategory |
| 1100 | Product Name, Category, Price | Rating, Subcategory, Stock Quantity |
| 800 | Product Name | Rating, Subcategory, Stock Quantity, Price, Category |

Order of pop-in matches "Screen: List Report" of SCREENS.md (it names Rating first, Subcategory second, then Stock Quantity, Price, Category). Evidence: DOM read of `th` visibility per width after `resize_page`, screenshots at 1400 and 1300.

## Cleanup
The V3/V10 product "VerifierTemp" was created and deleted again through the UI; the drafts of V1, V2, V4 and ru were discarded. After the run: `GET Products?$filter=IsActiveEntity eq false` returns no rows, 15 active products, Laptop Pro 15 is ELECTRONICS / LAPTOPS as seeded. Server stopped.

## Network evidence (`$batch` request lines)
```
V1  POST $batch: GET Subcategories?$select=category_code,code,name&$count=true&$orderby=name&$filter=category_code eq 'ELECTRONICS'&$skip=0&$top=100 -> 200, 3 rows (AUDIO, LAPTOPS, MICE)
V2  POST $batch: PATCH Products(...,IsActiveEntity=false) {"category_code":"FURNITURE"} -> 204, in the same batch
    GET Products(...)?$select=DraftMessages,subcategory_code&$expand=subcategory($select=code,name) -> 200 {"subcategory_code":null,"subcategory":null,"DraftMessages":[]}
V2  POST $batch: GET Subcategories?...$filter=category_code eq 'FURNITURE'... -> 200, 3 rows (DESK_ORGANIZATION, LIGHTING, SEATING)
V4  POST $batch: PATCH {"category_code":null} + the same side-effect GET -> 204 / 200 {"subcategory_code":null}
V4  empty category, dropdown: GET Subcategories?$select=...&$orderby=name&$skip=0&$top=100 (no $filter) -> 200, @odata.count 15
V3  create draft, Mice first: PATCH {"subcategory_code":"MICE"} + GET ...?$select=DraftMessages -> 204 / 200 "DraftMessages":[] (no PRODUCTS_SUBCATEGORY_MISMATCH, D7); typing "Mice" sent GET Subcategories?$search=Mice -> 1 row
V3  then PATCH category ELECTRONICS and FURNITURE: DraftMessages stayed empty; Mice kept for ELECTRONICS, emptied for FURNITURE (screenshot 13)
```

## Browser console
Baseline: no `VERIFICATION.md` on `main`; known noise (the `initialLoad` boolean deprecation, sandbox 404s `/appconfig/fioriSandboxConfig.json`, `/sap/bc/lrep/flex/*`, `/sap/bc/ui2/flp;sap-metrics-only`, FE `T_NEW_OBJECT|Products` i18n assert, object-page warnings such as `toggleHeaderOnTitleClick`, `Semantic Object not valid`, `Set unchanged path ... HeaderInfo`) is not re-listed. The console was read once, on the last (ru Object Page) load with `sap-ui-log-level=WARNING`; messages of earlier loads are lost on navigation, so "no new messages" is claimed only for that load.

New: 0 errors. Warnings: `Unknown qualified name Edm.String at /CatalogService.Subcategories/code/$Type - /Subcategories/code/Label` (and `.../code/Value/$Path@...Common.v1.Label`, `/Subcategories/name/Label`, `.../name/Value/...Label`; 4 messages) plus `Binding not ready - <template:if test="{= ${_VHUI>/tableAriaLabel}}">`, each once per opened value help. The identical 4 messages also fire for `/CatalogService.Categories/...` (the existing category dropdown), so it is the same pre-existing FE metamodel noise, now also for `Subcategories`. Failed network requests (>= 400): only the known sandbox 404s; no `$batch` returned >= 400.

A visibility mechanism (`UI.UpdateHidden` for viewer) was checked on the List Report (no Create / Delete / Import) and on the Object Page (no Edit / Delete) separately, V6.

## Automated tests
Not run by the verifier (`npm test` / `npm run test:ui` belong to the test roles); this file covers the browser check only.

## Verdict
Ready for review. Defects: none. Not covered: V5 (S7 rendering is not reachable through the UI by design), V7 Alt+Down and prefix typing, V9 with a Category filter set, the en console of earlier page loads.
