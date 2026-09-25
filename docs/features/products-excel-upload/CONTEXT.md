# Products Excel upload: context

Date: 2026-09-25. Author: `architect`. Branch: `feature/products-excel-upload`.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts go to `research/import-mechanism.md`, read only by `architect` and `reviewer` unless a plan step names the file.

## Request
GitHub issue #7, "products-excel-upload: create products from an uploaded Excel workbook": on the List Report, a catalog editor adds products by uploading an Excel file instead of creating them one by one through the Object Page. Only a `CatalogEditor` may do it (ADR-0013); a viewer never sees the upload.

## User decisions
Plan gate, 2026-09-25 (user):
1. ADR-0021 accepted (after the check of item 11 below left the design unchanged).
2. Workbook format: a header row with the element names `name`, `description`, `price`, `currency`, `stock`, `category`, `rating`, `imageUrl`, case-insensitive, any order.
3. `category` and `currency` hold codes (`ELECTRONICS`, `USD`), never localized names.
4. No sample download in the app; it is a follow-up `/backlog` issue (not created by this feature). The valid fixture is the sample, described in `README.md`.
5. All-or-nothing: a file with any bad row writes nothing, and every bad row is reported.
6. At most 1,000 data rows per file.
7. Imported products are created active, no drafts.
8. A duplicate `name` is a row error, both within the file and against existing active products.
9. If the Fiori Elements action dialog shows no file field (PLAN step 8): stop for a short user gate before the fallback.
10. `PIPELINE_ALLOW_PROTECTED=1` is set in the environment of the feature session (checked by the orchestrator: `env=1`); PLAN step 3 needs no extra gate.
11. Button label "Import from Excel" (ru U+0418 U+043C U+043F U+043E U+0440 U+0442 U+0020 U+0438 U+0437 U+0020 Excel, "Import iz Excel"). The user expected a standard Fiori button for this; the check with `fiori-mcp` found none: Fiori Elements V4 offers Export, clipboard paste (Object Page inline tables) and the attachments Upload Table, but no file import into a List Report (`research/import-mechanism.md` section 3).
12. All row errors are shown, no cap (not 100).
13. The error response starts with `PRODUCTS_IMPORT_NOTHING_IMPORTED`, followed by the row messages.
14. Each missing mandatory column gets its own `PRODUCTS_IMPORT_MISSING_COLUMN` message.
15. The format hint lives only in the file field label ("Excel File (.xlsx)") and in `README.md`.

Phase 3, 2026-09-25 (user, on research 6.2 and 6.3):
16. The List Report refreshes after the import through `@Common.SideEffects` on `importProducts` (absolute `TargetEntities` `/CatalogService.EntityContainer/Products`), and PATTERNS gets the row "Refresh after an action" (ADR-0021 amendment A).
17. An empty submit of the import dialog is validated, not accepted as framework behaviour: `@mandatory` on the parameter `file` makes Fiori Elements mark the field required and show its own value-state error on an empty submit; no controller extension (ADR-0021 amendment B).

## Affected entities and services
From `mcp__cds-mcp__search_model` (`CatalogService.Products`) and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Object | Exists now | What changes |
|---|---|---|
| `CatalogService.Products` | projection on `my.catalog.Products`, `@odata.draft.enabled`, `@restrict` READ → `CatalogViewer`, `*` → `CatalogEditor`; only the draft actions `draftPrepare`, `draftActivate`, `draftEdit` | add the collection-bound action `importProducts(in: many $self, file: ProductsImportFile not null) returns Integer` (ADR-0021); `@mandatory` on its parameter `file` in `srv/annotations/Products.cds` (amendment B) |
| `CatalogService.ProductsImportFile` | does not exist | new service type: `content : LargeBinary` (`@Core.MediaType: mediaType`, `@Core.AcceptableMediaTypes` xlsx, `@Core.ContentDisposition.Filename: fileName`), `mediaType : String(100)` (`@Core.IsMediaType`), `fileName : String(255)` |
| `my.catalog.Products` | `name` String(100) `@mandatory`; `description` String(500); `price` Decimal(10,2) `@mandatory` `@assert.range [0, 99999999.99]`; `currency` → `Currencies` `@mandatory`; `stock` Integer `@mandatory` `@assert.range [0, 1000000]`; `rating` Integer `@assert.range [0, 5]`; `category` → `Categories` `@mandatory` `@assert.target`; `imageUrl` String(500) | no change; these annotations are the row checks of the import |
| `my.catalog.Categories` | code list, codes `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY` | no change; the workbook uses these codes |
| `sap.common.Currencies` | ISO codes from `@sap/cds-common-content` | no change; the workbook uses ISO codes |
| `CatalogService.Permissions` | read-only singleton, `isEditor` (ADR-0013) | no change; a fourth consumer: `UI.Hidden` on the new toolbar action |
| `srv/catalog-service.js` | one handler, `on READ Permissions` | add `on importProducts Products` |
| `app/products/annotations/Products.cds` | `UI.LineItem` with 5 data fields, `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` | add a `UI.DataFieldForAction` for `CatalogService.importProducts` with `UI.Hidden` for non-editors; `@Common.SideEffects` on the action (amendment A) |

