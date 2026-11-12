# agent-turn-budget: live hook probe (PLAN step 1)

Date: 2026-11-13. Author: `architect` (procedure); run by the `/feature` orchestrator before phase 2, results appended below by the runner. Claude Code 2.1.322. Script: `research/turn-probe.mjs` (`build`, `hook`, `analyze`; dry-run checked 2026-11-13: a subagent input returns the probe context, a main-thread input stays silent, `node --check` and ESLint clean). Same method as #44 (`git show 5ab25a6:docs/features/context-hygiene/research/hook-probe-results.md`): a throwaway project outside the repository, `claude -p` with haiku, logs with keys and counts only.

Why a probe: hooks are snapshotted at session start, so the new hook cannot be probed in the session that registers it, and the #44 facts F1-F9 never returned context after an MCP tool, never used PostToolBatch, and never ran an agent into its `maxTurns` (`turn-budget-facts.md` F-H to F-K).

## Facts to settle

| # | Question | Pass when | Fallback when it fails |
|---|---|---|---|
| P1 | PostToolBatch fires inside a subagent with `agent_id`, `agent_type`, `transcript_path`, and its `additionalContext` reaches the agent | `logs/PostToolBatch.jsonl` has subagent rows; the agent transcript has a `hook_additional_context` attachment with `hookEvent: PostToolBatch`; the report quotes a `PROBE-BATCH-` token | PostToolUse and PostToolUseFailure on every tool (matcher `.*`) with one warning per agent and turn (ADR-0032 alternative 2) |
| P2 | PostToolUse `additionalContext` reaches the agent after an MCP tool | an attachment `hookEvent: PostToolUse` whose `toolUseID` is the `mcp__cds-mcp__search_docs` call, and the report quotes `PROBE-POST-mcp-` | with P1 passed: none needed (the batch carries the note); with P1 failed: stop and ask the user |
| P3 | A failed tool (`Bash` `exit 3`) fires PostToolUseFailure and the batch still fires | a `PostToolUseFailure` row for `Bash` and a batch row after it | the PostToolUse fallback also registers PostToolUseFailure |
| P4 | The request count at hook time against the true turn of the call (transcript lag, F-J) | the `analyze` P4 lines: count equals the true turn, or is one short on every row | a count one short is absorbed by the reserve; worse: count by `tool_calls` ids instead, ask the architect |
| P5 | Parallel calls: two PostToolUse rows and one PostToolBatch row with `tool_calls` of 2 in turn 3 | as stated | none; it only confirms the cost figure |
| P6 | A `SubagentHandback` issued in the last allowed turn (turn `M`) is delivered (variant `limit-last`) | `analyze` prints `turn 6 delivered` and the main result is the report, not a partial notice | the last-turn note asks for the handback one turn earlier (reserve floor unchanged) |
| P7 | A warned agent hands back before the limit (variant `limit`, notes from turn `M - 2`) | a delivered `SubagentHandback` at turn 4-6, no `stopped at its 6-turn limit` notice in the main transcript | haiku is a weak proxy for the pipeline models: record, do not block; phase 4 check on a real launch decides |

## Procedure

Run from the repository root in a terminal session of the user (the probe spawns Claude Code; an agent cannot). Each variant gets its own directory, because the project slug keys the transcripts.

1. Build, once per variant, outside the repository (the script refuses a path inside it):
   `node docs/features/agent-turn-budget/research/turn-probe.mjs build /tmp/atb-probe-deliver deliver`
   `node docs/features/agent-turn-budget/research/turn-probe.mjs build /tmp/atb-probe-limit limit`
   `node docs/features/agent-turn-budget/research/turn-probe.mjs build /tmp/atb-probe-last limit-last`
   Each writes `.claude/settings.json` (PostToolUse `.*`, PostToolUseFailure `.*`, PostToolBatch, all calling the copied `turn-probe.mjs hook`), `.claude/agents/turn-probe.md` (tools `Read, Bash, mcp__cds-mcp__search_docs`, `model: inherit`, `maxTurns` 12, 6, 6), `.mcp.json` with `cds-mcp` pinned 0.0.5, `target.txt`, `other.txt`.
2. Run each variant with cwd = its directory and an environment without `CLAUDE*` and `PIPELINE_*` variables (#44 run shape):
   `cd /tmp/atb-probe-deliver && env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u PIPELINE_ALLOW_PROTECTED -u PIPELINE_LANG claude -p 'Launch the turn-probe subagent in the foreground with the prompt "run the probe". When it returns, print DONE, its agent id and its report, or "no report".' --output-format json --model claude-haiku-5-5 --permission-mode auto --permission-prompts none --setting-sources project --strict-mcp-config --mcp-config .mcp.json --no-chrome --max-turns 12 --max-budget-usd 3`
   Then the same command in `/tmp/atb-probe-limit` and `/tmp/atb-probe-last`. Check `env | grep -E '^(CLAUDE|PIPELINE)'` is empty inside the `env -u` list first; add any variable it shows.
3. Analyze each: `node docs/features/agent-turn-budget/research/turn-probe.mjs analyze /tmp/atb-probe-deliver` (and the two others). Lines `P1/P2/P3 context`, `P4`, `P6/P7` map to the table. For P7 also search the main transcript (`~/.claude/projects/<slug>/<session>.jsonl`) for `stopped at its 6-turn limit`.
4. Append a "Results" section below: Claude Code version from the transcript records, one table row per fact with the evidence (record kinds, counts, tokens), the fallback applied, and the cost line of each run. Delete the three temp directories after the results are written.

Expected cost: three haiku runs of under 1 minute and under $0.05 each (#44 runs: $0.0064-0.0097).

## Gate

P1 or P2 failed without its fallback, or P4 more than one short: phase 2 does not start; the orchestrator brings the result to the user with the architect's amended Decision of ADR-0032. P6 or P7 failed: phase 2 starts with the fallback written into CONTEXT "Turn note".

## Results

Not run yet (2026-11-13).
