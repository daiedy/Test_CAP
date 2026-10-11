---
name: fe-v4-dynamic-field-control
description: Dynamic Common.FieldControl on cds 10.1.1 / UI5 1.153 - CDS expression via the association path (generated FK rejected), $edmJson drops null, integers not enum symbols, 0 renders Disabled and 1 ReadOnly, server ignores it, replaces static Mandatory, +10 EDMX lines; ADR-0025 proposed 2026-10-10
metadata:
  type: project
---

Measured for `products-subcategory-cascade` (2026-10-10; scratch probes in `/tmp`, CDN sources 1.153.0, `node_modules/@sap/cds` 10.1.1):

- `@Common.FieldControl: (category.code is null ? 0 : 3)` on the association compiles to `<If><Eq><Path>category_code</Path><Null/></Eq><Int>0</Int><Int>3</Int></If>` on the FK target only (+10 EDMX lines). Writing the generated FK (`category_code`) inside an annotation expression is a **compile error** ("Element not found"); use the association path.
- `$edmJson: { $If: [ { $Eq: [ { $Path }, null ] }, 0, 3 ] }` drops the `null` (one-operand `<Eq>`): broken.
- FE `FieldControlHelper` dynamic branch compares integers 0/1/7 only; enum symbols in the expression compile to `<EnumMember>` and are not matched. `UIFormatters.getEditMode`: 0 gives `Disabled`, 1 `ReadOnly` in edit mode; visibility depends on `UI.Hidden` only (0 does not hide in V4). `<Null/>` reaches FE as JSON `null`.
- Server: `lib/req/validate.js` treats only static `#ReadOnly`/`#Mandatory`; a dynamic FieldControl changes nothing on writes. capire: runtime expressions only in `@restrict.where` and `@assert`; only static `@readonly`/`@mandatory` produce field control.
- A dynamic FieldControl on a `@mandatory` element replaces the static `Mandatory` line in EDMX (server still enforces `@mandatory`).
- With `@mandatory` on the same element (`subcategory`, user requirement 2026-10-10) use `? 0 : 7`: EDMX 875 to 884. cds 10.1.1 writes no `ASSERT_MANDATORY` draft message on a draft PATCH (the reset's null stays silent); active writes and `draftActivate` reject. `importProducts` without the column then fails every row ("column subcategory_code"): a new mandatory field needs an import column decision (D7 of `products-subcategory-cascade`).
- `sap.fe.test` `onForm().iCheckField(field, value, { editMode: 'Disabled' })` should match via the generic property matcher (source-read, not run).

**Why:** no PATTERNS row covered a field whose editability depends on another field; fiori-mcp shows the expression form only in a checkbox-group sample, and the obvious spellings (`category_code`, `$edmJson` with `null`, enum symbols) all fail silently or at compile time.

**How to apply:** for any conditionally editable field plan ADR-0025's shape (check its status first): app-layer annotation, integer codes, association path, the data rule enforced separately in `srv/`. Quote +10 EDMX lines per field. Related: [[assert-constraint-and-dependent-vh]], [[contract-delta-facts]], [[fe-v4-action-dialog-and-refresh]].
