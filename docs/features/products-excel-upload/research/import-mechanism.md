# products-excel-upload: import mechanism research

Author: `architect`, 2026-09-25. Read by `architect` and `reviewer`; implementers read only the sections a PLAN step names. Sections 5 and 6 are filled by the implementers at the phase 2 and phase 3 measurements; section 7 (architect) holds the framework facts behind the phase 3 amendment of ADR-0021; section 8 (architect, 2026-09-28) the measurements and the reference walk behind amendment D (decompression guard).

## 1. Parser candidates (`npm view`, npm bulk advisory endpoint, 2026-09-25)

| Package | Version | Last publish of a stable version | License | Dependencies | Advisories |
|---|---|---|---|---|---|
| `xlsx` (SheetJS on npm) | 0.18.5 | npm frozen; newer versions only from the SheetJS CDN | Apache-2.0 | 7 | GHSA-4r6h-8v6p-xvw6 (high, prototype pollution, `<0.19.3`), GHSA-5pgg-2g8v-p4x9 (high, ReDoS, `<0.20.2`) |
| `exceljs` | 4.4.0 | 2023-10-19 (4.4.1-prerelease.0 on 2024-12-20) | MIT | 9 (`archiver`, `unzipper`, `tmp`, `jszip`, `saxes`, ...) | none returned |
| `read-excel-file` | 9.3.10 | registry modified 2026-08-10 | MIT | 4 (`saxen`, `fflate`, `worker-f`, `unzipper-esm`) | none returned |
| `write-excel-file` | 4.1.1 | registry modified 2026-06-08 | MIT | 1 (`fflate`) | not queried |
| `ui5-cc-spreadsheetimporter` | 2.4.0 | 2025-11-18 | see LICENSE.md | `xlsx` from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | n/a |

`read-excel-file` is `"type": "module"`, `engines.node >= 18`, exports `./node` (ESM and CJS), `./browser`, `./universal`, `./web-worker`. Its API (read a Buffer, rows as arrays or mapped by a schema) is **not verified by MCP** (not an SAP artifact); `cap-backend-dev` reads the package README at install time.

## 2. CAP facts (cds-mcp `search_docs`, 2026-09-25)

- `LargeBinary` maps to `Edm.Binary` in OData V4; `Edm.Stream` needs `@odata.Type: 'Edm.Stream'` or `@Core.MediaType` on an entity element. How a `LargeBinary` inside a structured **action parameter** arrives in `req.data` (base64 string or `Buffer`) is not documented: measured in phase 2 (section 5).
- Body-parser limit: default 100 KB (Express), configurable globally with `cds.server.body_parser.limit` or per service with `@cds.server.body_parser.limit`; exceeding it answers 413.
- `@assert.target` "is performed on the application service layer before the custom application handlers are called", for `CREATE` and `UPDATE`. `@mandatory` and `@assert.range` are enforced by the generic handlers (`handle_validations`). The documentation does not say whether they run for a service-internal `this.run(INSERT ...)`: measured in phase 2 (section 5).
- On drafts, `@assert.*` only turns into an error at activation (Draft Input Validation); active writes are validated immediately.
- `req.error` collects errors; after each phase the framework rejects with `MULTIPLE_ERRORS` and `details`. `req.info` adds a message to a successful response (`sap-messages` header).
- Actions bound to a collection receive no keys (`srv.send('<action>', '<Entity>', data)` programmatically); custom bound actions of a draft-enabled entity are inherited by `.drafts`.
- `@restrict` `grant: '*'` covers custom bound actions of the entity; `grant: 'READ'` does not (expected 403 for `viewer`, measured in phase 2).

## 3. Fiori Elements facts (fiori-mcp `search_docs`, 2026-09-25)

