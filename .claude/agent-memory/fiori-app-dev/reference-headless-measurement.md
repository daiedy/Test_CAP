---
name: reference-headless-measurement
description: How to measure the running FE app without chrome-devtools MCP - global puppeteer, $batch body parsing, UI5 log level, zsh arg pitfall
metadata:
  type: reference
---

When chrome-devtools MCP is not in the agent's tool list, puppeteer is installed globally at `/opt/homebrew/lib/node_modules/puppeteer` (Chrome 152 in `~/.cache/puppeteer`). Load it from a scratchpad `.mjs` with `createRequire("/opt/homebrew/lib/node_modules/")`, `page.authenticate({ username: "alice", password: "" })`, URL `http://localhost:4004/products/webapp/test/flpSandbox.html?sap-language=en#products-display`.

- OData reads are inside `$batch` POST bodies: parse `req.postData()` lines starting with `GET Products?`.
- UI5 on the CDN logs only errors by default: add `sap-ui-log-level=WARNING` to the URL before claiming "no warning", and run a positive control that triggers the warning on purpose.
- In zsh, `node x.mjs $a` with `a="ru alice"` passes ONE argument (no word splitting); pass arguments literally.
- Controls via `sap.ui.require("sap/ui/core/Element").registry.all()` inside `page.evaluate` (measurement code only, never app code).
- Open dialogs (FE action dialog, message box): iterate the registry for `sap.m.Dialog` with `isOpen()`; the DOM class `.sapMMessageBox` did not match the FE result box. FE action dialog id `fe::APD_::<Service>.<action>`, buttons `...::Action::Ok`/`Cancel`; the FileUploader id is generated.
- File upload: `(await page.$("input[type=file]")).uploadFile(path)`, then `firePress` on the dialog OK button. Any probe import changes the shared :4004 data: delete the created rows afterwards (other agents count 15 rows).

- Mock mode without auth: `npx fiori run --config ./ui5-mock.yaml --port 8089` in `app/products` (background), URL `http://localhost:8089/test/flpSandbox.html?...#products-display&/Products(ID=<id>,IsActiveEntity=true)`. Wait on the control registry (e.g. the `sap.m.Table` whose id contains `details` has items), not on DOM classes: `.sapUxAPObjectPageSectionTitle`/anchor-bar selectors never matched on Horizon and the wait timed out although the page was rendered.

- Measure an annotation variant without touching `srv/`: a scratch `/tmp/x.cds` with `using from '<abs>/srv/catalog-service'; using from '<abs>/app/products/annotations';` plus the `annotate`, served by `npx cds serve /tmp/x.cds --in-memory --port 4007` from the repo root (app and seed data still load; the `cds_outbox_Messages` error is harmless). Draft edit: `firePress` on the button id ending `StandardAction::Edit`; type into a field via `el.select()` + `keyboard.type`; pressing Enter also fires a `draftPrepare` POST.

- Amount + currency field (mdc Field, Currency composite): the two inner `input`s are `...::Field-edit-inner-inner` (amount) and `...-inner-unit-inner`; clear with `el.focus()` + `el.evaluate(i => i.select())` (triple click and Meta+A appended text); Tab from the amount stays inside the field and sends nothing, Tab twice leaves it and fires the `PATCH`. The mock server keeps a draft between runs: the next run on the same product finds no Edit button, use another product ID. Customizing proof: `getMetaModel().requestCurrencyCodes()`.

Used for products-rating-filter step 4 (research section 8) and products-excel-upload steps 8/8c (research section 6). Related: [[project-fiori-mcp-no-filterfields-livemode]].
