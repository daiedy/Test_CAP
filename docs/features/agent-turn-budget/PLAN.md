# agent-turn-budget: plan

Date: 2026-11-13. Status: approved (user, 2026-11-13). Gate mode: autonomous.

Shape (ADR-0018, ADR-0031): one criterion per line under a `### Phase <N>: <label>` or `### Every phase` subsection of "Acceptance criteria"; table rows only under "Steps", each `Phase` cell starting with `<N>: `, agent types in backticks; explanations belong in `CONTEXT.md` or `research/`. Each implementer, tester, `ui-verifier` and `docs-keeper` receives its rows and the criteria of its phase as a brief (`scripts/feature-brief.mjs`). `node scripts/check-feature-docs.mjs <name>` verifies the shape at the phase 1 gate.

Contract rule: no step changes the OData model; `metadata.xml` and the `$metadata` snapshot stay unchanged. Protected paths (`scripts/hooks/**`, `scripts/lib/**`, `.claude/**`) need the session's `PIPELINE_ALLOW_PROTECTED=1`. No phase 3 (no UI).

## Acceptance criteria

### Phase 2: probe, hook, metrics
- [x] Probe P1-P7 are recorded in `research/hook-probe.md` "Results" before any file of steps 2-6 changes, each failed fact with its CONTEXT fallback applied, verified by the step 1 gate
- [x] On the main thread the hook prints nothing and writes no record, verified by `test/hooks-turn-budget.test.js` "main thread is silent"
- [x] Below turn `M - reserve(M)` the hook is silent, verified by `test/hooks-turn-budget.test.js` "silent below the threshold"
- [x] From turn `M - reserve(M)` on, every turn returns `Turn N of M (K left)` as `additionalContext` and appends one `turn-note` record, verified by `test/hooks-turn-budget.test.js` "notes from the threshold"
- [x] At `K <= 3` the note asks for the handback in this turn, verified by `test/hooks-turn-budget.test.js` "last turns ask for the handback"
- [x] A `coordinator` resume restarts the count, verified by `test/hooks-turn-budget.test.js` "a resume restarts the run"
- [x] `api-request*` records and repeated `requestId` records add no turn, verified by `test/hooks-turn-budget.test.js` "counts each request once"
- [x] An agent type without a definition or `maxTurns`, a missing transcript and malformed input stay silent with exit 0, verified by `test/hooks-turn-budget.test.js` "silent on unknowns"
- [x] `reserve()` returns 6, 6, 7, 8 for 30, 60, 70, 80, verified by `test/hooks-turn-budget.test.js` "reserve by maxTurns"
- [x] `agentMaxTurns()` is the only frontmatter reader and `scripts/metrics.mjs` uses it, verified by `test/hooks-turn-budget.test.js` "agentMaxTurns reads the frontmatter" and `test/metrics.test.js` (card maxTurns unchanged)
- [x] The `agent-start` record carries `maxTurns` of the agent type, verified by `test/hooks-metrics.test.js` "agent-start carries maxTurns"
- [x] D19: a run at its limit without a delivered report is a limit stop, a run with a report or below the limit is not, verified by `test/metrics.test.js` "limit stops per run"
- [x] The card shows turn notes and limit stops per agent type in `en` and `ru`, and the history line carries `turnLimitStops` and `turnNotes`, verified by `test/metrics.test.js` "turn fields on the card and the history line"
- [x] `.claude/settings.json` registers `turn-budget.mjs` on the event step 1 confirmed, verified by `test/hooks-turn-budget.test.js` "registered in settings"
- [ ] The protocol section 2 step 10 and the `feature` skill turn-budget line point to the note, `test/prompt-budget.json` re-recorded, verified by `test/prompt-budget.test.js`

### Phase 4: live check
- [ ] In a temp project with the real hook, an agent of `maxTurns: 12` receives a note from turn 6 on, after an MCP call too, and delivers its report before turn 12, verified by `VERIFICATION.md` check 1
- [ ] The run's `turn-note` records and the card of that session show its notes and no limit stop, verified by `VERIFICATION.md` check 2
- [ ] Hook cost over 20 runs: a main-thread input at most 0.3 s median, a subagent input on the 11 MB #10 transcript at most 0.5 s median, verified by `VERIFICATION.md` check 3

### Phase 5: review
- [ ] `REVIEW.md` has zero blocking findings, verified by `REVIEW.md`

### Phase 6: documentation
- [ ] ADR-0032 accepted, PATTERNS row "Turn budget note", `docs/metrics/definitions.md` D19 and `data-flow.md` sections 2 and 4 updated, verified by `node scripts/check-docs-fresh.mjs`
- [ ] `CLAUDE.md` hooks line, README "How the pipeline works" and `docs/images/pipeline-flow.svg` name the PostToolBatch hook, `test/prompt-budget.json` re-recorded, verified by `test/prompt-budget.test.js`
- [ ] The ADR-0032 digest in `docs/wiki/decisions/Pipeline-decisions.md`, verified by `node scripts/wiki.mjs audit`
- [ ] The RU and EN manual pages are republished with the same hook text as the README, verified by the orchestrator's step 9 note in `SUMMARY.md`
- [ ] LESSONS 2026-11-13 entry closed, STATE, CHANGELOG and `SUMMARY.md` updated, verified by `node scripts/check-docs-fresh.mjs`