- "Enabling Stream Support", section "File upload as Action Parameter": an action with a complex-type parameter holding an `Edm.Stream` property plus media type and file name, annotated `Core.MediaType`, `Core.ContentDisposition.Filename`, `Core.AcceptableMediaTypes`, `Core.IsMediaType`, renders a file field in the action parameter dialog. The documented example is instance-bound (`_it`); a **collection-bound** action and the rendering in UI5 1.152 are measured in phase 3 (section 6). The CAP example declares the property as `LargeBinary`; whether CAP emits `Edm.Stream` for it inside a type is measured in phase 2 (section 5).
- Toolbar actions of a List Report table come from `UI.DataFieldForAction` in `UI.LineItem`; a path-based `UI.Hidden` on the record hides the button.
- **Plan gate item 11 (2026-09-25): no standard file import exists in Fiori Elements V4.** Searched fiori-mcp for a built-in table action that imports rows from a spreadsheet file. Found only: (1) "Copy and Paste from External Applications": table-level paste creates rows from the clipboard, requires a draft-enabled app and `creationMode` `Inline`/`InlineCreationRows`, is enabled by default on Object Page tables, validates data types only in the front end, sends one `$batch`, cannot paste `TextOnly` fields; (2) "Upload Table" / "Enabling File Upload for SAP Fiori elements Table": stores attachment files in an `Edm.Stream` property (`UI.MediaResource`), one file per row, via the CAP Attachments plug-in; (3) "Export Button (Spreadsheet & PDF)": export only; (4) "Create Object dialog" (`creationMode: CreationDialog`): one object at a time. None reads a file into many business rows, so the ADR-0021 design stands and the button label is "Import from Excel".
- Extension actions in a controller extension call `editFlow.invokeAction(<action>, { parameterValues, skipParameterDialog })` (the ADR-0021 fallback).

## 4. Rejected mechanisms

See ADR-0021 "Alternatives". Not repeated here.

## 5. Phase 2 measurements (to be filled by `cap-backend-dev` / `test-backend`)

| # | Question | Result |
|---|---|---|
| 5.1 | EDMX type of `ProductsImportFile.content` (`Edm.Binary` or `Edm.Stream`) and of the action (`IsBound`, binding parameter `Collection(CatalogService.Products)`) | `Edm.Stream` (not `Edm.Binary`): `@Core.MediaType` on a `LargeBinary` element of the complex type `CatalogService.ProductsImportFile` turns it into a stream property (`cds compile` 2026-09-25, cds 10.0.6). The action: `<Action Name="importProducts" IsBound="true">` with binding parameter `in` of `Collection(CatalogService.Products)` (`Nullable="true"`), parameter `file` of `CatalogService.ProductsImportFile` `Nullable="false"`, `ReturnType Edm.Int32`; no `EntitySetPath`. Annotations target `CatalogService.importProducts(Collection(CatalogService.Products))`. `metadata.xml` +37 lines |
| 5.2 | Shape of `req.data.file.content` in the handler for a JSON POST with base64 content | JSON POST `{ file: { content: <base64>, mediaType, fileName } }`: `req.data` has only `file`; `req.data.file.content` is the base64 **string** unchanged (starts `UEsDBBQ`, the zip magic `PK` in base64), not a Buffer; `req.params` is `[]`, `req.subject` is `{ ref: ['CatalogService.Products'] }`. The handler decodes with `Buffer.from(content, 'base64')` (`decodeContent` in `srv/lib/products-import.js`) |
| 5.3 | `this.run(INSERT.into(Products).entries(row))` inside the handler: does `ASSERT_MANDATORY` fire (row without `name`)? `ASSERT_RANGE` (`stock` -1)? `ASSERT_TARGET` (`category` `NOPE`)? Error `code`, `target`, `args` of each | All three fire on `this.run(INSERT.into(Products).entries(row))` inside the `on` handler (probe, 2026-09-25): no `name` → `ValidationError` `code` `ASSERT_MANDATORY`, `status` 400, `target` `name`, no args; `stock` -1 → `ASSERT_RANGE`, 400, `target` `stock`, `args` `[-1, 0, 1000000]`; `category_code` `NOPE` → `Error` `code` `ASSERT_TARGET`, 400, `target` `category_code`, `args` `['category_code']`. Also `rating` 9 → `ASSERT_RANGE`; `name` of 150 chars → `ASSERT_DATA_TYPE` `['...', 'String(100)']`. Several failures of one row arrive as one `MULTIPLE_ERRORS` with `details[]` (each `code`, `target`, `args`). A failed INSERT does not break the transaction: later rows insert. `currency_code` without `@assert.target` is not checked (see open question in the phase 2 report). Localized reason: `cds.i18n.messages.at(code, locale, args)`; `ASSERT_MANDATORY`, `ASSERT_RANGE`, `ASSERT_TARGET` exist in `ru`, `ASSERT_DATA_TYPE` is English only in cds 10.0.6 |
| 5.3a | Non-numeric text in `price` or `stock` passed unchanged to the internal `INSERT`: does the framework reject it (code, args)? If not, stop and report to `architect` | Rejected by the framework, no stop: `price` `'abc'` → `MULTIPLE_ERRORS` with `ASSERT_DATA_TYPE` `['abc', 'Decimal(10,2)']` and `ASSERT_RANGE` `['abc', 0, 99999999.99]`, both `target` `price`; `stock` `'abc'` → `ASSERT_DATA_TYPE` `['abc', 'Integer']` plus `ASSERT_RANGE`. The handler reports the first reason per column (`ASSERT_DATA_TYPE`) |
| 5.4 | The internal `INSERT` writes an active row (visible with `IsActiveEntity=true`), no draft | Active row, no draft: after the internal INSERT `Products?$filter=name eq 'Probe 20' and IsActiveEntity eq true` returns the row with `createdBy` `alice`, `IsActiveEntity` true; `Products?$filter=IsActiveEntity eq false&$count=true` is 0. A `req.reject` / collected `req.error` after the inserts rolls them back (row count unchanged) |
| 5.5 | `viewer` → 403 on the action, anonymous → 401 | Confirmed by `test/catalog-service.test.js` (2026-09-25): `POST Products/CatalogService.importProducts` with the valid fixture as `viewer` → 403, error `code` `'403'`; with `{ auth: null }` → 401; the product count stays 15 in both. The inherited `@restrict` (`*` → `CatalogEditor`) authorizes the collection-bound action, no own `@requires` needed |
| 5.6 | Base64 byte size of the 1,000-row fixture; fits 100 KB? | **Does not fit; limit set to `1mb` per ADR-0021** (`@cds.server.body_parser.limit: '1mb'` on `CatalogService`). Measured 2026-09-25: 1,000 rows with the mandatory columns only: JSON body 32,342 bytes (1,001 rows 32,378); every column filled with 60-char descriptions: base64 54,000; 500-char non-repeating descriptions: realistic prose from a ~870-word vocabulary 232 KB (`cap-backend-dev`), random characters 558 KB, the seeded pseudo-word prose of `proseDescription` in `test/fixtures/build-workbooks.mjs` 221,322 bytes. At the default 100 KB these answer 413; with `1mb` all return 200, value 1000, guarded by the test "importProducts accepts 1000 rows whose request body exceeds 100 KB" (asserts the body > 100,000 bytes) |
| 5.7 | Duration of a 1,000-row import (per-row `INSERT`) on SQLite in-memory | 1,000 rows through the real handler (parse, duplicate query, 1,000 per-row INSERTs): 227 ms for the whole POST on SQLite in-memory (probe of the INSERT loop alone: 220 ms), far below the 10 s threshold |

