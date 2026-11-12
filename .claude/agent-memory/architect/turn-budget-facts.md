---
name: turn-budget-facts
description: How Claude Code counts subagent turns (one requestId = one turn, limit per run, resume resets), wrap-up cost after a limit stop, hook cost figures, PostToolBatch as the once-per-turn event; basis of ADR-0032 (proposed 2026-11-13, #60 agent-turn-budget)
metadata:
  type: project
---

Measured 2026-11-13 on Claude Code 2.1.322 for #60 `agent-turn-budget` (spec in `docs/features/agent-turn-budget/`, research `turn-budget-facts.md`, probe procedure `hook-probe.md` with `turn-probe.mjs`; ADR-0032 proposed, plan waiting for approval).

- A subagent turn = one distinct `requestId` of its `assistant` records: the 5 #10 launches that stopped at the limit held exactly `maxTurns` requests (5 of 5), all 20 others delivered below it.
- The limit is per run: a `SendMessage` resume (a `user` record with `origin.kind: coordinator`) gets a fresh `maxTurns` (`ui-verifier` runs [80, 80, 37] in session `eecd975d`). The `[handback-send-enforce]` nudge is `isMeta` without `origin`, not a run start.
- Wrap-up cost: a run resumed only to finish and hand back after a limit stop took 4-10 turns, median 6, p80 8 (14 runs).
- The main transcript names each stop in a `task-notification`: `Agent "<desc>" stopped at its <M>-turn limit (partial result; ...)`.
- Tool uses per turn 1.4-1.8; PostToolUse fires per call, `PostToolBatch` (documented, not in the CHANGELOG) once per turn for every tool; whether it fires inside a subagent in 2.1.322 is probe P1.
- Cost: `node -e 0` 0.18 s; whole parse through `transcript-usage.mjs` 24 ms (1.4 MB) to 103 ms (11 MB); tail read 1-2 ms but needs a cursor. The node start dominates.
- Docs: `transcript_path` may lag the in-memory conversation (count can be one short); the subagent file is `<transcript_path minus .jsonl>/subagents/agent-<agent_id>.jsonl`.
- Lag, measured: probe P4 on 2.1.322 was exact (27 of 27), but on 2.1.323 the batch's own `assistant` record reached the file after PostToolBatch read it (3 of 7 records one short, and a silent short read at the threshold). Decision 2026-11-13 (ADR-0032 decision 4 amendment, phase 5 rework): count the batch's request when none of `tool_calls[].tool_use_id` is a `tool_use` id of the run (`slim()` keeps `tools[].id`); result exact or one high, never short. Do not trust a "one short is absorbed by the reserve" argument: a short read delays the first note and cuts the last-call margin.
- `scripts/metrics.mjs` had a private `maxTurns()` frontmatter reader; the card's "Calls" column is requests (D1).
- Claude Code docs can be fetched with `curl -sL https://code.claude.com/docs/en/<page>.md`; the CHANGELOG from raw.githubusercontent.com anthropics/claude-code.
- #44's probe temp projects lived under `~/.claude/jobs/<id>/tmp/hook-probe*`; their transcripts sit under `~/.claude/projects/` with every non-alphanumeric character of the cwd turned into `-`.

**Why:** the plan-gate answers (threshold, frequency, event, cost) rest on these figures, and transcripts are pruned after 30 days.

**How to apply:** for any later "agent ran out of turns" question, count requests per run with `research/turn-count.mjs`-style scripts before proposing limits; for a hook that must run once per turn, check probe P1's result in `hook-probe.md` before choosing PostToolBatch. See [[context-hygiene-design]], [[claude-code-transcript-facts]], [[pipeline-hook-output-and-state-drift]].
