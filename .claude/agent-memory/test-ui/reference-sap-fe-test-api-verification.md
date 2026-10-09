---
name: sap-fe-test-api-verification
description: Where to verify sap.fe.test OPA API signatures when fiori-mcp is down; measured ids (DataPoint column, custom filter field, action parameter dialog with a file field); absence checks; probing and mutation runs; runner test counting; vacuous iCheckField(field, ''), Object Page form ids, display-mode mdc Field without DOM, pop-in behind Show Details in the 60% OPA frame
metadata:
  type: reference
---

`mcp__fiori-mcp__search_docs` failed on 2026-09-07 in two sessions with "Search is currently unavailable. The embeddings service failed to initialize" (every query, `searchType: limited_fallback`). Accepted fallback (recorded in PLAN step 7 of `products-draft-edit`): read the debug sources of the exact UI5 version the app loads from the CDN.

- Version: `curl https://ui5.sap.com/resources/sap-ui-version.json` (1.152.0 on 2026-09-07; `index.html`, `flpSandbox.html` and the Test Starter pages all load `https://ui5.sap.com/resources/...` without a version, so the app and `sap.fe.test` are always on the CDN's latest).
- Sources: `https://ui5.sap.com/resources/sap/fe/test/<path>-dbg.js`, e.g. `api/FooterActionsOP` (`iExecuteSave`, `iExecuteCancel`, `iConfirmCancel` = press the `C_TRANSACTION_HELPER_DRAFT_DISCARD_BUTTON` text in a `sap.m.Popover`), `api/HeaderActions` and `api/HeaderAssertions` (there is no `HeaderActionsOP`; `iExecuteEdit`, `iCheckEdit`, `iCheckTitle(title, description)` match `sap.m.Title`/`sap.m.Label` texts), `api/FormActions` (`iChangeField`, `iOpenValueHelp` = F4 on the `sap.ui.mdc.Field`), `api/FormAssertions` (`iCheckField(field, value, state)`; state `required` works on the mdc Field), `builder/MacroFieldBuilder` (value/state matchers), `ObjectPage` (`iSeeObjectPageInEditMode`/`DisplayMode` read the `ui>/editMode` model). A 404 comes back as an HTML page, check the first bytes.

`ui5-test-runner` 5.14 report (`--report-dir`): `output.txt` has only the page total (`17/17`), `job.js` and `<pageId>/browser.json` carry no per-test list; per-test evidence is the QUnit module/test names in the journey plus data checks over OData (`$count`, `$filter=IsActiveEntity eq false`) and the `cds watch` log (`draftEdit`, `PATCH ...IsActiveEntity=false`, `draftActivate`, `DELETE`).

`npx prettier --check webapp/test/integration/` from `app/products` flags the pre-existing integration files (they were not formatted with the root `.prettierrc`); format only the file you changed, do not reformat the others in a test task.

Related: [[test-cap-ui-test-run-baseline]]

## DataFieldForAnnotation to a DataPoint (measured 2026-09-25, FE 1.152.0, products-rating-column)

- Table column: property key is the DataPoint `Value` property (`rating`), id `...::LineItem::C::DataPoint::Rating`; `iCheckColumns` / `iCheckCells` keyed by `rating`.
- Form: `FormElement::DataFieldForAnnotation::DataPoint::Rating`, so `iCheckField({ property: 'DataPoint::Rating' }, undefined, state)`. The typedef's `targetAnnotation` is not read by `BaseAPI` (ids come from `property`, inserted into a RegExp unescaped).
- A non-text cell control (RatingIndicator) is asserted with the cell state `{ editor: { controlType, value, maxValue } }`: `MdcTableBuilder` Cell `editor` routes through `MacroFieldBuilder` which unwraps FE wrappers; a plain `{ value }` cell state failed (timeout).
- Headless Chrome `--dump-dom` produces nothing in the agent sandbox. Probe ids instead with a temporary `opaTest` whose `Then.waitFor` success calls `sap.ui.test.Opa5.assert.ok(false, '<ids>')` while `runner.run([OnlyThisJourney])`: the runner's console output prints failure messages in full (only passes are reduced to counts). Restore both files afterwards.

## Custom filter field and liveMode (measured 2026-09-25, FE 1.152.0, products-rating-filter)

- A manifest `filterFields.<key>` custom filter renders as `sap.ui.mdc.FilterField` with id `...--fe::FilterBar::<Entity>::CustomFilterField::<key>` (content `CustomFilterFieldContentWrapper`); `sap.fe.test` field identifiers resolve to `::FilterField::<key>` and never match it, so use an own `OpaBuilder` page object (`pages/RatingRangeSlider.js`).
- `liveMode: true`: `getLiveMode()` true, but `showGoButton` stays true; the `-btnSearch` button exists with `visible` false and no DOM ref. `iCheckSearch({ visible: false })` therefore cannot prove "no Go button".
- Adapt Filters list items are `sap.m.CustomListItem` (dialog) bound to model `$p13n` (`name`, `label`, `visible`). Counting over all matched controls needs `OpaBuilder#check`, not `has` (per control).
- Per-test results of a run: `node -e` with `require('<report-dir>/job.js')` and walk objects that have `testId` and `name` (`report.failed`, `logs[].message`). A mutation run (deliberately wrong expected values) proves a custom assertion can fail; each failure costs the 60 s OPA timeout.

## Action parameter dialog with a file parameter (measured 2026-09-25, FE 1.152.0, products-excel-upload)

- `onActionDialog()` is the default `DialogActions`/`DialogAssertions` on the top-most `sap.m.Dialog`; confirm and cancel are picked by button position, and `iCheckActionParameterDialogField` matches only `sap.ui.mdc.Field` (`APD_::<property>`). A stream parameter renders `sap.m.Label` + `sap.ui.unified.FileUploader`, so use an own `OpaBuilder` page object (`pages/ImportProductsDialog.js`).
- Dialog, button and label ids are global, no view prefix (`generate([...])` in `sap/fe/macros/coreUI/OperationParameterDialog`), and the dialog is destroyed in `afterClose`. "Closed" = a plain `waitFor({ check })` over `Opa5.getPlugin().getMatchingControls({ id: /regex/, controlType, visible: false })` (returns `[]`, no retry); a builder with `hasId` would time out on a destroyed control.
- Table toolbar action by id: `iCheckAction({ service, action }, { visible, enabled, text })` (state keys fall through to control properties) and `iExecuteAction({ service, action })`; the id regex tolerates the `DataFieldForAction::` prefix.
- "No draft left" through the UI: `iCheckRows({}, N, { isDraft: false })` (rendered rows without a visible `sap.m.ObjectMarker`); the `{ isDraft: true }` mutation fails, so the state is evaluated.
- The `cds serve` log lists bound actions inside `$batch` (`> POST /Products(...)/CatalogService.draftEdit`); grep it for an action name as evidence the UI never sent it.

## Runner counting and single-journey runs (2026-09-25)

- PLAN baselines ("28 opaTests") count non-teardown OPA tests. The runner total adds one `Teardown` per journey and the 2 QUnit unit tests (main before #7: 36 OPA + 2 unit = 38).
- One journey only: `npx ui5-test-runner --url .../testsuite.qunit.html --page-filter opaTests --page-params "filter=<QUnit module name>" --report-dir <scratch>`. It runs the module, but the page ends as BROWSER TIMEOUT after `--page-timeout` because the runner waits for all tests; read per-test results from `job.js` and never use it as the gate run. Temporary mutation module + `Opa5.extendConfig({ timeout: 8 })` makes each expected failure cost 8 s instead of 60 s.
- Better single-journey run (measured 2026-10-09): temporarily make the last dependency of `opaTests.qunit.js` the probe journey and call `runner.run([<that arg>])`; the page completes normally (no BROWSER TIMEOUT). The PLAN baseline "40 opaTest + 2 QUnit = 42" of #8 counted teardowns, unlike the #7 baseline: count `grep -c "opaTest("` before trusting either convention.

## Form fields, pop-in and probes (measured 2026-10-09, FE 1.153.0, products-subcategories)

- `onForm().iCheckField(field, '')` passes for ANY value: `MdcFieldBuilder` `_equalish` turns a falsy expected value into `[]`. An empty field needs an own `OpaBuilder` (see `iSeeFormFieldEmpty` in `pages/CategoryDropdown.js`).
- Object Page field ids: label `...::FormElement::DataField::<prop>-label` (`sap.m.Label`), value `...::FormElement::DataField::<prop>::Field-edit` (`sap.ui.mdc.Field`, `value` = key, `additionalValue` = text; both `null` when empty). In display mode that Field is bound but has no DOM (the wrapper renders `::Field-display` `sap.m.Text`), so an OpaBuilder on it needs `mustBeVisible(false)`. A probe with `Opa5.getPlugin().getAllControls()` ignores rendering and hides this; run mutations in both modes.
- The OPA frame is 60% of the runner window (`Opa.config.frameWidth`; `sap.fe.test` passes no size). With 6 List Report columns, Price, Stock Quantity and Rating move into the responsive pop-in, collapsed behind Show Details; collapsed cells are not rendered, so `iCheckCells` with an `editor` state times out. Fix in the test: `onTable().iExecuteShowHideDetails(true)` first. Look at the runner screenshots in `<report-dir>/<page>/*.png` before theorizing.
- Worktree Bash guard refuses heredocs and `cp a b && cat > c`. Files that must keep literal backslash-u escapes cannot go through Write either (it decodes them): generate them with a script under `/tmp` that builds the escape from `String.fromCharCode(92)` and reads the values from the seed CSV.