## 6. Phase 3 measurements (to be filled by `fiori-app-dev`)

| # | Question | Result |
|---|---|---|
| 6.1 | The toolbar shows the Import button for `alice`, not for `viewer` (List Report, both roles) | Confirmed (headless Chrome 152, UI5 1.152 CDN, `npm run watch` on :4004, 2026-09-25). `alice`: `sap.m.Button` id `products::ProductsList--fe::table::Products::LineItem::DataFieldForAction::CatalogService.importProducts`, text "Import from Excel", visible, **enabled with no row selected**, rendered left of Create and Delete. `viewer`: the same control exists with `visible` false and no DOM, like Create and Delete (both invisible too), so `UI.Hidden` resolves like `UI.CreateHidden`, no asymmetry. No `Failed to read path ... $select` TypeError appeared in either role at `sap-ui-log-level=WARNING` in these runs |
| 6.2 | The action parameter dialog renders a file field (control class, accepted types) for the collection-bound action on UI5 1.152 | **File field rendered, no fallback.** `sap.m.Dialog` id `fe::APD_::CatalogService.importProducts`, title "Import from Excel" (the `DataFieldForAction` label, not the action `@title`); one `sap.m.Label` id `APD_::file::content::Label` "Excel File (.xlsx)"; one `sap.ui.unified.FileUploader` (generated id `__uploader0`, not stable) with `mimeType` `[xlsx]`, placeholder "Browse or drop a file", `<input type=file accept=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet>`; **no `mediaType` or `fileName` input**, so no `@UI.Hidden` on the type elements. Buttons `...::Action::Ok` "Import from Excel" (Emphasized) and `...::Action::Cancel` "Cancel". Deviations from SCREENS (inferred items): **no required asterisk** (`Label.required` and `FileUploader.required` false despite `file ... not null`), and pressing Import with no file does nothing: no request, no message, the dialog stays open. Cancel closes the dialog, sends no request, 15 rows. `ru`: title and OK button "U+0418 U+043C U+043F U+043E U+0440 U+0442 U+0020 U+0438 U+0437 U+0020 Excel", label "U+0424 U+0430 U+0439 U+043B U+0020 Excel (.xlsx)", Cancel "U+041E U+0442 U+043C U+0435 U+043D U+0438 U+0442 U+044C" (code points, invariant 10) |
| 6.3 | Uploading the valid fixture sends the action (request body shape) and the table shows the new rows without a manual refresh | Action sent in `$batch`: `POST Products/CatalogService.importProducts` with JSON `{"file":{"content":"<base64>","mediaType":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","fileName":"products-import-valid.xlsx"}}` (FE fills `mediaType` and `fileName` from the chosen file); answer 200, `value` 3, `sap-messages` `PRODUCTS_IMPORT_DONE`. The success message is shown as a **message box** "Information / Products imported: 3." with OK, not a toast. **The table does not refresh**: server count 18, table count stays 15 after the response and after closing the box, no GET is sent. Probe (temporary, reverted): `annotate CatalogService.Products with actions { importProducts @Common.SideEffects: { TargetEntities: ['/CatalogService.EntityContainer/Products'] }; }` in `app/products/annotations/Products.cds` (fiori-mcp "Side Effects", samples 7 and 9) adds one `GET Products?$count=true...` to the same `$batch` and the table shows 18 rows before the box is closed. Per SCREENS "States": stop and report to `architect` |
| 6.4 | The 400 with `details` is shown as a message list naming each row | Confirmed with the invalid fixture: 400 `MULTIPLE_ERRORS`, one FE message dialog (Close) listing, in order, the CAP header "Multiple errors occurred, see details below.", then `PRODUCTS_IMPORT_NOTHING_IMPORTED`, then every row message ("Row 3, column \"name\": Provide the missing value." ... "Row 7, column \"name\": a product named \"yoga MAT\" ..."), all Error, none with a target, no value state on the file field. The **parameter dialog stays open** behind it with the file still chosen, so a corrected file can be picked at once. Table and server keep 15 rows. Console: 7 warnings `TypeError: e(...).apply is not a function` from the message dialog description formatter (one per message), UI5 framework noise, no functional effect observed |
| 6.5 | Required file after `@mandatory` on the parameter `file` (PLAN steps 8a and 8c). Server (`cap-backend-dev`, 8a): a `POST` without `file` as `alice`: status, `code`, `target`. Dialog (`fiori-app-dev`, 8c, en and ru): `APD_::file::content::Label` `required`; Import from Excel with no file: FileUploader `valueState` and `valueStateText`, focus, requests in the network log, dialog open; `valueState` after choosing the valid fixture | Server (8a, `cap-backend-dev`, probe 2026-09-25, cds 10.0.6): `POST Products/CatalogService.importProducts` with body `{}` as `alice` → 400, `code` `ASSERT_MANDATORY`, `target` `file`, message "Provide the missing value." (with `Accept-Language: ru` the Russian text of the cds `ASSERT_MANDATORY` bundle entry); a single error, no `details`, the handler does not run. An explicit `{ "file": null }`, `{ "file": {} }`, `content` null or `''` pass both `@mandatory` and `not null` and reach the handler: 400 `MULTIPLE_ERRORS` with `details` `PRODUCTS_IMPORT_NOTHING_IMPORTED`, `PRODUCTS_IMPORT_NOT_XLSX`, no `target`. Dialog (8c, `fiori-app-dev`, headless Chrome 152, UI5 1.152 CDN, watch server on :4004, `alice`, 2026-09-25): **required marker works, no stop.** `APD_::file::content::Label` `required` true (DOM class `sapMLabelRequired`, asterisk) in en and ru; the FileUploader's own `required` stays false (FE keeps the flag on the label). Import from Excel with no file: FileUploader `valueState` Error, `valueStateText` en `Upload a file for "Excel File (.xlsx)".`, ru U+0417 U+0430 U+0433 U+0440 U+0443 U+0437 U+0438 U+0442 U+0435 U+0020 U+0444 U+0430 U+0439 U+043B U+0020 U+0434 U+043B U+044F U+0020 "U+0424 U+0430 U+0439 U+043B U+0020 Excel (.xlsx)". (UI5 text with the translated label), shown as the value-state popup under the field; focus on the uploader's `input[type=file]` (it is also the initial focus); no non-GET request; the parameter dialog stays open. Choosing the valid fixture sets `valueState` None and the field value `products-import-valid.xlsx`. The FileUploader id stays generated (`__uploader0`) |
| 6.6 | With `Common.SideEffects` on `importProducts` (PLAN steps 8 and 8c): the valid fixture as `alice`; requests of the `$batch`; table row count before the message box is closed; console at `sap-ui-log-level=WARNING` (a new instance of the `Permissions/isEditor` `$select` TypeError or another message for the absolute path?) | **Refresh works** (8c, same setup, en and ru). The action `$batch` carries two requests: `POST Products/CatalogService.importProducts` and `GET Products?$count=true&$select=HasActiveEntity,HasDraftEntity,ID,IsActiveEntity,category_code,currency_code,name,price,rating,stock&$expand=DraftAdministrativeData(...),category(...)&$filter=(IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null)&$skip=0&$top=30`. With the result message box still open (en "Information / Products imported: 3. / OK"; ru title U+0418 U+043D U+0444 U+043E U+0440 U+043C U+0430 U+0446 U+0438 U+044F, text U+0418 U+043C U+043F U+043E U+0440 U+0442 U+0438 U+0440 U+043E U+0432 U+0430 U+043D U+043E U+0020 U+0442 U+043E U+0432 U+0430 U+0440 U+043E U+0432: 3., button U+041E U+041A) the table binding count is 18 and the header shows "Products (18)"; 18 after closing; the parameter dialog closes on success. Console at `sap-ui-log-level=WARNING` (positive control: 38 warnings logged per run, e.g. the known `initialLoad` deprecation): compared with the valid-upload run before the amendment (6.3), no new message in en; in ru the only extra line is the ru-bundle variant of the known `T_NEW_OBJECT|Products` assert; no `Failed to read path ... $select` TypeError and no message about the absolute side-effect path. Imported rows deleted afterwards (15 active, 0 drafts) |

