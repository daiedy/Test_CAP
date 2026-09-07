# Lessons learned

Entries are added by all agents through the `retro` skill and by the human. Format: date, what happened, why, how to avoid it, source. New entries on top. The list of typical agent mistakes in CAP and Fiori from publications: `docs/ai-pipeline-plan.md`, section 3.4.

## 2026-09-07. Retrospective of the first `/feature` run (categories-code-list)

Facts: 7 commits, 8 agents, 3 gates passed, review without blocking findings, 15 backend tests and 11 OPA5 tests green. Failures and their causes:

1. **Three agents out of eight hit `maxTurns`** (`test-ui` 40, `ui-verifier` 40, `docs-keeper` 30 twice) and required manual continuation. Cause: tooling. The limits were set before the first real run; tasks that start servers, drive a browser and write multi-file documentation need 60–80 turns. How to avoid: raise `maxTurns` for `test-ui`, `ui-verifier`, `docs-keeper` to 80, for `reviewer` to 50; in the orchestrator prompts give the agents a "one check, one call" list.
2. **The metadata.xml snapshot command was wrong since stage 1** (`cds compile srv` without `app/`). Cause: knowledge. Neither linters nor tests noticed the error, because nobody read the snapshot automatically. Found by `test-backend` while comparing the snapshot against the plan criterion. How to avoid: verifiable criteria in PLAN with a grep over the EDMX (this worked); a test "metadata.xml equals `cds compile '*'`" in `test/`.
3. **`npm run watch` had been broken since the move to cds 10**, but nobody ran it: all agents and hooks used `cds serve` or `cds.test`. Cause: tooling and rules. How to avoid: a smoke step in `test-all` ("`npm run watch` comes up within 10 s"); `ui-verifier` starts the application with the standard command from the README, not with its own.
4. **`npm start` on :8080 does not bring up the application through the FLP sandbox**, although at stage 0 the `curl` check of `$count` through the proxy passed. Cause: tooling. OData was checked, not the component load via `/products/webapp`. How to avoid: a UI startup check means loading the application page in a browser, not HTTP 200 on the HTML; close together with `modernize-flp-sandbox`.
5. **The manual ValueList in `templates/annotations-ui.cds` and the PATTERNS row contradicted the auto-generation from CodeList.** Cause: rules. The template was written from general documentation, not from the example in the code (`Currencies`). How to avoid: derive templates and patterns from an existing working example; ADR-0011 fixed this.
6. **The design phase changed the plan** (mandatory `Common.Text` on the key of an own CodeList). Cause: knowledge, closed by the pipeline in the normal way: `ux-designer` found it, `architect` put it into the plan before the code. This confirms the value of the phase, it is not a failure.
7. **The Stop hook fired three times** on a stale STATE. Cause: rules. The orchestrator updates STATE only at the end, while the hook demands it after every code change. How to avoid: the `feature` orchestrator updates the "Active feature" line in STATE after every phase (add to the `feature` skill).
8. **An Object Page without draft has no edit mode.** Cause: task. The plan marked it as a risk rather than as a decision before the start. How to avoid: for a UI with editing, `architect` checks `@odata.draft.enabled` before the plan and puts it into "User decisions".

What worked: specification before code, acceptance criteria with test names, gates with real blocks, the review found 7 documentation discrepancies, `search_model` before edits, the agent report format.

## 2026-09-07. `$filter` for a multi-select FE V4 filter is visible only inside `$batch`

What: when several values are selected in a dropdown filter (MultiComboBox), FE V4 sends the request via `POST .../$batch`; there is no separate GET with `$filter` in the network, the resulting expression (`category_code eq 'KITCHEN' or category_code eq 'SPORTS'`) is visible only in the multipart body of the batch request. Noticed by `ui-verifier` while checking the category filter in the `categories-code-list` feature.
How to avoid: check the network via `list_network_requests` (filter `resourceTypes: ["xhr","fetch"]`) and `get_network_request` on the found `$batch`, instead of looking for a separate GET with `$filter` in the URL.

## 2026-09-07. The design phase produced real plan changes: `Common.Text` on the key of an own CodeList is mandatory

