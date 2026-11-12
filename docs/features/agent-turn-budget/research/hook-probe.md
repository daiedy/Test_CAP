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

Run 2026-11-13 by `cap-backend-dev` (phase 2, step 1) from the main checkout, not a worktree: an agent's Bash could spawn `claude -p`. Claude Code 2.1.322 (`claude --version`, and `version` of every record in the three main and three agent transcripts). Model `claude-haiku-5-5` on the main thread and, through `model: inherit`, in the probe agent.

Deviations from "Procedure" step 2:
- `env -u`: `env | grep -E '^(CLAUDE|PIPELINE)'` listed 14 variables. Besides the four of the procedure, these were also unset: `CLAUDE_CODE_HOST_SHORT_TEMP_DIRS`, `CLAUDE_JOB_DIR`, `CLAUDE_CODE_MESSAGING_SOCKET`, `CLAUDE_CODE_MESSAGING_TOKEN`, `CLAUDE_CODE_EXECPATH`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, `CLAUDE_EFFORT`.
- Flags: `claude --help` lists every flag of the command except `--max-turns`. The CLI accepted that flag as a hidden option (exit 0, empty stderr, main `num_turns` 2), so all three runs kept it. Each run wrote stdout to `out.json` and stderr to `err.txt` in its temp directory; stderr stayed empty in all three runs.

| # | Verdict | Evidence | Fallback applied |
|---|---|---|---|
| P1 | pass | `deliver`: `PostToolBatch.jsonl` has 6 rows, 5 of them in the subagent (`agent_type` `turn-probe`). Keys: `agent_id, agent_type, cwd, effort, hook_event_name, permission_mode, prompt_id, session_id, tool_calls, transcript_path`. The main-thread row (the batch of `Agent`) has no `agent_id` key. The agent transcript holds 4 `hook_additional_context` attachments with `hookEvent: PostToolBatch` for turns 1-4. Their `toolUseID` is `hook-<uuid>`, not a tool id. The report quotes `PROBE-BATCH-N1-K1`, `-N2-K1`, `-N3-K2`, `-N4-K1`. The fifth batch (turn 5, the `SubagentHandback`) ran and left a `hook_success` but no context attachment, because the agent had ended | none needed |
| P2 | pass | `deliver`: an attachment with `hookEvent: PostToolUse` whose `toolUseID` is the turn-2 `mcp__cds-mcp__search_docs` call, content `PROBE-POST-mcp-N2`. The report quotes `PROBE-POST-mcp-N2` after turn 2 | none needed |
| P3 | pass | `deliver`: `PostToolUseFailure.jsonl` has 1 row (`Bash`, subagent). Its keys add `error` and `is_interrupt` and lack `tool_response`. The `PostToolBatch` row of the same `Bash` follows 0.25 s later (n 4, batch of 1). Both contexts were attached (`PROBE-FAIL-Bash-N4`, `PROBE-BATCH-N4-K1`) and quoted by the report | none needed |
| P4 | pass, exact | 27 subagent hook rows over the three runs (`deliver` 11, `limit` 12, `limit-last` 4). On every row the count at hook time equals the true turn. That includes the parallel batch (3 of 3) and the turn-`M` batch of `limit` (6 of 6). There is no lag: the current request's `assistant` record is on disk when PostToolUse and PostToolBatch run. `transcript_path` is the main session file, and `<main without .jsonl>/subagents/agent-<agent_id>.jsonl` resolved the agent file on every row | none needed |
| P5 | pass | `deliver` turn 3: two `PostToolUse` rows (`Read`, `Read`, 0.11 s apart, n 3 each) and one `PostToolBatch` row with 2 `tool_calls` (`PROBE-BATCH-N3-K2`) | none (cost figure confirmed: one batch call per turn, one PostToolUse per tool call) |
| P6 | not exercised | `limit-last`: the agent called `SubagentHandback` on its own in turn 2 (2 requests, `turn 2 delivered`, main `toolUseResult.handback: send`). The turn-5 note never fired, and no handback was made in turn 6. Indirect evidence only. In `limit` the turn-6 (= `M`) tool call still ran and fired PostToolUse and PostToolBatch (n 6). In `deliver` the `SubagentHandback` was delivered (`handback: send`, `status: completed`) and no request followed it | P6 fallback, applied conservatively: the `K <= 2` text applies from `K <= 3`, unless a re-run of `limit-last` prints `turn 6 delivered` |
| P7 | fail (haiku) | `limit`: 3 notes (`Turn 4 of 6`, `Turn 5 of 6`, `Turn 6 of 6`) were attached as `hook_additional_context:PostToolBatch`. The agent called `Read` in turns 5 and 6. Turn 6 also held a 317-character text block that mentions the handback, followed by `Read`. 6 requests, no `SubagentHandback`. The main transcript holds `stopped at its 6-turn limit`, `toolUseResult.handback: withheld` and no `handbackReport` key; the main result is "no report". The turn-6 note was attached after the last request and reached no model call | P7 fallback: record, do not block; the phase 4 check on a real launch decides |

Observations for steps 2-3:
- PostToolBatch also fires on the main thread, in a row without the `agent_id` key. So the hook's early exit on a missing `agent_id` runs once per main-thread tool turn.
- A note on the turn-`M` batch is written into the transcript, but no request reads it. The last note a model can act on is the turn `M - 1` note (`K = 1`).
- `hook_success` attachments appear only for hook calls that printed output (`limit`: 3 batch, 0 PostToolUse).
- Agent files hold `api-request`, `api-request-blob` and `api-request-shape` records (`deliver` 5, 10, 1). The probe's own counter reads only `assistant` records and matched the true turn on every row.
- The probe agent's `tools:` list does not name `SubagentHandback`, yet it was called and delivered twice (`deliver`, `limit-last`). An agent's `tools` does not gate the handback.

| Run | Duration | Main turns | Cost (USD) |
|---|---|---|---|
| `deliver` | 20.7 s | 2 | 0.0042 |
| `limit` | 16.9 s | 2 | 0.0031 |
| `limit-last` | 8.1 s | 2 | 0.0023 |

Total: $0.0096, against the accepted $0.15.

Cleanup: the three temp directories are deleted after this section was written. No process the probe started is left running. The `@cap-js/mcp-server@0.0.5` processes that remain belong to sessions started on 2026-11-11 and 2026-11-12. The transcripts stay under `~/.claude/projects/-private-tmp-atb-probe-*`; they hold probe tokens only.

Gate: P1 and P2 pass, and P4 is exact, so phase 2 proceeds with fallback P6: the last-turn text applies from `K <= 3`, because P6 was not exercised. P7 is recorded as failed on haiku; the phase 4 check decides. Per "Gate", the orchestrator writes the P6 fallback into CONTEXT "Turn note"; this launch changes nothing outside `research/`.
