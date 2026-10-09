---
name: assert-constraint-and-dependent-vh
description: cds 10.1.1 @assert (case ...) constraints replace cross-field handlers (null trap with CQL !=, guard both operands, draft-message touched-only rule); FE V4 1.153 dropdown honors ValueListParameterIn; EDMX costs; ADR-0024 accepted 2026-10-09
metadata:
  type: project
---

Measured on a scratch copy for `products-subcategories` (#8, 2026-10-09, cds 10.1.1):

- `@assert: (case when ... then 'KEY' end)` on an association works with path expressions (`subcategory.category.code`), is propagated to the FK, runs as one SELECT before commit; 400 with `code` = the key, `target` = FK, localized from `_i18n/messages*.properties`; `in/<fk>` on draftActivate. **CQL `!=` is null-safe**: without `x.code is not null and ...` a null subcategory is rejected; guard the parent too (`category.code is not null`, user decision D7 2026-10-09, ux-designer found it), else a subcategory picked before the category gets a message no later category PATCH removes. On a draft PATCH a message is written to `DraftMessages` only when the PATCH touched the target element, and the PATCH response shows `[]`; read with a GET. 0 EDMX lines.
- `before('PATCH', Products.drafts)` fires on a draft PATCH; setting `req.data.x = null` persists and is in the PATCH response.
- Hand-written `Common.ValueList` on the association replaces the generated one (still one per property). UI5 1.153 `ValueHelpDelegate.getInitialFilterConditions` resolves In parameters for fixed-values typeahead too (source-read; OPA5 to confirm). `Common.SideEffects` on the entity renders twice (+30 lines for one record with 1 source and 2 targets).
- A new CodeList with one association: +129 EDMX lines (entity set, texts, generated ValueLists incl. one on the code list's own FK).

**Why:** the issue (and PATTERNS) assumed a cross-field rule needs a `before` handler; capire's declarative constraints do it, and the null trap would have rejected every product without a subcategory.

**How to apply:** for any rule between fields, plan an `@assert` constraint with explicit null guards before a handler; check ADR-0024's status and the PATTERNS rows it proposes. A future import column for such a field needs `validationErrors` in `srv/catalog-service.js` extended to map non-`ASSERT_*` keys to rows. Related: [[codelist-valuelist-autogen]], [[contract-delta-facts]], [[cds10-draft-behavior]].
