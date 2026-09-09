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

**Separate, permanent gap in the same snapshot:** the `fiori-mcp` documentation set has **no accessibility document for the List Report / Object Page**. Queries about keyboard, screen reader, ARIA or column headers return table grouping, ALP table-type or OData V2 UI-adaptation documents instead. Accessibility verdicts therefore come from the `ui5-best-practices-accessibility` skill checklist (eight topics; `references/target-size.md` covers `ObjectMarker`/`ObjectIdentifier` link target size) plus `mcp__ui5-mcp-server__get_api_reference` for the control's own ARIA associations and default visibility — say so explicitly in the section, because the reviewer expects a Fiori-docs URL per non-standard decision and there is none to give.
