# Products Excel upload: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task.

Date: 2026-09-25. Feature: GitHub issue #7. Basis: `CONTEXT.md`, `PLAN.md`, ADR-0021 (proposed). Statements marked **(inferred)** are framework behaviour that no `fiori-mcp` document states; each has a verifier scenario below. Statements marked **(6.x)** depend on the phase 3 measurement in `research/import-mechanism.md` section 6 (PLAN step 8).

## Floorplan and duplication check
- Floorplan: no new page. The task "create many products from a file" is a toolbar action of the existing List Report `ProductsList` (List Report floorplan, https://experience.sap.com/fiori-design-web/list-report-floorplan-sap-fiori-element/). Its input dialog is the standard Fiori Elements **action parameter dialog** ("Actions in the List Report": app-specific action of the type "Additional input required: opens a dialog with fields"). The file field in that dialog is the documented "File upload as Action Parameter" (fiori-mcp "Enabling Stream Support (OData V2 & V4)").
- Not chosen: the Table building block "Upload Table" (fiori-mcp "Enabling File Upload for SAP Fiori elements Table") creates one entity per uploaded file and needs an `Edm.Stream` property on `Products`; the task is one file that creates many rows. Freestyle UI5 is not needed.
- `docs/registry/UI-ARTIFACTS.md`: `app/products` has the List Report `ProductsList`, the Object Page `ProductsObjectPage` and one extension, the `RatingRangeFilter` filter fragment. No action, no dialog, no controller extension exists; nothing is duplicated. `UI.LineItem` exists without a qualifier; the new record goes into that same `UI.LineItem`, never a second one.
- The Object Page is unchanged. The filter bar, the columns and the row order of the List Report are unchanged.
- Out of scope (CONTEXT "User decisions" 4): no sample download in the app; the committed valid fixture is the sample, described in `README.md`.

## Screen: List Report "Products", Import action
- Title and subtitle: unchanged (app title "Product Catalog", table header "Products" from `UI.HeaderInfo.TypeNamePlural` with the row count).
- Filters (no more than 5 by default): unchanged (`name`, `category_code`, `price`, custom `rating`).
- Table columns in order of importance (no more than 7): unchanged (Product Name, Category, Price, Stock Quantity, Rating).
- Actions and their placement (toolbar, row, header):
  - **Import from Excel** button in the **table toolbar**, from `UI.DataFieldForAction` `CatalogService.importProducts` in `UI.LineItem` (fiori-mcp "Actions in the List Report": table toolbar actions are "for list-wide or selected-item operations"; this one is list-wide). Not in the page header, not in a row (`Inline` not set).
  - Position: the record is appended **after** the last `UI.DataField` of `UI.LineItem` (the rating record). Fiori Elements puts annotation actions to the left of the generic Create and Delete **(inferred)**. Not emphasized: Create stays the primary action of the table, and the table has no footer (Action placement, https://experience.sap.com/fiori-design-web/action-placement/, via fiori-mcp "Adding Action Buttons to Forms" step 8).
  - Enablement: the action is bound to the collection, so the button is **enabled with no row selected** and stays enabled whatever the selection **(inferred, 6.1)**. It never acts on the selected rows.
  - Label: `{i18n>Products.action.import}` = "Import from Excel" (user decision, CONTEXT "User decisions" 11; see Texts). Text button, no icon.
  - Visibility per role: `alice` (`CatalogEditor`) sees the button. `viewer` (`CatalogViewer`) does **not** see it; it is **hidden, not disabled**, the same as Create and Delete (ADR-0013), through `![@UI.Hidden]` with the `$edmJson` `$Not` `$Path` `/CatalogService.EntityContainer/Permissions/isEditor` expression copied from `UI.CreateHidden`. Source: fiori-mcp "Adding Action Buttons to Forms" step 5 ("Use UI.Hidden to hide the action button entirely"). A user who is both viewer and editor sees it.
- Object Page sections: none, the Object Page is not touched.
- Empty state and errors: see "Dialog" and "States" below. An empty table (after a filter) still shows the "Import from Excel" button for an editor: the action does not depend on the rows.
- Criticality and statuses: none on the page. Messages carry severity (Success or Information for the result, Error for rejection) through the framework's message handling; no custom colors.
- What is shown instead of a UUID (`TextArrangement`): no new field on the page. The dialog shows no IDs. Imported rows show category names (existing `#TextOnly` on `category`), not codes.

### Dialog: action parameter dialog of `importProducts`
Rendered by Fiori Elements from the action metadata; no fragment, no controller, no `manifest.json` change.

| Element | Content | Source of the text | Notes |
|---|---|---|---|
| Title | "Import from Excel" (the action label) | `Products.action.import` on the `DataFieldForAction`, or `@title` of the action (`Products.importProducts`, "Import Products") | Which of the two labels becomes the title is **(6.2)**; both keys exist so either is translated |
| Field | File field with the label "Excel File (.xlsx)", a text area showing the chosen file name and a Browse button | `@title` of `ProductsImportFile.content` (`ProductsImportFile.content`) | The label is the only format hint on screen; the full workbook format lives in `README.md` (user decision 15) |
| Required marker | Asterisk on the field; pressing Import with no file shows the framework's "required" message and does not call the server **(inferred, 6.2)** | framework | Needs the `file` parameter to be `not null`, as in the documented CAP example `_StreamProperties : ... not null`; `cap-backend-dev` sets it in PLAN step 4 |
| File type restriction | The browser's file picker is filtered to `.xlsx` | `@Core.AcceptableMediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']` on `content` | A user who switches the picker to "All files" and picks another type gets the framework's type-mismatch message and the file is not taken **(inferred)**; the server still rejects a non-workbook payload (`PRODUCTS_IMPORT_NOT_XLSX`) |
| Hidden fields | `mediaType` and `fileName` are **not** shown as inputs | `@Core.IsMediaType` and `@Core.ContentDisposition.Filename` make FE fill them from the chosen file | If 6.2 shows them as separate inputs: `fiori-app-dev` hides them with `@UI.Hidden` on the two type elements in `app/products/annotations/Products.cds` (the ABAP example of the same fiori-mcp document marks both hidden) |
| Buttons | **Import from Excel** (primary, the action label) and **Cancel** | framework: the OK button repeats the action label; Cancel is the framework text | Cancel closes the dialog, sends nothing, the table keeps 15 rows |

Initial focus: the file field (framework default for the first parameter) **(inferred)**.

### States

| State | Trigger | What the user sees | Table |
|---|---|---|---|
| Busy | Import from Excel pressed with a file | The dialog and the page are busy (framework busy indicator) until the response; the dialog buttons do not react **(inferred)**. At most 1,000 rows, PLAN risk: above 10 s the architect reconsiders the insert strategy | unchanged until the response |
| Success | Clean file, 200 with the count | The dialog closes. The message `PRODUCTS_IMPORT_DONE` "Products imported: 3." is shown by the framework: a message toast if FE treats it as a single success message, otherwise a message dialog with Close **(6.3)**; both are acceptable | refreshes and shows the new rows (15 → 18) without a manual refresh **(6.3)**. If 6.3 shows no refresh: stop and report to `architect` (a `Common.SideEffects` on the action is the candidate, not a controller) |
| Whole-file rejection, row errors | Any bad row, 400 with `details` | The framework message dialog (several messages) or message box (one message) lists **every** message; each message text starts with the row number and the column so the list is readable without the details view: `Row 5, column "stock": ...`. The column is the **workbook header name** (`stock`, not "Stock Quantity"), because the user corrects the file, not the screen. Order: by row, then by column order of the header (backend order). The first message is always `PRODUCTS_IMPORT_NOTHING_IMPORTED` (user decision 13), followed by **all** row messages, no cap (user decision 12) **(6.4)** | unchanged (15 rows), no draft |
| Duplicate name | A `name` equal to an existing active product or to an earlier row | one row message `PRODUCTS_IMPORT_DUPLICATE_NAME` in the same list | unchanged |
| Empty file | Header row only, or only empty rows | one message `PRODUCTS_IMPORT_EMPTY` | unchanged |
| Wrong format | Not an xlsx workbook (renamed file, csv, xls) | one message `PRODUCTS_IMPORT_NOT_XLSX` (after the client-side type filter was bypassed) | unchanged |
| Bad header | Unknown column, or a mandatory column (`name`, `price`, `currency`, `stock`, `category`) missing | one message `PRODUCTS_IMPORT_UNKNOWN_COLUMN` per unknown column and one `PRODUCTS_IMPORT_MISSING_COLUMN` per missing mandatory column (user decision 14); no row messages for those columns | unchanged |
| Too many rows | More than 1,000 data rows | one message `PRODUCTS_IMPORT_TOO_MANY_ROWS` with the count and the limit; no row messages | unchanged |
| Too large request | Body over the body-parser limit (413) | the framework's generic technical error **(inferred)**; PLAN step 6 sizes the limit so that a 1,000-row file never gets here | unchanged |
| Not authorized | `viewer` calls the action by URL (no button) | not a UI path; 403 is covered by the backend tests | unchanged |

Whether the parameter dialog stays open after a rejection (so the user can pick the corrected file at once) or closes is **(6.4)**; both are acceptable, record which.

### Fallback screen (only if 6.2 shows no file field; needs the user gate of PLAN step 8)
ADR-0021 fallback: a controller extension of the List Report adds the same toolbar button through Fiori MCP and opens a fragment dialog; the backend does not change. The design, so the gate can decide quickly:
- `sap.m.Dialog`, title "Import Products", `ariaLabelledBy` not needed (header shown). Content: `sap.ui.layout.form.Form` with `ColumnLayout` (UI5 guidelines, section 4), one `Label` "Excel File (.xlsx)" with `labelFor` the `sap.ui.unified.FileUploader` (`fileType: ["xlsx"]`, `mimeType` the xlsx type, placeholder "Choose an .xlsx file", `sendXHR` not used: the file is read in the browser and passed to `editFlow.invokeAction(..., { skipParameterDialog: true })`). No hint text: the format hint stays in the field label and `README.md`, the same as in the standard dialog (user decision 15).
- Toolbar button text "Import from Excel" (same key `Products.action.import`); `beginButton` "Import from Excel" (type Emphasized, enabled only when a file is chosen), `endButton` "Cancel". `initialFocus` the FileUploader. `typeMissmatch` sets the FileUploader value state Error with "Choose a file of type .xlsx." instead of a popup.
- Results reuse the backend messages above through the framework message handling of `invokeAction`; the controller announces success and failure with `sap.ui.core.InvisibleMessage` (Polite for success, Assertive for rejection) because the extension owns them.
- Guideline for the upload pattern: https://experience.sap.com/fiori-design-web/upload-collection/ (from the `references` of `sap.ui.unified.FileUploader`, `get_api_reference`).
- Cost: a controller extension, a fragment, a manifest change through Fiori MCP and app i18n keys (Texts, "Fallback only"); `ui5-freestyle-dev` builds it, OPA5 ids change.

## Texts
Rules: model and action labels in `_i18n/i18n.properties` / `_i18n/i18n_ru.properties` (the CDS annotations resolve `{i18n>...}` there); backend messages in `_i18n/messages*.properties` (UPPER_SNAKE); app keys in `app/products/webapp/i18n/` only for the fallback. Framework texts (Cancel, "required", type mismatch, busy, message dialog chrome, the CAP `MULTIPLE_ERRORS` header) are not project keys. Russian values below are Unicode code points (English-only docs, invariant 10); the bundle holds the plain word, the OPA `data/` file backslash-u escapes. Messages that no test asserts literally are given as a Latin transliteration for the implementer to write in Cyrillic.

### Labels (`_i18n/i18n*.properties`)

| Key | Type | en | ru |
|---|---|---|---|
| `Products.action.import` | `#XBUT` | Import from Excel | U+0418 U+043C U+043F U+043E U+0440 U+0442 U+0020 U+0438 U+0437 U+0020 Excel (Import iz Excel) |
| `Products.importProducts` | `#XTIT` action `@title` | Import Products | U+0418 U+043C U+043F U+043E U+0440 U+0442 U+0020 U+0442 U+043E U+0432 U+0430 U+0440 U+043E U+0432 (Import tovarov) |
| `Products.importProducts.file` | `#XFLD` parameter `@title` | File | U+0424 U+0430 U+0439 U+043B (Fajl) |
| `ProductsImportFile.content` | `#XFLD` | Excel File (.xlsx) | U+0424 U+0430 U+0439 U+043B U+0020 Excel (.xlsx) (Fajl Excel (.xlsx)) |
| `ProductsImportFile.mediaType` | `#XFLD` | File Type | U+0422 U+0438 U+043F U+0020 U+0444 U+0430 U+0439 U+043B U+0430 (Tip fajla) |
| `ProductsImportFile.fileName` | `#XFLD` | File Name | U+0418 U+043C U+044F U+0020 U+0444 U+0430 U+0439 U+043B U+0430 (Imya fajla) |

The button label is the user's decision (CONTEXT "User decisions" 11). "Tovarov" in `Products.importProducts` matches the vocabulary of the existing Russian bundle (`Products.typeNamePlural` = "Tovary").

### Messages (`_i18n/messages*.properties`, owned by `cap-backend-dev`; wording proposed here, the orchestrator passes it on)
Every row message starts with the row number (sheet row, header = row 1) and the workbook column name. Counts are written "label: number" to avoid plural forms in Russian.

| Key | en | ru (transliteration) |
|---|---|---|
| `PRODUCTS_IMPORT_DONE` | Products imported: {0}. | Importirovano tovarov: {0}. |
| `PRODUCTS_IMPORT_NOTHING_IMPORTED` (first message of every rejection, user decision 13) | No products were imported. Correct the rows listed below and import the file again. | Tovary ne importirovany. Ispravte ukazannye nizhe stroki i snova importirujte fajl. |
| `PRODUCTS_IMPORT_ROW_INVALID` | Row {0}, column "{1}": {2} | Stroka {0}, stolbec "{1}": {2} |
| `PRODUCTS_IMPORT_DUPLICATE_NAME` | Row {0}, column "name": a product named "{1}" already exists in the catalog or earlier in the file. | Stroka {0}, stolbec "name": tovar s nazvaniem "{1}" uzhe est v kataloge ili vyshe v fajle. |
| `PRODUCTS_IMPORT_NOT_XLSX` | The file is not an Excel workbook. Choose an .xlsx file. | Fajl ne yavlyaetsya knigoj Excel. Vyberite fajl .xlsx. |
| `PRODUCTS_IMPORT_EMPTY` | The file contains no product rows. Add rows below the header row. | V fajle net strok s tovarami. Dobavte stroki pod strokoj zagolovkov. |
| `PRODUCTS_IMPORT_UNKNOWN_COLUMN` | Column "{0}" is not supported. Allowed columns: name, description, price, currency, stock, category, rating, imageUrl. | Stolbec "{0}" ne podderzhivaetsya. Dopustimye stolbcy: name, description, price, currency, stock, category, rating, imageUrl. |
| `PRODUCTS_IMPORT_MISSING_COLUMN` (one per missing mandatory column) | The header row has no column "{0}". | V stroke zagolovkov net stolbca "{0}". |
| `PRODUCTS_IMPORT_TOO_MANY_ROWS` | The file has {0} product rows; at most {1} can be imported at once. Split the file. | V fajle strok: {0}; za odin raz mozhno importirovat ne bolee {1}. Razdelite fajl. |

`{2}` of `PRODUCTS_IMPORT_ROW_INVALID` is the framework's localized reason (`ASSERT_MANDATORY`, `ASSERT_RANGE`, `ASSERT_TARGET`); whether CAP ships it in Russian is a UX risk below. Exact key names and arguments are the backend's (PLAN step 5); only the wording is proposed here.

### Fallback only (`app/products/webapp/i18n/i18n*.properties`)
`productsList.importDialog.title` = Import Products (Import tovarov); `productsList.importDialog.fileLabel` = Excel File (.xlsx) (Fajl Excel (.xlsx)); `productsList.importDialog.placeholder` = Choose an .xlsx file (Vyberite fajl .xlsx); `productsList.importDialog.confirm` = Import from Excel (Import iz Excel); `productsList.importDialog.wrongType` = Choose a file of type .xlsx. (Vyberite fajl tipa .xlsx.).

## Accessibility
Checklist of the `ui5-best-practices-accessibility` skill (eight topics). `fiori-mcp` has no accessibility document for List Report dialogs; verdicts come from the skill and the UI5 API.

| # | Topic | Standard dialog (chosen) | Fallback |
|---|---|---|---|
| 1 | Landmarks | unchanged page; the dialog is a framework `sap.m.Dialog` (role dialog) | same |
| 2 | Labeling | toolbar button has visible text "Import from Excel" (no icon-only button, no tooltip needed); the file field is labelled by the framework from `ProductsImportFile.content`; the label names the format | `Label labelFor` the FileUploader; FileUploader `ariaLabelledBy` not needed then |
| 3 | Headings | dialog title is the header; no `Title` controls added | same |
| 4 | Focus and keyboard | Tab reaches Import from Excel in the toolbar; Enter or Space opens the dialog; focus lands on the file field; Tab to Browse, Import from Excel, Cancel; Escape = Cancel; after close focus returns to the Import from Excel toolbar button **(inferred)** | `initialFocus` the FileUploader; same order |
| 5 | Shortcuts | none added; no `CommandExecution` for a rare action | same |
| 6 | Invisible messaging | framework message toast, box and dialog are announced by UI5 | `InvisibleMessage.announce` Polite on success, Assertive on rejection |
| 7 | Reading order | label, field, buttons in DOM order | Label, FileUploader, then buttons |
| 8 | Target size | a standard `sap.m.Button` in the toolbar; no links or object controls added | same |

Error messages name the row and the column in text, never by color alone.

## Theme and tokens
Only standard controls and `sap_horizon`: toolbar `sap.m.Button` (type Default), the Fiori Elements parameter dialog, framework message toast, box and dialog. No CSS, no custom color, no icon (UI5 guidelines via `get_guidelines`: data binding, i18n in all locales, no globals). The fallback uses only `sap.m.Dialog`, `sap.ui.layout.form.Form` + `ColumnLayout`, `sap.m.Label`, `sap.ui.unified.FileUploader`.

## Verifier scenarios
In addition to PLAN acceptance criteria (valid file 18 rows, invalid file every row and 15 rows, viewer, ru).
1. As `alice`, no row selected: the "Import from Excel" button is visible and enabled in the table toolbar, left of Create; select two rows: still enabled, and the import does not touch them.
2. As `viewer`: no "Import from Excel" button, no gap or empty toolbar group where it would be; Create and Delete also absent (unchanged).
3. Open the dialog: title, one file field labelled "Excel File (.xlsx)" with an asterisk and no other format hint; no separate "File Type" or "File Name" input (if present, record for 6.2); "Import from Excel" and Cancel buttons; no sample-download link.
4. Press "Import from Excel" in the dialog without a file: a required-field message, no request in the network log.
5. The browser picker offers `.xlsx` only by default; choose "All files" and a `.txt`: a type-mismatch message; record its text (framework).
6. Upload the valid fixture: busy indicator, then the success message "Products imported: 3." and 18 rows without F5; record toast or dialog (6.3).
7. Upload the invalid fixture: the first message is "No products were imported. ..."; after it, one message per bad row (all of them, no cap), each starting with "Row n, column ..." in row order; 15 rows; record whether the parameter dialog stayed open (6.4) and whether the messages come as one list (dialog) or one by one.
8. Upload a header-only workbook: one "no product rows" message. Upload a workbook whose header lacks `price` and `stock`: two "The header row has no column ..." messages, one per column, and no row messages for them.
9. Keyboard only: Tab to "Import from Excel", Enter, focus on the file field, Escape closes, focus back on the "Import from Excel" toolbar button.
10. `sap-ui-language=ru`: button (code points in Texts, "Import iz Excel"), dialog title, field label and the success and error messages in Russian, including the framework reason inside `PRODUCTS_IMPORT_ROW_INVALID` (record if it stays English).

## UX risks
- FE may take the dialog title from the action `@title` ("Import Products") instead of the `DataFieldForAction` label ("Import from Excel"); both are translated, so only the wording differs (6.2).
- FE may render `mediaType` and `fileName` as editable inputs; the fix is `@UI.Hidden` on the two type elements (6.2).
- A 1,000-row file with errors in every row produces thousands of messages; the message dialog becomes a long list. Accepted by the user (decision 12: no cap); `ui-verifier` records the dialog's behaviour with the largest error fixture available.
- A reason from CAP's own bundle (`{2}`) may be English in a Russian session, which mixes languages inside one message (scenario 10).
- The success message is `req.info` (Information severity); FE may show it in a dialog that needs a click instead of a toast (6.3). Acceptable; a `Success` severity would be the backend's decision.
- If FE shows row errors as a value state on the file field (because a message targets `file`), the list may be hidden behind the field; backend row messages should carry no field target (6.4).
- Collection-bound action rendering of a stream parameter is documented only for instance-bound actions; the whole design falls back if 6.2 fails.

## Open questions for the user
None. All resolved at the plan gate (CONTEXT "User decisions", 2026-09-25):
1. Button label: resolved, "Import from Excel" (decision 11).
2. Error list size: resolved, every bad row, no cap (decision 12).
3. Leading `PRODUCTS_IMPORT_NOTHING_IMPORTED`: resolved, yes (decision 13).
4. Missing mandatory columns: resolved, one `PRODUCTS_IMPORT_MISSING_COLUMN` per column (decision 14).
5. Format hint: resolved, only the field label and `README.md`, in the fallback too (decision 15).
6. In-app sample download: resolved, not in this feature (decision 4).
