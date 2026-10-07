# pipeline-state-hygiene: summary

Completion date: 2026-10-07. Commits: `bb8bf9e` (plan, ADR-0023) ... `0dfe23d` (scripts and tests) on branch `feature/pipeline-state-hygiene`; documentation is uncommitted at the time of writing.

## What was done

- **Scripts** (`scripts/lib/state-now.mjs`, new): `projectNow()` moved from `backlog.mjs`; `stateDrift()` reports a branch mismatch, an unknown or non-ancestor `Last commit:` hash and more than `MAX_BEHIND = 1` first-parent commits behind HEAD (nothing on a detached HEAD); `driftKey()`, read/write of `.pipeline/state-drift.json`.
- **Briefing** (`scripts/lib/backlog.mjs`, `scripts/i18n/pipeline*.properties`): the drift line comes last, `en` and `ru`; an open issue without `spec-ready` and `in-progress` whose `docs/features/<name>/` holds `PLAN.md` or `CONTEXT.md` is tagged "plan drafted" and recommended for review (kind `review`, after `continue`, blocked or not).
- **Hooks** (`scripts/hooks/`): `session-start.mjs` records the drift key; `stop-gate.mjs` `driftAdvice()` gives the advice once per key through `hookSpecificOutput.additionalContext`, never exit 2, no `gate` event; the untracked-entry block no longer advises `git checkout --`; `protected-paths.mjs` `WORKTREES` exempts `.claude/worktrees/` in `protectedWriteHit()` only, so write guards still deny edits there; `.gitignore` lists `.claude/worktrees/`.
- **Tests**: `test/fixtures/hook-sandbox.mjs` extracted from `hooks-metrics.test.js`; `backlog.test.js` 8 to 11, `hooks-registry-gate.test.js` 7 to 8, new `hooks-state-hygiene.test.js` (3). 137 tests in 11 files, all green; each claimed rule was mutated once in a scratch copy, 27 of 27 went red.
- **Verification**: `VERIFICATION.md` "ready for review"; live Stop check gave one advisory entry and no hook error. Claude Code 2.1.289 labels it "Stop hook additional context" (PLAN text said "Stop hook feedback").
- **Review**: `REVIEW.md` 0 blocking, 3 minor, all closed in documentation: the observed label in PATTERNS and here, the STATE `Last commit:` subject quoted verbatim, "blocked or not" stated in the PATTERNS row.
- **Documentation**: ADR-0023 accepted; PATTERNS row "Advisory from a Stop hook"; STATE "What works"; CHANGELOG `pipeline` and `test` lines; registry regenerated, only the date stamp changed.

## Deviations from the plan

- None in scope. The hook label differs from the PLAN wording ("Stop hook feedback"), see above; the approved PLAN text stays.
- When the drift advice fires on the full-pass path, its JSON replaces the `Stop gate passed.` stdout line (reviewer choice (b)); that line was debug-log only.

## New items for the registry

- No entity, action or handler. New scripts library `scripts/lib/state-now.mjs` (`projectNow`, `stateDrift`, `driftKey`), `driftAdvice()` in `stop-gate.mjs`, `specDrafts()` and `renderDriftLine()` in `backlog.mjs`.

## Cost

Sessions 1 (2026-10-05 .. 2026-10-07), lead 1d 7h, active 1h 55m, waiting 1d 5h, agent-minutes 2h 30m (parallelism 1.3); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.289; spec: not attributed

Cost $19.75 (cost-state $6.91, recovered 286%; pricing check within 5%); tokens in 622 / cache write 1.7M / cache read 31.4M / out 133K; cache hit 95%; context avg 112K, peak 199K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 0m | 0m | 1 | $0.02 | $0.00 |
| 1 | 1 | 1h 0m | 1d 5h | 123 | $10.47 | $0.00 |
| 2 | 1 | 44m | 15m | 92 | $6.15 | $0.00 |
| 4 | 1 | 4m | 0m | 27 | $1.18 | $0.00 |
| 5 | 1 | 7m | 0m | 45 | $1.66 | $0.00 |
| 6 | 1 | 1m | 0m | 8 | $0.26 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 1h 16m | 52 / - | $3.11 | 0 |
| architect | 1 | 1 | 21m | 99 / 60 | $8.53 | 0 |
| cap-backend-dev | 1 | 0 | 10m | 36 / 60 | $2.01 | 0 |
| test-backend | 1 | 2 | 36m | 61 / 60 | $4.43 | 0 |
| reviewer | 1 | 0 | 6m | 42 / 50 | $1.52 | 0 |
| docs-keeper | 1 | 0 | 1m | 6 / 80 | $0.15 | 0 |
| unattributed | | | | | $-12.84 | |

Gates: 2 blocks (protected 2); review 0 blocking / 3 findings; criteria 13/13; MCP 2 queries, 0 unjustified, 0 failed; rule-covered edits with a query 0/0; prompts 1, hand-backs 6, notifications 7; lines +1316 / -186

## Lessons

- `docs/LESSONS.md`: one new Pending entry (the Bash guard matches protected path strings in command text; probing guards needs `PIPELINE_ALLOW_PROTECTED` unset and a scratch copy of `scripts/`). The two `Pending #15` entries stay for `/retro`, which decides their transfer; the issue scope hint says no new prompt line.
- Plain stdout of an exit-0 Stop hook is debug-log only, so the `LESSONS.md holds N entries` note has never reached anyone.

## Open debt

- No assertion pins a blocked drafted spec still giving `kind: 'review'` (reviewer, optional for a later `test-backend` change).
- The `LESSONS.md holds N entries; run /retro` note travels on the debug-only Stop line.

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, VERIFICATION.md, research of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/4234941ec46c5777eb16f0b5e3ae296f8f6d3687/docs/features/pipeline-state-hygiene (commit `4234941`).
