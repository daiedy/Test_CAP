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

Used for products-rating-filter step 4 (research section 8). Related: [[project-fiori-mcp-no-filterfields-livemode]].