## 7. Phase 3 amendment: framework facts (`architect`, 2026-09-25)

User decisions of 2026-09-25 on 6.2 and 6.3 (CONTEXT "User decisions" 16 and 17); the decisions are ADR-0021 "Amendment" A and B.

### 7.1 Refresh after the action (6.3)
- fiori-mcp "Side Effects" step 6: "If an action applies changes to an entity, these changes are only reflected on the UI after adding a side effect annotation to that action." Steps 7 and 9: an unbound action, and any action whose target is not reached by a navigation path, name the entity set with an absolute path `/<Namespace>.EntityContainer/<EntitySet>` in `TargetEntities` (CAP sample: `@Common.SideEffects: {TargetEntities: ['/sap.fe.core.Service.EntityContainer/RootEntity']}`).
- fiori-mcp "Side Effects — SAP Fiori elements" step 1, default side effects: create, delete, draft create, discard and activate, and "Triggering an action: refresh collection automatically when action is bound and returned instance does not match bound instance (e.g., copy)". `importProducts` returns `Integer`, so no default applies; this matches 6.3 (no `GET` after the action).
- Scratchpad compile (`architect`, cds 10.0.6, phase 3 look-ahead on the working tree of step 8): `annotate CatalogService.Products with actions { importProducts @Common.SideEffects: { TargetEntities: ['/CatalogService.EntityContainer/Products'] }; };` adds 9 EDMX lines inside the existing `<Annotations Target="CatalogService.importProducts(Collection(CatalogService.Products))">`: a `Common.SideEffectsType` record whose `TargetEntities` holds `<NavigationPropertyPath>/CatalogService.EntityContainer/Products</NavigationPropertyPath>`. The generated `Common.SideEffects #alwaysFetchMessages` of the draft root is qualified and on the entity type, so there is no clash.

