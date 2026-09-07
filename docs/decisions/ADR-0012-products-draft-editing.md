# ADR-0012: Editing Products in the Fiori app through drafts on `CatalogService.Products`

Date: 2026-09-07. Status: proposed (feature `products-draft-edit`; decision by the user pending).

## Context

SAP Fiori elements for OData V4 shows the Edit action of an Object Page, the Save/Cancel footer and the Create action of a List Report only for draft-enabled entity sets (`Common.DraftRoot`) or, since SAPUI5 1.136, through the manifest setting `inlineEdit` that patches the active entity field by field. `CatalogService.Products` is a plain CRUD projection, so the Object Page of `app/products` has no edit mode (`docs/features/categories-code-list/VERIFICATION.md`, scenario (c)); the OPA5 journey `EditCategoryOnObjectPageJourney.js` is skipped and `docs/STATE.md` carries the debt. `PATTERNS.md` has a row "Drafts" that fixes *how* to enable drafts (`@odata.draft.enabled` only on the root projection of the FE application that edits the data), but no row decides *whether* an editable Fiori app uses drafts or inline edit, where the annotation lives, how non-Fiori clients and tests address active data once the key gets `IsActiveEntity`, or whether the draft UI is hidden.

Facts established for the decision (`docs/features/products-draft-edit/CONTEXT.md`, "Verified by experiment"):

- cds 10.0.6 defaults: `cds.fiori.lean_draft: true`, `bypass_draft: true`, `draft_new_action: false`, lock timeout 15 min, deletion timeout 30 d.
- With these defaults a `POST /Products` without `IsActiveEntity` creates a draft (201, `IsActiveEntity: false`) and skips `@mandatory`/`@assert.target`; a `POST` with `IsActiveEntity: true` creates an active record and runs all assertions; `PATCH`/`DELETE` by `(ID)` alone address the active record; `draftActivate` enforces `@mandatory`, `@assert.range`, `@assert.target` with HTTP 400; a draft lock answers 409 `DRAFT_ALREADY_EXISTS`.
- The compiled contract grows by the draft artifacts only; `Categories` (`@readonly`) and the generated value list on `category_code` are untouched.
- `@sap-ux/fe-mockserver-core` 1.7.15 emulates `draftEdit`/`draftActivate` and defaults `IsActiveEntity: true` for mock records without the field.
- The Fiori documentation (via `mcp__fiori-mcp__search_docs`) describes inline edit as "edit single fields or groups of fields in the active entity without creating a draft", requires SAPUI5 1.136+, lists restrictions (no FCL, unavailable when a draft exists, no double-click on responsive tables) and demands the CAP bypass-draft setting; its sample service is itself draft-enabled. Whether inline edit renders on a non-draft CAP entity is not confirmed by the documentation.

## Decision

1. **Approach: full draft.** `CatalogService.Products` gets `@odata.draft.enabled`. The Object Page uses the standard FE V4 edit mode (Edit, Save, Cancel with discard confirmation); Create and Delete on the List Report and the Editing Status filter come with it and are accepted as standard behavior. Inline edit is not enabled in this feature; it may be added later as a complement (option C below) after the designer evaluates it on the running app.
2. **Where the annotation lives.** Inline on the projection in `srv/catalog-service.cds`: `@odata.draft.enabled entity Products as projection on catalog.Products;`, in the same style as `@readonly entity Categories`. Drafts change the service contract for every client, so they are service semantics, not presentation (ADR-0004); the rule `.claude/rules/srv-services.md` lists `@odata.draft.enabled` among the annotations allowed in the service file; a placement in `app/` would be invisible to `cds compile srv` and to the registry generator (LESSONS, metadata snapshot).
3. **Addressing active data outside Fiori.** Tests, scripts and any non-Fiori client that want an active record say so explicitly: `POST /Products { IsActiveEntity: true, ... }`, `PATCH`/`DELETE`/`GET` with `(ID=<id>,IsActiveEntity=true)`. Draft requests use `IsActiveEntity=false`, the bound actions `draftEdit`/`draftActivate`, and `DELETE ...IsActiveEntity=false` to discard. No `cds.fiori` configuration is changed to make the old request shape work.
4. **Runtime configuration stays default.** No `cds.fiori.*` entry in `package.json`: lean draft, bypass draft, lock 15 min, deletion 30 d, draft messages on. Timeouts are revisited only with a real multi-user requirement.
5. **No handlers.** Validation stays declarative in `srv/annotations/Products.cds`; it is enforced on `draftActivate` and on direct active writes. Draft lifecycle handlers (`NEW`, `EDIT`, `PATCH`, `SAVE`, `DISCARD`) are written only when a rule cannot be expressed by an annotation, following PATTERNS "Service and logic".
6. **Standard draft UI.** `sap.fe.app.hideDraft` is not enabled and `editableHeaderContent` stays `false`; no `manifest.json` change. Draft indicators and the Editing Status filter are the documented FE behavior and need no explanation to the user.

## Alternatives

