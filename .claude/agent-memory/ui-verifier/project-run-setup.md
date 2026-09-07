---
name: project-run-setup
description: How to stand up and reach Test_CAP's UI for browser verification (server, URL, locale switch)
metadata:
  type: project
---

Test_CAP's Fiori Elements V4 app is only reachable through the CAP server, not the standalone UI5 dev server.

- Start with `npm run watch` from the repo root (not `app/products && npm start`, which serves on :8080 and does not expose `/products/webapp` the way `flpSandbox.html` expects). Wait for `curl -sf 'http://localhost:4004/odata/v4/catalog/$metadata'` to return 200 before opening the browser (it came up in ~1 poll cycle / a few seconds in practice).
- List Report entry point: `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`.
- Russian locale: append `?sap-ui-language=ru` **before** the `#` hash, e.g. `http://localhost:4004/products/webapp/test/flpSandbox.html?sap-ui-language=ru#products-display`. Putting it after the hash is silently ignored.
- Mock mode (`npm run start-mock` in `app/products`) does not honor `Accept-Language` / `sap-ui-language` — never use it to verify `ru` locale scenarios; only useful for `en`-only smoke checks without a backend.
- Kill only the server you started yourself: `pkill -f "cds watch"` (started via `nohup npm run watch &`), then confirm with the same `curl` returning non-200.

See also [[fe-v4-dropdown-valuehelp-verification]] for how to drive and screenshot the actual UI once it's up.
