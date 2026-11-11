# Context hygiene: summary

Completion date: 2026-11-11. Commits: `389c3f8` ... `5ab25a6` (spec `389c3f8`, probe `4a16c70`, amendments `37521e3` and `fad85e9`, implementation `9eb5077`, verification `59125a8`, review rework `b78c95e`, documentation `5ab25a6`). Issue #44, ADR-0031.

## What was done
- Markers: `PLAN.md` criteria sit under `### Phase <N>: <label>` or `### Every phase`, `CONTEXT.md` sections are for `All`, `Backend` or `UI`; `planShapeErrors()` and `contextShapeErrors()` check them, the `products-validations` documents are migrated (templates `templates/feature/PLAN.md`, `CONTEXT.md`, `SCREENS.md`).
- Role brief: `briefFor()` and `briefPhase()` in `scripts/lib/feature-brief.mjs` build, per agent type and phase, its step rows, criteria and context sections plus a `## Not included` list with bytes; SubagentStart (`subagent-start.mjs`) writes `.pipeline/brief/<agent-type>-<phase>.md` and hands it whole up to `HOOK_OUTPUT_MAX` (10,000 characters), else a pointer. Ceilings per role group in `test/context-budget.json`, checked by `scripts/check-feature-docs.mjs`, raised only by `scripts/feature-brief.mjs --record`.
- Gates: PreToolUse `Read` (`read-gate.mjs`, `scripts/lib/read-ledger.mjs`: a repeated whole read and a whole read of a briefed document are denied once); PreToolUse `SendMessage` (`resume-gate.mjs`: no resume after a delivered report); PreToolUse `SubagentHandback` (`handback-gate.mjs`, `scripts/lib/handover-checks.mjs`: lint, protected writes, `## MCP not used`, `HANDBACK_DENY_MAX` = 3); SubagentStop keeps the same checks for a plain-text end; PostToolUse `SubagentHandback` keeps the report under `.pipeline/logs/report-<agent-type>-<agent-id>.md`.
- Relays without cuts: `relay()` in `scripts/lib/hook-utils.mjs` prints whole or a summary by structure plus a log path; the Stop gate names every failed test and the log.
- Context card: `node scripts/metrics.mjs context <feature>` (D14-D18 in `docs/metrics/definitions.md`: startup and peak context, compactions, tool-result characters by tool, repeat reads, brief characters, resumes after a report); the history line carries the `context` object, `test/context-budget.json` pins `resumesAfterReport` at 0.
- Prompts: protocol sections 2 and 8, `feature` and `spec` skills carry the fresh-launch rule once (no "or the resumed one").
- Tests: 246 in 16 files → 281 in 18 (`test/feature-brief.test.js`, `test/hooks-context.test.js`, `test/fixtures/hook-sandbox.mjs`, extended `doc-shapes`, `hooks-file-checks`, `hooks-metrics`, `hooks-subagent-stop`, `metrics`); `vitest.config.mjs` filters Node's `ExperimentalWarning`.
- Documentation: ADR-0031 accepted, ADR-0018 amendment and the ADR-0014, ADR-0016 notes accepted; PATTERNS (5 rows), CONVENTIONS, TESTING, README "How the pipeline works" (Check 8, Check 5), `CLAUDE.md`, the wiki page `Pipeline-decisions.md`, STATE, CHANGELOG.

## Deviations from the plan
- Probe F1-F9 on Claude Code 2.1.322 (`research/hook-probe-results.md`): F8 failed (SubagentStop gets no `last_assistant_message` after a handback) so the report is saved from PostToolUse `SubagentHandback` (Q8); F6's condition moved the hand-over checks to PreToolUse `SubagentHandback` (Q9); F9 measured `HANDBACK_DENY_MAX` = 3. Both amendments approved 2026-11-11.
- Q10 (2026-11-11): the ceiling of a role group is the per-group maximum over the migrated folders (backend 57,639, ui 46,085, verifier 8,931, docs 17,531 bytes) and `--record` never lowers it.
- Decisions Q1-Q7 at the plan gate: deny once per agent, file and hash (Q1); SCREENS.md by template section names, no markers (Q2); relays and report wording only, no runner (Q3); `autoCompactWindow` out of scope until the card of `/feature #10` (Q4); shell prints stay, the card shows the figure (Q5); the #10 documents re-marked without re-approval (Q6); ADR-0031 and the 0018 amendment accepted as proposed (Q7).
- Review rework 2026-11-11 (user decisions): a launch whose agent type has no step row in the current phase gets the brief of its last own phase at or before it, else its highest; a resumed agent id gets no brief and no `brief` record. Both rules are in ADR-0031 decision 2.
- The documentation commit adds `CLAUDE.md` bytes (10,469 → 10,666 recorded in `test/prompt-budget.json`).

## Acceptance criteria
All 43 criteria of `PLAN.md` are ticked: phase 2 by the named tests (281 of 281 at the phase 6 gate), phase 4 by `VERIFICATION.md` checks 1-6 (pass), phase 5 by `REVIEW.md` (0 blocking, re-review 2026-11-11 0 blocking, 0 important), phase 6 by this change.

