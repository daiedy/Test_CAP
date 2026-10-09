---
name: contract-delta-facts
description: Measured EDMX cost of common CDS edits on this model (2026-10-09, cds 10.1.1): @assert.target emits nothing, @assert.range maps to Validation.Minimum/Maximum, a Decimal precision change is one Property line, a UI.*Hidden $Path renders twice plus once per DataFieldForAction; scratch-copy method; Currencies CSV and import fixture facts
metadata:
  type: project
---

Measured on a scratch copy for the `catalog-hygiene` spec (#20, 2026-10-09; `rsync` without `node_modules`/`.git`/`docs`, `node_modules` symlinked, `npx cds compile '*' --to edmx-v4 -s CatalogService -l en`, `diff` per edit; the baseline compile was byte-identical to the committed `metadata.xml`, 697 lines):

- `Decimal(10, 2)` to `Decimal(15, 2)` on `Products.price`: **1 line** (`Precision="10"` to `"15"`).
- `@assert.range` bound change: **1 line** (`Validation.Maximum`; `Int=` for integers, `Float=` for decimals). `@assert.range` is the only `@assert.*` with an EDMX footprint on this model.
- `@assert.target` on an association: **0 lines**. It lives only in CSN (`@assert.target: true` on the association and its foreign key). Issue #20 assumed it changes the contract; it does not.
- A `$Path` change inside `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden`: **2 lines per term** (entity type and entity set) plus **1 per `DataFieldForAction` record** carrying the same `UI.Hidden`: 7 for the four consumers of `Permissions/isEditor`.

Data facts: `@sap/cds-common-content` 3.2.0 ships `db/data/sap-common-Currencies.csv` (204 data rows, quoted CSV, `USD`/`EUR`/`GBP` present, no `XXX`/`XTS`); `sap.common.Currencies` is `persistence.skip: if-unused` and is used by `Products.currency`, so the table exists and the test "exposes Currencies as a code list" reads `USD` on every run. The import fixtures (`test/fixtures/products-import-{valid,invalid}.xlsx`) use `USD`/`EUR`/`GBP` only; the invalid one proves `@assert.target` runs on the internal `INSERT` (`Row 5, column "category"`), so a second association check needs no handler change (`columnOf` already maps `currency_code` to `currency`).

`catalog-hygiene` (#20) is merged (`c29b3f8`, 2026-10-09); the figures above held at implementation. ADR-0003 carries the amendment in the ADR-0021 shape (section between Decision and Alternatives, `Amendment:` rows, `Status:` untouched). ADR-0024 is still a free number (the #11 spec mentioned it, no file exists on `main`).

**Why:** contract figures per phase are a plan requirement (CHANGELOG 2026-09-11) and the issue text got one of three wrong; measuring cost one scratch compile per edit.

**How to apply:** quote these per-edit costs when a plan touches the same constructs, re-measure only for new constructs; never promise an EDMX change for `@assert.target`, `@mandatory` already emits `Common.FieldControl`. Related: [[role-aware-ui-singleton]], [[fe-v4-action-dialog-and-refresh]], [[test-suite-shape]].
