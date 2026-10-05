# pipeline-metrics: summary

Completion date: 2026-10-05. Commits: `dd34026` ... `3d71ee7` (phase 6 documentation commit follows). Issue #14, ADR-0022.

## What was done
- Parser: `scripts/lib/transcript-usage.mjs`, the only reader of Claude Code transcripts (D1 per-field maximum per `requestId`, D2 token split with `<synthetic>` skipped, D5 timeline points, `cost-state`, file discovery, content-free `slim()` records that keep the D13 turn-input kind).
- Metrics: `scripts/lib/pipeline-metrics.mjs` (D1-D13: tokens, cost from the dated table `scripts/lib/model-pricing.json`, active and waiting time, phases, plan-aware rework, feature scope by branch and `/spec` window, prompts, hand-backs and notifications, pricing self-check, `reconcile`).
- Event log: `scripts/lib/metrics-log.mjs` writes `.pipeline/metrics-<session>.jsonl`; hooks `user-prompt.mjs`, `subagent-start.mjs` and the extended `subagent-stop.mjs`, session, phase, gate, compact and turn-end handlers append records, every write swallowed on failure.
- CLI: `scripts/metrics.mjs` (`session`, `feature`, `compare`, `reconcile`, `record`); `docs/metrics/history.jsonl` holds one line per finished feature, the 4 earlier features re-recorded as the baseline (`research/baseline-2026-09.md`).
- Briefing line from the last history entry in `PIPELINE_LANG`; skills (`/feature` phase 7 prints the card, `/retro` reads the session report, `docs-keeper` fills `## Cost`) and templates (`SUMMARY.md` `## Cost`, `PLAN.md` Phase column).
- Tests: `test/metrics.test.js` (15) on a synthetic fixture, `test/hooks-metrics.test.js` (8); suite at 130 tests in 10 files.
- Documentation: PATTERNS row "Pipeline metric", ADR-0022 accepted, STATE, CHANGELOG, LESSONS.

## Decisions taken during the feature
- D5 kept: two idle caps, a turn gap at 5 min and a tool gap at 10 min.
- The recovered-vs-`cost-state` warning (below 95%) was replaced by a pricing self-check per model (`PRICING_TOLERANCE` 5%), later an interval rule that brackets the unknown 5m/1h cache-write split; recovered ratio and `unattributed` stay on the card as information.
- D1 dedupes by `requestId` and `uuid` across the whole scope (resumed and forked sessions copy history); `cost-state` takes the last record per process (`startTime`).
- D12 rework is plan-aware against the plan as approved at the plan gate (first commit in the full git history whose `Status:` begins with `approved`), with the home-phase rule as fallback.
- D13 counts prompts, hand-backs and notifications from the `origin.kind` of transcript records, never from prompt text.

## Deviations from the plan
- Fix round 1 after verification (criteria 30-33, steps 11a-11e) and a review fix batch (step 12) were added under the Risks clause.
- The F4 live-stop race case in the fixture sits on agent `c1` of session `c-time`, not on `agent-a1.jsonl` as `research/data-flow.md` section 5 says: `a1` stays fixed because the hooks test pins its whole-file aggregate (REVIEW item d).
- `agent-start` records are written (criterion 14) but nothing reads them yet; kept for a later live cross-check of `resumes`.

## New items for the registry
None: no CDS, handler or UI artifact changed; `docs/registry` differs only by the generation date.

## Cost
## Cost: pipeline-metrics (#14)

Sessions 8 (2026-09-28 .. 2026-10-05), lead 6d 16h, active 9h 50m, waiting 6d 6h, agent-minutes 14h 12m (parallelism 1.4); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.283, 2.1.284, 2.1.287; spec: not attributed

Cost $125.18 (cost-state $141.38, recovered 89%; pricing check within 5%); tokens in 4.5K / cache write 10.3M / cache read 225M / out 621K; cache hit 96%; context avg 181K, peak 435K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 2h 44m | 14h 46m | 180 | $25.39 | $0.00 |
| 1 | - | 9m | 0m | 45 | $4.31 | $0.00 |
| 2 | 1 | 3h 49m | 3h 11m | 669 | $62.45 | $16.19 |
| 4 | 1 | 25m | 2d 12h | 40 | $4.24 | $1.10 |
| 5 | 2 | 2h 40m | 3d 0h | 328 | $27.52 | $3.25 |
| 6 | 1 | 4m | 0m | 33 | $1.27 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 7h 39m | 292 / - | $51.18 | 0 |
| cap-backend-dev | 6 | 11 | 2h 50m | 473 / 60 | $41.72 | 3 ($14.80) |
| architect | 4 | 7 | 1h 25m | 136 / 60 | $8.95 | 3 ($4.64) |
| test-backend | 7 | 6 | 2h 2m | 289 / 60 | $18.99 | 1 ($1.10) |
| docs-keeper | 2 | 1 | 4m | 26 / 80 | $0.49 | 0 |
| reviewer | 2 | 2 | 13m | 79 / 50 | $3.86 | 0 |
| unattributed | | | | | $16.20 | |

Gates: 4 blocks (mcp 4); review 0 blocking / 11 findings; criteria 24/24; MCP 5 queries, 0 unjustified, 0 failed; rule-covered edits with a query 3/7; prompts 31, hand-backs 36, notifications 47; lines +7630 / -442

Card printed before the line was recorded; the history line is authoritative.

Known effects of this feature's own markers (PLAN Risks): the approved plan `c10c4f0` numbers verification 5 and review 6 (before the renumbering), so phase labels in the card follow the skill's numbers while D12 compares the plan as written.
Two launches at 19:02 were made seconds before the phase 2 marker (orchestrator marker lag); both count as rework by design.

## Lessons
Seven entries in `docs/LESSONS.md` (forks and resumes copy history, SubagentStop timing and internal agents, UserPromptSubmit for hand-backs, `git log --full-history`, macOS tmpdir realpath, pricing self-check bracket, phase marker before launching agents). The `/feature` skill gained a rule: edit the STATE `Phase:` line with Edit or Write before launching the phase's agents.

## Open debt
- A forked session's `session` card includes the parent's copied history (feature scope dedupes it); STATE open debt, architect.
- `agent-start` records have no consumer (REVIEW Minor 2).