### Every phase
- [ ] `npm test` and `npm run lint` are green at every gate

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | 2: probe | `cap-backend-dev` (or the orchestrator) | `research/hook-probe.md` "Results"; temp projects `/tmp/atb-probe-*` built by `research/turn-probe.mjs`, deleted after | Probe before code (ADR-0031 decision 6) | P1-P7 rows filled; a failed P1 or P2 without fallback stops the phase |
| 2 | 2: library | `cap-backend-dev` | `scripts/lib/turn-budget.mjs` (new), `scripts/lib/transcript-usage.mjs` (`runTurns()`, `subagentTranscript()`), `scripts/lib/metrics-log.mjs` (`runningAgents()` via `subagentTranscript()`), `scripts/metrics.mjs` (imports `agentMaxTurns()`) | Pipeline metric | `npm run lint`, `npm test` |
| 3 | 2: hook and registration | `cap-backend-dev` | `scripts/hooks/turn-budget.mjs` (new), `scripts/hooks/subagent-start.mjs` (`maxTurns`), `.claude/settings.json` (the event of step 1) | ADR-0032; `.claude/rules/pipeline-config.md` hook rule | `node --check`, one `createSandbox()` run per event with the JSON fed by `printf '%s'` and `PIPELINE_ALLOW_PROTECTED` unset, before the `settings.json` edit; `npm run lint` |
| 4 | 2: card and history | `cap-backend-dev` | `scripts/lib/pipeline-metrics.mjs` (D19, card column, history keys), `scripts/i18n/pipeline.properties`, `scripts/i18n/pipeline_ru.properties` | Pipeline metric | `npm test` |
| 5 | 2: prompts | `cap-backend-dev` | `.claude/skills/project-protocol/SKILL.md` (section 2 step 10), `.claude/skills/feature/SKILL.md` (turn-budget line), `.claude/rules/pipeline-config.md` (one line for the turn note next to "Context (ADR-0031)"), `test/prompt-budget.json` (`node scripts/prompt-budget.mjs --record`) | ADR-0032 decision 6 | `npm test` (prompt budget) |
| 6 | 2: tests | `test-backend` | `test/hooks-turn-budget.test.js` (new, `createSandbox()`), `test/metrics.test.js`, `test/hooks-metrics.test.js`, `test/fixtures/transcript-fixture.mjs` | Hook test on a sandbox | `npm test` green, one `it` per named criterion |
| 7 | 4: live check | `test-backend` | `VERIFICATION.md`; a temp project outside the repository with a copy of `scripts/` and a probe agent of `maxTurns: 12` and one MCP tool, built like `research/turn-probe.mjs` | Probe before code | checks 1-3 with figures |
| 8 | 5: review | `reviewer` | `REVIEW.md` | | zero blocking findings |
| 9 | 6: documentation | `docs-keeper`, then the orchestrator for the manual pages | `docs/architecture/PATTERNS.md`, `docs/metrics/definitions.md`, `docs/metrics/data-flow.md`, `CLAUDE.md`, `README.md`, `docs/images/pipeline-flow.svg`, `docs/wiki/decisions/Pipeline-decisions.md`, `test/prompt-budget.json`, `docs/LESSONS.md`, `docs/STATE.md`, `docs/CHANGELOG.md`, `SUMMARY.md`; the RU/EN manual pages | | `node scripts/check-docs-fresh.mjs`, `node scripts/wiki.mjs audit`, `npm test` |

## Decisions that require an ADR
- ADR-0032 (accepted 2026-11-13): the turn note from a hook, its event, count, threshold, records and prompts. No PATTERNS row covers a hook that advises a subagent about its own budget.

## Risks
- PostToolBatch absent in 2.1.322 or not fired inside a subagent: probe P1, fallback to PostToolUse and PostToolUseFailure (CONTEXT).
- The transcript lags the hook (documented): probe P4; one turn short is inside the reserve.
- An agent reads the note and goes on: phase 4 check 1 on a live run, then the card's notes against limit stops per feature (#59 signal).
- The note costs a node start on every turn of every thread: phase 4 check 3 against 0.3 s and 0.5 s.
- A Claude Code update changes the transcript or the hook input: the hook fails silent, the card shows notes falling to 0 while stops remain; `/upstream-check` names PostToolBatch.
- The hook is snapshotted at session start: it works from the session after the phase 2 commit; phase 4 runs in a temp project.

## Open questions
None. Q1-Q8 decided by the user 2026-11-13 as recommended:
- Q1 Threshold: `reserve = max(6, ceil(maxTurns / 10))`.
- Q2 Frequency: a note on every turn from the threshold, sharper at the last three (P6 fallback).
- Q3 Event: `PostToolBatch` primary with the whole transcript read; PostToolUse the fallback.
- Q4 MCP delivery: the probe runs as step 1 at the start of phase 2, a `cap-backend-dev` launch.
- Q5 #59: separate; this feature delivers `turnLimitStops` and `turnNotes` for it.
- Q6 ADR form: a new ADR-0032.
- Q7 Ratchet: none now.
- Q8 Note language: English.
