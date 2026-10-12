---
name: custom-section-form-design-sources
description: MCP-citable sources for designing a FE custom section with a sap.ui.layout.form Form of typed fields (column counts, labels, units, empty indicator, numeric types, ComboBox/MultiComboBox, toast vs warning) when fiori-mcp is down
metadata:
  type: reference
---

Learned 2026-10-12 while redesigning `products-details-section` (#9) revision 2, with `mcp__fiori-mcp__search_docs` down all session.
- `mcp__ui5-mcp-server__get_guidelines` section 4 "Rules to create a Form" is the citable source for form layout: `Form` + `ColumnLayout`, never `SimpleForm`, 2 columns at M, 3 at L, 4 at XL.
- `get_api_reference sap.ui.layout.form.ColumnLayout` (small output): S always 1 column, newspaper order, labels beside fields in large columns unless `labelCellsLarge` 12. FE forms show labels above, so a matching custom form needs `labelCellsLarge` 12.
- `sap.ui.layout.form.FormElement#label`: the FormElement assigns the label to its fields when `labelFor` is empty. In a list-bound template, tell the developer not to set `labelFor` by hand.
- Useful small property queries: `sap.m.Input#description` (unit after the input), `#fieldWidth` (default 50%), `sap.m.Text#emptyIndicatorMode`, `sap.m.ComboBoxBase#showClearIcon` (1.96).
- `sap.ui.model.odata.type.Decimal`: the model value is a string (fits a String-stored value), `scale` pads the display unless `minFractionDigits` is overridden, grouping is on by default.
- `sap.m.MultiComboBox` (class output is large but under the limit): an invalid typed char is deleted at once with a 1 s Error flash; there is a phone full-screen dialog; the guideline URL is in `references`. `sap.m.Tokenizer` has the hidden `_tokensInfo` a11y text and the token guideline URL.
- `sap.m.MessageToast` "When not to use: ... an error or warning message" is the MCP-verified reason to reject a toast for warnings.
- Not answerable without fiori-mcp: what a FE V4 custom section offers on its heading line, and how FE shows a server Warning on a field. Hand both to the verifier.
- Measured FE form look (screenshots of revision 1): label above the value with a colon in both modes, 4 columns at the verifier's desktop window, numeric inputs end-aligned, currency to the right of the amount, and each section heading is one H2.

- Reconciling SCREENS with an approved plan (2026-10-12, #9 step 1b): besides the items the orchestrator names, diff the layouts and verifier scenarios against the seed decision (D17 gave Wireless Mouse and Office Chair two list values each; three scenarios and two layouts were stale) and the fragment name in the ADR. `@assert` constraint texts carry no placeholders, so server texts cannot name bounds; the client `sap.ui.model.odata.type.Decimal` (`minimum`/`maximum`/`scale`, `validateValue` throws) gives the bound-naming framework texts. This agent has no Bash: `check-feature-docs.mjs` cannot be run, and it checks only PLAN.md and CONTEXT.md anyway.

- Measured at the #9 browser proof (2026-10-12): never specify a `valueStateText` on a `sap.m.MultiComboBox` without an error state; it is announced as the popup title. Leave the invalid-char flash to the framework text "Invalid entry". A FE server Warning on a field (U3 `req.warn` from a `PATCH` `sap-messages` header) shows as the field's Warning value state with the text, listed in the popover after errors, NOT counted on the footer button; it clears at the next `DraftMessages` read. So never write "footer button with a warning, count N" in a scenario. A two-way ComboBox `selectedKey` writes `null` while typing a non-item, so a "stored value unchanged" promise needs `OneWay` plus commit-time writes (architect ruling).

- `get_api_reference sap.m.ObjectStatus` (moderate size): `inverted` 1.66, `state` ValueState or IndicationColor, `stateAnnouncementText` 1.110 overrides the default state announcement, `ariaLabelledBy`/`ariaDescribedBy` only with `active`; guideline URL in `references`. NOT documented: the default announced state text and whether the internal icon is aria-hidden; no UI5 sources on disk (`~/.ui5` absent, no sap.m in app node_modules), so hand both to the verifier's DOM check. a11y skill `references/target-size.md`: ObjectStatus target size matters only when active/link-like.

Related: [[fiori-mcp-search-outage]], [[table-section-design-sources]], [[docs-cyrillic-code-points]].