## New items for the registry
Hooks `read-gate.mjs`, `resume-gate.mjs`, `handback-gate.mjs`; libraries `feature-brief.mjs`, `handover-checks.mjs`, `read-ledger.mjs`; CLI `scripts/feature-brief.mjs`; the registry is regenerated.

## Cost
The history line was recorded with `node scripts/metrics.mjs record context-hygiene --force` (2026-11-11), the card below is `PIPELINE_LANG=en node scripts/metrics.mjs feature context-hygiene`. The line was forced by user decision 2026-11-11: the card counts one resume after a report, the `architect` `a2ba114e9430f8766` during `/spec` on 2026-11-10 (385.8K tokens of context), before the resume gate existed, which the zero ratchet would refuse. The #28 baseline for the open before/after run: 21 launches, 2,597.4K characters of tool results, 5 resumes (3 after a report), 0 compactions.

Sessions 2 (2026-11-09 .. 2026-11-11), lead 1d 19h, active 4h 41m, waiting 1d 14h, agent-minutes 6h 51m (parallelism 1.5); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.310, 2.1.322

Cost ≥$95.17 (cost-state $42.68, recovered 75%; WARNING pricing check off by more than 5%: claude-haiku-5-5 ?); tokens in 2.0K / cache write 4.9M / cache read 127M / out 1.3M; cache hit 96%; context avg 140K, peak 389K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 30m | 1d 4h | 41 | ≥$8.11 | $0.00 |
| 1 | - | 32m | 0m | 92 | $24.50 | $0.00 |
| 2 | 1 | 2h 53m | 3h 40m | 563 | $48.29 | $0.00 |
| 4 | 1 | 6m | 0m | 37 | $1.74 | $0.00 |
| 5 | 1 | 31m | 6h 33m | 150 | $10.23 | $6.30 |
| 6 | 1 | 9m | 0m | 52 | $2.29 | $0.00 |
| other | - | 0m | 0m | 4 | n/a | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 3h 0m | 114 / - | ≥$16.86 | 0 |
| architect | 6 | 5 | 1h 6m | 187 / 60 | $31.92 | 0 |
| claude-code-guide | 1 | 0 | 1m | 4 / - | n/a | 0 |
| cap-backend-dev | 8 | 2 | 1h 44m | 399 / 60 | $30.87 | 1 ($1.36) |
| test-backend | 5 | 0 | 42m | 140 / 60 | $10.51 | 2 ($1.79) |
| reviewer | 2 | 1 | 12m | 69 / 50 | $4.11 | 1 ($3.15) |
| docs-keeper | 1 | 0 | 6m | 26 / 80 | $0.90 | 0 |
| unattributed | | | | | $10.70 | |

Context per agent type (characters; node scripts/metrics.mjs context for each launch):
- architect: launches 6, resumes 2, compactions 0; startup max 28.3K, peak max 389.0K tokens; tool results 1,079.2K, brief 0, repeat reads 679
- claude-code-guide: launches 1, resumes 0, compactions 0; startup max 35.8K, peak max 52.4K tokens; tool results 30.7K, brief 0, repeat reads 0
- cap-backend-dev: launches 8, resumes 2, compactions 0; startup max 24.5K, peak max 321.4K tokens; tool results 1,908.1K, brief 235.7K, repeat reads 0
- test-backend: launches 5, resumes 0, compactions 0; startup max 24.8K, peak max 215.9K tokens; tool results 691.1K, brief 189.2K, repeat reads 6.9K
- reviewer: launches 2, resumes 1, compactions 0; startup max 22.7K, peak max 199.4K tokens; tool results 396.2K, brief 0, repeat reads 0
- docs-keeper: launches 1, resumes 0, compactions 0; startup max 23.9K, peak max 111.0K tokens; tool results 148.3K, brief 15.8K, repeat reads 0
- main: compactions 0, peak 277.9K tokens
Resumes after a report (1): architect a2ba114e9430f8766 at 2026-11-10 16:13 UTC, context 385.8K tokens

Gates: 2 blocks (reread 1, brief 1); review 0 blocking / 9 findings; criteria 43/43; MCP 1 queries, 0 unjustified, 0 failed; rule-covered edits with a query 0/0; prompts 10, hand-backs 22, notifications 27; lines +8063 / -566

Warnings: unknown-model:claude-fable-5-2, unknown-model:claude-haiku-5-5

## Lessons
Moved to `docs/LESSONS.md` (Pending, with destinations): ceilings sit exactly at the feature that set them; `git diff --stat` omits untracked files; a denied handback leaves a `tool_use` record; a mutation check of the main branch misses the fallback branch; a safety case behind an allow-on-error `try/catch` needs a deny mutation; a type with rows in several phases gets the last own phase's brief.

## Open debt
STATE rows: the read gate records a read at PreToolUse (a failed whole `Read` counts); one `--force` of `metrics.mjs record` bypasses the duplicate and the ratchet refusals alike; `post-edit.mjs` joins notes that can exceed `HOOK_OUTPUT_MAX`; the `brief` record has no current-phase field; the before/after measurement on `/feature #10` and the Q4 `autoCompactWindow` decision are open (user).

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, VERIFICATION.md, research of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/5ab25a6bb66a446451861f53f1d30e0c6b6ee081/docs/features/context-hygiene (commit `5ab25a6`).
