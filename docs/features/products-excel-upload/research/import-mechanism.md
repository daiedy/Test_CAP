# products-excel-upload: import mechanism research

Author: `architect`, 2026-09-25. Read by `architect` and `reviewer`; implementers read only the sections a PLAN step names. Sections 5 and 6 are filled by the implementers at the phase 2 and phase 3 measurements.

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
| 5.1 | EDMX type of `ProductsImportFile.content` (`Edm.Binary` or `Edm.Stream`) and of the action (`IsBound`, binding parameter `Collection(CatalogService.Products)`) | |
| 5.2 | Shape of `req.data.file.content` in the handler for a JSON POST with base64 content | |
| 5.3 | `this.run(INSERT.into(Products).entries(row))` inside the handler: does `ASSERT_MANDATORY` fire (row without `name`)? `ASSERT_RANGE` (`stock` -1)? `ASSERT_TARGET` (`category` `NOPE`)? Error `code`, `target`, `args` of each | |
| 5.3a | Non-numeric text in `price` or `stock` passed unchanged to the internal `INSERT`: does the framework reject it (code, args)? If not, stop and report to `architect` | |
| 5.4 | The internal `INSERT` writes an active row (visible with `IsActiveEntity=true`), no draft | |
| 5.5 | `viewer` → 403 on the action, anonymous → 401 | |
| 5.6 | Base64 byte size of the 1,000-row fixture; fits 100 KB? | |
| 5.7 | Duration of a 1,000-row import (per-row `INSERT`) on SQLite in-memory | |

## 6. Phase 3 measurements (to be filled by `fiori-app-dev`)

| # | Question | Result |
|---|---|---|
| 6.1 | The toolbar shows the Import button for `alice`, not for `viewer` (List Report, both roles) | |
| 6.2 | The action parameter dialog renders a file field (control class, accepted types) for the collection-bound action on UI5 1.152 | |
| 6.3 | Uploading the valid fixture sends the action (request body shape) and the table shows the new rows without a manual refresh | |
| 6.4 | The 400 with `details` is shown as a message list naming each row | |