### 7.2 Required file parameter (6.2)
Not stated by any fiori-mcp document; read from the UI5 1.152.0 CDN debug sources (the version the app loads, `sap-ui-version.json` of 2026-09-02), 2026-09-25:
- `sap/fe/macros/coreUI/OperationParameterDialog-dbg.js`, `createFormElement` and `createFileUploader`: a complex-type parameter with an `Edm.Stream` property renders a `sap.ui.unified.FileUploader`; the label text comes from the stream property's `Common.Label`, but `required` (the `Label.required` and the FileUploader custom data `isRequired`) comes from `FieldControlHelper.isRequiredExpression(parameter)`, which reads only the **parameter's** `Common.FieldControl` (`Mandatory` or 7). `Nullable="false"` from `not null` is not read, nor a `FieldControl` on the stream element `content`. This explains 6.2 (no asterisk). fiori-mcp "Action Parameters — Declaration" calls `Nullable="false"` parameters mandatory; UI5 1.152 does not mark them.
- `sap/fe/core/ActionRuntime-dbg.js`, `validateProperties` (run first by the OK button, `onApply`): for a FileUploader whose `isRequired` is `"true"` and whose value is empty, it sets `valueState` Error with the framework text `C_OPERATIONS_ACTION_PARAMETER_DIALOG_FILE_MISSING_MANDATORY_MSG` (en `Upload a file for "{0}".`, ru U+0417 U+0430 U+0433 U+0440 U+0443 U+0437 U+0438 U+0442 U+0435 U+0020 U+0444 U+0430 U+0439 U+043B U+0020 U+0434 U+043B U+044F "{0}".; `{0}` is the label, here "Excel File (.xlsx)"), focuses the field and returns false: no request, the dialog stays open. `handleFileUploaderChange` resets the state to None when a file is chosen.
- cds-mcp "`@mandatory`": it "adds a corresponding `@FieldControl` annotation to the EDMX so that OData / Fiori clients would enforce a valid entry". Scratchpad compile (same run as 7.1): `annotate CatalogService.Products with actions { importProducts(file @mandatory); };` adds exactly one EDMX line, `<Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Mandatory"/>`, inside `<Annotations Target="CatalogService.importProducts(Collection(CatalogService.Products))/file">`.
- Not known: whether cds 10.0.6 validates `@mandatory` on an action parameter on the server. Today a missing `file` reaches the handler, `decodeContent` turns it into an empty buffer and the workbook check rejects it; row 6.5 records the answer after the annotation.

