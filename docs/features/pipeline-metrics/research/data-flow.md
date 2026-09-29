# pipeline-metrics: data flow, record shapes, outputs

Date: 2026-09-29. Author: `architect`. Read by `cap-backend-dev` (steps 2, 4, 6-8), `test-backend` (steps 5, 9), `docs-keeper` (steps 10-12), `reviewer`. Definitions D1-D12 are in `research/definitions.md`.

## 1. Modules

| Module | Kind | Responsibility |
|---|---|---|
| `scripts/lib/transcript-usage.mjs` | new, protected (`scripts/lib/**`) | the only reader of transcript files: `readJsonl(file)`, `requests(records)` (D1), `timelinePoints(records)` (D5), `costState(records)`, `sessionFiles(projectDir, sessionId)` (main path, `subagents/*.jsonl` with meta), `projectDir(cwd)` (slug rule). No pricing, no phases, no I/O beyond reading. Seed: the prototype's `readJsonl`/`summarize` (80 lines, Node built-ins). |
| `scripts/lib/pipeline-metrics.mjs` | new, protected | aggregation on plain records: `activeTime(points, {idleMs, toolMs})` (D6), `agentMinutes`, `costOf(usageByModel, pricing)` (D4), `phasesOf(records, markers)` (D11), `reworkOf(launches, markers)` (D12), `featureRecords(sessions, name)` (D10), `sessionReport(...)`, `featureReport(...)`, `historyLine(report)`, `compareLines(lines)`, `renderCard(report, bundle)`; constants `IDLE_MS`, `TOOL_MS`, `RECONCILE_MIN`, `HOME_PHASE`. Pure functions, unit-tested on the fixture. |
| `scripts/lib/metrics-log.mjs` | new, protected | event log: `appendMetric(root, sessionId, record)`, `readMetrics(root, sessionId)`, `metricsFile`, `pruneMetrics(root, 30)`; same file layout and helpers as `mcp-audit.mjs` (`appendAudit`/`readAudit`/`pruneAudit`), the `ts` stamp added the same way. Reviewer checks that no second JSONL reader appears. |
| `scripts/lib/model-pricing.json` | new, protected | `{ "recordedAt": "YYYY-MM-DD", "source": "<price list URL>", "perMTok": { "<model>": { "input", "cacheWrite5m", "cacheWrite1h", "cacheRead", "output" } } }` |
| `scripts/metrics.mjs` | new, not protected | CLI, section 4 |
| `scripts/hooks/*.mjs`, `.claude/settings.json` | changed, protected | section 2 |

## 2. Hooks and the records they write to `.pipeline/metrics-<session>.jsonl`

Every record starts with `ts` (ISO, added by `appendMetric`). No record carries prompt text, tool output, file content or a transcript excerpt.

| Hook (event) | Registration | Record | Notes |
|---|---|---|---|
| `session-start.mjs` (SessionStart) | exists | `{ event: 'session', source, transcriptPath, branch }` | also writes `.pipeline/current-session` (the id, for the CLI default) and calls `pruneMetrics(root, 30)` next to `pruneAudit` |
| new `user-prompt.mjs` (UserPromptSubmit) | new matcher-less entry | `{ event: 'prompt', command?, arg? }` | `command` = the leading `/<skill>` token when the prompt starts with `/`; `arg` only when it matches `#\d+` or `[a-z0-9-]+`; nothing else from the prompt. Counts user prompts (D10 join for `/spec`, prompts per feature) |
| new `subagent-start.mjs` (SubagentStart) | new entry | `{ event: 'agent-start', agent, agentType }` | `agent_id`, `agent_type` from the hook input |
| `subagent-stop.mjs` (SubagentStop) | exists | `{ event: 'agent-stop', agent, agentType, transcriptPath, model, requests, tokens: { input, cacheWrite5m, cacheWrite1h, cacheRead, output }, costUSD, activeMin, leadMin, toolCalls, firstTs, lastTs }` | read through `agent_transcript_path` with `transcript-usage.mjs`; written before the gate checks, so a blocked stop still records. Fires once per stop: a resumed agent produces several records, the report takes the last per `agent` (the transcript is cumulative) and counts records − 1 as resumes |
| `subagent-stop.mjs`, `stop-gate.mjs`, `protect-files.mjs`, `protect-files-bash.mjs` | exist | `{ event: 'gate', hook, agent, agentType, reason }` | at every `exit 2` / `deny` site; `reason` ∈ `lint`, `mcp`, `protected`, `registry`, `docs`, `tests`, `tests-timeout`, `state-shape`, `state-budget`. A single helper `recordGate(input, hook, reason)` in `metrics-log.mjs` |
| `post-edit.mjs` (PostToolUse Edit/Write) | exists | `{ event: 'phase', feature, phase, raw }` | only when the edited file is `docs/STATE.md`: `feature` from the `- Feature:` line (`none` or `<name> (#N)`), `phase` = first integer 0-7 of the `- Phase:` value or `none`, `raw` = the value cut at 80 chars. Written on every STATE edit, deduplicated by the reader when `phase` and `feature` did not change |
| `pre-compact.mjs` (PreCompact) | exists | `{ event: 'compact', trigger }` | one line next to the existing `sessions.log` write |
| `stop-gate.mjs` (Stop) | exists | `{ event: 'turn-end', blocked }` | one record per Stop, after the gate decision; the main transcript itself is read by the CLI, not by the hook |

