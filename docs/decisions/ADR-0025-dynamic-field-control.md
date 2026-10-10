# ADR-0025: Field editable only when another field is filled (dynamic field control)

Date: 2026-10-10. Status: accepted (user, 2026-10-10, feature `products-subcategory-cascade`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
The user asks that the Object Page Subcategory field be disabled while no category is selected, and that a category change clear the subcategory (feature `products-subcategory-cascade`). The clearing exists (ADR-0024 decision 3). No row in `PATTERNS.md` covers a field whose editability depends on the value of another field of the same entity: "Mandatory field" and "Read-only" are static, "Role-aware UI visibility" hides actions per user, not fields per row.

capire: only static `@readonly`/`@mandatory` produce field control, and the CAP runtimes evaluate annotation expressions only in `@restrict.where` and `@assert`; Fiori Elements V4 reads `Common.FieldControl` as a constant, a path or an expression (fiori-mcp "Field Control", checkbox-group sample `@Common.FieldControl: (Boolean2 ? 0 : 3)`). Evidence and measurements: `docs/features/products-subcategory-cascade/research/framework-facts.md`.

## Decision
A field that is editable only while another field of the same entity has a value gets one dynamic `Common.FieldControl`, written as a CDS expression on the field's element (for an association, on the association; the compiler puts it on the foreign key) in `app/<app>/annotations/<Entity>.cds`: `@Common.FieldControl: (<assoc>.<key> is null ? 0 : 3)`.

1. Values are the integer codes of `Common.FieldControlType`: `0` (Inapplicable, rendered by FE V4 as a disabled input in edit mode), `1` (ReadOnly, a read-only input), `3` (Optional), `7` (Mandatory). Enum symbols compile to `<EnumMember>` and FE's dynamic branch compares integers only.
2. The condition reaches the other field through its association path (`category.code`), never through the generated foreign key (`category_code` is rejected by the compiler in an annotation expression); the compiler writes `<Path>category_code</Path>`. CDS expression syntax, not `$edmJson` (the `$edmJson` form drops a `null` literal).
3. It is presentation: the server ignores a dynamic FieldControl (`lib/req/validate.js` reads only the static `#ReadOnly`/`#Mandatory`), so it lives with the field's other presentation annotations, not in `srv/annotations/`. The data rule it reflects is enforced in `srv/` by its own declarative means (`@mandatory`, an `@assert` constraint) and, where the rule changes data, by the draft handler of ADR-0024 decision 3.
4. Not on an element with `@mandatory` unless the enabled branch yields `7`: the dynamic value replaces the static `Mandatory` field control in EDMX, the server keeps enforcing `@mandatory`.
5. No `Common.SideEffects` for the editability itself: the expression reads a property of the same entity, so the field switches on the client as soon as the other field changes. Side effects stay for values the server changes (here `#CategoryChanged`).

First application: `Products.subcategory` with `(category.code is null ? 0 : 7)`, paired with `@mandatory` on `subcategory` in `srv/annotations/Products.cds` (user requirement at the plan gate, 2026-10-10: Category and Subcategory are both mandatory; D2 = disabled). Point 4 applies: the enabled branch yields `7`, so the field shows the required marker once a category is chosen, while the server enforces `@mandatory` on every path (measured on a scratch copy: 400 `ASSERT_MANDATORY` on an active write and on `draftActivate`, no draft message from the reset).

## Alternatives
| Option | Why rejected |
|---|---|
| `@readonly` with an expression | not supported: only static `@readonly` produces field control (capire) |
| FieldControl path to a calculated or `virtual` element (`subcategoryFieldControl : UInt8`) | adds a contract property, needs a `Common.SideEffects` target and a server round trip before the field switches; a `virtual` element needs an `after READ` handler (imperative) |
| `$edmJson: { $If: [ { $Eq: [ { $Path: 'category_code' }, null ] }, 0, 3 ] }` | capire: fallback only; measured: the `null` literal is dropped, `<Eq>` keeps one operand |
| Controller extension that toggles the input | client code for what one annotation does (invariant 6, ADR-0007) |
| `UI.Hidden` while the other field is empty | hides the field; the request is to disable it |
| `@Core.OperationAvailable`, `Common.ValueListRelevantQualifiers` | the first applies to actions, the second chooses between ValueLists; neither controls a property's editability |
| The annotation in `srv/annotations/<Entity>.cds` next to `@mandatory` | the server does not evaluate it, so it is not a semantic rule of the service; `.claude/rules/srv-services.md` limits that file to `@title`, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`, `@Core.Description` |

## Consequences
- `PATTERNS.md`, section "UI Fiori Elements": new row "Field editable only when another field is filled" with this decision; the row "Dependent value help" gets "pair it with ... and, when the dependent field must wait for its parent, Field editable only when another field is filled". Example: `subcategory` in `app/products/annotations/Products.cds`.
- `templates/annotations-ui.cds`: one commented `Common.FieldControl` line in the dependent value help block.
- `.claude/rules/ui-annotations.md` (protected) lists the annotations of the file without `Common.FieldControl`; one word added in a user-started `PIPELINE_ALLOW_PROTECTED=1` session (same STATE `Open debt` row as the ADR-0024 sentences).
- The reviewer accepts a dynamic `Common.FieldControl` only in this shape and only in `app/<app>/annotations/`, with the server-side rule named in the feature plan.
- EDMX cost on this model: +10 lines on the foreign key's `<Annotations>` target; on a `@mandatory` element the static `Mandatory` line goes away, so +9 net against the static form (measured 2026-10-10: 875 to 884 lines).

## Sources
- capire "Field Control", "Expression Translation", "Expressions as Annotation Values", "Input Validation `@readonly`", "CDS Annotations" (runtime expression support), via `mcp__cds-mcp__search_docs`
- SAP Fiori elements "Field Control", "Grouping Fields ... checkbox groups" (CAP CDS `@Common.FieldControl: (Boolean2 ? 0 : 3)`), via `mcp__fiori-mcp__search_docs`
- `https://ui5.sap.com/resources/sap/fe/core/templating/FieldControlHelper-dbg.js`, `UIFormatters-dbg.js`, `DataFieldFormatters-dbg.js`, `sap/fe/base/BindingToolkit-dbg.js`, `sap/ui/model/odata/v4/lib/_MetadataConverter-dbg.js` (1.153.0)
- `@sap/cds/lib/req/validate.js`, `libx/_runtime/common/aspects/any.js` (10.1.1)
- ADR-0004, ADR-0011, ADR-0024; `docs/features/products-subcategory-cascade/research/framework-facts.md`
