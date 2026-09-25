---
name: sap-fe-test-api-verification
description: Where to verify sap.fe.test OPA API signatures when fiori-mcp is down; measured ids for a DataFieldForAnnotation DataPoint column and form field; how to probe rendered ids via a failing OPA assert
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
