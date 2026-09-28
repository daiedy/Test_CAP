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
- Measured on UI5 1.152 in #7 (write these as facts next time, cite the feature's ADR-0021): dialog title = `DataFieldForAction` label, not the action `@title`; `mediaType`/`fileName` get no inputs; `not null` on the parameter gives NO asterisk and a silent empty submit, only `@mandatory` on the parameter (emits `Common.FieldControl`) gives the asterisk plus a value-state Error with the framework text `C_OPERATIONS_ACTION_PARAMETER_DIALOG_FILE_MISSING_MANDATORY_MSG`; one `req.info` result = Information message box with OK, not a toast; a collection-bound action returning a scalar does NOT refresh the list, `Common.SideEffects` with absolute `TargetEntities` `/<Service>.EntityContainer/<Set>` does ("Side Effects" step 6); a 400 with details = one message dialog led by CAP's "Multiple errors occurred..." header, and the parameter dialog stays open with the file chosen.
- `get_api_reference sap.ui.unified.FileUploader` output exceeds the tool limit; Grep the saved file for `experience.sap.com` (gives the upload-collection guideline) and `fileType|mimeType|typeMissmatch`.

Related: [[fiori-mcp-search-outage]], [[docs-cyrillic-code-points]], [[filter-bar-design-sources]].
