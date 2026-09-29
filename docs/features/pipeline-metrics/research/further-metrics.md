# pipeline-metrics: catalogue of further metrics

Date: 2026-09-29. Author: `architect`. Read by `cap-backend-dev` (step 4), `test-backend` (step 5), `reviewer`. The request asks which metrics agentic pipelines are usually judged by; this is the list, each with its source in this project and its status in v1. The card and the history line (`research/data-flow.md` section 4) carry every v1 row.

| Metric | Formula and source | v1 | Why it matters |
|---|---|---|---|
| Active time, lead time, waiting | D6, D7 on the transcript timeline | yes | the request's core; waiting is the user's cost, active is the pipeline's |
| Agent-minutes and parallelism | D8 | yes | shows whether background agents overlap or the pipeline runs serially |
| Tokens by kind, cost | D2, D4, dated price table | yes | the request's core |
| Cache hit ratio, context per call (avg, peak) | D3 | yes | a falling hit ratio or a rising context means the prompts or the reading lists grew (ADR-0018 budget) |
| Turn budget utilization | requests of an agent / `maxTurns` from `.claude/agents/<role>.md` | yes | an agent near 100% stops mid-task (CHANGELOG 2026-09-23); a budget far above use can be cut |
| Resumes and relaunches | D9 | yes | resumes are recoveries from turn limits or watchdog stalls; relaunches are lost context |
| Gate blocks by reason | `gate` records; history fallback `system/stop_hook_summary.hookErrors > 0` (count only) | yes | which gate fires most, and whether a rule change reduced it |
| Rounds per phase | D11 markers | yes (fallback: n/a) | a phase re-entered is a defect found late |
| Rework share of cost | D12 | yes | #7: ≈19% |
| Review findings | `REVIEW.md` list items under Blocking / Important / Minor | yes | findings per feature against cost: a cheap feature with many findings is not cheap |
| Acceptance criteria closed / total | `PLAN.md` checkboxes | yes | the plan's own scoreboard |
| MCP-first compliance | audit log per agentType: edits under an `MCP_RULES` rule with an attempt, `justification`, `skipped-unjustified`, `ok:false` | yes | invariant 1, already counted by `/retro` by hand |
| User prompts per feature, waiting per phase | `prompt` records (history: `user` records with string content and no `toolUseResult`, 60 in #7); waiting per phase = lead − active of the phase | yes | how much steering a feature needed and where the user waits |
| Lines added / removed | git shortstat over the feature's commits; per session `cost-state.totalLinesAdded/Removed` | yes | cost per changed line is the usual headline figure; keep it next to review findings, never alone |
| Cost per acceptance criterion, per test added | `costUSD / criteria.total`; tests from the test-count line of `STATE.md` "What works" | later | comparable across features only when the criteria are of similar size |
| Compactions per session | `compact` records (today `.pipeline/sessions.log`) | yes, session card only | a compaction loses context; more than one per phase is a reading-list problem |
| Tool-call mix per agent | `tool_use` names per agent (prototype `tools` map) | yes, `--json` only | shows an agent reading instead of querying MCP, or verifying with `curl` instead of the browser |
| Time-to-first-green, defect escape rate | first phase gate without a block; defects found in phase 4-5 that belong to phase 2-3 | later | needs the gate records of several features first |
| OpenTelemetry `claude_code.token.usage`, `cost.usage`, `active_time.total` | `CLAUDE_CODE_ENABLE_TELEMETRY=1` and an OTLP collector | later, cross-check only | no per-agent or per-phase attribution; an independent total once a collector exists |

Not measured on purpose: anything per user (one developer), model quality scores, and dashboards or pages (the card and `compare` are the interface; a page is a separate wish).