What: while preparing the screens, `ux-designer` found via `mcp__cds-mcp__search_model` on `CatalogService.Currencies` that `@Common.Text: name` on `sap.common.Currencies.code` is set in the definition of `@sap/cds/common` itself and is not inherited from the `CodeList` aspect; the new `Categories : CodeList { key code }` will not have this annotation, and without it the dropdown and the value help dialog columns will show the code (`ELECTRONICS`) instead of the name. `PLAN.md` was extended with a mandatory step: `app/products/annotations/Categories.cds` with `Common.Text: name` + `Common.TextArrangement: #TextOnly` on `code`.
How to avoid: for any new own `CodeList` explicitly check and add `Common.Text` on its key in `app/<app>/annotations/<CodeList>.cds`; do not rely on the `CodeList` aspect providing this annotation itself. Fixed in ADR-0011, part 1.

## 2026-09-07. The `ValueListWithFixedValues` dropdown in FE V4 is a typeahead table, not a `sap.m.List`

What: in an OPA journey the check of the category dropdown items (`sap.m.List` + `sap.m.DisplayListItem`, as in `sap.fe.test.api.FilterBarActions#iSelectDropDownOption`) did not find the controls for 60 seconds, although the list was open on the screenshot. A dump via `sap/ui/test/OpaPlugin` in the application frame showed: SAP Fiori elements for OData V4 (1.152) renders the fixed list as a typeahead `sap.m.Table` with id `...::FilterFieldValueHelp::category_code::Popover::qualifier::::SuggestTable` (parents `sap.ui.mdc.valuehelp.content.MTable` → `sap.ui.mdc.valuehelp.Popover`), rows are `sap.m.ColumnListItem` in `MultiSelect` mode (checkbox with the `-selectMulti` suffix), the cell is `sap.fe.macros.Field` → `FieldWrapper` → `sap.m.Text`, and the same text is rendered by two `sap.m.Text` controls (pop-in), while the code is not in the row at all. Noticed by `test-ui` in the `categories-code-list` feature.
How to avoid: for list checks look up the `sap.m.Table` by the id regex `category_code::Popover::.*SuggestTable$` with `isDialogElement(true)`, take the `ColumnListItem`s, compare the set of unique visible texts of a row with the name; select in the filter by pressing `Press({ idSuffix: 'selectMulti' })` on the row. The standard `iSelectDropDownOption` does not fit this construct. Page object: `app/products/webapp/test/integration/pages/CategoryDropdown.js`.

## 2026-09-07. `fiori run` (:8080) does not bring up the application through the FLP intent, OPA runs against `cds watch` (:4004)

What: `flpSandbox.html` and `index.html` resolve the component by `url: "/products/webapp"` and load UI5 through absolute links to `https://ui5.sap.com`. `fiori run` (`npm start`, `ui5.yaml`) serves the webapp at the root (`/Component.js` 200, `/products/webapp/Component.js` 404), so in headless Chrome on `http://localhost:8080/test/flpSandbox.html#products-display` the List Report does not appear within 3 minutes; on `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display` (`cds watch` serves `app/` statically) the table appears. In addition, the `fiori-tools-proxy` pins `/resources` to `minUI5Version` 1.136.0, while the application html pages take the CDN "latest" (1.152.0): a test frame with `../resources/` and the application frame would run on different `sap.fe` versions.
How to avoid: the Test Starter test pages bootstrap from the same CDN as the application (`https://ui5.sap.com/resources/sap/ui/test/starter/createSuite.js` and `runTest.js`; `prefer-test-starter` accepts an absolute path ending in `/resources/sap/ui/test/starter/...`), and `npm run test:ui` targets `:4004/products/webapp/test/testsuite.qunit.html` while `npm run watch` is running. The `--page-timeout 900000` flag in the script limits a page to 15 minutes (the default is 0, that is no limit), so that a hung OPA run does not hold the runner forever; `--parallel 1`, because there is one page and the live backend is shared. The defect of `npm start` itself (the `/products/webapp` URL in the sandbox config and the absolute CDN instead of `resources/`) is closed together with the `modernize-flp-sandbox` debt, decided by `fiori-app-dev`/the user.

## 2026-09-07. The `@sap-ux/ui5-test-writer` 1.9.6 scaffold must be brought to Test Starter, the generator's journeys are unusable

