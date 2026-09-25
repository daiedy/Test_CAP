---
name: project-fiori-mcp-no-filterfields-livemode
description: fiori-mcp 1.12.2 list_functionality exposes no custom filter field (controlConfiguration filterFields) and no liveMode for app/products; only hideFilterBar under filterBar
metadata:
  type: project
---

`fiori-mcp` 1.12.2 `list_functionality` for `app/products` offers, under the List Report filter bar, only `["ProductsList","filterBar","hideFilterBar"]`. There is no id for `controlConfiguration` → `@UI.SelectionFields` → `filterFields.<key>` (custom filter field) and none for `liveMode` (measured 2026-09-25, feature products-rating-filter #6; full list in `docs/features/products-rating-filter/research/fiori-mcp-custom-filter.md`). The bundle contains a CustomFilterField writer and a liveMode spec property internally, but they are not exposed.

**Why:** ADR-0007 allows manifest edits only through `execute_functionality`, so these manifest changes are blocked until the user decides on an exception or an upstream version exposes them.

**How to apply:** for any plan step that needs `filterFields`, `liveMode` or other settings missing from the list, re-run `list_functionality` first (the pin may have been bumped). If the id is still missing, stop and report. Do not guess ids and do not edit by hand.
