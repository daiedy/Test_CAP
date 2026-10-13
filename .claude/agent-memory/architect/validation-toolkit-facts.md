---
name: validation-toolkit-facts
description: Measured 2026-10-13 (cds 10.1.1, scratch probes for the products-validations spec, #10) - @assert.format/range .message keys, open bounds, the undocumented error('KEY', args, targets) CQL function with additionalTargets on drafts, self-association uniqueness from a draft, before('SAVE', Root) sees deep children at activation, EDMX costs; ADR-0028 proposed
metadata:
  type: project
---

Facts from `docs/features/products-validations/research/validation-facts.md` (scratch `/tmp/pv-scratch`, probes P0-P14, Q1-Q4):

- `@assert.format.message: 'KEY'` and `@assert.range.message: 'KEY'` (and `@mandatory.message`) take a bare message key from `_i18n/messages*.properties`, localized (ru measured); the error `code` stays `ASSERT_FORMAT`/`ASSERT_RANGE`. Open bounds `[(0), max]` work (`Validation.Exclusive` +2 EDMX lines; `Validation.Pattern` +1 per `@assert.format`).
- Timing: format/range/target messages are in the draft `PATCH` response; `@assert: (case ...)` messages are written at commit for **touched** elements (`cds.env.features.assert_touched_only`) or elements named as `additionalTargets`, visible on the next `DraftMessages` GET; at activation input validation (`ASSERT_*`) rejects first and the constraints never run in that request (two Save rounds possible).
- `error('KEY', args, ('field1', 'field2'))` in a constraint `then` branch (`@cap-js/db-service` `cql-functions.js`, parsed by `assert.js`) gives `target` + `additionalTargets` (+ message args); **not in capire docs**; targets must be string literals (a path is cut to its last segment, a generated FK name is a compile error in annotation expressions). On the active path the OData error shows `target` only.
- Subqueries are not allowed in annotation expressions. Uniqueness on a draft root: a self-association in `db/schema.cds` with functions in the ON (`lower(trim(...))` compiles) + `exists namesakes`; from a draft it resolves to active rows, the own row is excluded by `ID` (draftEdit + activate unchanged passes); `@cds.api.ignore` does not hide a navigation property (+5 EDMX with a title).
- `sap.common.Currencies.minorUnit` exists and `@sap/cds-common-content` 3.2.0 ships it (33 currencies with 0, e.g. JPY); `floor(price) != price` is the portable "has decimals" test.
- Handlers on lean draft: `before('SAVE', Products)` fires on a deep `POST` (`CREATE`) and at `draftActivate` (`UPDATE`) with `req.data.details` present; `before('SAVE', ProductDetails)` on an active child PATCH through the root; `before('PATCH', ProductDetails.drafts)` rejecting with 400 stores nothing.
- Dynamic `Common.FieldControl: (stock > 0 ? 7 : 3)` compiles to `<If><Gt>...` (+10 EDMX); browser rendering of `additionalTargets` and of an `in/details(...)` activation error on a custom-form control NOT yet proven (feature phase 3).
- Every new root constraint needs a per-row import pre-check (ADR-0021 4E shape) or the import answers a row-less commit error.

**Why:** the issue assumed `@assert.unique` and cds default texts; the measured toolkit (custom keys, `error()` targets, self-association) decides the whole #10 design.

**How to apply:** check ADR-0028's status before reusing; quote the EDMX costs; for a rule across two edited fields use `error()` with both targets; never promise draft feedback for `@mandatory`. Related: [[assert-constraint-and-dependent-vh]], [[composition-under-lean-draft]], [[contract-delta-facts]], [[fe-v4-dynamic-field-control]].
