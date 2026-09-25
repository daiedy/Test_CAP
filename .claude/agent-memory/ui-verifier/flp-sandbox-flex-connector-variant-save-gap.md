---
name: flp-sandbox-flex-connector-variant-save-gap
description: Test_CAP's flpSandbox.html has no flexibility-services connector configured, so My Views "Save As" silently fails and a later variant switch erases the unsaved change — reproduces on any field, not specific to custom filter fields
metadata:
  type: project
---

Found while verifying `products-rating-filter` (#6) on `npx cds serve --in-memory --port 4004`, UI5 1.152.0. This agent first mis-diagnosed the symptom as a custom-filter-field-specific gap (see corrected entry below); `fiori-app-dev` measured the real cause.

**Symptom**: on the List Report, change a filter, "My Views" → Save As a new variant, switch to another variant, switch back — the saved condition is gone (control back to default, table back to the unfiltered row count), even though the live filter worked correctly right up to the save.

**Root cause (measured by `fiori-app-dev`)**: `app/products/webapp/test/flpSandbox.html` sets no `data-sap-ui-flexibility-services`, so "Save As" goes to the framework's default `LrepConnector`, which needs a real backend Lrep endpoint. In this sandbox that endpoint doesn't exist: `HEAD /sap/bc/lrep/actions/getcsrftoken/` → 404, `GET /sap/bc/lrep/flex/data/products` → 404. The save listener fails with `Error: Not Found`, the change object stays `NEW` (never persisted), and `VariantManagerApply.handleSelectVariant` → `eraseDirtyChangesOnVariant` erases any `NEW` change when a different variant is selected. This reproduces identically with a plain annotation-based field (measured with `Category=KITCHEN` on `main`, no custom filter field involved) — it is **not** specific to manifest custom filter fields, `ExtensionAPI.setFilterValues`, or missing `PropertyInfo` (that was this agent's first, wrong, hypothesis).

**Confirmed fix**: injecting a `SessionStorageConnector` (e.g. via request interception in a verification session, or via `data-sap-ui-flexibility-services` in a real deployment) makes Save/Restore work correctly — a saved variant with `Category=KITCHEN` and a Rating band both restored correctly under that connector.

**How to apply**: any future feature that needs to verify "save a variant, switch away, switch back" in this project's `flpSandbox.html` will hit this same gap — it is not something a feature branch can fix by changing its own annotations or fragment code. Treat a failed variant-restore as sandbox debt first (check the two 404s in the network log) before assuming the feature's own filter/condition code is broken. The actual sandbox fix (adding a working flex connector to `flpSandbox.html`) is tracked as separate backlog debt, decided 2026-09-25, not bundled into whichever feature happens to notice it.

See also [[chrome-devtools-mcp-click-reliability]] for other verification-session gotchas found in the same run.
