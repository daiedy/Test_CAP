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
- Back to the List Report from the Object Page: `onHeader().iNavigateByBreadcrumb('<TypeNamePlural>')` passes without navigating when the Breadcrumbs macro carries no links (measured 2026-09-09 in edit mode: `nav#...--fe::Breadcrumbs` carried the class `sapMBreadcrumbsCurrentLocation` and no link), so the run fails as a timeout on the next assertion instead of on the navigation step. Fallback: `Given.iTearDownMyApp()` at the end of the case that leaves edit mode and `Given.iStartMyApp('products-display')` at the start of the next one; the journey still ends with a teardown-only case. The restart is dialog-free once the draft change is persisted server-side, unlike shell Back, which opens Save / Keep Draft / Discard Draft. Example: `webapp/test/integration/DraftMarkerInListReportJourney.js`.
- A `ValueListWithFixedValues` dropdown in FE V4 is a typeahead `sap.m.Table` (id regex `<field>::Popover::.*SuggestTable$`, `isDialogElement(true)`), rows are `ColumnListItem` in MultiSelect; `FilterBarActions#iSelectDropDownOption` does not match it. Example page object: `webapp/test/integration/pages/CategoryDropdown.js`.
- Adding `@Common.SemanticKey` does not invalidate existing OPA5 row assertions: the semantic-key cell becomes a `sap.m.ObjectIdentifier`, which `sap/fe/test/builder/MacroFieldBuilder.js` matches on its `title`, so `iCheckRows({ <prop>: value }, N)` and `iPressRow({ <prop>: value })` keep matching unchanged and no journey needs an edit. Assert the marker itself with the third argument: `iCheckRows(values, N, { isDraft: true })` (ADR-0015).
- QUnit: `const`/`let`, `async/await`, `assert.expect(N)` in every asynchronous test, `sinon.createSandbox()`.
- Running without a browser: `npm run test:ui` in `app/products` against the server started the way CI starts it, `npx cds serve --in-memory --port 4004` in the root (the runner targets `http://localhost:4004/products/webapp/test/testsuite.qunit.html`). Measured 2026-09-10: against `cds watch` the runner registered no test page at all (`testPageUrls: []`, "No test page found (or all filtered out)") on one instance and hung the probe navigation for 20 minutes on a second, concurrent one, while the same tree ran 23/23 in 68 s against `cds serve`. Use `cds serve` for a test run and keep `npm run watch` for development. Through `npm start` on :8080 the app does not start from the FLP sandbox, see LESSONS.
- `test/flpSandbox.html` is the application entry point, not a test; change it only through the `modernize-flp-sandbox` skill.

## After editing
- `npx ui5lint` in `app/<app>`: test pages are checked too (`prefer-test-starter`).
- Run the tests and attach the output.

## Forbidden
- Tests that depend on execution order or real timers.
- Deleting `flpSandbox.html` or `index.html`.
