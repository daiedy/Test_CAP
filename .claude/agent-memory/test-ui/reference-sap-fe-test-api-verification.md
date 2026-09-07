---
name: sap-fe-test-api-verification
description: Where to verify sap.fe.test OPA API signatures (FooterActionsOP, HeaderActions, FormActions, MacroFieldBuilder) when fiori-mcp search_docs is down; what the ui5-test-runner report does and does not contain
metadata:
  type: reference
---

`mcp__fiori-mcp__search_docs` failed on 2026-09-07 in two sessions with "Search is currently unavailable. The embeddings service failed to initialize" (every query, `searchType: limited_fallback`). Accepted fallback (recorded in PLAN step 7 of `products-draft-edit`): read the debug sources of the exact UI5 version the app loads from the CDN.

- Version: `curl https://ui5.sap.com/resources/sap-ui-version.json` (1.152.0 on 2026-09-07; `index.html`, `flpSandbox.html` and the Test Starter pages all load `https://ui5.sap.com/resources/...` without a version, so the app and `sap.fe.test` are always on the CDN's latest).
- Sources: `https://ui5.sap.com/resources/sap/fe/test/<path>-dbg.js`, e.g. `api/FooterActionsOP` (`iExecuteSave`, `iExecuteCancel`, `iConfirmCancel` = press the `C_TRANSACTION_HELPER_DRAFT_DISCARD_BUTTON` text in a `sap.m.Popover`), `api/HeaderActions` and `api/HeaderAssertions` (there is no `HeaderActionsOP`; `iExecuteEdit`, `iCheckEdit`, `iCheckTitle(title, description)` match `sap.m.Title`/`sap.m.Label` texts), `api/FormActions` (`iChangeField`, `iOpenValueHelp` = F4 on the `sap.ui.mdc.Field`), `api/FormAssertions` (`iCheckField(field, value, state)`; state `required` works on the mdc Field), `builder/MacroFieldBuilder` (value/state matchers), `ObjectPage` (`iSeeObjectPageInEditMode`/`DisplayMode` read the `ui>/editMode` model). A 404 comes back as an HTML page, check the first bytes.

`ui5-test-runner` 5.14 report (`--report-dir`): `output.txt` has only the page total (`17/17`), `job.js` and `<pageId>/browser.json` carry no per-test list; per-test evidence is the QUnit module/test names in the journey plus data checks over OData (`$count`, `$filter=IsActiveEntity eq false`) and the `cds watch` log (`draftEdit`, `PATCH ...IsActiveEntity=false`, `draftActivate`, `DELETE`).

`npx prettier --check webapp/test/integration/` from `app/products` flags the pre-existing integration files (they were not formatted with the root `.prettierrc`); format only the file you changed, do not reformat the others in a test task.

Related: [[test-cap-ui-test-run-baseline]]
