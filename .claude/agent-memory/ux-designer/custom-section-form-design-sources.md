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

Related: [[fiori-mcp-search-outage]], [[table-section-design-sources]], [[docs-cyrillic-code-points]].
