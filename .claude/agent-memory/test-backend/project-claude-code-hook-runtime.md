---
name: claude-code-hook-runtime
description: Observed Claude Code 2.1.284 hook and transcript behavior that live metrics checks depend on (hot reload, fork copies, SubagentStop flush race, what fires UserPromptSubmit)
metadata:
  type: project
---

Observed live in pipeline-metrics step 11 (2026-09-29, Claude Code 2.1.284), from `.pipeline/metrics-*.jsonl` against transcript kinds only:

- New `settings.json` hook registrations fire in the already running session that added them (no restart needed; only SessionStart obviously needs a new session).
- A forked session (`source: fork`) copies the parent's records with the same `uuid` and `requestId` and rewrites `sessionId`; a session-scope card double counts them, the feature scope dedupes.
- SubagentStop fires before the agent's final `end_turn` message is flushed to `agent_transcript_path`: a live parse misses exactly one request (re-parse cut at the live `lastTs` is identical).
- UserPromptSubmit fires for a subagent hand-back (`origin=peer`, `isMeta`) and for a `queued_command` attachment after a background agent stops; not for SendMessage (that fires SubagentStart as a resume, `origin=coordinator` in the subagent transcript). Human prompts carry `origin=human`.

**Why:** these explain the `agent-stop-drift` noise and the inflated `prompts` figure; they are not in the hooks reference.

**How to apply:** when verifying live metrics or hook records, classify by the enum fields `origin`, `queue-operation.operation`, `attachment.type` (never read text), cut a forked session at its `session` record `ts`, and cut agent re-parses at the live `lastTs` before judging drift. Related: [[project-probing-runtime-behavior]], [[metrics-cli-offline]].