The change adds an operation inside `@requires: 'authenticated-user'`; what an unauthenticated caller gets from any endpoint is unchanged (401), so the CI readiness probe, the `run-app`/`test-all` smoke curls, the `ui-verifier` server check and the README examples need no update.

## What already exists and is reused
- `@mandatory`, `@assert.range`, `@assert.target` on `Products` (`srv/annotations/Products.cds`): the row checks; the import handler does not repeat them (ADR-0021 decision 3).
- `@restrict` on `CatalogService.Products` (`srv/catalog-service.cds`): authorizes the bound action; no new `@requires` or `@restrict`.
- `CatalogService.Permissions` singleton and the `$edmJson` `$Not` `$Path` expression of `app/products/annotations/Products.cds`: reused verbatim for `UI.Hidden` of the action.
- `_i18n/messages.properties`, `messages_ru.properties`: exist with 0 keys; the import adds the first `PRODUCTS_IMPORT_*` keys.
- `test/catalog-service.test.js` auth and draft idioms (`defaults.auth`, `{ auth: null }` → 401, `rejectedWith(/403/)`, `IsActiveEntity=true` reads).
- OPA5 page objects `ProductsList.gen.js`, `JourneyRunner.js`; `RoleAwareActionsJourney.js` as the reference for a toolbar-visibility assertion.
- The Fiori Elements action parameter dialog's own required-file check (value state Error, framework text, no request), switched on by the `Common.FieldControl` that `@mandatory` emits (research 7.2); no project text, no controller.
- Nothing suitable exists for parsing, a file parameter, a bulk create or a controller extension: `docs/registry/REUSE-CATALOG.md` lists no `srv/lib` function, `HANDLERS.md` one handler, `UI-ARTIFACTS.md` only the `RatingRangeFilter` fragment.

## Applicable patterns
- "Action on a set or without context" (bound to the collection, ADR-0021 decision 2); "Business logic error" (`req.error`/`req.reject` with `_i18n/messages.properties` keys); "Logging"; "Shared function for several handlers" (`srv/lib/products-import.js`).
- "Mandatory field", "Format or range check", "Association target existence check": reused as the row checks, not re-implemented; "Mandatory field" also for the action parameter `file` (amendment B).
- "Authorization" (`@restrict` inherited) and "Role-aware UI visibility" (singleton, `UI.Hidden` on the action record).
- "Action button" (`DataFieldForAction` in `UI.LineItem`); "Refresh after an action" (`Common.SideEffects`, amendment A); "Client-side logic" only in the ADR-0021 fallback.
- "Texts" (en and ru; annotation labels in `_i18n`), "Service test", "OData contract", "metadata.xml snapshot update", "User scenario".
- ADR needed: parsing library, file transport, bulk create on a draft root, all-or-nothing, duplicates, workbook contract, first new runtime dependency: `docs/decisions/ADR-0021-products-excel-import.md` (accepted 2026-09-25; amended in phase 3 for the refresh and the required file).

## Relevant lessons
- `docs/architecture/TESTING.md` "cds 10 specifics": a POST without `IsActiveEntity: true` creates a draft and skips `@mandatory`; the import writes active rows through the service, never through a draft.
- LESSONS 2026-09-25 (UI5 logs at ERROR level by default): a "no new console warning" claim needs `sap-ui-log-level=WARNING` and a positive control.
- LESSONS 2026-09-16 (`Permissions/isEditor` `$select` TypeError): a new `$Path` consumer may add one more instance of the known noise; verify List Report in both roles.
- CHANGELOG 2026-09-23: a hidden-by-singleton control can fail asymmetrically; `ui-verifier` checks the button as `viewer` and as `alice`.

## Open questions
None; the plan gate of 2026-09-25 answered all of them (see "User decisions").
