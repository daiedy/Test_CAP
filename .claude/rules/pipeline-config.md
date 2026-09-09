---
paths:
  - ".claude/**"
  - ".mcp.json"
  - "scripts/hooks/**"
---
# Agentic pipeline configuration (protected)

The files `.claude/settings.json`, `.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `.mcp.json`, `scripts/hooks/` are executed automatically and carry the same risk as CI scripts (ADR-0009, the Shai Hulud incident of 2026-04-29).

## Rules
- Agents do not edit these files as part of features. Changes are made by a human or by a separate task on an explicit request from the user, with a diff review.
- Versions in `.mcp.json` and in `npx` commands are pinned exactly; they are raised only by the `upstream-check` skill after reading the changelog.
- A plugin pins only its skills: an MCP server bundled with a plugin starts with whatever version its own `.mcp.json` names (the `ui5` plugin uses `npx -y @ui5/mcp-server` without a version). It registers as `plugin:<plugin>:<server>` (`plugin:ui5:ui5-mcp-server`), so a project `.mcp.json` entry does not replace it: both run until the plugin server is toggled off in the `/mcp` panel (stored per machine and project in `~/.claude.json` as `disabledMcpServers`; not a `settings.json` key). The pin lives in the project `.mcp.json` (`ui5-mcp-server` = `@ui5/mcp-server@0.2.18` since 2026-09-09); agents reference only `mcp__ui5-mcp-server__*` tools.
- MCP audit (ADR-0014): the PostToolUse hook `mcp-audit.mjs` (matcher `^mcp__|^Skill$`, also on PostToolUseFailure) logs every MCP and skill attempt per agent into `.pipeline/mcp-audit-<session>.jsonl` (gitignored, pruned after 14 days); `post-edit.mjs` logs Edit/Write per agent. `subagent-stop.mjs` compares the agent's edits with the rule table `MCP_RULES` in `scripts/lib/mcp-audit.mjs` and blocks once when a required query is missing, unless the report has a `## MCP not used` section; the reason (or the unexplained skip) is logged for `/retro`. Failed attempts count as attempts. Edits made through Bash are not seen by this check.
- `app/**/webapp/manifest.json` is denied for Edit/Write by `protect-files.mjs`: Fiori MCP `execute_functionality` only; `PIPELINE_ALLOW_PROTECTED=1` for deliberate maintenance.
- Hooks do not read or send out `~/.claude.json`, `.env`, service keys. Network calls only to the domains from `docs/upstream/versions.json`.
- Every new hook script passes `node --check` and is run manually with a test JSON on stdin before it is enabled in `settings.json` (feed the JSON with `printf '%s'` or from a file: zsh `echo` turns `\n` into a line break and produces invalid JSON).
- `settings.local.json` is personal and in `.gitignore`; shared settings only in `settings.json`.
- External skills and plugins are installed from official SAP sources and `claude-plugins-official`.

## Forbidden
- `@latest` in the commands that start MCP servers and tools.
- A hook with `bypassPermissions` or with checks disabled.
