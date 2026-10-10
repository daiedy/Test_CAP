---
name: reference-table-popin-order
description: Where the sap.m.Table auto pop-in order inside one UI.Importance group is documented (UI5 source, not MCP)
metadata:
  type: reference
---

UI5 MCP `get_api_reference` `sap.m.Table#autoPopinMode` gives only the group order (Low first, Medium/None second, High last). The order inside one group is only in the source: `https://ui5.sap.com/resources/sap/m/Table-dbg.js`, `_configureAutoPopin` + `Table._updateAccumulatedWidth` (checked on 1.153.0, 2026-10-09). Columns are grouped High, Medium, Low, keep their aggregation order, and `minScreenWidth` is the accumulated width. So the rightmost column of the lowest group pops in first. Fiori MCP `search_docs` ("Table Columns", "Defining Line Items") only says Importance defaults to None.

**How to apply:** whenever SCREENS predicts a pop-in order for `UI.LineItem`, derive it from this rule. Download the file into a fresh /tmp directory, and note the column with the semantic key (FE gives it High) as the one that never pops in. The worktree guard refuses computed `sed -n` ranges, so use `grep -n -A<N> "<name> = function"` instead (see [[project-worktree-bash-guard]]).
