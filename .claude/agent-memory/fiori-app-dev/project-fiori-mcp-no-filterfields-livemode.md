---
name: project-fiori-mcp-no-filterfields-livemode
description: fiori-mcp 1.12.2 list_functionality exposes no custom filter field, no liveMode, no Object Page table settings; custom sections ARE writable via the unlisted id ["<Page>","sections"]
metadata:
  type: project
---

`fiori-mcp` 1.12.2 `list_functionality` for `app/products` offers, under the List Report filter bar, only `["ProductsList","filterBar","hideFilterBar"]`. There is no id for `controlConfiguration` → `@UI.SelectionFields` → `filterFields.<key>` (custom filter field) and none for `liveMode` (measured 2026-09-25, feature products-rating-filter #6; full list in `docs/features/products-rating-filter/research/fiori-mcp-custom-filter.md`). The bundle contains a CustomFilterField writer and a liveMode spec property internally, but they are not exposed.

Object Page tables: even after the `details` table section was annotated (2026-10-12, products-details-section #9), the list had no `["ProductsObjectPage","table",...]` id (creationMode, enableExport, selectionMode, personalization); only the app-wide `["settings","defaultCreationMode"]`, whose `get_functionality_details` enum is just `InlineCreationRows` (manifest path `sap.fe.macros.table.defaultCreationMode`). So the unset default is plain `Inline`, and any per-table Object Page setting is not reachable through MCP.

Custom sections (2026-10-12, #9 step 7): `list_functionality` does not list them either (it enumerates only page-tree properties, and the `sections` node has only `additionalProperties`), but `get_functionality_details` resolves `["ProductsObjectPage","sections"]` to a spec schema (`fragmentName`, `title`, `relatedFacet`, `relativePosition`, `actions`), and `execute_functionality` with `{ sections: { Details: { fragmentName: "products.ext.fragment.DetailsForm", title: "{i18n>...}", relatedFacet: "PricingStock", relativePosition: "After" } } }` wrote the correct `content.body.sections.Details` (`template`, `position.anchor/placement`, `title`); `run_manifest_validation` valid.

**Why:** ADR-0007 allows manifest edits only through `execute_functionality`, so these manifest changes are blocked until the user decides on an exception or an upstream version exposes them.

**How to apply:** for any plan step that needs a manifest setting missing from the list, re-run `list_functionality` first (the pin may have been bumped), then probe the page-tree node with `get_functionality_details` (read-only; a server-resolved schema is not a guess). Execute only a resolved id and say so in the report. If nothing resolves, stop and report; do not edit by hand.