| Option | Why rejected |
|---|---|
| B. Inline edit only (`inlineEdit` in `ProductsObjectPage`/`ProductsList` settings via Fiori MCP, no draft) | Not confirmed by the documentation for a non-draft CAP entity (the sample is draft-enabled and the guide requires bypass-draft, which presupposes drafts); edits are field-by-field PATCHes without a Save of the whole object, without data-loss protection and without a Create flow; the skipped journey (Edit, dropdown, Save, header update) does not fit its interaction model. Requires a manifest change and re-validation of `ui5lint` (UI5 MCP `run_manifest_validation` is broken, LESSONS) |
| C. Draft plus inline edit for single fields (`inlineEdit` on the Object Page and/or List Report) | Attractive for quick stock/price corrections, but two editing models on one page is a design decision the `ux-designer` has not evaluated; inline edit is unavailable while a draft exists, which needs explanation. Deferred: can be added as a follow-up with its own plan and manifest change through `execute_functionality` |
| Keep `Products` non-draft and delete the skipped journey | Leaves the catalog read-only in the UI; contradicts the request |
| `cds.fiori.draft_new_action: true` (draft-agnostic mode: plain `POST` creates an active record, Fiori creates drafts through `draftNew`) | Would keep the old test payloads unchanged, but is a configuration switch that changes the contract (`Common.DraftRoot.NewAction`, action `draftNew`); the environment override did not take effect in the experiment (needs `package.json` and was not verified); adds a dependency on FE support for `NewAction` and on the mockserver honoring it. Explicit `IsActiveEntity: true` in tests is verified and needs nothing |
| `cds.fiori.direct_crud: true` | Marked Beta in the documentation; same trade-off as above |
| `cds.fiori.bypass_draft: false` | Makes direct writes to active data impossible for any client and pushes tests through the full draft cycle for every negative check; the cds 10 default is `true` for a reason (migration guide) |
| `@odata.draft.enabled` in `app/products/annotations/Products.cds` (CAP docs example) | Contract change hidden in the presentation layer; not visible to `cds compile srv`, to the registry generator and to a second client; contradicts ADR-0004 and the `srv-services` rule |
| `sap.fe.app.hideDraft` | Hides the Editing Status filter and draft indicators while drafts still exist in the backend; the designer has not asked for it and it would need a manifest change; can be enabled later through Fiori MCP `settings > hideDraft` |
| `editableHeaderContent: true` (FE V4 default) | Would let the header title/description be edited in place; both fields are already in General Information, and a change needs a manifest edit for no functional gain |
| `before('SAVE', Products.drafts)` handlers for validation | Duplicates what `@mandatory`/`@assert.*` already enforce on activation (verified); forbidden by `.claude/rules/srv-handlers.md` |
| `@odata.draft.enabled` also on `Categories` | The code list is `@readonly` and maintained via CSV; PATTERNS "Drafts" allows the annotation only on the root that is edited |

## Consequences

- OData contract: `Products` gets the key part `IsActiveEntity` and the draft properties, actions and `Common.DraftRoot`; the snapshot `test/__snapshots__/metadata.test.js.snap` and `app/products/webapp/localService/metadata.xml` are regenerated once; `docs/CHANGELOG.md` records the contract change.
- Tests: every request to an active `Products` record carries `IsActiveEntity` explicitly; a `POST` without it is by definition a draft. `docs/architecture/TESTING.md`, section "cds 10 specifics", gets the sentence "on a draft-enabled entity `POST` without `IsActiveEntity: true` creates a draft and skips `@mandatory`; address active data with `IsActiveEntity=true`". `templates/service.test.js` shows the explicit form (and drops the stale `category: 'Furniture'`).
- `PATTERNS.md`, row "Drafts": example `CatalogService.Products` (`srv/catalog-service.cds`), decision ADR-0012, and the note "non-Fiori clients and tests address active data with `IsActiveEntity=true`; validations are enforced on `draftActivate`".
- `PATTERNS.md`, section "Tests", row "Service test": add "for draft-enabled entities see ADR-0012".
- `docs/STATE.md`: the debt row about the missing edit mode is removed; ADR-0012 joins the accumulated decisions.
- Data hygiene: drafts live in `CatalogService.Products.drafts` (SQLite in-memory, recreated on every `cds watch` start); OPA journeys restore what they change and `npm run watch` is restarted before a run so the List Report row count stays 15.
- Reviewer checks: no handler file, the annotation only in `srv/catalog-service.cds`, no `Common.Draft*` written by hand, no manifest diff, no `IsActiveEntity` in `mockdata`, tests explicit about `IsActiveEntity`.
- Follow-ups enabled by this decision, each with its own plan: inline edit for single fields (option C), `hideDraft`, a Create journey, `@restrict` on `Products` once real users exist (draft lock and `InProcessByUser` then become meaningful).

## Sources

- CAP, "Serving SAP Fiori UIs > Fiori Draft Support" (`@odata.draft.enabled`, `.drafts`, draft events, "Requests to Active Data > Draft-agnostic Requests", "Direct CRUD on Draft-enabled Entities (Beta)", draft lock and deletion timeouts), via `mcp__cds-mcp__search_docs`; https://cap.cloud.sap/docs/advanced/fiori#draft-support
- CAP, "Migrating to cds 10 > Bypass Drafts by Default" and "June 2026 > CAP Node.js > Bypass Drafts by Default", via `mcp__cds-mcp__search_docs`
- SAP Fiori elements, "Draft Handling" (`hideDraft`, `DraftRoot`, `PreparationAction`), "Inline Edit (OData V4)", "Toggling the Editability of Header Fields" (`editableHeaderContent`), "Toggling Between Draft and Saved Values", "Configuring Display of Editing Status in List Report Tables", "Non-Draft Apps (OData V2 only)", via `mcp__fiori-mcp__search_docs`
- `sap.fe.test.api.FooterActionsOP` (`iExecuteSave`, `iExecuteCancel`, `iConfirmCancel`), via `mcp__fiori-mcp__search_docs`
- Experiment log and results: `docs/features/products-draft-edit/CONTEXT.md`, section "Verified by experiment"
- `@sap/cds` 10.0.6 `libx/_runtime/fiori/lean-draft.js` (defaults), `_i18n/i18n_ru.properties` (Draft labels); `@sap-ux/fe-mockserver-core` 1.7.15 `dist/data/entitySets/entitySet.js`, `draftEntitySet.js`
- ADR-0002, ADR-0004, ADR-0007, ADR-0008; `docs/LESSONS.md`, retro item 8
