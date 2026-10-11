---
name: composition-under-lean-draft
description: Measured 2026-10-11 (cds 10.1.1, UI5 1.153.0 sources) for the products-details-section spec - how a composition child behaves under lean draft (422 on top-level writes, product nav resolves to the draft parent, per-row activation targets), @assert with exists/$self as a set-membership guard, @assert.unique gives a 500, navigation-path In parameter, EDMX cost, CSV quote trap; ADR-0026 accepted 2026-10-11 (D1 = reject at Save, inch unit `in`)
metadata:
  type: project
---

Facts from the scratch run for #9 (`docs/features/products-details-section/research/framework-facts.md` while the folder exists):

- **Composition child of a draft root** (`Products.details : Composition of many ProductDetails`): the child is draft-enabled by the root; every top-level write to the child set (`POST/PATCH/DELETE /ProductDetails`, active or draft, any role) is 422 `DRAFT_MODIFICATION_ONLY_VIA_ROOT`, before authorization. Writes go through the root: `POST /Products(id,IsActiveEntity=true)/details` (active, bypass draft), `POST /Products(id,false)/details` (draft), deep `POST/PATCH` on the root. Reads of the child set are authorized on the child's own `@restrict` only (capire), so the explicit child projection carries the root's grants.
- A draft child's `product` navigation (`$expand=product`, `/product`) returns the **draft** parent (IsActiveEntity false). `draftActivate` re-checks every child row (not only changed ones); error targets are `in/details(ID=...,IsActiveEntity=false)/<element>`, `MULTIPLE_ERRORS` when several. A child `POST` (NEW) writes no draft message; a child `PATCH` of the element writes the message on the child and on the root `DraftMessages` with the full path. Messages written by a failed activation stay until touched or saved.
- **`@assert` set-membership**: `not exists attribute.subcategories[subcategory.code = $self.product.subcategory.code]` compiles and runs; `$self` inside an infix filter is the annotated entity. Also `exists product.details[attribute.code = $self.attribute.code and ID != $self.ID]` (duplicate inside the draft tree) and a nested `exists details[... not exists ...[... $self.subcategory.code]]` on the root. 0 EDMX lines. An unmanaged association whose ON condition follows a managed association beyond its keys (`product.subcategory`) is a compile error.
- **`@assert.unique` on a draft child** with `@cap-js/sqlite`: a duplicate on the active path (incl. `draftActivate`) is a **500 `ERR_SQLITE_ERROR`**, a draft PATCH is silent. Use an `@assert` branch for user-facing uniqueness; keep `@assert.unique` only where the CSV is the sole writer.
- **FE V4 In parameter on a child row**: `ValueHelpDelegate._getInitialFilterConditionsFromBinding` calls `bindingContext.requestProperty(sources)`, so `LocalDataProperty: product.subcategory_code` (CDS path, compiled `PropertyPath="product/subcategory_code"`) is a supported source; pair it with `Common.SideEffects` from the parent property to the composition (`TargetEntities: [ details ]`) so the cached parent value is refreshed. Source-read, browser proof pending in the feature.
- Object Page table: `Inline` is the default creation mode in FE V4; Create/Delete exist only in edit mode (fiori-mcp before its outage). `sap.fe.test.ObjectPage#onTable({ property: 'details' })`.
- EDMX: composition + 2 code-list-like entities + child draft artifacts + labels = +293 lines (884 to 1177); the app annotations (facet, line item, header info, 3 side effects rendered twice, hand-written value list replacing the generated one) +96 net (1273).
- CSV: a bare `"` as a value opens a quoted field and silently swallows the following rows; write `""""`.

**Why:** the issue assumed handlers and `@assert.unique`; the measured facts (422, 500, `$self` in filters, late property read) decide the design and are not in the MCP docs.

**How to apply:** for any further composition or child value help reuse these facts instead of re-measuring; check ADR-0026's status first. Related: [[assert-constraint-and-dependent-vh]], [[cds10-draft-behavior]], [[contract-delta-facts]], [[test-suite-shape]].
