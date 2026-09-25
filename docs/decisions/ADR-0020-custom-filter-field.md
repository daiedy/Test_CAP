# ADR-0020: Custom filter field in the Fiori Elements V4 filter bar

Date: 2026-09-25. Status: accepted (user, 2026-09-25, feature `products-rating-filter`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
Issue #6 asks for a filter by `Products.rating` shown as `sap.m.RangeSlider` in the List Report. No annotation renders a slider (`UI.SelectionFields` gives a condition field, `Capabilities.FilterRestrictions` only restricts it), so the request needs the app's first extension. `PATTERNS.md` has no row for a custom filter field; the nearest row, "Custom section or column", names the fragment folder and the Fiori MCP registration but not how a custom control feeds the filter bar. Facts and measurements to come: `docs/features/products-rating-filter/research/custom-filter-mechanism.md`.

## Decision
A custom filter field is a fragment `app/<app>/webapp/ext/fragment/<Name>.fragment.xml` registered through Fiori MCP (`list_functionality` → `get_functionality_details` → `execute_functionality`; for `products-rating-filter` by hand under the exception below, because `fiori-mcp` 1.12.2 has no functionality for it) under `controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields.<property>` with `template`, `availability` and `position`; the key is the property name (predefined operators), so the field replaces the standard field of that property, and `label` is omitted when the property's `Common.Label` fits. The control shows the current condition through a **one-way** binding to `{filterValues>}` with the matching `sap/fe/macros/filter/type/*` type and writes it only from its `change` event, in a handler module `ext/fragment/<Name>.js` (wired with `core:require`) that calls the page ExtensionAPI `setFilterValues(<property>, <operator>, <values>)`, or `setFilterValues(<property>)` to clear when the control is back at its neutral position. The handler's pure mapping (control value to condition) is a named function with a QUnit test in `webapp/test/unit/`. A two-way binding is allowed only for a control that never adjusts its own value on render.

## Exception to ADR-0007 (amendment, user decision 2026-09-25)
**Scope.** Exactly two entries of `app/products/webapp/manifest.json`, both under `sap.ui5.routing.targets.ProductsList.options.settings`, for feature `products-rating-filter` (#6) only:
1. `controlConfiguration["@com.sap.vocabularies.UI.v1.SelectionFields"].filterFields.rating` = `{ "template": "products.ext.fragment.RatingRangeFilter", "availability": "Default", "position": { "placement": "After", "anchor": "price" } }`, with no `label` and no `property` key.
2. `liveMode: true`.

**Why.** ADR-0007 routes every manifest change through `execute_functionality`, but `fiori-mcp` 1.12.2 `list_functionality` for `app/products` returns no id for `filterFields.<key>` and none for `liveMode` (the only filter bar id is `[ProductsList, filterBar, hideFilterBar]`); the server bundles a `CustomFilterField` writer and a `liveMode` property internally without exposing them (record: `docs/features/products-rating-filter/research/fiori-mcp-custom-filter.md`). ADR-0007 already admits a manual edit "when no functionality exists"; this section bounds that case to two named entries instead of leaving it open.

**How.** `fiori-app-dev` edits the file by hand in a session the user starts with `PIPELINE_ALLOW_PROTECTED=1`; that user-started session is the sanction, no agent sets the variable. The edit is validated with `mcp__ui5-mcp-server__run_manifest_validation`; when that tool fails with the known draft-06 schema error of 0.2.18 (STATE open debt), `npm run lint` in `app/products` (`ui5lint`) alone is the gate. `git diff main -- app/products/webapp/manifest.json` shows only the two entries above (with the enclosing `controlConfiguration` / `@com.sap.vocabularies.UI.v1.SelectionFields` / `filterFields` objects they need) and nothing else; the reviewer checks this diff.

**Exit condition.** The exception covers no other entry and no other feature: any further manifest change, including a later edit of these two entries, goes back to Fiori MCP `execute_functionality` or needs a new user decision. On every `fiori-mcp` bump `upstream-watcher` re-runs `list_functionality` for `app/products` and reports whether `filterFields` and `liveMode` became MCP-covered; from then on they are changed through MCP only.

## Alternatives
| Option | Why rejected |
|---|---|
| Two-way binding of the control to `{filterValues>}` (MCP "recommended", no JS) | `RangeSlider` clamps its range on every render and writes it back; with a 0-based scale the empty filter formats to `[MIN_SAFE_INTEGER, max]` (`Range` type treats `min: 0` as unset), so a `BT 0...5` condition would be set on first load and hide products with no rating (research section 3). Same failure class as the RatingIndicator write-back in #5. Stays allowed for controls without self-adjustment |
| Custom operator (`property` + unique key + `customFilterOperators`) | Needed only when the standard field must stay next to the custom one; one more manifest section and an operator the filter chip names technically |
| Fiori tools Page Map in the IDE sets both manifest entries (option 2 of the step 3 record) | Not chosen by the user; the Page Map edit runs outside the pipeline's audit log and gates |
| Park the feature until `fiori-mcp` exposes `filterFields` and `liveMode` (option 3) | No release in sight; the exit condition of the exception switches back to MCP once it happens |
| Controller extension `ext/controller/ListReportExt.js` building filters in `onBeforeRebindTable`-style hooks | V2 idiom; in V4 bypasses the filter bar state (variants, app state, "Filtered by") |
| Condition field via `UI.SelectionFields` (+ `SingleRange` restriction) | Declarative and preferred when a typed range is acceptable, but it is not a slider; remains the way for "filter by range" without a specific control (open question in the feature plan) |

## Consequences
- New `PATTERNS.md` row "Custom filter field" in "UI Fiori Elements" with this way and the example of `products-rating-filter`; "Custom section or column" stays for sections and columns.
- `CONVENTIONS.md`: a fragment's handler module lives next to it as `ext/fragment/<Name>.js` (no `.controller.` infix, not a controller extension); add the line with the PATTERNS row.
- First QUnit module of the app: `webapp/test/unit/` plus an entry in `webapp/test/testsuite.qunit.js`, so CI's `npm run test:ui` runs it without a workflow change.
- `docs/registry/UI-ARTIFACTS.md` lists the fragment and the handler under "Extensions and fragments" (generator scans `/ext/`); the manifest wiring itself is not listed there.
- `upstream-watcher` checks on each `fiori-mcp` bump whether `list_functionality` exposes `filterFields` and `liveMode` (exit condition of the exception); `docs/LESSONS.md` and STATE record the 1.12.2 gap.
- OPA5 cannot drive a custom control through `sap.fe.test` `iChangeFilterField`; a page object sets it through the control API and fires `change`.

## Sources
- Fiori MCP `search_docs`: "Adding Custom Fields to the Filter Bar (V2 & V4)" steps 4-7 and 14; "Custom Filter" (FPM explorer, `filterBarCustom`).
- UI5 1.152.0 CDN debug sources: `sap/fe/macros/filter/type/Range-dbg.js`, `sap/fe/macros/filter/type/Value-dbg.js`, `sap/m/RangeSlider-dbg.js`, `sap/fe/templates/ListReport/ExtensionAPI-dbg.js`, `sap/fe/core/converters/controls/ListReport/FilterBar-dbg.js`.
- `docs/features/products-rating-filter/research/fiori-mcp-custom-filter.md` (`list_functionality` output of `fiori-mcp` 1.12.2).
- ADR-0007 (manifest only via `execute_functionality`; manual edit when no functionality exists).
- `docs/LESSONS.md` 2026-09-25 (RatingIndicator clamp and write-back).
