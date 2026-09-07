# ADR-0007: Fiori Elements V4 by default; applications and manifest only via Fiori MCP

Date: 2026-09-07. Status: accepted.

## Context
Typical agent mistakes in the UI: manual assembly of the Fiori application structure, broken module references in `manifest.json`, edits via personalization. SAP ships `@sap-ux/fiori-mcp-server` with application generation in a CAP project and a three-step modification (`list_functionality`, `get_functionality_details`, `execute_functionality`).

## Decision
- Screens are implemented in Fiori Elements V4 (List Report, Object Page, other floorplans when needed). Freestyle UI5 only when the screen cannot be expressed with floorplans, the decision is recorded in `docs/features/<name>/CONTEXT.md`.
- New applications are created only by `generate_fiori_app_cap`. `manifest.json` is changed only via `execute_functionality`; a manual edit is acceptable when no functionality exists, followed by `run_manifest_validation`.
- Behavior is defined by annotations; controller extensions only for purely client-side logic.

## Alternatives
| Option | Why rejected |
|---|---|
| Manual manifest editing based on the documentation | The main source of agent errors according to SAP and community publications |
| Freestyle UI5 as the foundation | More code, tests and linting; FE gives standard behavior for free |
| Fiori Elements V2 | The project is on OData V4, V2 is not considered |

## Consequences
- The `.claude/rules/ui5-webapp.md` rule, patterns of the "UI Fiori Elements" section.
- The `fiori-app-dev` agent receives the `mcp__fiori-mcp__*` tools.

## Sources
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server
- https://architecture.learning.sap.com/news/2026/04/27/agentic-engineering
- https://community.sap.com/t5/sap-cap-blog-posts/from-zero-to-fiori-building-sap-apps-with-ai-agents-and-why-i-use-markdown/ba-p/14288142
