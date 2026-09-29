# pipeline-metrics: context

Date: 2026-09-29. Author: `architect`. Branch: `feature/pipeline-metrics` (not created: `/spec`). Issue #14.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). No screens (no UI). Definitions, measured transcript facts, record shapes, CLI output and the metrics catalogue are in `research/definitions.md`, `research/data-flow.md` and `research/further-metrics.md`, read when a plan step names them.

## Request
Metrics for the effectiveness of the AI pipeline: how long each agent works, how long each `/feature` phase takes, how many tokens and dollars each costs. Idle time while the user is not interacting must not count. Propose and add the further metrics commonly used to judge agentic pipelines. The user wants the figures to compare features against each other over time, not a dashboard.

## User decisions
Plan approved by the user on 2026-09-29 with the eight gate answers below (numbering as in "Open questions"; ADR-0022 accepted the same day):
1. Idle threshold: two caps, a turn gap counts up to 5 min and a tool gap up to 10 min (`IDLE_MS`, `TOOL_MS`); step 4 still reports #7 under a single 5-minute cap so the difference is a measured figure.
2. Committed artifacts: both `docs/metrics/history.jsonl` (one line per finished feature, `metrics.mjs record`) and the `## Cost` section of `SUMMARY.md`; raw data stays in `.pipeline/`.
3. Briefing: one line from the last `history.jsonl` entry (feature, cost, active time, rework share) in `PIPELINE_LANG`; no regression warning in v1, `metrics.mjs compare` on demand.
4. Reconciliation: v1 accepts a documented gap once step 4 names the cause per kind and model; the card shows the recovered ratio and an `unattributed` row as information, without a threshold; 95% is not a gate. Amended by the user on 2026-09-29 after step 4 (the ratio is structurally 62-97% in auto mode with subagents): the card and `reconcile` warn when a model's pricing self-check diverges by more than `PRICING_TOLERANCE` = 0.05 (`research/definitions.md` section 5).
5. OpenTelemetry: a v1 non-goal; a later cross-check only.
6. Feature join key: `gitBranch` on every record plus the `/spec` or `/feature` prompt marker for sessions on `main`; the STATE `Feature:` line is not the join key.
7. Retention of `.pipeline/metrics-*.jsonl`: 30 days, pruned by SessionStart.
8. Baseline scope: `products-rating-column` (#5), `products-rating-filter` (#6), `products-excel-upload` (#7) and `catalog-authorization`, recorded before 2026-10-10.
The whole implementation touches protected paths (`scripts/lib/**`, `scripts/hooks/**`, `.claude/settings.json`, skills, agent prompts), so the `/feature` session is started by the user with `PIPELINE_ALLOW_PROTECTED=1` (rule `pipeline-config.md`, ADR-0016); hooks load at session start, so step 11 needs one restart.

Fix round 1 after step 11, decided by the user on 2026-09-29 (letters as in the PLAN status line; definitions in `research/definitions.md` D11-D13 and `research/data-flow.md` section 3):
- A. Turn inputs (D13, VERIFICATION F3): `prompts`, `handbacks` and `notifications` are three separate figures counted from the main-thread transcript by `origin.kind` (`human`, `peer`, `task-notification`) of string `user` records and `queued_command` attachments, by the same rule for history and live sessions; the `prompt` event records are command markers only (the `/spec` and `/feature` join of D10) and count none of the three.
- B. Phases and rework (D11, D12, VERIFICATION F6): phase numbers follow the `/feature` skill (0 preparation, 1 plan, 2 backend, 3 UI, 4 verification, 5 review, 6 documentation, 7 completion) and rework is plan-aware: a launch that the approved PLAN's Steps table assigns to its phase is never rework, any other launch is judged by the home-phase rule; the PLAN is the version approved at the plan gate, the first commit in the path's full git history whose `Status:` begins with `approved` (amended by the user 2026-09-30, PLAN question 9), so a fix-round step whose agent type the approved plan does not list in that phase is rework; a plan without `Phase`/`Agent` columns falls back to home phases (`reworkSource: 'home-phase'`).
- C. Agent figures (VERIFICATION F4): taken from the transcript re-parse when the agent file exists; the live `agent-stop` aggregate is the fallback only when the file is gone (`agent-transcript-missing:<agent>`); drift compares the live aggregate with the re-parse cut at its `lastTs`, so a stop one request short raises no `agent-stop-drift` warning.
- D. Forked sessions (VERIFICATION F5): a forked session's `session` card includes the parent's copied pre-fork history (the `feature` card dedupes it by `uuid` and `requestId`, D1); recorded as open debt in `docs/STATE.md`, not fixed in this feature.

## Affected entities and services
No CDS entity, service, action or annotation is touched; `mcp__cds-mcp__search_model` was not run because the request names none, and the OData contract does not change (no `npx vitest -u`, no `metadata.xml`). The affected artifacts are pipeline files:

| Object | Exists now | What changes |
|---|---|---|
| `scripts/lib/transcript-usage.mjs` | no (prototype of 80 lines in the issue) | new: the only reader of Claude Code transcripts (D1, D5, `cost-state`, file discovery) |
| `scripts/lib/pipeline-metrics.mjs`, `scripts/lib/metrics-log.mjs`, `scripts/lib/model-pricing.json` | no | new: aggregation and cost (D4-D12), the event log (shape of ADR-0014), the dated price table |
| `scripts/metrics.mjs` | no | new CLI: `session`, `feature`, `record`, `compare`, `reconcile`; Markdown card and `--json` |
| `scripts/hooks/session-start.mjs`, `post-edit.mjs`, `subagent-stop.mjs`, `stop-gate.mjs`, `protect-files.mjs`, `protect-files-bash.mjs`, `pre-compact.mjs` | exist | each appends one record kind to `.pipeline/metrics-<session>.jsonl` (`session`, `phase`, `agent-stop` + `gate`, `gate` + `turn-end`, `gate`, `gate`, `compact`) |
| `scripts/hooks/user-prompt.mjs`, `scripts/hooks/subagent-start.mjs`; `.claude/settings.json` | no | new hooks on `UserPromptSubmit` and `SubagentStart`; two registrations |
| `scripts/i18n/pipeline.properties`, `pipeline_ru.properties` | exist (24 keys) | `metrics.*` keys for the card and the briefing line, en and ru |
| `docs/metrics/history.jsonl` | no | new, committed: one line per finished feature; baseline lines for #5, #6, #7 and `catalog-authorization` |
| `templates/feature/SUMMARY.md`, `.claude/skills/feature/SKILL.md`, `.claude/skills/retro/SKILL.md`, `.claude/agents/docs-keeper.md`, `CLAUDE.md` | exist | one line or section each (`research/data-flow.md` section 6); `test/prompt-budget.json` re-recorded |
| `test/metrics.test.js`, `test/hooks-metrics.test.js`, `test/fixtures/transcript-fixture.mjs`, `test/fixtures/metrics-log.jsonl` | no | new Vitest files and a synthetic fixture without conversation content |
| `docs/decisions/ADR-0022-pipeline-metrics.md` | drafted, proposed | accepted at the plan gate: definitions, transcript-as-source, what is committed |

## What already exists and is reused
- `scripts/lib/hook-utils.mjs`: `readStdinJson`, `repoRoot`, `run`, `emitJson`, `readSection`, `currentBranch`, `isUnder`. No second stdin reader, glob matcher or section reader.
- `scripts/lib/mcp-audit.mjs`: the per-session JSONL file in `.pipeline/`, `appendAudit`/`readAudit`/`pruneAudit` as the shape and lifecycle of `metrics-log.mjs`; `readAudit`, `mcpGaps`, `MCP_RULES` feed the MCP-compliance metric directly. `agentKey(input)` is the agent id used in both logs.
- `scripts/lib/doc-shapes.mjs` `sections()`: counts the acceptance criteria in `PLAN.md` and the findings in `REVIEW.md`.
- `scripts/lib/backlog.mjs`: `loadBundle`/`t` for the card and briefing texts in `PIPELINE_LANG`; the issues cache `.pipeline/issues.json` resolves `#N` to a feature name; `renderBriefing` gains the metrics line.
- `scripts/prompt-budget.mjs` + `test/prompt-budget.json`: the "measure and pin" idea becomes `metrics.mjs record` + `docs/metrics/history.jsonl`; no second baseline mechanism.
- `scripts/hooks/pre-compact.mjs` (`.pipeline/sessions.log`) stays; it gains one `compact` record so compactions are counted with everything else.
- `scripts/prune-feature.mjs`: `SUMMARY.md` survives the prune, so the `## Cost` section survives with it.
- `test/fixtures/build-workbooks.mjs` and `test/hooks-protect-bash.test.js`: the idioms for a fixture builder and for driving a hook with sample stdin JSON.
- The prototype (`proto-metrics.mjs`, Node built-ins only) is the seed of `transcript-usage.mjs`; its "last record per request" rule becomes "per-field maximum per request" (D1).
- Nothing in `docs/registry/` measures time, tokens or cost; `search_model` is irrelevant (no CDS object).
- It would be a mistake to write anew: a JSONL append/read/prune, a glob matcher, a Markdown section reader, an i18n loader, a baseline-pinning mechanism, or a transcript reader inside a hook (hooks call the lib).

## Applicable patterns
- PATTERNS "Record a wish, order the queue" (ADR-0019): `#N` resolution and the issues cache are reused, not re-implemented.
- PATTERNS "Finish a feature" (ADR-0019): phase 7 gains the card; the prune keeps `SUMMARY.md` with the `## Cost` section.
- PATTERNS "Language of the chat and the briefing" (ADR-0019): the card and the briefing line go through `scripts/i18n/pipeline*.properties`.
- Rule `pipeline-config.md`: every new hook passes `node --check` and a manual run with sample JSON before it is enabled; prompt growth is re-recorded (ADR-0018).
- No row exists for "a pipeline metric" or "reading Claude Code transcripts": ADR needed, drafted as ADR-0022 (see PLAN "Decisions that require an ADR").

## Relevant lessons
- CHANGELOG 2026-09-23 (retro of `catalog-authorization`): agents stop at turn limits and stall on the stream watchdog; resumes via `SendMessage` are the recovery. Resumes, relaunches and turn-budget utilization are therefore first-class figures, and a resumed agent's transcript is cumulative (one `agent-stop` record per stop, last wins).
- CHANGELOG 2026-09-11 (a scratchpad figure read as a phase figure): every measured figure in this plan names the session and the rule it was measured with; the card prints its own caps and pricing date.
- `docs/LESSONS.md` 2026-09-29 (`prune-feature.mjs` skips a pre-written `## Full record`): the `## Cost` section is written by `docs-keeper` in phase 6 from a command's output, never pre-filled with a placeholder the prune could keep.
- `docs/LESSONS.md` 2026-09-29 (the `Write`/`Edit` tools decode `\u` escapes): the `ru` texts go into `pipeline_ru.properties` only.

## Open questions
None open: all eight were decided on 2026-09-29 (see "User decisions"; PLAN question 9 is decided by B); kept here as the numbering the decisions refer to:
1. Idle threshold: two caps (turn gap 5 min, tool gap 10 min) or the prototype's single 5-minute cap?
2. Committed artifacts: `docs/metrics/history.jsonl` and the `## Cost` section of `SUMMARY.md`, or one of them?
3. Briefing: one line from the last history entry without a regression warning, or a warning when cost exceeds the previous feature by a factor?
4. Reconciliation: is a documented, per-kind explained gap (73% recovered today with the verified 5m/1h prices; 88% when every cache write is priced at 1h) acceptable for v1, or is 95% a phase 2 gate?
5. OpenTelemetry: v1 non-goal (recommended) or a cross-check now?
6. Feature join key: `gitBranch` plus the `/spec` prompt marker (recommended), or the STATE `Feature:` marker only?
7. Retention of `.pipeline/metrics-*.jsonl`: 30 days (recommended, Claude Code's transcript retention) or 14 (the MCP audit)?
8. Baseline scope: #5, #6, #7 and `catalog-authorization` (recommended; their transcripts still exist) or #5-#7 only?
