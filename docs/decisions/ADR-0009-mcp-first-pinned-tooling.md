# ADR-0009: MCP-first protocol and pinned versions of agent tools

Date: 2026-09-07. Status: accepted.

## Context
An LLM without grounding in current documentation invents CDS syntax, mixes OData V2 and V4, does not see the existing model. SAP ships MCP servers for CAP, Fiori and UI5 and in the README requires consulting them before any edit. At the same time, on 2026-04-29 the Shai Hulud attack injected malicious hooks into Claude Code `settings.json` in CAP repositories and harvested the MCP configuration from `~/.claude.json`.

## Decision
- Protocol: before creating or changing any SAP artifact, the agent queries the corresponding MCP (CDS and handlers → `cds-mcp`; annotations, Fiori Elements, manifest → `fiori-mcp`; UI5 controls and API → UI5 MCP from the `ui5` plugin). If MCP contradicts the model's knowledge, follow MCP. For version questions trust `cds version`, `npm view` and live pages, not the snapshot in MCP.
- Versions in `.mcp.json` are pinned exactly (`@cap-js/mcp-server@0.0.5`, `@sap-ux/fiori-mcp-server@1.12.2`, `chrome-devtools-mcp@1.8.0`; UI5 MCP via the `ui5@claude-plugins-official` plugin 0.1.8). They are bumped only by the `release-check` skill after reading the changelog.
- `.claude/**`, `.mcp.json`, `scripts/hooks/**` are considered security-sensitive: agents do not edit them (the `pipeline-config.md` rule, PreToolUse hook), edits go through human review, dependency installation with `--ignore-scripts` in CI.
- Fiori MCP telemetry is disabled with the `SAP_UX_FIORI_TOOLS_DISABLE_TELEMETRY` variable.

## Alternatives
| Option | Why rejected |
|---|---|
| Markdown instructions only, without MCP | Framework knowledge goes stale; SAP documentation is too large for the context |
| `@latest` in MCP launch commands | Uncontrolled tool changes between sessions; a supply chain attack vector |

## Consequences
- The shared `project-protocol` skill is preloaded into all subagents.
- Path-based rules name the exact MCP tool names.

## Sources
- https://github.com/cap-js/mcp-server (Rules section)
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server (Rules section)
- https://github.com/SAP-samples/cap-agentic-engineered (AGENTS.md)
- https://www.mend.io/blog/shai-hulud-sap-cap-supply-chain-attack-claude-code/
