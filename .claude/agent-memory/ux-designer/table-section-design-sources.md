---
name: table-section-design-sources
description: Where the facts for a FE V4 Object Page table section (composition child, inline creation, draft messages on rows) come from when fiori-mcp is down, what get_api_reference cannot answer, and the SCREENS.md conventions that worked for ru texts
metadata:
  type: reference
---

Learned 2026-10-11 while designing `products-details-section` (#9), with `mcp__fiori-mcp__search_docs` down for the whole session.
- When the architect ran before the outage, `docs/features/<name>/research/framework-facts.md` section 1 holds the fiori-mcp document titles and findings; quote them as "architect, MCP" in the SCREENS sources table instead of leaving rows unsourced. For a table section the useful ones were "Create Mode Options for Object Page" (Inline is the OData V4 default), "Enabling Inline Creation Mode and Empty Row Mode for Table Entries", "Generic Action Buttons in Object Page Tables" (Create and Delete only in edit mode), "Side Effects" (`TargetEntities` navigation paths).
- `mcp__ui5-mcp-server__get_api_reference` resolves `app/products` against OpenUI5 1.136.5, so any `sap.fe.*` or `sap.ui.mdc.*` query fails ("Could not find field 'fe' in symbol 'sap'"); only `sap.m`, `sap.uxap`, `sap.ui.core` symbols answer. Useful small entries: `sap.m.Table#autoPopinMode`, `sap.m.Column#importance`, `sap.uxap.ObjectPageSectionBase#titleLevel` (Auto, rendered as `aria-level`), `sap.m.MessagePopover` (guideline URL in `references`; the class output is huge, ask only once).
- Facet `Label` and the child's `UI.HeaderInfo.TypeNamePlural` should be the same word in both locales: which one the framework renders as the table header is a verifier question, and identical strings make the answer irrelevant to the user.
- Keep `ProductDetails`-like child rows without `Common.SemanticKey`: it would render an `ObjectIdentifier` with a draft marker per row (target-size and noise), and the parent's marker in the List Report is enough.
- A code-point glossary (one row per distinct `ru` word, then transliterations in the i18n and message tables) keeps the Texts section readable and avoids re-encoding the same word; the project's `ru` bundles and CSVs contain no letter yo (U+0451), so spell with U+0435.
- The Fiori Object Page, responsive table and combo box guideline URLs are stable (`experience.sap.com/fiori-design-web/object-page/`, `.../responsive-table/`, `.../combo-box/`), but mark them "not re-verified this session" when neither fiori-mcp nor an API `references` field returned them.

Related: [[fiori-mcp-search-outage]], [[dependent-field-design-sources]], [[docs-cyrillic-code-points]].