### 7.3 Contract figures (look-ahead, `architect`, scratchpad compile, cds 10.0.6)
| State | `metadata.xml` lines | `git diff --numstat` against `1a1199f` (phase 2 commit) |
|---|---|---|
| Phase 2 commit `1a1199f` | 678 | |
| Step 8 as delivered (`UI.DataFieldForAction`, uncommitted) | 687 | +9 −0 |
| Phase 3 with amendment A (`Common.SideEffects`, +9) and B (`Common.FieldControl`, +1) | 697 | +19 −0 (the phase 3 gate figure) |

## 8. Phase 5 amendment D: decompression guard (`architect`, 2026-09-28)

Scratchpad measurements, Node 22.23.2 on macOS, 4,144 MB heap limit, `read-excel-file` 9.3.10, `unzipper-esm` 0.13.3. Crafted files are the valid fixture unzipped, with `xl/worksheets/sheet1.xml` or `xl/sharedStrings.xml` replaced and zipped with `zip -9`; "dd" means zipped to a pipe (`zip -r - ... | cat`), so every entry has flag bit 3 and a data descriptor. The functions were called directly (`readImportRows`, the prototype `unzippedSize` of 8.4), not through the action handler. RSS is the peak of the process (`/usr/bin/time -l`); the baseline of a process that has loaded both is 53-55 MB. The figures describe the phase 5 branch state (`3551425`) plus the prototype, not an implemented guard.

### 8.1 Without the guard (`readImportRows` of `3551425`)
| Crafted workbook | xlsx / JSON body | Unzipped | Result | Time | Peak RSS |
|---|---|---|---|---|---|
| One shared string of 200 MB | 207,036 / 276,178 B | 210 MB | accepted as a 1-row workbook | 295 ms | 489 MB |
| One shared string of 700 MB, sizes in the headers | 715,842 / 954,586 B | 734 MB | `NOT_XLSX` (V8 string limit) | 651 ms | 791 MB |
| The same, dd | 716,646 / 955,658 B | 734 MB | `NOT_XLSX` | 660 ms | 1,475 MB |
| The same, local header declares 100 bytes | 715,842 B | 734 MB | `NOT_XLSX` (the reader truncates into `Buffer.alloc(100)`, but inflates everything) | 426 ms | 90 MB |
| The valid fixture re-zipped with sizes in the headers, `xl/sharedStrings.xml` declaring 1.5 GiB | 3,547 B | 5 KB | `NOT_XLSX` (the reader allocates `Buffer.alloc(1.5 GiB)`; zero pages are not resident on macOS) | 10 ms | 53 MB |
| 1,000,000 one-cell rows with cell references | 5,033,683 B (over the body limit) | 55 MB | parsed | 1.2 s | 834 MB |
| 200,000 one-cell rows with cell references | 1,010,280 B (over the body limit) | 10.8 MB | parsed | 229 ms | 182 MB |
| 1,000,000 rows without cell references, or repeating `r="2"` | 654,935 / 134,371 B | 168 / 45 MB | `NOT_XLSX` (the parser needs `r` on every `<c>`) | 70-166 ms | 164-409 MB |
| The 700 MB files in a `worker_threads` Worker, `resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 }` | as above | 734 MB | `NOT_XLSX` | 550-663 ms | 772 MB (sizes in headers), 1,478 MB (dd) |

Row-count bombs are bounded by the body limit (a cell reference per cell deflates only ~10:1, ~155,000 one-cell rows per 1 MB body); a single large text value deflates ~1000:1, and one request costs up to 1.5 GB. `resourceLimits` does not bound it: inflated entries are `Buffer`s, external memory outside the V8 heap.

