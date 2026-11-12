# ADR-0032: A hook tells a subagent its turn against `maxTurns`

Date: 2026-11-13. Status: accepted (user, 2026-11-13, feature `agent-turn-budget`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
In #10 5 of 25 launches stopped at `maxTurns` without a report (`ui-verifier` 3 of 6 at 80, `fiori-app-dev` at 60, `reviewer` at 50); two verifier launches carried "hand back by turn 72/70" in the delegation and still ran to 80, one left `cds serve` on :4004, the follow-ups cost about $3 (issue #60, CHANGELOG 2026-11-13, LESSONS 2026-11-13). An agent does not see its turn count, so neither a deadline in the delegation nor protocol section 2 step 10 ("budget your turns") can work. The #10 retro sized launches and raised two limits; nothing tells an agent that its limit is near. Measurements and framework facts: `docs/features/agent-turn-budget/research/turn-budget-facts.md`; the live probe: `research/hook-probe.md`.

## Decision
1. **Event.** A new hook `scripts/hooks/turn-budget.mjs` is registered on `PostToolBatch` in `.claude/settings.json` (no matcher; Claude Code fires it once per turn after every tool call of the batch resolved, before the next model call, for MCP and failed calls alike). On the main thread (no `agent_id`) it exits before loading the transcript library. Probe P1 decides; when it fails, alternative 2 applies.
2. **Count.** The turn of an agent is the number of distinct `requestId` values of the `assistant` records of its current run, a run starting at the launch or at the last `coordinator` delivery (a `SendMessage` resume gets a fresh `maxTurns`; measured 5 of 5 stops at exactly `maxTurns` requests and resumed runs of 80 after a stop at 80). The file is `<transcript_path without .jsonl>/subagents/agent-<agent_id>.jsonl`; it is read whole through `scripts/lib/transcript-usage.mjs` (`runTurns()`), the only transcript reader, which costs 24-103 ms against a 0.18 s node start. A batch whose request is not yet on disk counts as well (decision 4, amendment 2026-11-13).
3. **Limit.** `M` is `maxTurns` of the frontmatter of `.claude/agents/<agent_type>.md`, read by `agentMaxTurns()` in the new `scripts/lib/turn-budget.mjs` (moved from `scripts/metrics.mjs`, which imports it). An agent type without a definition or without `maxTurns` gets no note.
4. **Threshold and frequency.** Reserve `R = max(TURN_RESERVE_MIN, ceil(M x TURN_RESERVE_SHARE))` with 6 and 0.1, the measured median and 80th percentile of a wrap-up run (30 → note from turn 24, 60 → 54, 70 → 63, 80 → 72). From turn `M - R` on, every turn gets the note as `additionalContext`: `Turn N of M (K left): start no new item; write the current state into your document (mark an unfinished row), stop the processes you started, hand back your report through SubagentHandback.` At `K <= 3` the note asks for the handback in this turn (probe 2026-11-13: P6, a handback in turn `M`, was not exercised, so the conservative fallback applies instead of `K <= 2`). Before the threshold the hook is silent. Amended 2026-11-13 (phase 5 review): on Claude Code 2.1.323 the batch's own `assistant` record can reach the file after the hook reads it (VERIFICATION check 1: 3 of 7 records one short, and a silent short read at the threshold batch), which starts the notes a turn late, shows one turn more than is left and gives the `K <= 3` text 2 turns instead of 3; so the hook also reads the `tool_use_id` strings of `tool_calls` (never `tool_response`) and counts the batch's own request when none of them is a `tool_use` id of the run (`runTurns(records, batchIds)`): the count is exact, or one high when a record of that request without its tool use is already on disk (the note a turn early); `TURN_LAST_CALL` stays 3, and an input without ids keeps the file count.
5. **Records.** Each note appends `{ event: 'turn-note', agent, agentType, turn, maxTurns }` to `.pipeline/metrics-<session>.jsonl` (`metrics-log.mjs`); SubagentStart adds `maxTurns` to its `agent-start` record, the limit in force for the run. The card computes per run its turns, its notes and a limit stop (D19: turns reached the limit in force and the run holds no delivered report) and the history line carries `turnLimitStops` and `turnNotes`, the field #59 reads.
6. **Prompts.** Protocol section 2 step 10 and the `feature` skill turn-budget line point to the note instead of a deadline an agent cannot see; launches are still sized by measured cost, the note is the guard.

## Alternatives
| Option | Why rejected |
|---|---|
| 1. A deadline in the delegation text ("hand back by turn 72") | Ignored 2 of 2 times in #10: the agent cannot count its turns |
| 2. PostToolUse and PostToolUseFailure on every tool (the issue's proposal) | Fires per call (1.4-1.8 per turn in #10), parallel calls start parallel processes and duplicate the note, a failed call needs a second event; kept as the fallback if probe P1 fails, with one note per agent and turn kept by an exclusive-create marker file |
| 3. `hooks` in each agent's frontmatter | Eleven copies of one entry; a new agent type would miss it |
| 4. `decision: block` or `continue: false` at the threshold | Stops the loop without a report, the failure this ADR removes |
| 5. Only higher `maxTurns` (the #10 retro) | Moves the cliff; nothing tells the agent it is near |
| 6. A tail read with a persisted cursor | Saves at most 0.1 s against a 0.18 s node start and adds state and a run-boundary search |
| 7. A fixed reserve, a per-role reserve, or one note plus a last one | A fixed 8 takes 27% of a 30-turn run; a per-role figure is a second tuning place next to `maxTurns`; a single note is one more line in a long context, the kind of text ignored in #10 |

## Consequences
- Simpler: an agent sees its budget; the orchestrator no longer writes turn deadlines; the card and the history line count limit stops per launch for #59.
- Harder: every turn of every thread starts a node process (about 0.2 s on the main thread, at most 0.35 s in a subagent); `PostToolBatch` becomes the tenth hook event, `turn-budget.mjs` the fourteenth script.
- Changes: PATTERNS row "Turn budget note"; `docs/metrics/definitions.md` D19 and `data-flow.md` section 2 (`turn-note`, `agent-start.maxTurns`); `CLAUDE.md` hooks line; README "How the pipeline works"; the RU/EN manuals and `docs/images/pipeline-flow.svg`; `test/prompt-budget.json` re-recorded for the protocol and the `feature` skill.

## Sources
- Issue #60; `docs/features/agent-turn-budget/research/turn-budget-facts.md`, `research/hook-probe.md`.
- code.claude.com/docs/en/hooks.md (PostToolBatch, "Add context for Claude", common input fields), code.claude.com/docs/en/sub-agents.md (`maxTurns`, hooks in subagents), fetched 2026-11-13.
- ADR-0022 (metrics records), ADR-0031 (probe before code, hand-over gate, `HANDBACK_DENY_MAX`), #44 probe results F3, F7, F9 (`git show 5ab25a6:docs/features/context-hygiene/research/hook-probe-results.md`).