Hook input fields relied on (Claude Code 2.1.282, per the issue's scope hints; step 6 confirms them by writing `Object.keys(input)` once into a `probe` record and removing the probe): common `session_id`, `transcript_path`, `cwd`, `hook_event_name`; SubagentStart/Stop `agent_id`, `agent_type`; SubagentStop `agent_transcript_path`, `stop_hook_active`, `last_assistant_message`; UserPromptSubmit `prompt`; SessionStart `source`; PreCompact `trigger`. A missing field degrades to a record without it; the hook never fails on it.

Retention: `metrics-*.jsonl` pruned after 30 days by SessionStart (Claude Code prunes transcripts after `cleanupPeriodDays`, default 30, so the event log outlives nothing it needs). `.pipeline/` is gitignored already. The durable record is `docs/metrics/history.jsonl` plus the `## Cost` section of every `SUMMARY.md`.

## 3. Joining live and history

`metrics.mjs` reads, per session: the event log when present (markers, agent aggregates, prompts, gates) and the transcript files through `transcript-usage.mjs` (usage and timeline). Paths come from the `session` and `agent-stop` records when present; otherwise from `projectDir(cwd)` and the `subagents/` walk (history: #5-#7 and every session before the hooks land). When both exist the CLI compares the `agent-stop` aggregate with the parse of the same file and warns on a difference above 1% (a second self-check, independent of `cost-state`). Feature scope: D10. Phase scope: D11 with markers, home-phase fallback without, stated in the card header (`phases: markers` or `phases: home-phase fallback`).

## 4. CLI `scripts/metrics.mjs`

| Command | Output |
|---|---|
| `session [id] [--json] [--idle 5] [--tool 10]` | one card (default id: `.pipeline/current-session`, else the newest file in the project dir) |
| `feature <name\|#N> [--json]` | one card over every session that carries the feature (D10) |
| `record <name>` | appends the feature's history line to `docs/metrics/history.jsonl` (refuses a duplicate `feature` unless `--force`); run by `docs-keeper` in phase 6 |
| `compare [<name>...]` | table of history lines with the delta of `costUSD`, `activeMin`, `reworkShare`, `gateBlocks` against the previous line; no names: all lines |
| `reconcile <id>` | the per-model per-kind table of definitions section 5 for one session; the tool of step 3 |

Card (Markdown, `renderCard`), header lines then two tables then one summary line; texts through `scripts/i18n/pipeline*.properties` (`metrics.*` keys, en and ru) since `/feature` phase 7 and the briefing print it in `PIPELINE_LANG`:

```
## Cost: products-excel-upload (#7)
Sessions 1 (2026-09-25 .. 2026-09-28), lead 3d 13h, active 4h 12m, waiting 3d 9h, agent-minutes 6h 40m (parallelism 1.6); idle cap 5 min, tool cap 10 min; phases: home-phase fallback
Cost $75.25 (cost-state $85.73, recovered 88%, WARNING below 95%); tokens in 2.2K / cache write 5.4M / cache read 158M / out 309K; cache hit 96%; context avg 152K, peak 259K
| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
Gates: 7 blocks (lint 3, mcp 2, tests 1, state-shape 1); review 0 blocking / 9 findings; criteria 12/13; MCP 26 queries, 0 unjustified, 1 failed; prompts 60; lines +1471 / -132
```

`--json` prints the report object; the history line is its aggregate part:

```
{ "feature", "issue", "recordedAt", "sessions", "leadMin", "activeMin", "waitingMin", "agentMin", "costUSD", "costStateUSD", "recovered", "tokens": { "input", "cacheWrite5m", "cacheWrite1h", "cacheRead", "output" }, "cacheHit", "ctxAvg", "ctxPeak", "calls", "launches", "resumes", "reworkShare", "gateBlocks": { "<reason>": n }, "review": { "blocking", "total" }, "criteria": { "closed", "total" }, "prompts", "lines": { "added", "removed" }, "phases": { "<n>": { "rounds", "activeMin", "costUSD" } }, "pricingDate", "idleMin", "toolMin", "phaseSource" }
```

Inputs of the non-transcript figures: `review` = list items under `## Blocking`, `## Important`, `## Minor` of `docs/features/<name>/REVIEW.md` (the reviewer's result format), `total` = all three; `criteria` = `- [x]` / `- [ ]` lines of the `## Acceptance criteria` section of `PLAN.md` via `sections()` from `doc-shapes.mjs`; `lines` = `git log --shortstat` over commits whose subject contains `<name>` (the `/feature` commit convention `feat(srv): <name> backend`); `maxTurns` from the frontmatter of `.claude/agents/<agentType>.md`; MCP figures from `readAudit` and `mcpGaps` of `mcp-audit.mjs` per agent.

## 5. Fixture for the parser tests (no conversation content)

`test/fixtures/transcript-fixture.mjs` builds, into a temp directory at test time, a synthetic project dir: `main.jsonl`, `<session>/subagents/agent-a1.jsonl` + `.meta.json` (`agentType: 'cap-backend-dev'`, opus) and `agent-a2` (`ui-verifier`, sonnet). Allowed record keys, enforced by a test that walks every record: `type`, `timestamp`, `requestId`, `agentId`, `gitBranch`, `toolUseResult` (boolean), `message: { model, usage, content: [{ type, name?, input?: { subagent_type? , to? } }] }`; `cost-state` with `totalCostUSD`, `modelUsage`, durations and line counts. Cases the builder encodes, each with the expected figure computed by hand in the same file: two records of one request with growing output (D1), a request in the main file with identical records, one `<synthetic>` record, a 12-minute Bash tool gap (counts 10), a 40-minute turn gap (counts 5), an `AskUserQuestion` gap of 8 minutes (counts 5), an `Agent` launch whose subagent records fill 6 minutes (merged: 6, main alone: 5), a `SendMessage` resume, a launch of `architect` after `fiori-app-dev` (rework by the fallback rule), 5m and 1h cache writes, a `cost-state` whose total makes the recovered ratio 0.90 (warning) and a second variant at 0.97 (no warning), an unknown model. Event-log fixture `test/fixtures/metrics-log.jsonl`: `session`, three `phase` markers (2, 3, 2 → phase 2 has two rounds), one `gate` per reason, two `prompt` records (one `/spec #7`), `agent-start`/`agent-stop` pairs matching the agents.

## 6. Changes outside scripts (one line each, applied under `PIPELINE_ALLOW_PROTECTED=1`)

- `.claude/settings.json`: register `UserPromptSubmit` and `SubagentStart`; no other timeout changes (the SubagentStop read of one agent transcript of 1-3 MB takes well under a second).
- `.claude/skills/feature/SKILL.md` phase 7: after the prune, `node scripts/metrics.mjs feature <name>` and show the card; orchestrator rules: the `Phase:` line reads `<N>: <label>` (the marker parser reads the integer).
- `.claude/skills/retro/SKILL.md` section 1: `node scripts/metrics.mjs session --json` for gate blocks by reason and rework launches, next to the MCP audit line.
- `scripts/hooks/session-start.mjs` and `scripts/lib/backlog.mjs` briefing: one line from the last `history.jsonl` entry (`metrics.briefing` key: feature, cost, active time, rework share); no regression logic in v1.
- `templates/feature/SUMMARY.md`: a `## Cost` section, filled with the card by `docs-keeper` in phase 6 (`node scripts/metrics.mjs feature <name>`), followed by `node scripts/metrics.mjs record <name>`.
- `.claude/agents/docs-keeper.md` step 5: the two commands above.
- `CLAUDE.md` documentation map: row `Pipeline cost per feature | docs/metrics/history.jsonl, SUMMARY.md "Cost"`; `PATTERNS.md` Infrastructure row "Pipeline metric" (ADR-0022) added by `docs-keeper` on acceptance.
- `test/prompt-budget.json`: re-recorded for the grown skill and agent files (`node scripts/prompt-budget.mjs --record`, CHANGELOG line).
