---
name: project-fe-drops-validation-exclusive
description: FE V4 (CDN 1.154.0) ignores Validation.Exclusive; an open @assert.range bound gives no client refusal, a closed bound does, also inside the Currency composite
metadata:
  type: project
---

Fiori Elements V4 applies `Validation.Minimum`/`Maximum` of an `Edm.Decimal` property as the `minimum`/`maximum` constraints of the field's `sap.ui.model.odata.type.Decimal`, but never `minimumExclusive`/`maximumExclusive`: `setUpConstraints` in `sap/fe/base/BindingToolkit-dbg.js` (and `getTypeConfig` in `sap/fe/core/templating/UIFormatters-dbg.js`) reads only the two plain keys, although `EDM_TYPE_MAPPING` lists the `@...Exclusive` keys. `Edm.Int32` fields get no Validation constraints at all.

Measured 2026-11-12 (products-validations D1): price with `@assert.range: [(0), ...]` → `0` sends the PATCH, `-1` is refused on the client ("Enter a number with a minimum value of 0.00"). A scratch closed bound `[0.01, ...]` → `0` refused on the client ("... minimum value of 0.01"), no request. The Currency composite (only `skipDecimalsValidation` allowed) still enforces the amount part's Decimal constraints, because `PropertyBinding._setBoundValue` validates each part on the raw write.

With `@CodeList.CurrencyCodes` + `UnitSpecificScale` (measured 2026-11-12 in mock mode, M1): JPY refuses `10.50` on the amount ("Enter a number without decimals."), and changing the currency to JPY while the field shows a stored `10.50` is refused on the client too ("This currency does not support decimals. Adjust the amount or enter a different currency."), no `PATCH`; so the server's two-target R4 message is not reached by that UI path. Mock mode needs `localService/mockdata/Currencies.json`, else random customizing.

**Why:** the plan assumed the open bound gives a client refusal; it does not.
**How to apply:** for a "refuse on the client" criterion on a Decimal, propose a closed bound in `srv/annotations` (cap-backend-dev) or accept the server message; never hand-write `@Validation.Minimum` in the app layer (the compiler keeps the generated `Exclusive` under it). Related: [[reference-headless-measurement]].
