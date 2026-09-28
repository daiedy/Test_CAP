---
name: test-cap-demo-user-roles
description: Actual role mapping of Test_CAP's mock auth users (package.json cds.requires.auth.users) — bob is CatalogEditor, not CatalogViewer
metadata:
  type: project
---

`package.json` → `cds.requires.auth.users` currently defines:
- `alice`: `["CatalogEditor"]`
- `bob`: `["CatalogEditor"]` — **not** a viewer, despite the name suggesting a second/alternate persona
- `viewer`: `["CatalogViewer"]` — this is the actual read-only demo account

Confirmed 2026-09-25 while verifying `products-excel-upload` (#7): a task briefing described `bob` as "CatalogViewer", which was wrong. `GET /odata/v4/catalog/Permissions?$select=isEditor` as `bob` returned `isEditor:true` (same as `alice`), and `bob` saw "Create", "Delete" and the feature's own "Import from Excel" button in the List Report toolbar — all editor-only controls. Switching to `viewer` (`isEditor:false`) reproduced the expected read-only toolbar (no Create/Delete/Import, not even disabled).

**How to apply**: for any future viewer-role UI scenario in this project, use `viewer`, not `bob`. If a task briefing or PLAN.md names `bob` as the viewer, verify with a quick `curl -u bob: '.../Permissions?$select=isEditor'` before trusting it — this file itself can drift again if `package.json` changes. Before recommending, re-check `package.json`'s `cds.requires.auth.users` for the current mapping.

See also [[fe-v4-basic-auth-session-priming]] for how to open a second isolated-context tab for a different user.
