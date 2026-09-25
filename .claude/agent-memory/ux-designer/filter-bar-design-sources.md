---
name: filter-bar-design-sources
description: Where the facts for a FE V4 filter bar / custom filter field design come from (fiori-mcp docs that exist, what is missing, a11y skill path on disk) and that this agent has no Bash to run check scripts
metadata:
  type: reference
---

Sources for filter bar designs (verified 2026-09-25, `products-rating-filter` #6):
- `fiori-mcp` `search_docs` answers "Adding Custom Fields to the Filter Bar (V2 & V4)" (manifest shape, `{filterValues>}` binding, `setFilterValues`, step 13 metaModel label binding) and "Custom Filter" (FPM explorer URL `.../fpmExplorer/index.html#/buildingBlocks/filterBar/filterBarCustom`). Queries about "Filtered by" text, collapsed header, Clear button, variant restore return only the same two docs plus ALP/OVP noise: that behaviour stays "inferred" and becomes verifier scenarios.
- Fiori design guideline URLs for slider controls come from the `references` field of `get_api_reference` (`sap.m.RangeSlider` -> range-slider, `sap.m.Slider` -> slider); `sap.m.Slider` API holds the keyboard line and the note that `inputsAsTooltips` is recommended for accessibility.
- The `ui5-best-practices-accessibility` skill is readable on disk at `~/.claude/plugins/cache/claude-plugins-official/ui5/<ver>/skills/ui5-best-practices-accessibility/` (SKILL.md + `references/*.md`) when no Skill tool is available.
- `liveMode`: no `fiori-mcp` doc (query returns only FilterBar building block pages); facts come from the feature research (CDN `ListReport.view.xml`). Event semantics per field are MCP-quotable: `get_api_reference` `sap.m.RangeSlider#change` resolves to `sap.m.Slider` `change` ("after the end user finishes interacting") vs `liveChange` ("during the dragging period"); `sap.m.Input#change` resolves to `sap.m.InputBase` (focus leave or Enter).
- This agent has no Bash tool: `node scripts/check-feature-docs.mjs <name>` cannot be run; say so in the report. The script checks only PLAN.md and CONTEXT.md shape, not SCREENS.md.

Related: [[fiori-mcp-search-outage]], [[docs-cyrillic-code-points]].
