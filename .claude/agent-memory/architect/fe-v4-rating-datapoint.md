---
name: fe-v4-rating-datapoint
description: FE V4 facts for a stars column (UI.DataPoint Visualization Rating renders sap.m.RatingIndicator, editable in a form in edit mode), the sap.fe.test matchers that assert it, and the extend-based scratch measurement; basis of the products-rating-column spec (2026-09-25, no ADR)
metadata:
  type: project
---

Feature `products-rating-column` (spec 2026-09-25, issue #5): a rating column needs no fragment. Verified facts, each from Fiori MCP or the CDN debug sources of the loaded UI5 (1.152.0, marked CDN):

- `UI.DataPoint #X: { Value: <prop>, TargetValue: N, Visualization: #Rating }` referenced by a `UI.DataFieldForAnnotation` in `UI.LineItem` renders `sap.m.RatingIndicator` (`maxValue` = `TargetValue`, `editable=false`) in the table; the Fiori tools Page Editor generates the same shape ("Add Rating Column"). Decimals round to half stars (x.25 to x.74).
- CDN: the same record in a `UI.FieldGroup` gets FE edit style `RatingIndicator` in edit mode (interactive stars bound to the property, `maxValue` from `TargetValue`, tooltip from `Common.QuickInfo` or the framework key `T_COMMON_RATING_INDICATOR_TITLE_LABEL`). A header-facet DataPoint stays read-only in edit mode (MCP), so an editable rating belongs in a FieldGroup.
- The column header of a `DataFieldForAnnotation` comes from the record's `Label`, not from the property's `@title`: set `Label: '{i18n>Entity.element}'` explicitly, reusing the `_i18n` key.
- CDN, `sap.fe.test`: `iCheckColumns(n, { <headerText>: { header } })` works because `hasColumns` matches `getHeader() === key || getPropertyKey() === key`; a `RatingIndicator` cell is asserted with `iCheckCells(rowValues, { <header>: { value: 5 } })` (`cellProperty` unwraps `MacroAPI` and applies a `properties` matcher), not with `iCheckRows({ prop: 5 })`, whose value matcher falls through to `text` for that control; a form field of a `DataFieldForAnnotation` uses the `FieldIdentifier` with `targetAnnotation` (exact string unverified, derive from the rendered `FormElement` id).
- Contract cost measured on cds-dk 10.0.7: element + `@title` + `@assert.range` = +6 EDMX lines (Property, `Common.Label`, `Validation.Minimum/Maximum`); DataPoint + two `DataFieldForAnnotation` records = net +15 with positional churn of the neighbouring `Common.SemanticKey`/`SideEffects` block in the raw diff.

**Why:** the issue's wording "custom column" pulls towards the fragment row of PATTERNS; the facts above show the annotation row covers it, which kept the plan free of a manifest change and an ADR.

**How to apply:** for any DataPoint visualization (Rating, Progress) plan an annotation column first; reuse the matcher notes for `test-ui`. Scratch trick extension (see [[fe-v4-semantic-key-marker]]): a model change is measured with `extend my.catalog.X with { ... }` in the `/tmp` scratch; extending an array annotation with `...` in the scratch needs a `using from` of the project file that holds the first assignment, otherwise the compiler reports `Duplicate assignment`. Related: [[test-suite-shape]], [[cds10-draft-behavior]].
