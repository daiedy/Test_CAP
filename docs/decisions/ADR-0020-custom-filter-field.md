# ADR-0020: Custom filter field in the Fiori Elements V4 filter bar

Date: 2026-09-25. Status: accepted (user, 2026-09-25, feature `products-rating-filter`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
Issue #6 asks for a filter by `Products.rating` shown as `sap.m.RangeSlider` in the List Report. No annotation renders a slider (`UI.SelectionFields` gives a condition field, `Capabilities.FilterRestrictions` only restricts it), so the request needs the app's first extension. `PATTERNS.md` has no row for a custom filter field; the nearest row, "Custom section or column", names the fragment folder and the Fiori MCP registration but not how a custom control feeds the filter bar. Facts and measurements to come: `docs/features/products-rating-filter/research/custom-filter-mechanism.md`.

## Decision
A custom filter field is a fragment `app/<app>/webapp/ext/fragment/<Name>.fragment.xml` registered through Fiori MCP (`list_functionality` → `get_functionality_details` → `execute_functionality`) under `controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields.<property>` with `template`, `availability` and `position`; the key is the property name (predefined operators), so the field replaces the standard field of that property, and `label` is omitted when the property's `Common.Label` fits. The control shows the current condition through a **one-way** binding to `{filterValues>}` with the matching `sap/fe/macros/filter/type/*` type and writes it only from its `change` event, in a handler module `ext/fragment/<Name>.js` (wired with `core:require`) that calls the page ExtensionAPI `setFilterValues(<property>, <operator>, <values>)`, or `setFilterValues(<property>)` to clear when the control is back at its neutral position. The handler's pure mapping (control value to condition) is a named function with a QUnit test in `webapp/test/unit/`. A two-way binding is allowed only for a control that never adjusts its own value on render.

## Alternatives
| Option | Why rejected |
|---|---|
| Two-way binding of the control to `{filterValues>}` (MCP "recommended", no JS) | `RangeSlider` clamps its range on every render and writes it back; with a 0-based scale the empty filter formats to `[MIN_SAFE_INTEGER, max]` (`Range` type treats `min: 0` as unset), so a `BT 0...5` condition would be set on first load and hide products with no rating (research section 3). Same failure class as the RatingIndicator write-back in #5. Stays allowed for controls without self-adjustment |
| Custom operator (`property` + unique key + `customFilterOperators`) | Needed only when the standard field must stay next to the custom one; one more manifest section and an operator the filter chip names technically |
| Controller extension `ext/controller/ListReportExt.js` building filters in `onBeforeRebindTable`-style hooks | V2 idiom; in V4 bypasses the filter bar state (variants, app state, "Filtered by") |
| Condition field via `UI.SelectionFields` (+ `SingleRange` restriction) | Declarative and preferred when a typed range is acceptable, but it is not a slider; remains the way for "filter by range" without a specific control (open question in the feature plan) |

## Consequences
- New `PATTERNS.md` row "Custom filter field" in "UI Fiori Elements" with this way and the example of `products-rating-filter`; "Custom section or column" stays for sections and columns.
- `CONVENTIONS.md`: a fragment's handler module lives next to it as `ext/fragment/<Name>.js` (no `.controller.` infix, not a controller extension); add the line with the PATTERNS row.
- First QUnit module of the app: `webapp/test/unit/` plus an entry in `webapp/test/testsuite.qunit.js`, so CI's `npm run test:ui` runs it without a workflow change.
- `docs/registry/UI-ARTIFACTS.md` lists the fragment and the handler under "Extensions and fragments" (generator scans `/ext/`); the manifest wiring itself is not listed there.
- OPA5 cannot drive a custom control through `sap.fe.test` `iChangeFilterField`; a page object sets it through the control API and fires `change`.

## Sources
- Fiori MCP `search_docs`: "Adding Custom Fields to the Filter Bar (V2 & V4)" steps 4-7 and 14; "Custom Filter" (FPM explorer, `filterBarCustom`).
- UI5 1.152.0 CDN debug sources: `sap/fe/macros/filter/type/Range-dbg.js`, `sap/fe/macros/filter/type/Value-dbg.js`, `sap/m/RangeSlider-dbg.js`, `sap/fe/templates/ListReport/ExtensionAPI-dbg.js`, `sap/fe/core/converters/controls/ListReport/FilterBar-dbg.js`.
- `docs/LESSONS.md` 2026-09-25 (RatingIndicator clamp and write-back).
