# pipeline-metrics: baseline 2026-09

Date: 2026-09-29. Author: `cap-backend-dev` (PLAN step 5). Every card below is the verbatim output of `PIPELINE_LANG=en node scripts/metrics.mjs feature <name>`, and every line of `docs/metrics/history.jsonl` was written by `node scripts/metrics.mjs record <name>` (no hand-written line). Rules: D1-D12 of `research/definitions.md` after the second amendment (D1 and D5 deduplicate over the whole scope, section 5 reference total per process, pricing self-check with `PRICING_TOLERANCE` 0.05), caps 5 min idle and 10 min tool, prices of `scripts/lib/model-pricing.json` (recorded 2026-09-29). No conversation content was read.

## Features and sessions

Order: first record of each feature, the order of `docs/metrics/history.jsonl`.

| Feature | First record | Sessions | Processes (cost-state `startTime`) | Copied requests dropped (D1) |
|---|---|---|---|---|
| `catalog-authorization` | 2026-09-10T02:52Z | `e9ead85a-f2cc-47dc-9381-d0ad15e6cb45`, `29ece8c2-7063-4395-8aab-6964034f62cf` | 1, shared by both sessions ($97.25; apportioned $82.54 because the sessions also hold records outside the feature) | 174 of 757 counted per file |
| `products-rating-column` (#5) | 2026-09-24T22:16Z | `0bb70a42-b799-4a69-8817-b4af22dc7fa3` | 1, shared with #6 by the same session (proportional share) | 0 |
| `products-rating-filter` (#6) | 2026-09-25T01:55Z | `0f92618d-cf37-4489-8e1e-177d03ed3fce`, `0bb70a42-b799-4a69-8817-b4af22dc7fa3` | 2 (one per session) | 0 |
| `products-excel-upload` (#7) | 2026-09-25T08:18Z | `6ecbd7a4-061e-42d6-8c8a-941e7dae43c2` | 1, own | 0 |

## Comparison

Command: `PIPELINE_LANG=en node scripts/metrics.mjs compare` (4 rows):

```
| Feature | Recorded | Cost | Δ cost | Active | Δ active | Rework | Δ rework | Gates | Δ gates |
|---|---|---|---|---|---|---|---|---|---|
| catalog-authorization | 2026-09-29 | $65.39 | - | 3h 39m | - | 0% | - | 2 | - |
| products-rating-column (#5) | 2026-09-29 | $13.93 | -$51.46 | 1h 11m | -2h 29m | 3% | +3 pp | 2 | ±0 |
| products-rating-filter (#6) | 2026-09-29 | $27.81 | +$13.88 | 1h 56m | +45m | 12% | +9 pp | 1 | -1 |
| products-excel-upload (#7) | 2026-09-29 | $62.02 | +$34.21 | 3h 30m | +1h 35m | 21% | +10 pp | 7 | +6 |
```

All four lines have `gateSource: stop-hook-summary`, so the gate deltas are comparable among them; a later line from the live event log (`gateSource: events`) prints `n/a` against them (data-flow section 4).

## History-source limits of these cards

These features ran before the event log exists, so the cards use the history fallbacks of `research/further-metrics.md`:
- phases: home-phase fallback (D11); rounds are n/a without markers;
- gates: Stop-hook summaries with a non-empty `hookErrors` (the Stop gate only, reason not recorded);
- `spec: not attributed`: the `/spec` runs on `main` have no prompt marker (D10);
- prompts: main-thread `user` records with string content and no `toolUseResult`;
- review: items under `## Blocking`, `## Important`, `## Minor` of the last `REVIEW.md` in git (n/a for `catalog-authorization`, whose review predates that format);
- criteria: checkboxes of the last `PLAN.md` in git; lines: `git log --shortstat` over commits whose subject names the feature;
- MCP: the audit files still present in `.pipeline/` (14-day retention), cut to the feature's time window;
- cost-state: the reference total of definitions section 5; the recovered ratio and the `unattributed` row are information without a threshold; the pricing self-check is within 5% for every model of every feature.

## Cost: catalog-authorization

Sessions 2 (2026-09-10 .. 2026-09-23), lead 13d 11h, active 3h 39m, waiting 13d 7h, agent-minutes 4h 39m (parallelism 1.3); idle cap 5 min, tool cap 10 min; phases: home-phase fallback; pricing 2026-09-29; Claude Code 2.1.267, 2.1.268, 2.1.273, 2.1.280; spec: not attributed

Cost $65.39 (cost-state $82.54, recovered 79%; pricing check within 5%); tokens in 1.2K / cache write 3.1M / cache read 72.7M / out 450K; cache hit 96%; context avg 131K, peak 291K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 1 | - | 33m | 1h 27m | 62 | $8.06 | $0.00 |
| 2 | - | 17m | 0m | 88 | $7.57 | $0.00 |
| 3 | - | 43m | 53m | 89 | $8.64 | $0.00 |
| 4 | - | 14m | 0m | 91 | $3.43 | $0.00 |
| 5 | - | 12m | 0m | 52 | $4.10 | $0.00 |
| 6 | - | 9m | 0m | 66 | $2.89 | $0.00 |
| orchestration | - | 1h 31m | 13d 5h | 130 | $30.69 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 2h 30m | 130 / - | $30.69 | 0 |
| architect | 1 | 0 | 16m | 44 / 60 | $5.51 | 0 |
| ux-designer | 1 | 0 | 17m | 18 / 30 | $2.55 | 0 |
| cap-backend-dev | 1 | 0 | 8m | 47 / 60 | $4.09 | 0 |
| test-backend | 1 | 0 | 7m | 41 / 60 | $3.48 | 0 |
| fiori-app-dev | 1 | 0 | 7m | 40 / 60 | $3.95 | 0 |
| test-ui | 1 | 0 | 36m | 49 / 80 | $4.69 | 0 |
| ui-verifier | 1 | 1 | 15m | 91 / 80 | $3.43 | 0 |
| reviewer | 1 | 1 | 14m | 52 / 50 | $4.10 | 0 |
| docs-keeper | 1 | 0 | 9m | 66 / 80 | $2.89 | 0 |
| unattributed | | | | | $17.15 | |

Gates: 2 Stop-gate blocks (history: Stop hook summaries, reason not recorded); review n/a; criteria 30/31; MCP 112 queries, 0 unjustified, 4 failed; rule-covered edits with a query 3/4; prompts 27; lines +1565 / -298

## Cost: products-rating-column (#5)

Sessions 1 (2026-09-24 .. 2026-09-25), lead 3h 19m, active 1h 11m, waiting 2h 8m, agent-minutes 1h 57m (parallelism 1.7); idle cap 5 min, tool cap 10 min; phases: home-phase fallback; pricing 2026-09-29; Claude Code 2.1.282; spec: not attributed

Cost $13.93 (cost-state $19.37, recovered 72%; pricing check within 5%); tokens in 764 / cache write 1.1M / cache read 37.8M / out 74.2K; cache hit 97%; context avg 106K, peak 202K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 2 | - | 9m | 2h 8m | 41 | $1.27 | $0.41 |
| 3 | - | 19m | 0m | 63 | $2.78 | $0.00 |
| 4 | - | 15m | 0m | 124 | $3.59 | $0.00 |
| 5 | - | 4m | 0m | 20 | $0.91 | $0.00 |
| 6 | - | 9m | 0m | 61 | $1.90 | $0.00 |
| orchestration | - | 16m | 1m | 58 | $3.49 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 56m | 58 / - | $3.49 | 0 |
| cap-backend-dev | 1 | 0 | 1m | 12 / 60 | $0.39 | 0 |
| test-backend | 2 | 0 | 3m | 29 / 60 | $0.88 | 1 ($0.41) |
| fiori-app-dev | 1 | 0 | 1m | 12 / 60 | $0.46 | 0 |
| test-ui | 1 | 1 | 27m | 51 / 80 | $2.32 | 0 |
| ui-verifier | 1 | 1 | 15m | 124 / 80 | $3.59 | 0 |
| reviewer | 1 | 0 | 4m | 20 / 50 | $0.91 | 0 |
| docs-keeper | 1 | 0 | 10m | 61 / 80 | $1.90 | 0 |
| unattributed | | | | | $5.44 | |

Gates: 2 Stop-gate blocks (history: Stop hook summaries, reason not recorded); review 0 blocking / 9 findings; criteria 13/22; MCP 112 queries, 0 unjustified, 4 failed; rule-covered edits with a query 0/0; prompts 16; lines +970 / -593

## Cost: products-rating-filter (#6)

Sessions 2 (2026-09-25 .. 2026-09-25), lead 5h 25m, active 1h 56m, waiting 3h 30m, agent-minutes 3h 10m (parallelism 1.6); idle cap 5 min, tool cap 10 min; phases: home-phase fallback; pricing 2026-09-29; Claude Code 2.1.282; spec: not attributed

Cost $27.81 (cost-state $38.54, recovered 72%; pricing check within 5%); tokens in 1.2K / cache write 2.2M / cache read 80.9M / out 135K; cache hit 97%; context avg 146K, peak 409K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 1 | - | 8m | 0m | 44 | $1.85 | $0.63 |
| 3 | - | 49m | 3h 30m | 172 | $7.71 | $2.63 |
| 4 | - | 29m | 0m | 214 | $11.80 | $0.00 |
| 5 | - | 6m | 0m | 22 | $0.93 | $0.00 |
| 6 | - | 9m | 0m | 51 | $1.48 | $0.00 |
| orchestration | - | 15m | 0m | 65 | $4.05 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 1h 19m | 65 / - | $4.05 | 0 |
| architect | 2 | 0 | 6m | 35 / 60 | $1.21 | 1 ($0.63) |
| ux-designer | 1 | 0 | 2m | 9 / 30 | $0.63 | 0 |
| fiori-app-dev | 3 | 3 | 38m | 111 / 60 | $5.08 | 1 ($2.63) |
| test-ui | 1 | 0 | 16m | 61 / 80 | $2.63 | 0 |
| ui-verifier | 1 | 3 | 34m | 214 / 80 | $11.80 | 0 |
| reviewer | 1 | 0 | 6m | 22 / 50 | $0.93 | 0 |
| docs-keeper | 1 | 0 | 9m | 51 / 80 | $1.48 | 0 |
| unattributed | | | | | $10.72 | |

Gates: 1 Stop-gate blocks (history: Stop hook summaries, reason not recorded); review 0 blocking / 6 findings; criteria 20/20; MCP 195 queries, 0 unjustified, 10 failed; rule-covered edits with a query 8/8; prompts 22; lines +1279 / -543

## Cost: products-excel-upload (#7)

Sessions 1 (2026-09-25 .. 2026-09-28), lead 3d 12h, active 3h 30m, waiting 3d 9h, agent-minutes 6h 38m (parallelism 1.9); idle cap 5 min, tool cap 10 min; phases: home-phase fallback; pricing 2026-09-29; Claude Code 2.1.282; spec: not attributed

Cost $62.02 (cost-state $84.56, recovered 73%; pricing check within 5%); tokens in 2.2K / cache write 5.3M / cache read 156M / out 305K; cache hit 97%; context avg 155K, peak 307K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 1 | - | 44m | 3d 5h | 162 | $10.85 | $10.85 |
| 2 | - | 29m | 0m | 174 | $11.36 | $0.00 |
| 3 | - | 36m | 19m | 127 | $6.19 | $0.00 |
| 4 | - | 29m | 12m | 246 | $9.25 | $2.38 |
| 5 | - | 13m | 0m | 76 | $5.94 | $0.00 |
| 6 | - | 22m | 7m | 105 | $6.19 | $0.00 |
| orchestration | - | 37m | 3h 19m | 150 | $12.24 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 2h 25m | 150 / - | $12.24 | 0 |
| cap-backend-dev | 1 | 6 | 41m | 100 / 60 | $7.17 | 0 |
| test-backend | 1 | 4 | 34m | 74 / 60 | $4.19 | 0 |
| fiori-app-dev | 1 | 1 | 17m | 57 / 60 | $3.14 | 0 |
| architect | 2 | 3 | 50m | 129 / 60 | $8.65 | 2 ($8.65) |
| ux-designer | 1 | 2 | 13m | 33 / 30 | $2.20 | 1 ($2.20) |
| test-ui | 1 | 0 | 21m | 70 / 80 | $3.05 | 0 |
| ui-verifier | 2 | 2 | 30m | 246 / 80 | $9.25 | 1 ($2.38) |
| reviewer | 1 | 2 | 20m | 76 / 50 | $5.94 | 0 |
| docs-keeper | 1 | 3 | 28m | 105 / 80 | $6.19 | 0 |
| unattributed | | | | | $22.54 | |

Gates: 7 Stop-gate blocks (history: Stop hook summaries, reason not recorded); review 0 blocking / 9 findings; criteria 25/29; MCP 230 queries, 0 unjustified, 7 failed; rule-covered edits with a query 13/13; prompts 54; lines +2992 / -864