### 8.2 With the prototype guard (`unzippedSize`, limit 10 MiB = 10,485,760 B)
| Workbook | xlsx / JSON body | Guard result | Guard time | Peak RSS |
|---|---|---|---|---|
| `test/fixtures/products-import-valid.xlsx` (also re-zipped dd, and with directory entries) | 3,201 / 4,398 B | `{ size: 5403 }`, then 3 rows parsed | 0-1 ms | 55 MB |
| `test/fixtures/products-import-invalid.xlsx` | 3,176 / 4,366 B | `{ size: 5460 }`, then 6 rows parsed | 0 ms | 55 MB |
| 1,000 rows, 500-character prose descriptions (the test "accepts 1000 rows whose request body exceeds 100 KB") | 165,893 / 221,322 B | `{ size: 748371 }` (0.71 MB), then 1,000 rows | 1 ms | 81 MB |
| 1,000 rows, every text column at its maximum length (100 / 500 / 500), repetitive Cyrillic | 178,251 / 237,798 B | `{ size: 1019768 }` (0.97 MB) | 2 ms | 102 MB |
| 1,000 rows at maximum lengths, random printable ASCII | 979,392 / 1,305,986 B (over the body limit) | `{ size: 1533937 }` (1.46 MB) | 3 ms | 101 MB |
| 1,000 rows at maximum lengths, random Cyrillic | 1,119,628 / 1,492,970 B (over the body limit) | `{ size: 2495163 }` (2.38 MB) | 5 ms | 107 MB |
| One description of 9 MiB (built in memory with `write-excel-file`) | 12,191 / 16,386 B | `{ size: 9441591 }`, then parsed | 3 ms | 142 MB (incl. building the 9 MiB string) |
| One description of 11 MiB (the regression-test size) | 14,236 / 19,114 B, built in 107 ms | `TOO_LARGE` (inflate cap: `write-excel-file` writes data descriptors) | 3 ms | 113 MB (incl. building the string) |
| 700 MB shared string, sizes in the headers | 715,842 B | `TOO_LARGE` (declared size) | 0 ms | 53 MB |
| 700 MB shared string, dd | 716,646 B | `TOO_LARGE` (inflate cap) | 3 ms | 63 MB |
| 700 MB shared string, local header declares 100 bytes | 715,842 B | `TOO_LARGE` (inflate cap) | 3 ms | 63 MB |
| Valid fixture, `xl/sharedStrings.xml` declaring 1.5 GiB | 3,547 B | `TOO_LARGE` (declared size) | 1 ms | 52 MB |
| 200 MB shared string; the row-count files of 8.1 | 134 KB - 26 MB | `TOO_LARGE` | 0-1 ms | 53-78 MB |

A legitimate 1,000-row workbook unzips to at most 2.4 MB even with random text at every maximum length, and those files already exceed the 1 MB body limit; the limit leaves 4x room over that and 14x over the test workbook. What the guard admits costs at most ~150 MB RSS (the 9 MiB row, parsed), against 1.5 GB without it.

### 8.3 Library facts behind the walk (sources in `node_modules`, 2026-09-28)
- `read-excel-file/node` exports `readSheet(input, sheet?, options?)` with `input` a path, `Stream`, `Buffer` or `Blob`; `readSheetNode.js` calls `unpackXlsxFile(input)` then `parseSheet(...)`. No option takes pre-unzipped entries or a custom unzip; `parseSheet` is internal.
- `unpackXlsxFileNode.js` pipes the input through `InputValidationStream` into `unzipFromStream` (`modules/zip/unzipFromStream.js`, which re-exports the `unzipper` implementation). Entries whose path does not end in `.xml` or `.xml.rels` are autodrained, not inflated. For a kept entry with a known size it allocates `Buffer.alloc(<declared uncompressed size>)` and copies the chunks into it (truncating extra bytes); with an unknown size (flag bit 3 and compressed size 0) it collects every chunk and concatenates them at the end.
- `unzipper-esm` 0.13.3 `lib/parse.js` `_readRecord`: reads a 4-byte signature and dispatches on `0x04034b50` (local file, checked first, also after the central directory), `0x02014b50` (central directory, sets `reachedCD`), `0x06054b50` (end record: reads it and ends the stream), and after `reachedCD` any other signature skips to the next end-record signature; before the central directory any other signature is an `INVALID_SIGNATURE` error. `_readFile`: `compressionMethod` non-zero means `zlib.createInflateRaw()`, zero means stored; `fileSizeKnown = !(flags & 0x08) || compressedSize > 0`; known: exactly `compressedSize` bytes; unknown: bytes up to the data-descriptor signature `50 4b 07 08`, then 16 descriptor bytes. `lib/parseExtraField.js` replaces a size of `0xFFFFFFFF` by the zip64 extra field (`0x0001`).
- `write-excel-file` 4.1.1 writes every entry with flag bit 3 and sizes 0 in the local header (checked on an in-memory workbook), so the committed fixtures and every test workbook take the "unknown size" path of the walk and are bounded by the inflate cap, not by a declared size. The declared-size check is defence in depth for archives with sizes in the headers (Excel, `zip`): on macOS a 1.5 GiB declaration cost no resident memory (8.1), another allocator may commit it.
- Node.js 22 `zlib.inflateRawSync(buffer, { maxOutputLength })` throws a `RangeError` with `code` `ERR_BUFFER_TOO_LARGE` as soon as the output would exceed the limit, so the guard's own memory stays within the budget (measured in 8.2: 63 MB peak for the 700 MB files).

