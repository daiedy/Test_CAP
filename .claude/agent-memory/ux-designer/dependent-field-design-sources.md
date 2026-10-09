---
name: dependent-field-design-sources
description: Where facts for a FE V4 dependent dropdown design come from (In parameter, side-effect reset, messages, Adapt Filters, form guideline URLs), sap.fe.test limits for form labels, and the search_docs output-overflow trap
metadata:
  type: reference
---

Verified 2026-10-09 while designing `products-subcategories` (#8); all queries answered, no outage.
- `fiori-mcp` docs worth quoting: "In/Out Mappings in the Common.ValueList Annotation" (steps 5 and 10: In filters the value help by the main-entity value); "Value Help as a Dropdown or Radio Button List" (radio buttons forbidden with ValueListParameterIn; dropdown sorting follows the Value Help Dialog logic); "Side Effects" step 1 (single source property: request sent immediately after the change) and the framework doc's source-property rules (ComboBox/value help trigger on value set or focus leave); "Using Messages in SAP Fiori Elements" step 2 (backend must revalidate changed fields and add/remove state messages) and step 8 (bound messages in edit mode go to the message popover); "Adapting the Filter Bar (V2 and V4)" step 2 (V4 Adapt Filters lists main-entity properties, so a property left out of SelectionFields is still offered there).
- Design guideline URLs: https://experience.sap.com/fiori-design-web/form/ and https://experience.sap.com/fiori-design-web/object-page/#forms come from the "Grouping Fields with UI.FieldGroup and UI.ConnectedFields" doc (query about Object Page form fields); the combo box URL comes from the `references` field of `get_api_reference sap.m.ComboBox`.
- `sap.fe.test.api.FieldIdentifier` has only `property`, `fieldGroup`, `targetAnnotation`, `connectedFields`: no label. A form label assertion (for example a `ru` label on the Object Page) needs an OpaBuilder on `sap.m.Label`, or use the List Report column header via `iCheckColumns`.
- The project's CQL null trap matters for UX: a `@assert` constraint guarded only on one side fires when the other operand is empty, which shows up as a misleading draft message on Create. Check every constraint the plan adds against the empty-parent state.
- Broad `search_docs` queries with maxResults 6+ overflow the tool limit and are saved to a file; parallel overflowing calls can be saved under the same file name and overwrite each other. Use maxResults 4-5 and Grep the saved files for `TITLE`.
- `node scripts/check-feature-docs.mjs` still checks only PLAN.md and CONTEXT.md (re-read 2026-10-09); this agent has no Bash to run it.

Related: [[filter-bar-design-sources]], [[action-dialog-design-sources]], [[fiori-mcp-search-outage]], [[docs-cyrillic-code-points]].
