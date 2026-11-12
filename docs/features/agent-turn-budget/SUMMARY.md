# Agent turn budget: summary

Completion date: 2026-11-13. Commits: `02422a5` ... `1403f35` (spec `02422a5`, probe `9f6c661`, implementation `d90c06b`, verification `f34af18`, spec amendment `4b48fff`, review rework `e2a933a`, check 4 `0d3445e`, re-review `1403f35`), documentation in the phase 6 commit. Issue #60, ADR-0032.

## What was done
- Library: `scripts/lib/turn-budget.mjs` holds `agentMaxTurns(root)` (the one frontmatter reader, moved from `scripts/metrics.mjs`), `reserve(maxTurns)` (6, 6, 7, 8 for 30, 60, 70, 80), `runTurns(records, batchIds)` (turns of the current run from the agent file, a `coordinator` resume restarts the count, `api-request*` records and repeated `requestId` add nothing) and `turnNote()`.
- Hook: `scripts/hooks/turn-budget.mjs` on PostToolBatch (`.claude/settings.json`). On a subagent input from turn `M - reserve(M)` on, it returns `Turn N of M (K left)` as `additionalContext` and appends a `turn-note` record to `.pipeline/`; at `K <= 3` the note asks for the handback in this turn. The main thread, an agent type without `maxTurns`, a missing transcript and malformed input stay silent with exit 0.
- Metrics: the `agent-start` record carries `maxTurns`; D19 (`agentRuns()` in `scripts/lib/transcript-usage.mjs`) counts a limit stop (a run at its limit without a delivered report) and turn notes per agent type; the card shows both in `en` and `ru`, the history line carries `turnLimitStops` and `turnNotes`.
- Prompts: protocol section 2 step 10 and the `feature` skill turn-budget line point to the note.
- Review rework (REVIEW Important 1-3): the current batch's `tool_use_id` values complete the count (see Deviations); each `turn-note` record counts as one note.
- Tests: `test/hooks-turn-budget.test.js` (new), extended `test/metrics.test.js` and `test/hooks-metrics.test.js`.
- Live checks (`VERIFICATION.md`): check 1 (a `maxTurns: 12` agent notes from turn 6 and hands back before 12), check 2 (`turn-note` records and the card), check 3 (hook cost over 20 runs within 0.3 s main thread and 0.5 s on the 11 MB transcript), check 4 (batch ids match live, re-run of check 3).
- Documentation: ADR-0032 accepted (decision 4 amended), PATTERNS row "Turn budget note", `docs/metrics/definitions.md` D19, `data-flow.md` sections 2 and 4, `CLAUDE.md` hooks line, README "How the pipeline works" (Check 9), `docs/images/pipeline-flow.svg`, `docs/images/worker-lifecycle.svg` (the turn note box in the worker's loop), the ADR-0032 digest in `docs/wiki/decisions/Pipeline-decisions.md`, `test/prompt-budget.json`, LESSONS, STATE, CHANGELOG.
- Manual pages (PLAN step 9, orchestrator, 2026-11-13): the RU page https://claude.ai/artifact/FzzFq9aMcdp58y4XnpUEU4 (version 1794526105-190a) and the EN page https://claude.ai/artifact/NFpQenYCVZNwgK5RQ92kx5 (version 1794526097-30fd) are republished with Check 9 "Turn note" in the README wording, the counts nine checks, fourteen scripts and ten events, both diagrams as in `docs/images/`, the glossary entry, and the roles table at `fiori-app-dev` 80 and `reviewer` 70; the README was brought in line with the EN page in the same phase.

## Deviations from the plan
- The planned event was PostToolUse per call; probe P1 and P5 showed PostToolBatch fires once per tool turn (also for a parallel batch), so the hook sits on PostToolBatch (ADR-0032 decision 1). It also fires on the main thread, so the early exit runs once per main-thread tool turn.
- P6 (does a handback on the last turn still land) was not exercised in the probe: the agent handed back on its own in turn 2. The CONTEXT fallback applies, the last-turn text from `K <= 3`, not `K <= 2`. P7 failed on haiku (the agent read on past the note); the phase 4 check on sonnet and opus decided and passed.
- P4 held exactly on 2.1.322 (the count at hook time equals the true turn). On 2.1.323 the transcript lagged by one request, so the first review found the count one short (REVIEW Important 1). Rework: the hook now adds the current batch as a turn when none of the batch's `tool_use_id` values is in the agent file, and counts the file alone otherwise (ADR-0032 decision 4 amended). Check 4 confirms live that the new count is never below the true turn ("exact or one high" in D19 and `data-flow.md`).
- Notes are counted per `turn-note` record, not per distinct `turn`: two records of one run with equal `turn` are two notes (REVIEW Important 3).
- The documentation commit changes `test/prompt-budget.json` (CLAUDE.md and the protocol grew).

## Acceptance criteria
Phases 2, 4 and 5 are ticked by the named tests, `VERIFICATION.md` checks 1-4 and `REVIEW.md` (re-review: 0 blocking, all Important and Minor closed).
## New items for the registry
Hook `scripts/hooks/turn-budget.mjs`; library `scripts/lib/turn-budget.mjs` (`agentMaxTurns`, `reserve`, `runTurns`, `turnNote`); `agentRuns()` in `scripts/lib/transcript-usage.mjs`; the registry is regenerated.

## Cost
Sessions 1 (2026-11-12 .. 2026-11-12), lead 2h 19m, active 2h 18m, waiting 1m, agent-minutes 3h 37m (parallelism 1.6); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.322

Cost $35.80 (no cost-state record); tokens in 1.3K / cache write 2.3M / cache read 62.3M / out 601K; cache hit 96%; context avg 107K, peak 309K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 6m | 0m | 6 | $0.44 | $0.00 |
| 1 | 1 | 22m | 0m | 64 | $4.37 | $0.00 |
| 2 | 1 | 51m | 0m | 206 | $11.14 | $0.29 |
| 4 | 1 | 9m | 0m | 32 | $1.93 | $0.00 |
| 5 | 1 | 34m | 0m | 161 | $8.83 | $4.92 |
| 6 | 1 | 17m | 0m | 135 | $8.99 | $0.00 |
| 7 | 1 | 0m | 0m | 1 | $0.10 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Turn notes / limit stops | Cost | Rework |
|---|---|---|---|---|---|---|---|
| main | - | - | 1h 39m | 111 / - | - | $7.60 | 0 |
| architect | 4 | 0 | 21m | 74 / 60 | 0 / 0 | $5.48 | 2 ($1.63) |
| cap-backend-dev | 4 | 0 | 38m | 158 / 60 | 3 / 0 | $7.53 | 1 ($1.35) |
| test-backend | 5 | 0 | 35m | 123 / 60 | 0 / 0 | $7.18 | 2 ($2.23) |
| reviewer | 2 | 0 | 9m | 46 / 70 | 0 / 0 | $2.60 | 0 |
| docs-keeper | 8 | 0 | 8m | 58 / 80 | 0 / 0 | $1.55 | 0 |
| general-purpose | 1 | 0 | 8m | 35 / - | 0 / 0 | $3.85 | 0 |

Context per agent type (characters; node scripts/metrics.mjs context for each launch):
- architect: launches 4, resumes 0, compactions 0; startup max 26.6K, peak max 197.6K tokens; tool results 340.6K, brief 0, repeat reads 0
- cap-backend-dev: launches 4, resumes 0, compactions 0; startup max 23.7K, peak max 149.7K tokens; tool results 448.3K, brief 59.7K, repeat reads 0
- test-backend: launches 5, resumes 0, compactions 0; startup max 24.1K, peak max 123.3K tokens; tool results 385.7K, brief 67.6K, repeat reads 0
- reviewer: launches 2, resumes 0, compactions 0; startup max 23.2K, peak max 118.6K tokens; tool results 201.7K, brief 0, repeat reads 0
- docs-keeper: launches 8, resumes 0, compactions 0; startup max 26.5K, peak max 76.5K tokens; tool results 175.2K, brief 52.0K, repeat reads 0
- general-purpose: launches 1, resumes 0, compactions 0; startup max 43.7K, peak max 288.3K tokens; tool results 415.2K, brief 0, repeat reads 0
- main: compactions 0, peak 308.6K tokens
Resumes after a report (0): none

Gates: 1 blocks (state-budget 1); review 0 blocking / 7 findings; criteria 31/31; MCP 1 queries, 0 unjustified, 0 failed; rule-covered edits with a query 0/0; prompts 2, hand-backs 24, notifications 25; lines +2382 / -181

## Lessons
Moved to `docs/LESSONS.md` Pending (2026-11-13) with the place where each acts: a probe fact on one patch does not hold on the next; a hook rate from its own records understates misses; code moved to `scripts/lib` comes under the relay scan; the hook sandbox needs an own `session_id`; a kept report can be overwritten by a later plain-text note; launch sizing. The 2026-11-13 entry "agents cannot see their turn count" is closed by this feature.

## Open debt
- A kept report `.pipeline/logs/report-<type>-<id>.md` was overwritten by the agent's plain-text note after its handback (a `cap-backend-dev` launch of this feature: 387 bytes). Owner `cap-backend-dev`; STATE open debt.
- `resume-gate.mjs` keeps its own transcript path lookup; moving it onto `subagentTranscript()` is a follow-up candidate (REVIEW Minor 1); STATE open debt.

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, VERIFICATION.md, research of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/bcd89065385df9d71070d2ae19c6919cb8bf4de4/docs/features/agent-turn-budget (commit `bcd8906`).
