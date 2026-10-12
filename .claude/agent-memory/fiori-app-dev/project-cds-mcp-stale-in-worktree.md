---
name: project-cds-mcp-stale-in-worktree
description: cds-mcp 0.0.5 search_model in a .claude/worktrees checkout misses entities added by the feature; fuzzy hits land on templates/ and DRAFT types
metadata:
  type: project
---

In a feature worktree, `mcp__cds-mcp__search_model` (0.0.5) does not return entities the feature added (seen 2026-10-12 for `DetailListValues`, `DetailValueTypes`, `ProductDetailSelections` in products-details-section): a fuzzy name query returns `DRAFT.DraftAdministrativeData*` or `my.catalog.tpl.ui.OrdersService.*` from `templates/`, and the architect's CONTEXT recorded it as "returns the pre-feature model".

**Why:** the server's model index does not follow the uncommitted worktree model; a guess built on its answer would miss new elements or report removed ones.

**How to apply:** still call it (the MCP audit expects it), but take element names from `db/schema.cds` + `srv/catalog-service.cds` and prove the result on a fresh `cds compile '*' --to edmx-v4 -s CatalogService -l en` to /tmp (diff against the pre-edit compile). Say so in the report under "Reused". Related: [[project-worktree-bash-guard]].
