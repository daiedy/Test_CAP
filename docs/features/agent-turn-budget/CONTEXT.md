# agent-turn-budget: context

Date: 2026-11-13. Author: `architect`. Branch: `feature/agent-turn-budget`. Issue #60 (P1). ADR-0032 (accepted 2026-11-13).

This file is the brief for the implementers, so it holds only the sections below (ADR-0018). Each implementer and tester receives its slice of it with PLAN.md from the SubagentStart hook (ADR-0031, `scripts/feature-brief.mjs`); `reviewer` and `architect` read it whole. Measurements, framework facts and rejected mechanisms: `research/turn-budget-facts.md`; the live probe: `research/hook-probe.md`.

## Request
A subagent sees how many of its `maxTurns` it has used and hands back its report before the limit instead of being cut off at it. In #10 5 of 25 launches stopped at the limit without a report; a "hand back by turn N" line in the delegation was ignored twice, because an agent does not see its count. Proposal of the issue: a hook on the subagent's tool calls counts its turns as distinct `requestId` values in its transcript, reads `maxTurns` from `.claude/agents/<agent_type>.md`, adds a note as `additionalContext` from a threshold on, and logs each note into `.pipeline/metrics-*.jsonl` for the `metrics.mjs` card and for #59.

## User decisions
None yet; the plan gate answers the open questions of PLAN.md (threshold, frequency, event, ADR form, #59).

## Affected entities and services
No CDS entity, service, annotation or UI file changes; `search_model` has nothing to answer. The OData contract and `metadata.xml` stay as they are. Pipeline objects:

| Object | Exists now | What changes |
|---|---|---|
| `scripts/hooks/turn-budget.mjs` | no | new hook on `PostToolBatch` (fallback per step 1) |
| `scripts/lib/turn-budget.mjs` | no | new: `agentMaxTurns()`, `reserve()`, `turnNote()`, the constants |
| `scripts/lib/transcript-usage.mjs` | `readTranscript()`, `requests()`, `slim()` marks a `coordinator` record `resume: true` | `runTurns(records)`, `subagentTranscript(transcriptPath, agentId)` |
| `scripts/hooks/subagent-start.mjs` | writes `agent-start` | adds `maxTurns` |
| `scripts/lib/metrics-log.mjs` | `appendMetric()`, `metricsAgent()`, `runningAgents()` derives the agent file itself | `runningAgents()` uses `subagentTranscript()` |
| `scripts/metrics.mjs` | private `maxTurns()` frontmatter reader | imports `agentMaxTurns()` |
| `scripts/lib/pipeline-metrics.mjs` | agent table "Calls / maxTurns" | D19 per run, card column, history keys |
| `.claude/settings.json` | 9 events, 13 scripts; no PostToolBatch | one `PostToolBatch` entry |

### Backend: the hook
- Input: `PostToolBatch` (common fields plus `tool_calls[]`). No `agent_id`: exit 0 with no output and no record, before importing `transcript-usage.mjs` or the turn library (the main thread pays only the node start).
- `M = agentMaxTurns(root)[agent_type]`; no definition or no `maxTurns` (internal agents `claude`, `general-purpose`, `claude-code-guide`): silent.
- File: `subagentTranscript(input.transcript_path, input.agent_id)` = the path without `.jsonl` plus `/subagents/agent-<id>.jsonl`, a leading `agent-` stripped, `~/` expanded (same derivation as `resume-gate.mjs` and `runningAgents()`).
- `N = runTurns(readTranscript(file))`: distinct `requestId` of `assistant` records after the last record with `resume: true`, through `requests()` (D1), so `api-request*` records and copied history never add a turn.
- `turnNote(N, M)`: null while `N < M - reserve(M)`; else the note. `reserve(M) = max(TURN_RESERVE_MIN, ceil(M * TURN_RESERVE_SHARE))`, 6 and 0.1: 30 → 6, 60 → 6, 70 → 7, 80 → 8.
- Note text, English (model-facing, invariant 10), `K = M - N`: `Turn N of M (K left): start no new item; write the current state into your document (mark an unfinished row), stop the processes you started, hand back your report through SubagentHandback.` At `K <= 3`: `Turn N of M: hand back your report through SubagentHandback in this turn; a denied handback needs a turn to fix.`
- Output: `{ hookSpecificOutput: { hookEventName: input.hook_event_name, additionalContext: note } }` (the event name is echoed, so the fallback events work unchanged), then `appendMetric(root, session_id, { event: 'turn-note', agent: metricsAgent(input), agentType, turn: N, maxTurns: M })`.
- `tool_calls[].tool_response` holds whole tool results: read nothing from it, log nothing of it (privacy rule of `docs/metrics/definitions.md`).
- Never blocks, never exits non-zero; any internal error is silent. Registration: `PostToolBatch` without matcher, `timeout` 10, the same `PATH=... node scripts/hooks/turn-budget.mjs` command shape as the other entries.

### Backend: probe facts and fallbacks
Step 1 runs `research/hook-probe.md` before any file of steps 2-6 is written (ADR-0031 decision 6).
- P1 fails (PostToolBatch absent or not inside a subagent): register the same script on `PostToolUse` and `PostToolUseFailure` with matcher `.*`; one note per agent and turn, kept by `fs.openSync(<marker>, 'wx')` on `.pipeline/turn-notes/<agent>-<turn>` (parallel calls start parallel processes).
- P2 fails with P1 failed: stop, the user decides.
- P4 shows the count one short: no change (the reserve absorbs it); more than one short: stop, the architect amends.
- P6 fallback applied (probe 2026-11-13, P6 not exercised): the sharper text starts at `K <= 3`, not `K <= 2`.
- P7 failed on haiku (probe 2026-11-13: notes ignored, stop at the limit): recorded, not blocking; phase 4 check 1 decides on a pipeline model.
- A note on the turn-`M` batch reaches no model call (probe 2026-11-13): the hook may still emit it, nothing depends on it.

### Backend: card and history (D19)
- Run: a launch (agent file) or a resume, split at the `resume` records. Limit in force: `maxTurns` of the run's `agent-start` record, else of its `turn-note` records, else the frontmatter today (features before #60).
- Limit stop: a run whose turns reached its limit and which holds no delivered report (`deliveredReports()`). Measured basis: 5 of 5 #10 stops held exactly `maxTurns` requests.
- Card (`feature`, `session`): one more agent-table column, turn notes and limit stops per agent type (`en` and `ru` header in `scripts/i18n/pipeline*.properties`). History line: `turnLimitStops`, `turnNotes` (numbers), the fields #59 reads; no ratchet.

### Backend: tests
New `test/hooks-turn-budget.test.js` on `createSandbox()` (`test/fixtures/hook-sandbox.mjs`) with a synthetic subagent transcript (`test/fixtures/transcript-fixture.mjs` shapes: `assistant` records with `requestId`, a `coordinator` `user` record, an `api-request` record); one `it` per PLAN criterion it names. `test/metrics.test.js` for D19 and the history keys, `test/hooks-metrics.test.js` for `agent-start.maxTurns`. Suite today: 310 tests in 18 files; re-derive the count at the gate.

## What already exists and is reused
`docs/registry/` covers `db/`, `srv/`, `app/` only; the reuse list comes from the code:
- `transcript-usage.mjs`: `readTranscript()` (drops `api-request*`), `requests()` (D1), the `resume` marker of `slim()`, `deliveredReports()`; the only transcript reader (PATTERNS "Pipeline metric").
- `metrics-log.mjs`: `appendMetric()`, `metricsAgent()`; `hook-utils.mjs`: `readStdinJson()`, `repoRoot()`, `emitJson()`.
- `scripts/metrics.mjs` `maxTurns()`: moved, not copied; `resume-gate.mjs` and `runningAgents()`: the path derivation, unified in `subagentTranscript()`.
- `post-edit.mjs`: the PostToolUse `additionalContext` shape; `handback-gate.mjs`: one script serving two events by `hook_event_name`.
- Wrong to write anew: a second transcript reader or regex counter, a second frontmatter reader, a gate reason for the note (it is not a gate: no `GATE_REASONS` entry).

## Applicable patterns
- "Pipeline metric" (one transcript parser, hooks as the marker source).
- "Check output relay" (the note is far below `HOOK_OUTPUT_MAX`).
- "Rework by fresh launch": a stopped agent is still resumed only to deliver; the note makes that rarer.
- Probe before code (ADR-0031 decision 6); hook scripts per `.claude/rules/pipeline-config.md` (`node --check`, a sandbox run before `settings.json`).
- No row for a turn note: ADR needed, drafted as ADR-0032 (PATTERNS row "Turn budget note" in phase 6).

## Relevant lessons
- LESSONS 2026-11-13 (Pending #60): agents cannot see their turn count; this feature closes it.
- #44 probe: hooks are snapshotted at session start, so the hook is probed in a temp project and takes effect in the next session.
- #44 F3: a subagent hook carries the main `transcript_path`; the read ledger keys on `agent_id`.
- Memory "hook output": choose block or `additionalContext` explicitly; this note never blocks.

## Open questions
See PLAN.md "Open questions" (Q1-Q8).
