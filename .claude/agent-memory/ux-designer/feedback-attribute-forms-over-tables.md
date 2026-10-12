---
name: feedback-attribute-forms-over-tables
description: For per-product attribute values the user rejected an FE table section with inline Create and an attribute dropdown as clumsy and chose data-driven form fields (Akeneo-style) with a completeness counter
metadata:
  type: feedback
---

For product attributes or characteristics, propose data-driven form fields first: one labelled field per attribute of the subcategory, typed controls, units next to the input and a "Filled N of M" counter. Do not lead with an editable table where the user picks the attribute per row.

**Why:** on 2026-10-12 the user rejected the verified revision 1 of `products-details-section` (an FE table section with Create, an attribute combo box, Value and Unit columns) as clumsy. After reviewing an options page with mockups, the user chose fields generated from the subcategory and styled like "General Information", with the server creating one field per assigned attribute. The user also added multi-value lists (MultiComboBox) during the redesign. The user values a familiar PIM look (Akeneo) over the framework's default table.

**How to apply:** when a feature asks for variable attributes or details, show a form-layout option with mockups at the spec stage, before the table option, and state its cost honestly. A custom section needs a fragment plus Fiori MCP `controlConfiguration`. Ask early about multi-value lists and about which data the user may lose on a change, for example a subcategory change. These were the user's follow-up questions this time.

Related: [[custom-section-form-design-sources]].