What: `generateOPAFiles(projectPath, { htmlTarget: 'test/flpSandbox.html' })` creates page objects `pages/<Target>.gen.js` (usable as is: `appId`, `componentId`, `contextPath` from the manifest) and `pages/JourneyRunner.js`, but `testsuite.qunit.html/js` in the legacy `parent.jsUnitTestSuite` format, `integration/opaTests.qunit.html` with its own bootstrap (`sap_fiori_3`) and `QUnit.start()` in `opaTests.qunit.js`, which `ui5lint` catches with `prefer-test-starter`. The `*Journey.gen.js` journeys call `Given.iStartMyApp()` without an intent (in the FLP sandbox that is the shell home page, not the List Report); with `scriptName` a journey references `onTheProductsList`, while the runner registers `onTheProductsListGenerated`. When reading annotations the generator prints "UI.LineItem annotation has not been defined" (the annotations are in `metadata.xml`, there are no local files in the manifest), so the journeys contain no column checks.
How to avoid: take only `pages/*.gen.js` from the generator; write `testsuite.qunit.*`, `Test.qunit.html`, `opaTests.qunit.js` per Test Starter (journeys export functions, `runner.run([...])` once); pass the intent in `iStartMyApp('products-display', { 'sap-ui-language': 'ru' })`.

## 2026-09-07. The teardown of an OPA journey must be a separate last `opaTest`

What: `Given.iTearDownMyApp()` at the end of the last substantive test is not executed if the test failed earlier (OPA stops the queue), and the next journey fails with "sap.ui.test.launchers.iFrameLauncher: Launch was called twice without teardown", turning one error into a cascade. `sap.fe.test.BaseArrangements#iTearDownMyApp` has `.description('Tearing down my app')`, that is its own assertion, so a separate `opaTest('Teardown', function (Given) { Given.iTearDownMyApp(); })` (the Fiori tools template) does not produce "Expected at least one assertion".
How to avoid: in every journey the last test is teardown only; data changed by the journey is restored before it.

## 2026-09-07. `npm run watch` (`cds-serve --watch`) fails, `npx cds watch` works

What: `cds-serve --watch` from `@sap/cds` 10.0.6 failed with `TypeError: this.load is not a function` (`bin/serve.js:333`), although `@sap/cds-dk` is installed locally; `npx cds watch` (cds-dk 10.0.7) brings the server up. Noticed by `test-ui` when starting the live stack for OPA.
Fixed in commit `ce05c8a`: `npm run watch` is now `cds watch`; `npm start` stays `cds-serve` per the CAP documentation (works without cds-dk).

## 2026-09-07. A reference to an association in `UI.DataField.Value` is not rewritten to the foreign key

What: in `app/products/annotations/Products.cds`, after moving `category` to `Association to Categories`, the entries `{ $Type: 'UI.DataField', Value: category }` and `UI.SelectionFields: [ category ]` compiled without warnings, but in the EDMX they produced `Path="category"` and `<PropertyPath>category</PropertyPath>`, that is a path to the NavigationProperty rather than to a property; Fiori Elements expects a property path in a DataField. The compiler copies the annotations of the element itself (`@title`, `@Common.Text`, `@Common.ValueListWithFixedValues`) from the association to `category_code`, but does not touch the paths inside `@UI.*`. Noticed by the `fiori-app-dev` agent on the baseline compilation before step 9 of the `categories-code-list` feature.
How to avoid: in `@UI.LineItem`, `SelectionFields`, `HeaderInfo`, `FieldGroup` reference the foreign key `<assoc>_<key>` (as in `templates/annotations-ui.cds`), and put `@Common.Text`, `TextArrangement`, `ValueListWithFixedValues` on the association. Check: `cds compile '*' --to edmx-v4 -s CatalogService | grep -n 'Path="category'` must not show a bare `Path="category"` outside `NavigationPropertyBinding`.

## 2026-09-07. An explicit `@Common.ValueList` on an association suppresses the ValueList generated from the CodeList

What: after moving `Products.category` to `Association to Categories : CodeList`, the `$metadata` snapshot (`cds.load('*')`, that is with `app/`) showed on `category_code` the old `Common.ValueList` with `CollectionPath="Products"` from `app/products/annotations/Products.cds`, and the generated one with `CollectionPath="Categories"` was missing. `cds compile srv --to edmx-v4` (without `app/`) shows the generated one. The compiler does not generate a ValueList from `@cds.odata.valuelist` if the element already has an explicit `@Common.ValueList`, and the explicit annotation is copied from the association to the foreign key.
How to avoid: when moving a field to a CodeList, delete the old `@Common.ValueList` in `app/` in the same change; check with `cds compile '*' --to edmx-v4 | grep -A 6 'Products/category_code'`, not with `cds compile srv`. The second positional CLI argument (`cds compile srv app`) is ignored, only `'*'` merges the layers.

## 2026-09-07. The `cds.test` (fetch) error carries the `code` and `target` of the OData error