### 8.4 Reference walk (prototype of 8.2; `cap-backend-dev` writes the production version with JSDoc, named constants and the error codes of ADR-0021 amendment D)
```js
import zlib from 'node:zlib';
const LOCAL = 0x04034b50, CENTRAL = 0x02014b50, END = 0x06054b50;
const DESCRIPTOR = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
const ZIP64 = 0xffffffff;
export function unzippedSize(bytes, limit) {
  let offset = 0, total = 0, reachedCentral = false;
  while (offset + 4 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (signature === LOCAL) {
      if (offset + 30 > bytes.length) return { error: 'INVALID' };
      const flags = bytes.readUInt16LE(offset + 6);
      const method = bytes.readUInt16LE(offset + 8);
      const compressed = bytes.readUInt32LE(offset + 18);
      const declared = bytes.readUInt32LE(offset + 22);
      const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
      if (compressed === ZIP64 || declared === ZIP64) return { error: 'TOO_LARGE' };
      const sizeKnown = !(flags & 0x08) || compressed > 0;
      if (sizeKnown && declared > limit - total) return { error: 'TOO_LARGE' };
      const end = sizeKnown ? start + compressed : bytes.indexOf(DESCRIPTOR, start);
      if (end < 0 || end > bytes.length) return { error: 'INVALID' };
      const data = bytes.subarray(start, end);
      let size = data.length;
      if (method !== 0 && data.length) {
        try {
          size = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, limit - total) }).length;
        } catch (err) {
          return { error: err.code === 'ERR_BUFFER_TOO_LARGE' ? 'TOO_LARGE' : 'INVALID' };
        }
      }
      total += size;
      if (total > limit) return { error: 'TOO_LARGE' };
      offset = sizeKnown ? end : end + 16;
    } else if (signature === CENTRAL) {
      if (offset + 46 > bytes.length) return { error: 'INVALID' };
      reachedCentral = true;
      offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    } else if (signature === END || reachedCentral) {
      break; // the reader stops at the end record; after the central directory it skips to it
    } else {
      return { error: 'INVALID' };
    }
  }
  return { size: total };
}
```

### 8.5 Test sizing
- Service test: one row whose `description` is `'a'.repeat(MAX_UNZIPPED_BYTES + 2 ** 20)` built with `workbook()` of `test/fixtures/build-workbooks.mjs`: 14 KB xlsx, 19 KB body, about 0.1 s to build, rejected by the inflate cap (data descriptors).
- Unit tests pass a small `limit` (for example 64 KiB) to `unzippedSize`: a `workbook()` with a 256 KiB `description` gives `TOO_LARGE` (inflate cap), the valid fixture gives `{ size }` between its byte length and 64 KiB (5,403 in the prototype), `Buffer.from('name;price')` gives `INVALID`, an empty buffer gives `{ size: 0 }` (then `readSheet` reports `NOT_XLSX`, as today).
- The two declared-size branches need sizes in the local header, which `write-excel-file` never writes: a test helper builds a one-entry archive by hand (a 30-byte local header with signature `0x04034b50`, method 8 at offset 8, compressed length at 18, declared size at 22, name length at 26, then the name and `zlib.deflateRawSync(content)`). Declared `limit + 1` with the content `'x'` gives `TOO_LARGE` without inflating; declared 0 with 256 KiB of `'a'` gives `TOO_LARGE` by the inflate cap; an honest 1,000-byte entry gives `{ size: 1000 }`; two honest 40,000-byte entries against 64 KiB give `TOO_LARGE` (the budget spans the archive). Dry run against the prototype, 2026-09-28: all cases as stated.
