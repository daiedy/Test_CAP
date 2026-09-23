---
name: fiori-mcp-search-outage
description: mcp__fiori-mcp__search_docs can stop answering mid-session ("embeddings service failed to initialize"); retries do not help, so front-load all doc queries and mark unverified claims
metadata:
  type: project
---

`mcp__fiori-mcp__search_docs` (fiori-mcp 1.12.2) answered the first ~10 queries of a session normally and then returned `{"searchType":"limited_fallback","error":"Search is currently unavailable. The embeddings service failed to initialize.","results":[]}` for every later query, including immediate retries (observed 2026-09-07 while designing `products-draft-edit`).

**Why:** the embeddings backend of the server dies or times out; the MCP server keeps running but cannot search. Nothing in the project causes it.

**How to apply:** issue every Fiori documentation query in the first parallel batch of a design task (draft, messages, filters, header, create mode, keyboard shortcuts, semantic key) instead of spreading them over the session. If the outage hits anyway, do not guess: write the statement as "expected, not verified (Fiori MCP unavailable)" and hand it to `ui-verifier` as a scenario, as the protocol requires. Mention the outage in the "Guidelines" table of the Screens section so the reviewer knows which rows lack a source.

**Not reproduced on 2026-09-09** (`products-draft-marker` design, four queries, all answered) — treat the outage as intermittent, not as the normal state.

**Second permanent gap: action visibility.** The snapshot has **no document for `UI.CreateHidden` / `UI.UpdateHidden` / `UI.DeleteHidden`** and **no design guidance on removing versus disabling an action**, nor any inventory of what remains in a List Report table toolbar once the generic actions are gone (verified 2026-09-10 with four separate queries during the `catalog-authorization` design; the `role based visibility hiding actions read-only user` query returned only OVP key-user adaptation, MessageButton and OData V2 feature toggles). What the snapshot *does* give, and what is worth quoting instead:
- "Hiding UI Elements with the UI.Hidden Annotation" — `Path` must be Boolean, expression trees need `edmJSON`, `edmJSON` is V4-only, and step 8: *"Hiding actions in footer does not remove footer if backend-bound messages must be shown"* (so always check for an empty footer after hiding actions).
- "Action Control for Context-Dependent Actions" — the framework's own precedent: when an availability condition is false the action is **hidden** at page-header level and merely **disabled** for a header button inside a table. This is the closest thing to a citable source for "hide, do not disable" at header level.
- "Generic Action Buttons in Object Page Tables" — `creatable-path`/`deletable-path` need "a Boolean property on the root entity", i.e. a bound context, which is why a per-row flag can never answer a toolbar-level "may I create".
`get_guidelines` of the UI5 MCP does not help either: it is a coding-guidelines document (no CSS, no globals, data binding, keys in all locales) and says nothing about action visibility or read-only floorplans. Consequence: for role-aware visibility the authority is the CAP recipe "Serving SAP Fiori UIs > Role-based Visibility" via `mcp__cds-mcp__search_docs`, not `fiori-mcp`; say so in the sources table instead of leaving a row without a citation.

**Separate, permanent gap in the same snapshot:** the `fiori-mcp` documentation set has **no accessibility document for the List Report / Object Page**. Queries about keyboard, screen reader, ARIA or column headers return table grouping, ALP table-type or OData V2 UI-adaptation documents instead. Accessibility verdicts therefore come from the `ui5-best-practices-accessibility` skill checklist (eight topics; `references/target-size.md` covers `ObjectMarker`/`ObjectIdentifier` link target size) plus `mcp__ui5-mcp-server__get_api_reference` for the control's own ARIA associations and default visibility — say so explicitly in the section, because the reviewer expects a Fiori-docs URL per non-standard decision and there is none to give.
