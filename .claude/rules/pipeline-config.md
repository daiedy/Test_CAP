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
- A plugin pins only its skills: an MCP server bundled with a plugin starts with whatever version its own `.mcp.json` names (the `ui5` plugin uses `npx -y @ui5/mcp-server` without a version). Such a server is overridden by an entry with the same server name in the project `.mcp.json`, which is where the pin lives (`ui5-mcp-server` since 2026-09-09).
- Hooks do not read or send out `~/.claude.json`, `.env`, service keys. Network calls only to the domains from `docs/upstream/versions.json`.
- Every new hook script passes `node --check` and is run manually with a test JSON on stdin before it is enabled in `settings.json`.
- `settings.local.json` is personal and in `.gitignore`; shared settings only in `settings.json`.
- External skills and plugins are installed from official SAP sources and `claude-plugins-official`.

## Forbidden
- `@latest` in the commands that start MCP servers and tools.
- A hook with `bypassPermissions` or with checks disabled.
