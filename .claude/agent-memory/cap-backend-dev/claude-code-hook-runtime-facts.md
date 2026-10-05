---
name: claude-code-hook-runtime-facts
description: Measured Claude Code hook runtime behaviour relevant to scripts/hooks (internal SubagentStop events, live reload, agent_id join, prompt deliveries, SubagentStop before the final message flush), observed 2026-09-29 on CLI 2.1.284
metadata:
  type: reference
---

Observed live in the `pipeline-metrics` (#14) session, 2026-09-29, Claude Code 2.1.284:

- While a subagent runs, SubagentStop fires about every 32 s for a Claude Code internal agent with an empty `agent_type`, a fresh `agent_id` and no transcript file under `subagents/`. The existing `subagent-stop.mjs` gate (eslint over changed files) runs for each of them; anything the hook records per stop is multiplied accordingly. Documented in code.claude.com/docs/en/hooks.md ("Not every SubagentStop event comes from a subagent Claude spawned").
- Editing an already registered hook script takes effect on its next call in the running session; only a new registration in `.claude/settings.json` needs a session restart.
- The hook input `agent_id` equals the id in `<session>/subagents/agent-<id>.jsonl` (verified against the MCP audit log), so hook records join transcript threads by it. SubagentStart also delivered the bare id live (the docs example `agent-abc123` is misleading); `metricsAgent()` strips a leading `agent-` anyway.
- UserPromptSubmit fires for a subagent hand-back delivery (`origin=peer`) and for a `queued_command` after a background agent stops, so `prompt` records count more than typed prompts (confirmed by VERIFICATION F3, 2026-09-29).
- SubagentStop fires before the agent's final `end_turn` message is flushed to `agent_transcript_path`: a hook reading the file misses exactly that last request (VERIFICATION F4). Compare live aggregates with a re-parse cut at the record's `lastTs`, never with the whole file; do not wait inside the hook for the file to grow.
- Hook input field reference: `curl -sSL https://code.claude.com/docs/en/hooks.md` (sections "<Event> input").

**How to apply:** when a hook writes per-stop records or runs costly checks, decide explicitly what happens for an empty `agent_type`; verify hook changes live without waiting for a restart unless the registration is new. See [[pipeline-metrics-hooks]] if written later.
