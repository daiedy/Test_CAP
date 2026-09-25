# Research: a RangeSlider filter field for `rating` in the FE V4 List Report

Date: 2026-09-25. Author: `architect`. Feature `products-rating-filter` (#6). Read by `architect` and `reviewer`; plan steps 2, 3 and 6 name this file for `fiori-app-dev`, `test-ui` and `ui-verifier`.

Sources: Fiori MCP `search_docs` ("Adding Custom Fields to the Filter Bar", "Custom Filter" FPM sample, "Configuring Filter Fields (FilterRestrictions)", "Adapting the Filter Bar"); CDN debug sources of the loaded UI5 1.152.0 (`https://ui5.sap.com/resources/sap-ui-version.json`), marked **CDN**. Nothing here was run against the app; every "predicted" line is a measurement task in `PLAN.md`.

## 1. What Fiori Elements V4 offers

| Way | Control rendered | Code | Contract |
|---|---|---|---|
| A. `rating` in `UI.SelectionFields` | `sap.ui.mdc.FilterField` condition field (default `MultiRange`: typed `2...4`, `>3`, value help with operators) | annotation only | changes (`UI.SelectionFields` gets a 4th entry) |
| A'. A + `Capabilities.FilterRestrictions.FilterExpressionRestrictions [{ Property: rating, AllowedExpressions: 'SingleRange' }]` | same field restricted to one range (MCP: "SingleRange" = `selectionType #INTERVAL`, no multiple selections) | annotation only | changes (two terms) |
| B. Custom filter field (`controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields.<key>` with `template`) | any control in `ext/fragment/<Name>.fragment.xml`, here `sap.m.RangeSlider` | fragment (+ handler module) + manifest | none |

`Common.FilterDefaultValue` and `UI.SelectionVariant` only preset values (MCP: applied on load with the standard variant), `Common.ValueListWithFixedValues` needs a value list (a code list); none of them renders a slider. **No annotation renders `sap.m.RangeSlider`**: the literal request is only reachable through way B.

## 2. Custom filter field facts (MCP unless marked)

- Manifest shape (MCP): `filterFields.<key>: { label, property, template, required, availability: Default|Adaptation|Hidden, position: { placement: Before|After, anchor } }`. "For predefined-operator custom filters: key must match the metadata property name; do not specify property." `property` is needed only with a custom operator.
- Value binding (MCP): the control's value property binds to `{filterValues>}` with a filter value type from `sap/fe/macros/filter/type/*` (`Value` with `formatOptions.operator`, `MultiValue`); the filter bar then handles variants and app state.
- Alternative (MCP): a `change` handler from a module wired with `core:require` calls `this.setFilterValues(<key>, <value>)`, `this.setFilterValues(<key>)` clears; `this` is the page ExtensionAPI.
- CDN `sap/fe/templates/ListReport/ExtensionAPI-dbg.js`: `setFilterValues(sConditionPath, sOperator?, vValues)`, public, async; it targets the Adapt Filters filter bar when that dialog is open, otherwise the page filter bar.
- CDN `sap/fe/macros/filter/type/Range-dbg.js`: class `sap.fe.macros.filter.type.Range extends Value`, default operator `BT`; `formatValue` of an empty value returns `[this.oFormatOptions.min || Number.MIN_SAFE_INTEGER, this.oFormatOptions.max || Number.MAX_SAFE_INTEGER]`. **`min: 0` is falsy**, so for a 0-based scale the empty value formats to `[MIN_SAFE_INTEGER, max]` whatever `formatOptions.min` says.
- CDN `sap/fe/macros/filter/type/Value-dbg.js`: for an external type `float[]` (the type of `RangeSlider.range`) the element type is `FloatType`; `parseValue([lo, hi])` stores the formatted `BT` condition string in the `filterValues` model.
- CDN `sap/fe/core/converters/controls/ListReport/FilterBar-dbg.js`: a manifest filter field with `template` gets `settings.isCustomFilter = true`; `insertCustomManifestElements` merges it over the annotation-based field **of the same key** (`template`, `label`, `availability`, `position` overwritten). Consequence: with key `rating` the slider **replaces** the standard `rating` condition field, also in Adapt Filters; keeping both needs a second key, which the MCP rule above allows only with a custom operator and `property: 'rating'`.
- CDN, same file: `_getMissingLabelForManifestFilterFields` copies the label of the annotation-based field with the same key when the manifest `label` is empty. For key `rating` that is `Common.Label` = `{i18n>Products.rating}` of the service bundle (`_i18n`, en and ru exist since #5). Predicted: no new app i18n key; measure the rendered label in en and ru.

## 3. The clamp-and-writeback trap (predicted, CDN)

`sap/m/RangeSlider-dbg.js` 1.152.0: `onBeforeRendering` sets `_bInitialRangeChecks = false` and calls `setRange(getRange())`; `setRange` maps every value through `_adjustRangeValue`, which snaps to `step`, clamps to `[min, max]` with `log.warning("Min value (...) not in the range ...")`, and `_updateRangePropertyDependencies` calls `setProperty("range", ...)`.

With the documented two-way binding `range="{path: 'filterValues>', type: 'sap.fe.macros.filter.type.Range'}"` and `min="0"`: the empty filter formats to `[MIN_SAFE_INTEGER, 5]` (section 2), the first render clamps it to `[0, 5]` and the two-way binding writes `[0, 5]` back, so the filter bar would carry `rating BT 0...5` from the first load: the variant looks modified, "Filtered by" names Rating, and a product with `rating` null (possible: `rating` has no `@mandatory`) disappears. The same mechanism made the edit-mode `RatingIndicator` write clamped values back in #5 (`docs/LESSONS.md`, 2026-09-25). A full-range position after a drag has the same effect (`BT 0...5` excludes nulls).

## 4. Mechanisms for way B

| Id | Binding | JS | Empty state | Full range | Adapt Filters | Verdict |
|---|---|---|---|---|---|---|
| M1 | two-way `range` → `filterValues>` with type `Range` | none | predicted `BT 0...5` written on first render, console warning | `BT 0...5`, hides nulls | slider only | rejected unless the measurement in PLAN step 3 disproves section 3 |
| M2 | one-way `range` from `filterValues>` with type `Range` and a clamping `formatter`; `change` handler calls `setFilterValues('rating', 'BT', [lo, hi])`, or `setFilterValues('rating')` for the full range | one small handler module, QUnit | no condition, slider shows 0..5 | clears the condition | slider only | **proposed** (ADR-0020) |
| M3 | key `ratingRange` + `property: 'rating'`, custom operator function returning `new Filter('rating', 'BT', lo, hi)`, registered in `sap.fe.macros.filter.customFilterOperators` | operator module | depends on the operator | operator decides | slider and the standard field | only if the user wants both fields (open question 2) |

M2 keeps the condition inside the filter bar (not in a private model), so variants, app state, "Filtered by" and the Clear button keep working; to be verified by `ui-verifier` (variant save and restore).

## 5. `liveMode` (CDN, not in MCP)

- `sap/fe/templates/ListReport/ListReport.view.xml`: `liveMode="{viewData>/liveMode}"` on the filter bar, i.e. the page setting `ProductsList.options.settings.liveMode`; the `FE_FilterSearch` command (Ctrl+Enter) is only registered when `liveMode` is false.
- `sap/fe/test/builder/MdcFilterBarBuilder-dbg.js`: `doSearch()` = `doPress("btnSearch")`, the Go button; `iExecuteSearch()` uses it. Predicted: with `liveMode` true there is no Go button, so every `iExecuteSearch()` fails: 5 calls in 3 journeys (`FilterProductsByCategoryJourney.js` 2, `DraftMarkerInListReportJourney.js` 2, `RussianLocaleJourney.js` 1). `liveMode` therefore is a change of the whole OPA5 suite, not of this feature's journey.

## 6. Test data (from `db/data/my.catalog-Products.csv`, same values in `localService/mockdata/Products.json`)

Ratings: 0 x1, 1 x1, 2 x2, 3 x3, 4 x4, 5 x4 (15 rows). Row counts by slider range: [0, 5] 15 (no condition), [4, 5] 8, [2, 4] 9, [3, 5] 11, [0, 1] 2, [5, 5] 4, [0, 0] 1 (`Smartphone Stand`). Combined with category `KITCHEN` (ratings 4, 5, 5): [5, 5] 2.

## 7. Contract

Way B changes no `db/`, `srv/` or `app/*/annotations` file: `test/__snapshots__/metadata.test.js.snap` and `localService/metadata.xml` stay byte-identical (check with `git diff --numstat` at the phase gate: no line for either file). Way A/A' would change both; the figure is to be measured with `git diff --numstat` in that phase, not predicted.
