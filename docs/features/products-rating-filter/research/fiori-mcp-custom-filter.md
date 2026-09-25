# Research: Fiori MCP functionality for the custom filter field and `liveMode`

Date: 2026-09-25. Author: `fiori-app-dev`. Feature `products-rating-filter` (#6), PLAN step 3 (and the lookup for step 4c). Server: `fiori-mcp` 1.12.2 (pinned in `.mcp.json`; install `~/.npm/_npx/8643016cb8f04b03/node_modules/@sap-ux/fiori-mcp-server`, `package.json` version 1.12.2). Nothing under `app/` was changed.

## Result

**No functionality covers either change.** `list_functionality` for `app/products` returns no id for `controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields.<key>` (custom filter field) and no id for `liveMode` on `ProductsList`. Per PLAN step 3 ("If no functionality covers a custom filter field: stop and report, do not edit `manifest.json`") steps 4 and 4c are **not started**. Decision needed from the user or `architect` (see "Options").

**Resolved 2026-09-25:** option 1, ADR-0020 section "Exception to ADR-0007" (user decision); `fiori-app-dev` re-ran `list_functionality` immediately before the manifest edit in step 4, still unchanged (no `filterFields` or `liveMode` id, per the CHANGELOG entry for that phase).

## 1. `list_functionality` (`appPath` = `/Users/anton_straltsou/github/Test_CAP/app/products`)

Full list of ids returned (descriptions shortened):

| Group | Functionality ids |
|---|---|
| Pages and extensions | `add-page`, `delete-page`, `create-controller-extension` |
| App settings | `[settings, path]`, `[settings, viewType]`, `[settings, defaultCreationMode]`, `[settings, disableStrictUomFiltering]`, `[settings, title]`, `[settings, description]`, `[settings, flexEnabled]`, `[settings, cloudDevAdaptationStatus]`, `[settings, flexibleColumnLayout]` (+ `limitFCLToTwoColumns`, `defaultTwoColumnLayoutType`, `defaultThreeColumnLayoutType`), `[settings, controllerExtensions]`, `[settings, hideDraft]` (+ `enabled`, `stayOnCurrentPageAfterSave`, `stayOnCurrentPageAfterCancel`, `hideCreateNext`) |
| `ProductsList` page | `[ProductsList, variantManagement]`, `[ProductsList, inlineEdit]` (+ `[inlineEdit, enabledFields]`, `disabledFields`, `connectedFields`) |
| `ProductsList` filter bar | **`[ProductsList, filterBar, hideFilterBar]` only** |
| `ProductsList` table | `[ProductsList, table, initialLoad]`, `personalization` (+ `column`, `sort`, `filter`, `group`), `type`, `selectionMode`, `selectAll`, `selectionLimit`, `enableExport`, `condensedTableLayout`, `hierarchyQualifier`, `widthIncludingColumnHeader`, `disableCopyToClipboard`, `enableMassEdit` (+ `operationGroupingMode`, `visibleFields`, `ignoredFields`), `quickVariantSelection` (+ `hideTableTitle`, `showCounts`, `paths`), `creationMode` (+ `name`) |
| `ProductsObjectPage` | `[ProductsObjectPage, variantManagement]`, `[ProductsObjectPage, header, editableHeaderContent]`, `[..., header, visible]`, `[..., header, anchorBarVisible]`, `[..., header, actions, RelatedApps, showRelatedApps]`, `[..., layout, sectionLayout]` |

Absent: any `filterFields` / custom filter id, any `liveMode` id, any `controlConfiguration` id for `@com.sap.vocabularies.UI.v1.SelectionFields`.

## 2. `get_functionality_details`

Only the one filter bar id was queried (the tool forbids guessing ids that `list_functionality` did not return):

| Functionality id | Name | Parameter | Manifest path |
|---|---|---|---|
| `["ProductsList","filterBar","hideFilterBar"]` | Change property | `hideFilterBar`: boolean, "Allows you to hide the filter bar." | `$["sap.ui5"].routing.targets.ProductsList.options.settings.hideFilterBar` |

It is unrelated to either change. No details exist for a custom filter field or `liveMode` because no id was returned.

## 3. What the server knows internally (read from the 1.12.2 bundle, not exposed)

`dist/index.js` bundles the Fiori tools specification: a `CustomFilterField` building block writer (`aggregationName: "filterFields"`, template `filter/fragment.xml`, and a path helper `getCustomFilterFieldFieldPath` = `.../@UI.SelectionFields/filterFields/<key>`), and a `liveMode` property on a `CommonFilterBar` class (in one variant written as a **flex** change, i.e. screen personalization, which this project forbids). Neither reaches the MCP `list_functionality` output for this app, so the pipeline cannot use them (ADR-0007: manifest only via `execute_functionality`).

## 4. `search_docs` (fiori-mcp)

- "add custom filter field to filter bar": "Adding Custom Fields to the Filter Bar (V2 & V4)" and "Custom Filter" (FPM explorer) describe the manifest shape; both say to edit `manifest.json` (or use the Page Map in the Fiori tools UI), none names an MCP functionality.
- "liveMode list report filter bar manifest setting": no `liveMode` document (same as `ux-designer` found).

## Options (for the user / `architect`, not taken)

1. Allow a one-off manual edit of `manifest.json` for exactly these two entries (`filterFields.rating` and `liveMode: true`), with `PIPELINE_ALLOW_PROTECTED=1` set by the user, validated by `ui5lint`; record it as an exception to ADR-0007 in ADR-0020 or a new ADR.
2. The user applies both entries through the Fiori tools Page Map in the IDE (the documented UI way), then `fiori-app-dev` builds the fragment and handler (step 4 non-manifest files) and measures.
3. Wait for a `fiori-mcp` version whose `list_functionality` exposes `filterFields` / `liveMode` (`upstream-check`), keeping the feature parked.
