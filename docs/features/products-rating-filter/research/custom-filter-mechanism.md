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

## 8. Measurements of PLAN steps 4 and 4c (`fiori-app-dev`, 2026-09-25)

Setup: `npx cds serve --in-memory --port 4004` (stopped after), UI5 1.152.0 from the CDN, `flpSandbox.html#products-display`, headless Chrome 152 through puppeteer (global install), basic auth `alice` or `viewer`, `sap-ui-log-level=WARNING` so that `Log.warning` reaches the console. Requests are the `GET Products?...` lines inside the `$batch` bodies; the constant draft filter `(IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null)` is omitted below.

**Ids and structure (for `test-ui`).** Filter bar `products::ProductsList--fe::FilterBar::Products` (`sap.ui.mdc.FilterBar`), slider `products::ProductsList--rating--RatingRangeSlider` (`sap.m.RangeSlider`, `min 0`, `max 5`, `step 1`, tick marks and input tooltips on), table `products::ProductsList--fe::table::Products::LineItem`. `getFilterItems()` order and keys: `$editState`, `name`, `category_code`, `price`, `rating`. The rating item is a `sap.ui.mdc.FilterField` with key `rating`, and there is no second `rating` field. The Go button `...--fe::FilterBar::Products-btnSearch` exists as a control, `getVisible()` false and not rendered. `getLiveMode()` is true.

**Label (PLAN risk 3 did not happen).** The fallback to `Common.Label` works: en "Rating", ru the `Products.rating` value of `_i18n/i18n_ru.properties` (U+0420 U+0435 U+0439 U+0442 U+0438 U+043D U+0433) (both `alice` and `viewer`). No manifest `label` and no i18n key needed.

**First load.** Slider `[0, 5]`, `getConditions().rating` is `[]`, 15 rows, and the first `Products` request has no `rating` in `$filter`. The same holds for `viewer` (en, ru) and for `alice` in ru.

**Changes (all measured in one session in this order; rows from `getRowBinding().getLength()`).**

| Step | How | `Products` requests (`$filter` part) | Rows | Slider / condition |
|---|---|---|---|---|
| 0..5 → 4..5 | real mouse drag of the start handle across 4 ticks, 20 moves, released | 0 during the drag; on release 2: none, then `rating ge 4 and rating le 5` | 8 | `[4,5]` / `BT [4,5]` |
| 4..5 → 4..4 | end handle focused, Arrow Left | 1: `rating ge 4 and rating le 4` | 4 | `[4,4]` / `BT [4,4]` |
| 4..4 → 2..4 | `setRange([2,4])` + `fireChange` (the OPA path) | 1: `rating ge 2 and rating le 4` | 9 | `[2,4]` / `BT [2,4]` |
| 2..4 → 0..5 | `setRange([0,5])` + `fireChange` | 1: none | 15 | `[0,5]` / `[]` (cleared) |
| condition from outside | `StateUtil.applyExternalState(filterBar, { filter: { rating: [BT 4..5] } })` (the variant / app state path) | 1: `rating ge 4 and rating le 5` | 8 | the slider follows: `[4,5]` (the one-way display binding works; PLAN risk 2 did not happen) |
| Name "Lamp" | typed with 120 ms per key, then Enter | 0 while typing; 1 on Enter: `rating ge 4 and rating le 5 and name eq 'Lamp'` | 0 | unchanged |

**The first filter change after load sends two requests. This is `liveMode` behaviour of the filter bar, not of the slider.** Measured on fresh page loads with a `search` listener on the filter bar:
- Slider as the first change (mouse drag, Arrow key or `fireChange`): one `change` event and two `search` events. The first `search` carries the conditions from before the change (`{}`), the second carries `BT`. Result: two requests, first without `rating`, then with it.
- Name as the first change (type, then Enter): two `search` events, both with `name EQ Lamp`, so two identical requests.
- Every later change, of any field: exactly one request.
- Both searches come from `mdc` `FilterBarBase._checkAndNotify`, as the stack trace shows; the slider handler makes only one `setFilterValues` call.

Only the table's first reload is doubled. The final rows always match the final conditions. It is neither a request per keystroke nor one per drag step (the PLAN risk). It is reported, not tuned. `ui-verifier` scenario M should expect it on the first change after load.

**Console.** Across all runs (en/ru, `alice`/`viewer`), nothing matched "not in the range". Positive control on the same page: `setRange([-9007199254740991, 5])` logs `Warning: Min value (-9007199254740991) not in the range: [0,5] - Element sap.m.RangeSlider#products::ProductsList--rating--RatingRangeSlider`. So the probe does see such warnings, and `formatRange` prevents them. No other warning or error mentions the slider, the fragment or `filterValues`. The rest is the known sandbox noise: deprecated `sandbox.js`/`createRenderer`, the `Component-preload.js` 404, `LrepConnector`.

**Not measured here (left to `ui-verifier`).** Variant save and restore through the UI, the Adapt Filters dialog, the typed input in the tooltip, the accessibility tree, mock mode, and the Category, Price and Editing Status request counts.
