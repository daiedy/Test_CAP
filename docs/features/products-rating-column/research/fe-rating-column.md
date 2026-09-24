# Research: how a rating column can be rendered, edited and tested

Date: 2026-09-25. Author: `architect`. Read by `architect` and `reviewer`; `PLAN.md` step 4 names this file for `test-ui` (section "sap.fe.test matchers"), step 3 names it for `fiori-app-dev` (section "Annotation column").

Sources, in the order of protocol section 1: `mcp__cds-mcp__search_docs` ("@assert.range", numeric types), `mcp__fiori-mcp__search_docs` (four queries: rating DataPoint in a table, custom column with `controlConfiguration`, rating in edit mode, Field building block), the debug sources of the UI5 version the app loads from the unpinned CDN (`sap-ui-version.json` = 1.152.0, ADR-0006): `sap/fe/macros/library-preload.js`, `sap/fe/test/builder/MacroFieldBuilder-dbg.js`, `MdcTableBuilder-dbg.js`, `FEBuilder-dbg.js`, `sap/fe/test/api/TableAssertions-dbg.js`, `FormAPI-dbg.js`, `BaseAPI-dbg.js`. Facts taken from the CDN sources are marked "CDN 1.152.0": the Fiori MCP documentation was silent on them, so they are verified against the loaded framework but not by MCP.

## Annotation column (recommended way)

Fiori MCP, "Add a Read-Only Rating Indicator (Stars) to a Fiori Elements Table" and "Rating Indicator" (Field building block, OData V4):

- A `UI.DataPoint` with `Visualization: #Rating` and `Value: <property>` referenced from `UI.LineItem` by a `UI.DataFieldForAnnotation` record (`Target: '@UI.DataPoint#<Qualifier>'`) renders the rating as stars in the table. CAP CDS form given by the documentation:

```cds
UI.DataPoint #Rating : { Value : rating, TargetValue : 5, Visualization : #Rating },
UI.LineItem : [ ..., { $Type : 'UI.DataFieldForAnnotation', Label : 'Rating', Target : '@UI.DataPoint#Rating' } ]
```

- `TargetValue` is the maximum number of stars (default 5, an `Int` or a path). Decimal values are rounded; x.25 to x.74 shows a half star.
- The Fiori tools Page Editor creates exactly this shape for "Add Rating Column" (`Value`, `TargetValue: 5`, `Visualization: Rating`), which is a second confirmation that the annotation, not a fragment, is the tooling's way.
- The same `DataFieldForAnnotation` record inside a `UI.FieldGroup` shows the rating in an Object Page form; the Field building block renders it.

CDN 1.152.0, `sap/fe/macros/library-preload.js` (field templating):

- Display: `createRatingIndicator` builds a `sap.m.RatingIndicator` with `maxValue` from `TargetValue`, `value` from the property, `editable: "false"`, tooltip from the DataPoint's `Common.QuickInfo` or the framework text `T_COMMON_RATING_INDICATOR_TITLE_LABEL` (ships translated in `sap.fe.macros`, so no project i18n key is needed for the tooltip). The List Report cell is therefore read-only stars.
- Edit: when the `DataFieldForAnnotation` target is a DataPoint with `Visualization === "UI.VisualizationType/Rating"`, the field's `editStyle` is set to `"RatingIndicator"` and `ratingIndicatorTargetValue` to `TargetValue`; `getRatingIndicatorTemplate` renders an interactive `sap.m.RatingIndicator` bound to the property with `maxValue` = `TargetValue`. So in Object Page edit mode (drafts, ADR-0012) an editor sets the rating by clicking stars; whole stars only for an `Integer`.
- The Object Page header facet variant (Fiori MCP, "Rating Indicator Facet for Fiori Elements Object Page Header") stays read-only in edit mode and moves into the header; that is why the plan puts the field into a `FieldGroup`, not a `HeaderFacet`.

