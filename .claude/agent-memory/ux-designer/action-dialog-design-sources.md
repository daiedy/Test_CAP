---
name: action-dialog-design-sources
description: Which fiori-mcp docs cover a FE V4 toolbar action with a parameter dialog, file-upload parameters and action messages, and what stays inferred (dialog title source, toast vs dialog, refresh)
metadata:
  type: reference
---

Verified 2026-09-25 while designing `products-excel-upload` (#7); all queries answered, no outage.
- "Enabling Stream Support (OData V2 & V4)", section "File upload as Action Parameter": complex-type parameter with stream + `Core.MediaType`/`IsMediaType`/`ContentDisposition.Filename`/`AcceptableMediaTypes`; example is instance-bound; the ABAP variant marks mimetype and filename `@UI.hidden`; the CAP example declares the parameter `not null`.
- "Actions in the List Report": action types (confirmation, input dialog, immediate, navigation) - the citable basis for "parameter dialog".
- "Adding Action Buttons to Forms" step 5: `UI.Hidden` hides the button entirely; step 8 carries the Action placement guideline URL (experience.sap.com/fiori-design-web/action-placement/).
- "Using Messages in SAP Fiori Elements" step 8: bound vs unbound messages, toast only for exactly one bound success message, unbound messages in a message dialog.
- "Localization of UI Texts": action-scoped FE text overrides need `enhanceI18n` (a manifest change) - avoid, use annotation labels.
- "Upload Table" / "Enabling File Upload for ... Table": one entity per file, not for bulk import.
- Not in the snapshot: which label becomes the parameter dialog title, whether the dialog stays open on error, table refresh after a collection-bound action, focus return. Mark inferred and hand to the phase 3 measurement / verifier.
- `get_api_reference sap.ui.unified.FileUploader` output exceeds the tool limit; Grep the saved file for `experience.sap.com` (gives the upload-collection guideline) and `fileType|mimeType|typeMissmatch`.

Related: [[fiori-mcp-search-outage]], [[docs-cyrillic-code-points]], [[filter-bar-design-sources]].