What: `@cap-js/cds-test` 1.0.2 throws `Object.assign(new Error, { response, status }, response.data.error)`: a message like `400 - Provide the missing value.`, the fields `code` (`ASSERT_MANDATORY`, `ASSERT_TARGET`, `ENTITY_IS_READ_ONLY`), `target` (`category_code`). `rejectedWith(/400/)` of chai-as-promised resolves to the error itself.
How to apply: `const err = await expect(POST(...)).to.be.rejectedWith(/400/); expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'category_code' })`. This ties a negative test to a specific annotation rather than to any 400.

## 2026-09-07. The metadata.xml snapshot must be built from the whole model, not from `srv`

What: the command `cds compile srv --to edmx-v4` includes only `db` and `srv`, so the UI annotations from `app/products/annotations/` did not get into the snapshot, and mock mode showed a table without columns. Correct: `cds compile '*' --to edmx-v4 -s CatalogService -l en`. The same applies to the contract test: `cds.load('*')` takes the whole model. Noticed by the `test-backend` agent on the first feature run; the command was fixed in CLAUDE.md, PATTERNS, the rules and the agents.

## 2026-09-07. CAP MCP compiles all `.cds` files of the project, including `templates/`

What: `mcp__cds-mcp__search_model` failed with "Duplicate definition of artifact my.catalog.template.Orders": four templates in `templates/*.cds` declared the same namespace and identical entities. `cds compile srv` and the tests did not see this, because they take only the `db`, `srv`, `app` roots.
How to avoid: every standalone `.cds` file outside `db/srv/app` gets its own namespace (`my.catalog.tpl.<name>`). Check: `cds compile db srv app templates --to json` must pass.

## 2026-09-07. `run_manifest_validation` of UI5 MCP 0.2.18 fails with a schema error

What: the tool returns "schema with key or id http://json-schema.org/draft-06/schema already exists" on any call, also on repeated calls. A server defect, not the manifest.
Workaround: the manifest rules are checked by `ui5lint` (`no-outdated-manifest-version`, `no-legacy-ui5-version-in-manifest`, `no-removed-manifest-property`, `no-deprecated-library`). Until the defect is fixed, `npm run lint` in `app/products` is enough after a manifest edit. Track via `release-check` on `@ui5/mcp-server` releases.

## 2026-09-07. `ui5lint --fix` changes `sap.ui.getCore().byId` to `Element.getElementById`

What: the linter autofix replaced the deprecated call in `Component.js` with `sap/ui/core/Element.getElementById`, adding the dependency to `sap.ui.define`. Behavior preserved.
How to avoid: before `--fix`, capture the diff and check that the replacement is equivalent. For new files use `Element.getElementById` right away.

## 2026-09-07. `sap.ui.core.util.MockServer` does not support OData V4

What: mock mode on `MockServer` and Sinon did not work. Replaced with `@sap-ux/ui5-middleware-fe-mockserver` in `ui5-mock.yaml`.
Details: the mock expects `<EntitySet>.json` files with an array of records in `mockdataPath`; `generateMockData: true` generates the missing sets (for example `Currencies`). The proxy property is called `ignoreCertErrors`, in the plural.

## 2026-09-07. A middleware in `ui5.yaml` without the installed package breaks `fiori run`

What: `ui5.yaml` referenced `sap-fe-mockserver`, the package was neither in devDependencies nor in `ui5.dependencies`. Rule: a middleware is added together with the package in `devDependencies` and in `package.json` → `ui5.dependencies`.

## 2026-09-07. Element titles live on the projection, not on the db entity

What: by convention `@title` is set in `srv/annotations/<Entity>.cds` on `CatalogService.<Entity>`. Hence tools that read `my.catalog.Products` directly will not see the titles; the registry generator takes them from the first projection.

## 2026-09-07. `cds add lint` reformats `mta.yaml`

What: the command rewrote the indentation in `mta.yaml` (without semantic changes). Check the diff after any `cds add`.

## 2026-09-07. A Fiori Elements controller extension file without `.controller.`

What: the manifest reference `ns.ext.controller.ListReportExt.onAction` requires the file `ext/controller/ListReportExt.js`, not `ListReportExt.controller.js`, otherwise `ModuleError`. Source: SAP-samples/cap-agentic-engineered, LESSONS_LEARNED.

## 2026-09-07. Keyboard hack for the Explore button

What: `Component.js` attaches an Enter/Space handler to the shell button `uh-explore-button` via `setTimeout(1500)`. Fragile: depends on a timer and on an internal ushell id. The standard alternative for own buttons: `sap.ui.core.CommandExecution` and `sap.m.Button` with `ariaHasPopup`. For sandbox shell buttons there is no standard way; the author's decision is kept.