Column label: FE builds the header of a `DataFieldForAnnotation` column from the record (`Label`), not from the property's `@title` as it does for a `DataField`. The plan sets `Label: '{i18n>Products.rating}'` explicitly, reusing the same `_i18n` key as the `@title`, so the header is deterministic in `en` and `ru` without a second key. This is the documented exception to the `ui-annotations.md` rule "if the label matches the element's `@title`, do not specify `Label`", which is written for `DataField`.

## Custom column fragment (literal reading of "custom column")

Fiori MCP, "Adding Custom Columns" (OData V4 part): a custom column is declared in `manifest.json` under `sap.ui5.routing.targets.ProductsList.options.settings.controlConfiguration["@com.sap.vocabularies.UI.v1.LineItem"].columns.<key>` with `header` (i18n), `template` (fragment module name, e.g. `products.ext.fragment.RatingColumn`), `position: { placement, anchor }`, `width`, `importance`, `availability`, and `properties` (the properties the column depends on, needed for sorting and export). The fragment holds the cell content, e.g. `<RatingIndicator value="{rating}" maxValue="5" editable="false"/>`. Column ids follow `...::C::CustomColumn::<key>`. Fiori MCP `list_functionality` on `app/products` is the only allowed route to the manifest edit (PATTERNS "Manifest change", ADR-0007); `run_manifest_validation` is broken in UI5 MCP 0.2.18 (LESSONS), so `ui5lint` is the check.

What the fragment way costs beyond the annotation way, for the same rendered result:

| Aspect | Annotation column | Custom column fragment |
|---|---|---|
| Files | `app/products/annotations/Products.cds` | `ext/fragment/RatingColumn.fragment.xml` (first extension of the app), `manifest.json` via Fiori MCP, webapp i18n key for the header |
| Object Page | the same `DataFieldForAnnotation` record in a FieldGroup, stars in display and edit | still needs the `UI.DataPoint` (or shows a plain number input): two mechanisms for one field |
| Contract | net +16 EDMX lines (measured, `contract-delta.md`) | about 0 lines for the column, net +11 anyway if the Object Page shows stars (DataPoint and FieldGroup record, measured, `contract-delta.md` row 3c) |
| Sorting, export, personalization | native (the column is a LineItem entry) | only with `properties` in the manifest and a fragment that survives p13n |
| Tests | `iCheckColumns` by header, `iCheckCells` by `value` | same assertions, column key `CustomColumn::<key>`; `ui5lint` on the fragment |
| Registries | `SERVICES.md` LineItem count 4 to 5 | `UI-ARTIFACTS.md` gains "Extensions and fragments" |
| Pattern | "Table columns, filters, header, sections" | "Custom section or column": exists, but CLAUDE.md invariant 6 (declarative before imperative) makes it the wrong row for content an annotation expresses; an ADR would have to record why |

Rejected for the recommended default: the fragment adds a manifest change, a first extension point and a duplicate rendering mechanism for no visible difference.

## Other rejected mechanisms

| Mechanism | Why rejected |
|---|---|
| `Decimal(2, 1)` for half stars | Editing clicks whole stars (`sap.m.RatingIndicator` `visualMode` default `Half` only affects display of fractional values); a Decimal arrives as a string in `cds.test` and the CSV; no requirement for averages. Keep `Integer`, like `stock` |
| `@mandatory` on `rating` or a default of 0 | A product without a rating is a valid state ("not rated yet", empty stars); `@assert.range` ignores `null` (CDS docs: the check is `min <= input <= max` on provided values). A default would turn "unrated" into "zero stars" silently |
| `@readonly` on `rating` (CSV-only data) | Contradicts the issue's hints (`@assert.range`, "backend rejects a value outside the scale"): CDS ignores input for `@readonly` elements silently, so the range annotation would never fire. Offered as the alternative of open question 2 |
| Rating in `UI.HeaderInfo` or a `UI.HeaderFacets` DataPoint | Read-only in edit mode (Fiori MCP); the request is a List Report column, the Object Page placement is the designer's call within a FieldGroup |
| `UI.SelectionFields` entry for `rating` | Not requested; a filter on stars needs a designer decision and a journey; out of scope |
| A `before` handler for the range | PATTERNS "Format or range check": handler only if the annotation cannot express it; `[0, 5]` is a closed interval `@assert.range` |
| `virtual` or calculated rating (average of reviews) | No reviews entity exists; the request is a stored rating |

