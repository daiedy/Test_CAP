# products-subcategory-cascade: framework facts and measurements

Date: 2026-10-10. Author: `architect`. Read by `architect` and `reviewer`; implementers read it only where a PLAN step names it. Versions: `@sap/cds` 10.1.1, `@sap/cds-compiler` 7.0.3, `@sap/cds-dk` 10.1.0, UI5 CDN 1.153.0 (`sap-ui-version.json`, build 2026-09-30).

## 1. What already happens today (code read, `68410eb`)

| Path | Category changes | Category cleared | Subcategory written while the category is empty |
|---|---|---|---|
| Draft `PATCH` (Fiori UI and plain API) | `resetStaleSubcategory` (`before('PATCH', Products.drafts)`) sets `subcategory_code = null` when the stored subcategory does not belong to the new category; test "clears the subcategory when a draft changes the category" | Same handler: `SELECT.one ... where({ code, category_code: null })` finds no row (every subcategory has a category), so the subcategory is cleared; **no test proves it** | Accepted silently, no message (constraint guard `category.code is not null`, ADR-0024 D7); test "records no mismatch for a subcategory chosen before the category ..." |
| Active `PATCH`/`PUT` (API with `IsActiveEntity=true`, bypass draft) | 400 `PRODUCTS_SUBCATEGORY_MISMATCH`, target `subcategory_code`, unless the request also sends a matching or empty subcategory; test "rejects a category change that leaves a stale subcategory on an active product" | `@mandatory` on `category` rejects (400); **no test for an active `PATCH` with `category_code: null`** | `@mandatory` on `category` rejects a create without a category (test "rejects a product without a category") |
| `draftActivate` | constraint 400, target `in/subcategory_code` | `@mandatory` 400 | `@mandatory` 400 |
| `importProducts` | no subcategory column (SUMMARY #8 open debt) | `category` is a mandatory column | not reachable |

Consequence: no saved (active) product can hold a subcategory without a category or of another category. The "disabled while empty" rule is about the order of entry on the Object Page; the data rule behind it is already enforced on the server.

Editing surfaces of `Products` in `app/products` (`manifest.json`): the Object Page form (create and edit, `editableHeaderContent: false`). The List Report has no inline edit, no mass edit, no creation row or creation dialog (`creationMode` absent: Create posts a draft and opens the Object Page). So "create from the List Report" is the Object Page in create mode, the same form.

## 2. MCP queries and findings

| Server | Query | Finding |
|---|---|---|
| cds-mcp `search_model` | `CatalogService.Products` | `@odata.draft.enabled`; `subcategory` and `subcategory_code` carry `@assert.target`, the `@assert` xpr and `@Common.Label`, no `@Common.FieldControl`; `category`/`category_code` carry `@Common.FieldControl: #Mandatory` (from `@mandatory`) |
| cds-mcp `search_docs` | "Common.FieldControl dynamic expression read-only field depending on another field" | capire "Field Control": "Currently only static `@readonly` / `@mandatory` annotations are supported for field control in Fiori UIs"; Java `cds.drafts.enforceReadonly` (Node has no counterpart in the result) |
| cds-mcp `search_docs` | "expressions as annotation values translated to OData dynamic expressions $If case when" | capire "Expression Translation": `case when ... then ... else`, the ternary `? :`, `and`/`or`/`not`, relational operators and `$Null()`/`null` are translated for OData vocabulary annotations; "Use the EDM JSON expression syntax only as a fallback"; "Elements that are not available to the compiler ... can't be used in annotation expressions" |
| cds-mcp `search_docs` | "constraints @readonly elements protected against write operations ignored input" | `@readonly` values are silently ignored on CREATE/UPDATE; "The same applies for ... `@FieldControl.ReadOnly` (static)" |
| cds-mcp `search_docs` | "Field Control Fiori @UI.Hidden expression @readonly expression dynamic constraints" | "Currently, the CAP runtimes support expressions in the `where` property of `@restrict` and in `@assert`": a dynamic `Common.FieldControl` is not evaluated by the server |
| cds-mcp `search_docs` | "Node.js draft-specific events NEW PATCH before handler Products.drafts" | `before('NEW', X.drafts)`, `before('PATCH', X.drafts)`; `PATCH` is an alias of `UPDATE` on the draft; "Validate on active entities, not only on drafts" |
| cds-mcp `search_docs` | "@assert constraint draft messages declarative constraints case when then end condition" | constraints run on every input, as draft messages on `PATCH`, rejected on active writes (basis of ADR-0024, unchanged) |
| fiori-mcp `search_docs` | "Common.FieldControl dynamic field control path ReadOnly Inapplicable Optional Mandatory" | "Field Control" building block page: static `#Mandatory`/`#Optional`/`#ReadOnly` and a path `@Common.FieldControl: BookingFeeFC`; checkbox-group sample: CAP CDS `@Common.FieldControl: (Boolean2 ? 0 : 3)` rendering `<If><Path/><Int>0</Int><Int>3</Int></If>`, "FieldControl can also be set as path based reference to property or expression binding" |
| fiori-mcp `search_docs` | "FieldControlType values 0 hidden 1 read-only 3 optional 7 mandatory behavior in edit mode" | no statement how 0 renders in OData V4; inline edit and mass edit pages (not configured in this app) |
| fiori-mcp `search_docs` | "when to use disabled input field versus read-only field depends on another field selection" | nothing on the design guideline; the SAP Fiori design guideline on disabled versus read-only inputs is not in the MCP index (not verified by MCP) |

## 3. UI5 1.153.0 sources (CDN debug sources, read 2026-10-10)

- `sap/fe/core/templating/FieldControlHelper-dbg.js`: for a non-constant FieldControl `isDisabledExpression` is `fc == 0` and `isReadOnlyExpression` is `fc == 1`, compared as numbers or numeric strings only; the constant branch also accepts the enum strings. So a dynamic expression must yield the integers, not `Common.FieldControlType/...` enum members. `isRequiredExpression` is `fc == 7`.
- `sap/fe/core/templating/UIFormatters-dbg.js` `getEditMode`: in an editable page, a disabled expression gives `FieldEditMode.Disabled` (greyed, not focusable input), a read-only one `FieldEditMode.ReadOnly` (framed, focusable, not editable); in display mode both give `Display`.
- `sap/fe/core/templating/DataFieldFormatters-dbg.js` `generateVisibleExpression`: visibility depends on `UI.Hidden` only, so FieldControl 0 disables the field in OData V4, it does not hide it.
- `sap/ui/model/odata/v4/lib/_MetadataConverter-dbg.js` `postProcessNull`: an unannotated `<Null/>` inside an expression becomes JSON `null`; `sap/fe/base/BindingToolkit-dbg.js` `parseAnnotationCondition` turns `$Eq: [ { $Path }, null ]` into `equal(path, constant(null))`. The chain CDS expression → EDMX → binding `${category_code} === null ? 0 : 3` holds (source-read; OPA5 confirms).
- `sap/fe/test/builder/MdcFieldBuilder-dbg.js` / `FEBuilder-dbg.js`: `onForm().iCheckField(field, value, state)` matches any `sap.ui.mdc.Field` property named in `state`, so `{ editMode: 'Disabled' }` is a candidate assertion (source-read; the `iCheckField(field, '')` false pass of TESTING still applies to the value).

## 4. CAP runtime sources (`node_modules/@sap/cds` 10.1.1)

- `lib/req/validate.js` `_is_readonly`: `@readonly`, `@cds.on.*`, `@Core.Computed`, or `@Common.FieldControl['#'] === 'ReadOnly'`; `_is_mandatory` reads `@mandatory` or `['#'] === 'Mandatory'`. `libx/_runtime/common/aspects/any.js` `_isReadOnly` the same. An expression value has no `#`, so a dynamic FieldControl changes nothing on the server: writes stay accepted.

## 5. Scratch compile (outside the project)

Method: probe files in `/tmp/cascade-probe/` with `using from '<worktree>/srv/catalog-service'; using from '<worktree>/app/products/annotations';` plus one annotation, `npx cds compile <probe> --to edmx-v4 -s CatalogService -l en` run from the worktree, diff against `app/products/webapp/localService/metadata.xml` (baseline probe without an annotation: 874 lines, byte-identical).

| Probe | Annotation on `CatalogService.Products` | Result |
|---|---|---|
| p1, p2, p4, p6, p7 | `subcategory @Common.FieldControl: (category_code is null ? 0 : 3)` and variants with `case`, `= null`, enum symbols, `1` | compile error: "Element `category_code` has not been found": the generated foreign key is not visible to the compiler in an annotation expression |
| p5 | `subcategory @Common.FieldControl: (category.code is null ? 0 : 3)` | **+10 lines, nothing removed**, in `<Annotations Target="CatalogService.Products/subcategory_code">`: `<If><Eq><Path>category_code</Path><Null/></Eq><Int>0</Int><Int>3</Int></If>`; the compiler rewrites the association path to the foreign key; one target only (no entity-set duplicate) |
| p3 | `{ $edmJson: { $If: [ { $Eq: [ { $Path: 'category_code' }, null ] }, 0, 3 ] } }` | +8 lines, **broken**: `<Eq>` with one operand, the `null` literal is dropped |
| p6b | `(category.code is null ? #Inapplicable : #Optional)` | compiles to `<EnumMember>` inside `<If>`; FE's dynamic branch compares integers only (section 3), so not used |
| p9 | `category @Common.FieldControl: (name is null ? 0 : 7)` on the `@mandatory` category | the dynamic value **replaces** the static `FieldControlType/Mandatory` line in EDMX; the server still enforces `@mandatory` (section 4) |
| p10 | `(category.code is null or category.code = '' ? 0 : 3)` | +15 lines (`<Or>` with an empty `<String/>`); FE never writes an empty string (UI5 OData types parse empty input to `null`), not used |

## 7. Mandatory subcategory (plan gate addition, scratch run 2026-10-10)

Method: `rsync` of the worktree to `/tmp/cascade-scratch` (without `node_modules`, `.git`, `docs`, `.claude`), `node_modules` symlinked, `@mandatory` added to `subcategory` in the copy's `srv/annotations/Products.cds` and `Common.FieldControl: (category.code is null ? 0 : 7)` to the copy's `app/products/annotations/Products.cds`; one throwaway Vitest file with `cds.test`, run with `npx vitest run`. Nothing in the project changed.

| Request | Result |
|---|---|
| Active `POST` without `subcategory_code` | 400 `ASSERT_MANDATORY`, target `subcategory_code`, "Provide the missing value." |
| Active `PATCH { category_code: 'KITCHEN', subcategory_code: null }` | 400 `ASSERT_MANDATORY`, target `subcategory_code` |
| Active `PATCH { subcategory_code: null }` | 400 `ASSERT_MANDATORY`, target `subcategory_code` |
| Active `PATCH { category_code: null }` | 400 `ASSERT_MANDATORY`, target `category_code` |
| Draft `PATCH { category_code: 'KITCHEN' }` (stored `LIGHTING`) | 200, the reset empties `subcategory_code`; the following `GET` shows `DraftMessages: []` (no mandatory message on a draft) |
| Draft `PATCH { category_code: null }` | 200, both empty, `DraftMessages: []` |
| `draftActivate` of that draft | 400 `MULTIPLE_ERRORS` with `ASSERT_MANDATORY` on `in/category_code` and `in/subcategory_code` |
| `importProducts` with today's valid fixture (no `subcategory` column) | 400: `PRODUCTS_IMPORT_NOTHING_IMPORTED` plus `Row 2/3/4, column "subcategory_code": Provide the missing value.` (`columnOf` falls back to the element name for an element without a workbook column) |
| `$metadata`, `subcategory_code` | the dynamic `<If>...<Int>0</Int><Int>7</Int></If>` and no static `FieldControlType/Mandatory`; the navigation property `subcategory` keeps only `Common.Label` |

EDMX per phase: `@mandatory` alone 875 lines (+1, the static `Mandatory` line on `subcategory_code`); with the `7` expression 884 lines (+10 against 874, +10 -1 against 875). `db/data/my.catalog-Products.csv` and `app/products/webapp/localService/mockdata/Products.json` give every one of the 15 products a subcategory.

## 6. Mechanisms considered and rejected

| Mechanism | Why not |
|---|---|
| `@readonly` with an expression | capire: only static `@readonly`/`@mandatory` produce field control |
| `@Common.FieldControl` with a path to a calculated or virtual element (`subcategoryFieldControl : UInt8`) | a new contract property, has to be added to `Common.SideEffects` targets and switches only after a server round trip; a `virtual` element needs an `after READ` handler (imperative); an on-read calculated element on a draft table is unmeasured |
| `$edmJson` expression | capire: fallback only; drops the `null` literal (p3) |
| Controller extension toggling `enabled` | client code for what one annotation does; invariant 6 |
| `UI.Hidden` while the category is empty | hides the field; the request says disabled |
| `@Core.OperationAvailable` | applies to actions, not properties |
| `Common.ValueListRelevantQualifiers` | chooses between several ValueLists; it does not control editability (also rejected in ADR-0024) |
| A server `@assert` "subcategory requires a category" | on a draft it is only a message that a later category `PATCH` does not remove (touched-only draft messages, ADR-0024 D7); on active data `@mandatory` on `category` already rejects |
