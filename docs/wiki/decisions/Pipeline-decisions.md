---
title: Pipeline decisions
summary: The decisions about the tooling, the agents and the documentation that build the catalog, each listed by title with a link to its ADR.
tags: [pipeline, tooling, decisions]
adr:
  - ADR-0001
  - ADR-0002
  - ADR-0004
  - ADR-0005
  - ADR-0006
  - ADR-0007
  - ADR-0008
  - ADR-0009
  - ADR-0014
  - ADR-0016
  - ADR-0017
  - ADR-0018
  - ADR-0019
  - ADR-0022
  - ADR-0023
  - ADR-0030
sources:
  - docs/decisions/ADR-0001-node22-cds10.md
  - docs/decisions/ADR-0002-vitest-cds-test.md
  - docs/decisions/ADR-0004-annotation-split.md
  - docs/decisions/ADR-0005-javascript-esm.md
  - docs/decisions/ADR-0006-ui5-version.md
  - docs/decisions/ADR-0007-fiori-elements-via-mcp.md
  - docs/decisions/ADR-0008-fe-mockserver.md
  - docs/decisions/ADR-0009-mcp-first-pinned-tooling.md
  - docs/decisions/ADR-0014-mcp-audit-soft-gate.md
  - docs/decisions/ADR-0016-bash-write-gate.md
  - docs/decisions/ADR-0017-generated-files-gate.md
  - docs/decisions/ADR-0018-context-budget.md
  - docs/decisions/ADR-0019-backlog-github-issues.md
  - docs/decisions/ADR-0022-pipeline-metrics.md
  - docs/decisions/ADR-0023-pipeline-state-hygiene.md
  - docs/decisions/ADR-0030-business-rules-wiki.md
---

# Pipeline decisions

These decisions do not change what a user of the catalog sees. They fix how the catalog is built, checked and documented. Each entry gives the title of the decision and links the ADR, which holds the decision, its alternatives and its consequences. The decisions that shape the product are explained one by one in the [decisions folder](Decisions.md).

## Platform and tools

- ADR-0001: [Node.js 22 and cds 10 as the base platform](../../decisions/ADR-0001-node22-cds10.md)
- ADR-0002: [Vitest and @cap-js/cds-test for backend tests, $metadata snapshot as the contract](../../decisions/ADR-0002-vitest-cds-test.md)
- ADR-0005: [JavaScript for UI5, ESM for the backend, TypeScript postponed](../../decisions/ADR-0005-javascript-esm.md)
- ADR-0006: [SAPUI5 from CDN without a pinned version, minUI5Version 1.136.0, manifest 2.0.0](../../decisions/ADR-0006-ui5-version.md)
- ADR-0007: [Fiori Elements V4 by default; applications and manifest only via Fiori MCP](../../decisions/ADR-0007-fiori-elements-via-mcp.md)
- ADR-0008: [Mock server @sap-ux/ui5-middleware-fe-mockserver instead of sap.ui.core.util.MockServer](../../decisions/ADR-0008-fe-mockserver.md)

## Agents and gates

- ADR-0009: [MCP-first protocol and pinned versions of agent tools](../../decisions/ADR-0009-mcp-first-pinned-tooling.md)
- ADR-0014: [MCP audit with a written reason instead of a hard requirement](../../decisions/ADR-0014-mcp-audit-soft-gate.md)
- ADR-0016: [Shell writes are gated by the git state, not by trusting the write route](../../decisions/ADR-0016-bash-write-gate.md)
- ADR-0017: [Generated files are sanctioned by their content, not by the write route](../../decisions/ADR-0017-generated-files-gate.md)
- ADR-0018: [Context budget by structure, not by line counts](../../decisions/ADR-0018-context-budget.md)

## Backlog, metrics and state

- ADR-0019: [Backlog in GitHub Issues, feature folders only while in work](../../decisions/ADR-0019-backlog-github-issues.md)
- ADR-0022: [Pipeline metrics from hooks and the transcript, one committed line per feature](../../decisions/ADR-0022-pipeline-metrics.md)
- ADR-0023: [Pipeline state hygiene: drafted specs, STATE drift feedback, worktrees outside the git audit](../../decisions/ADR-0023-pipeline-state-hygiene.md)

## Layering of annotations

- ADR-0004: [Splitting annotations into semantics and presentation, labels via i18n](../../decisions/ADR-0004-annotation-split.md)

## This wiki

- ADR-0030: [Business-rules wiki: docs/wiki/ as the source of truth, a generated link graph with lookup commands, a one-way mirror to the GitHub Wiki](../../decisions/ADR-0030-business-rules-wiki.md)

## Related

- The wiki itself is described by ADR-0030 above; the product decisions are listed on the [Home](../Home.md) page.