## sap.fe.test matchers (for `test-ui`)

CDN 1.152.0:

- `TableAssertions.iCheckColumns(iExpectedNumberOfColumns, mColumnStateMap)`: with a number it asserts the `columns` aggregation length (`hasAggregationLength`), then `hasColumns(map)`. `MdcTableBuilder` matches a column key by `oColumn.getHeader() === vColumn || oColumn.getPropertyKey() === vColumn`, so the header text is a valid key: `iCheckColumns(5, { Rating: { header: 'Rating' } })` works without knowing the generated property key (expected `DataFieldForAnnotation::DataPoint::Rating`, not verified).
- `TableAssertions.iCheckCells(vRowValues, mColumnStateMap)`: `Row.Matchers.cellProperties` maps each column to `cellProperty`, which unwraps `sap.fe.macros.MacroAPI` wrappers (`getContent()`) and applies `Cell.Matchers.states(state)` to the inner control. `FEBuilder.Matchers.state(name, value)` falls back to a `properties` matcher for a name that is not an aggregation and not in `ElementStates`, so `{ Rating: { value: 5 } }` matches a `sap.m.RatingIndicator` whose `value` is 5: `iCheckCells({ name: 'Laptop Pro 15' }, { Rating: { value: 5 } })`.
- `iCheckRows({ rating: 5 })` does not work for this cell: `MacroFieldBuilder._getValueMatcher` lists `sap.m.RatingIndicator` as a main control but falls through to `properties({ text })` for it, and a RatingIndicator has no `text`. Use `iCheckCells` with a state, as above.
- `FormAssertions.iCheckField(vFieldIdentifier, vValue, mState)`: the `FieldIdentifier` typedef has `property` and an optional `targetAnnotation` ("when set, a DataFieldForAnnotation is identified instead of a DataField, and the resolved control id changes accordingly"). The exact `targetAnnotation` string for a DataPoint (`'DataPoint'` or `'DataPoint#Rating'`) is not confirmed by the sources read; `test-ui` derives it from the rendered `FormElement` id. Pass the expected value as a state (`{ value: 5 }`), not as `vValue`, for the reason above. Fallback if the identifier does not resolve: a custom page object like `pages/CategoryDropdown.js` matching `sap.m.RatingIndicator` inside the `GeneralInfo` form container.
- Editing the stars in OPA5 (`iChangeField`) targets `sap.ui.mdc.Field` and `InputBase`; not attempted in this feature. The edit round trip is the `ui-verifier` scenario plus the backend `draftActivate` test.
- Existing journeys: `CategoryShownAsNameJourney` and `RussianLocaleJourney` call `iCheckColumns(undefined, ...)`, so a fifth column does not break them; `iCheckRows(15)` counts rows, not columns.

## CDS facts

- `@assert.range: [ min, max ]` on numeric elements is a closed interval; validated on `draftActivate` and on direct active writes; error code `ASSERT_RANGE`, translated by the runtime (`en`, `ru`); target `in/rating` on activation of a draft of an active record, plain `rating` on a direct `PATCH` (TESTING "cds 10 specifics", ADR-0012 facts). On a draft `PATCH` the violation is a `DraftMessages` entry with HTTP 200.
- `Integer` compiles to `Edm.Int32`; `@assert.range` renders `Validation.Minimum`/`Validation.Maximum` in the contract (measured, `contract-delta.md`).
- Adding an element to a `projection on` entity needs no service change; drafts (`@odata.draft.enabled`) and `@restrict` grants cover it automatically (`search_model` on `CatalogService.Products`: the projection has no explicit column list).
