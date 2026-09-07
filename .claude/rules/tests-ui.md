---
paths:
  - "app/**/webapp/test/**"
---
# UI tests (app/<app>/webapp/test/)

## Before editing
1. Skills `ui5-best-practices-qunit` and `ui5-best-practices-opa5` from the `ui5` plugin.
2. `mcp__fiori-mcp__search_docs` for "OPA5 Fiori elements", `sap.fe.test.ListReport`, `JourneyRunner`.
3. `docs/architecture/TESTING.md`.

## Rules
- Structure: `test/testsuite.qunit.html` + `testsuite.qunit.js` (Test Starter), `test/unit/` for QUnit, `test/integration/` for OPA5 journeys, `test/e2e/` for wdi5.
- OPA5 for Fiori Elements: page objects on `sap.fe.test.ListReport` and `sap.fe.test.ObjectPage`. From `@sap-ux/ui5-test-writer` take only `pages/*.gen.js`; its `testsuite`, `opaTests.qunit.html` and `*Journey.gen.js` are legacy (no Test Starter, `iStartMyApp()` without an intent) and are replaced by hand. Start the app with the intent: `iStartMyApp('products-display', { 'sap-ui-language': 'ru' })`.
- Journeys export functions and `runner.run([...])` is called once in `opaTests.qunit.js`. The last `opaTest` of every journey is teardown only (`Given.iTearDownMyApp()`), otherwise a failed step leaves the frame open and the next journey fails with "Launch was called twice without teardown".
- A `ValueListWithFixedValues` dropdown in FE V4 is a typeahead `sap.m.Table` (id regex `<field>::Popover::.*SuggestTable$`, `isDialogElement(true)`), rows are `ColumnListItem` in MultiSelect; `FilterBarActions#iSelectDropDownOption` does not match it. Example page object: `webapp/test/integration/pages/CategoryDropdown.js`.
- QUnit: `const`/`let`, `async/await`, `assert.expect(N)` in every asynchronous test, `sinon.createSandbox()`.
- Running without a browser: `npm run test:ui` in `app/products` while `npm run watch` runs in the root (the runner targets `http://localhost:4004/products/webapp/test/testsuite.qunit.html`). Through `npm start` on :8080 the app does not start from the FLP sandbox, see LESSONS.
- `test/flpSandbox.html` is the application entry point, not a test; change it only through the `modernize-flp-sandbox` skill.

## After editing
- `npx ui5lint` in `app/<app>`: test pages are checked too (`prefer-test-starter`).
- Run the tests and attach the output.

## Forbidden
- Tests that depend on execution order or real timers.
- Deleting `flpSandbox.html` or `index.html`.
