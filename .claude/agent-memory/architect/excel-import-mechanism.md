---
name: excel-import-mechanism
description: Facts behind ADR-0021 (products-excel-upload, #7) - xlsx npm advisories, read-excel-file choice, FE file-upload action parameter, body limit, unmeasured CAP points
metadata:
  type: project
---

ADR-0021 (accepted by the user 2026-09-25, feature `products-excel-upload`, issue #7): parse server-side with `read-excel-file` (9.3.10), collection-bound action `importProducts(in: many $self, file: ProductsImportFile)`, one internal `INSERT` per row, all-or-nothing, FE action parameter dialog for the upload.

No standard Fiori Elements V4 file import exists (checked at the gate because the user expected one): only Export, clipboard paste (draft tables with creationMode Inline/InlineCreationRows, Object Page by default), the attachments Upload Table, and the Create dialog. Answer that question from this fact next time.

**Why:** `xlsx` on npm is frozen at 0.18.5 with two high advisories (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9); `exceljs` last stable 2023-10; `ui5-cc-spreadsheetimporter` bundles SheetJS from a CDN tarball and creates rows per OData request (drafts on a draft root). fiori-mcp documents "File upload as action parameter" (complex type with LargeBinary + `Core.MediaType` + `Core.IsMediaType` + `Core.ContentDisposition.Filename`), example instance-bound only. CAP body-parser default is 100 KB (`@cds.server.body_parser.limit` per service).

**How to apply:** Next feature touching files or bulk writes: ADR-0021 is accepted and amended (phase 3: `Common.SideEffects` refresh, `@mandatory` on `file`). Settled by research 5/6 of `docs/features/products-excel-upload/research/import-mechanism.md` (or its SUMMARY permalink after pruning): `@mandatory`/`@assert.range`/`@assert.target` DO fire on a service-internal `this.run(INSERT)` (one `MULTIPLE_ERRORS` per row, transaction survives a failed insert); `LargeBinary` with `@Core.MediaType` in a type becomes `Edm.Stream` and arrives in `req.data` as a base64 string; FE 1.152 renders the file field for a collection-bound action; a 1,000-row body needs `@cds.server.body_parser.limit: '1mb'`; success `req.info` shows as a message box, not a toast. Dialog and refresh facts: [[fe-v4-action-dialog-and-refresh]]. Adding any npm dependency touches protected `package-lock.json` - plan a `PIPELINE_ALLOW_PROTECTED=1` step. See [[cds10-draft-behavior]], [[role-aware-ui-singleton]].
