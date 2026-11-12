---
name: project-live-claude-p-hook-check
description: Recipe for a live claude -p check of a subagent hook in a temp project (#60 phase 4); card from the temp copy of metrics.mjs; prefix recount tells a late transcript write from a double fire
metadata:
  type: project
---

Live check of a subagent hook with `claude -p` (agent-turn-budget #60 phase 4, 2026-11-13, Claude Code 2.1.323):

- Temp project in `/tmp`: `fs.cpSync` of the whole `scripts/`, `.claude/settings.json` holding only the hook entry copied verbatim from the repo settings (the relative `node scripts/hooks/...` command works, cwd is the temp root), `.mcp.json` with only the needed server, one agent `.md`. Unset every name `env | grep -E '^(CLAUDE|PIPELINE)'` prints (14) via `env -u`; flags `--permission-mode auto --permission-prompts none --setting-sources project --strict-mcp-config --mcp-config .mcp.json --no-chrome --max-turns 12 --max-budget-usd 3`. A 7-turn agent run cost $0.06 (sonnet) and $0.12 (opus), about 25 s.
- A chained task (each item file names the next) keeps the agent at one call per turn; sonnet and opus both obeyed the first turn note.
- `repoRoot()` is the script location, so `node <temp>/scripts/metrics.mjs session <id>` reads the temp `.pipeline/` and finds transcripts by the slug rule; same for hook timing in a sandbox root (`/tmp/x` with `scripts/` and `.claude/agents/`), so the repo `.pipeline/` stays clean.
- Repeated `turn` values in `turn-note` records: cut the raw agent file at the record's `ts` and run `runTurns(readTranscript(prefix))`. If the prefix already holds the batch's `assistant` record, the hook read the file before that record hit disk (count one short), not a double fire. Seen in 3 of 7 records; `readTranscript()` slims away `timestamp`, so filter raw lines.
- Per-batch truth without logging ids (#60 check 4): add a scratch `PostToolBatch` logger group (placed before the hook group) that counts on an immediate read, sleeps 2 s, re-reads and takes the true turn as `runTurns()` of the records up to the one holding the batch's `tool_use` id. On 2.1.323 fast local batches (`Read`, `SubagentHandback`) are off disk at hook time (4 of 7), MCP batches are on disk. `tool_calls[]` keys: `tool_input`, `tool_name`, `tool_response`, `tool_use_id`; the main thread gets `tool_calls` too.
- Measured on an M-series Mac: `node -e 0` 0.042 s, the turn hook 0.051 s on the main thread and 0.084 s on an 11 MB transcript (older facts said 0.18 s node start).

**Why:** the phase 4 check needed a live model run without touching the repo `.pipeline/` or settings.
**How to apply:** reuse for any live hook check; see [[project-live-hook-verification]] and [[project-claude-code-hook-runtime]].
