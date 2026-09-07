---
name: fiori-mcp-search-outage
description: mcp__fiori-mcp__search_docs can stop answering mid-session ("embeddings service failed to initialize"); retries do not help, so front-load all doc queries and mark unverified claims
metadata:
  type: project
---

`mcp__fiori-mcp__search_docs` (fiori-mcp 1.12.2) answered the first ~10 queries of a session normally and then returned `{"searchType":"limited_fallback","error":"Search is currently unavailable. The embeddings service failed to initialize.","results":[]}` for every later query, including immediate retries (observed 2026-09-07 while designing `products-draft-edit`).

**Why:** the embeddings backend of the server dies or times out; the MCP server keeps running but cannot search. Nothing in the project causes it.

**How to apply:** issue every Fiori documentation query in the first parallel batch of a design task (draft, messages, filters, header, create mode, keyboard shortcuts, semantic key) instead of spreading them over the session. If the outage hits anyway, do not guess: write the statement as "expected, not verified (Fiori MCP unavailable)" and hand it to `ui-verifier` as a scenario, as the protocol requires. Mention the outage in the "Guidelines" table of the Screens section so the reviewer knows which rows lack a source.
