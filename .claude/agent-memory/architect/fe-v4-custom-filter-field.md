---
name: fe-v4-custom-filter-field
description: FE V4 custom filter field facts (manifest filterFields, filterValues binding, Range type min-0 bug, RangeSlider clamp write-back, setFilterValues, liveMode kills iExecuteSearch); basis of ADR-0020 (accepted 2026-09-25, products-rating-filter #6; user chose liveMode together)
metadata:
  type: project
---

Spec `products-rating-filter` (#6, 2026-09-25), ADR-0020 accepted by the user 2026-09-25 (RangeSlider, 0..5 step 1, slider only, `liveMode: true` in the same feature, non-default). With liveMode the 5 `iExecuteSearch()` calls are dropped and the following `iCheckRows(n)` is the wait (each n differs from the previous count). Facts from Fiori MCP and the UI5 1.152.0 CDN debug sources:

- No annotation renders a slider; declarative alternative = `rating` in `UI.SelectionFields` (+ `Capabilities.FilterRestrictions` `SingleRange`), a typed condition field, contract change.
- Custom filter: `controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields.<key>` with `template`, `availability`, `position`. Key = property name for predefined operators; it overwrites the annotation-based field of the same key (also in Adapt Filters). Empty `label` falls back to the property's `Common.Label` (`_getMissingLabelForManifestFilterFields`, FilterBar converter). Keeping both fields needs a custom operator + `property` + unique key.
- `sap.fe.macros.filter.type.Range` (default op `BT`): empty value formats to `[min || MIN_SAFE_INTEGER, max || MAX_SAFE_INTEGER]`, so `min: 0` is ignored.
- `sap.m.RangeSlider.onBeforeRendering` re-runs `setRange` with clamping and `setProperty('range')`: a two-way binding writes the clamped value back (same class as the RatingIndicator lesson of #5). Hence ADR-0020: one-way display + `change` handler calling ExtensionAPI `setFilterValues(path, op, values)` / `setFilterValues(path)` to clear.
- `liveMode` = page setting `ProductsList.options.settings.liveMode` (view xml `viewData>/liveMode`); `sap.fe.test` `iExecuteSearch()` presses `btnSearch` (Go), 5 calls in 3 journeys would break.
- I cannot call Fiori MCP `list_functionality` (architect has only `search_docs`); the plan makes `fiori-app-dev` record it first in `research/fiori-mcp-custom-filter.md`.

**Why:** the literal "RangeSlider" pulls to the MCP-"recommended" two-way binding, which self-applies a 0..5 condition and hides null ratings.

**How to apply:** any custom filter control that adjusts its own value on render (slider, rating, step input) gets the one-way + handler shape; check the user's ADR-0020 decision first. Related: [[fe-v4-rating-datapoint]], [[test-suite-shape]].
