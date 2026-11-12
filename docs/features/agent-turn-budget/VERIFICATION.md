# Verification: agent-turn-budget (#60), phase 4

Step 7, `test-backend`, 2026-11-13. Gate mode: autonomous. Criteria: PLAN.md `### Phase 4: live check`.

## Check 1: a `maxTurns: 12` agent hands back on the note

Verdict: pass, on `claude-sonnet-5-5` and on `claude-opus-5-5`.

Setup. Two temp projects, `/tmp/atb-check1-sonnet` and `/tmp/atb-check1-opus`, outside the repository, each built by a scratch builder with the same content:
- `scripts/`: a whole copy of this repository's `scripts/` after d90c06b.
- `.claude/settings.json`: only the `PostToolBatch` entry, copied verbatim from this repository's `.claude/settings.json` (`PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH" node scripts/hooks/turn-budget.mjs`, timeout 10, no matcher). No other hook.
- `.mcp.json`: only `cds-mcp`, copied from this repository's `.mcp.json` (`npx -y @cap-js/mcp-server@0.0.5`).
- `.claude/agents/turn-check.md`: `tools: Read, mcp__cds-mcp__search_docs`, `model: inherit`, `maxTurns: 12`. The task is a chain of 20 item files. Each file names a docs query and the next file, so each item needs one `Read` and one `search_docs` call: 40 calls, one call per message. The agent hands back "when all 20 items are done". Its prompt also holds the turn-note sentence of protocol step 10 verbatim, as every pipeline agent has it. Only the note can make it hand back before turn 12.
- Command, from the temp directory, with all 14 variables that `env | grep -E '^(CLAUDE|PIPELINE)'` listed unset through `env -u`: `claude -p 'Launch the turn-check subagent in the foreground with the prompt "Process the 20 items." When it returns, print DONE, its agent id and its report, or "no report".' --output-format json --model <model> --permission-mode auto --permission-prompts none --setting-sources project --strict-mcp-config --mcp-config .mcp.json --no-chrome --max-turns 12 --max-budget-usd 3`. Exit 0 and empty stderr in both runs. Claude Code 2.1.323 (the `version` of every agent record).

| Run | Session / agent | Turns 1-6 | Note | Turn 7 | Main `toolUseResult` | Cost | Wall |
|---|---|---|---|---|---|---|---|
| sonnet | `da789679-d92c-450d-9f92-78baba01f855` / `abebf9f77eb01a7c6` | `Read`, `search_docs`, alternating; turn 6 `mcp__cds-mcp__search_docs` | after the turn-6 batch, `hook_additional_context` `PostToolBatch` at 22:33:43.702Z: "Turn 6 of 12 (6 left): start no new item; write the current state into your document (mark an unfinished row), stop the processes you started, hand back your report through SubagentHandback." | `SubagentHandback`, result ok | `status: completed`, `handback: send`, `handbackReport` present | $0.0555 | 27.6 s |
| opus | `eea1976c-28aa-4f61-9021-0db48a362a31` / `a16e504b6fcbeffc0` | same | same text, at 22:35:36.157Z | `SubagentHandback`, result ok | same | $0.1211 | 24.9 s |

- From turn 6 on: the first note came after turn 6, as `reserve(12) = 6` predicts. It came after an MCP call: the turn-6 batch was `mcp__cds-mcp__search_docs`.
- Handback before turn 12: both agents delivered in turn 7 with 7 requests. Each report names the last completed item (3) and where to continue (`items/item-04.txt`). The opus report quotes the note.
- Only one note reached a model per run, because both agents obeyed the first one (`K = 6`). The sharper `K <= 3` text was not exercised.
- Neither main transcript holds the platform's `stopped at its` limit text (grep: 0 and 0).

Repeated `turn` values (the open observation of the doubled 55). Both runs logged two `turn-note` records with `turn: 6`:

| Run | Record ts | Batch | Tool call ts, result ts | Count of the file prefix up to the record ts |
|---|---|---|---|---|
| sonnet | 22:33:43.699Z | turn 6, `search_docs` | 22:33:41.752Z, 22:33:43.641Z | 6 |
| sonnet | 22:33:47.563Z | turn 7, `SubagentHandback` | 22:33:46.829Z, 22:33:47.497Z | 7 |
| opus | 22:35:36.153Z | turn 6, `search_docs` | 22:35:35.227Z, - | 6 |
| opus | 22:35:41.863Z | turn 7, `SubagentHandback` | 22:35:41.422Z, - | 7 |
| repo `a7e1e6af`, `cap-backend-dev` `ab48cfd9654506e7f` | 22:06:25.856Z (`turn` 55) | turn 55, `Edit` | 22:06:25.651Z, 22:06:25.787Z | 55 |
| same | 22:06:31.377Z (`turn` 55) | turn 56, `Bash` | 22:06:31.189Z, 22:06:31.308Z | 56 |
| same | 22:07:19.196Z (`turn` 57) | turn 57, `SubagentHandback` | 22:07:18.480Z, 22:07:19.122Z | 57 |

The second record of a pair belongs to a distinct, later batch: each batch left its own `hook_success` attachment. So the hook did not fire twice; it counted one short. Cut at the record's timestamp, the agent file already holds the batch's own `assistant` record, and `runTurns()` of that prefix (and of the whole file after the run) gives the true turn. So the record was written to disk after the hook read the file. In the temp runs 2 of 4 records were exact, and in the repo session 2 of 3; the others were one short. The probe (`research/hook-probe.md` P4, 2.1.322) saw all 27 rows exact. One short is the P4 fallback case "no change, the reserve absorbs it". The card collapses the pair: one note each (check 2). In the temp runs the one-short record sits on the handback batch, so its note reached no model (no `hook_additional_context` after turn 7).

## Check 2: `turn-note` records and the session card

Verdict: pass.

Records, `<temp>/.pipeline/metrics-<session>.jsonl`. The temp settings register only `PostToolBatch`, so these are the only records:
- sonnet: `{"ts":"2026-11-12T22:33:43.699Z","event":"turn-note","agent":"abebf9f77eb01a7c6","agentType":"turn-check","turn":6,"maxTurns":12}` and the same at `22:33:47.563Z`.
- opus: the same pair for `a16e504b6fcbeffc0` at `22:35:36.153Z` and `22:35:41.863Z`.

Card. `PIPELINE_LANG=en node scripts/metrics.mjs session <id>` was run from each temp directory, through the temp copy of `scripts/`. `repoRoot()` is the script's own location, so the copy reads `<temp>/.pipeline/`. There is no `session` record, so the transcripts resolve by the slug rule to `~/.claude/projects/-private-tmp-atb-check1-<model>/`. Exit 0 for both. Agent rows:

```
| Agent | Launches | Resumes | Active | Calls / maxTurns | Turn notes / limit stops | Cost | Rework |
| turn-check | 1 | 0 | 0m | 7 / 12 | 1 / 0 | $0.02 | 0 |    (sonnet)
| turn-check | 1 | 0 | 0m | 7 / 12 | 1 / 0 | $0.05 | 0 |    (opus)
```

Both cards also print `hand-backs 1`. Without an `agent-start` record, the limit 12 comes from the `turn-note` records (D19 "else of its turn-note records"). Limit stops are 0: 7 requests stay below 12, and the run holds a delivered report. The card counts one note for the two records of each run.

Supplementary evidence: the repository session `a7e1e6af-b74d-43f9-a399-133b59cd4391` (`.pipeline/metrics-a7e1e6af-b74d-43f9-a399-133b59cd4391.jsonl`). `cap-backend-dev` `ab48cfd9654506e7f` got notes at turns 55, 55 and 57 of 60. It called `SubagentHandback` in turn 57: the tool result is not an error, and the hook kept the report as `.pipeline/logs/report-cap-backend-dev-ab48cfd9654506e7f.md`. It was a background launch, so a background-task notification then started a text-only turn 58, still below 60. The record timing is in check 1.

## Check 3: hook cost over 20 runs

Verdict: pass. Main-thread input: median 0.051 s (limit 0.3 s). Subagent input on the 11 MB transcript: median 0.084 s (limit 0.5 s).

Method. The sandbox root `/tmp/atb-check3` holds copies of this repository's `scripts/` and `.claude/agents/`. `repoRoot()` of the copied hook is that root, so every record went to `/tmp/atb-check3/.pipeline/`. A scratch driver, run under `env -u PIPELINE_ALLOW_PROTECTED` and with that variable also deleted from the child environment, timed one `spawnSync('/bin/sh', ['-c', "printf '%s' \"$IN\" | node /tmp/atb-check3/scripts/hooks/turn-budget.mjs"])` per run, wall time by `process.hrtime`. The input JSON was passed in `IN`. Runs alternated main, subagent and a bare `node -e 0` baseline, 20 rounds. Node 22 from `/opt/homebrew/opt/node@22/bin`, as in the registered command. Load average 2.52 before and 2.48 after; the machine was not idle (5.92 at the start of this launch).

Inputs. Both have the shape of a `PostToolBatch` input (`session_id`, `transcript_path`, `cwd`, `hook_event_name`, `permission_mode`, `prompt_id`, `effort`, one `tool_calls` entry).
- Main thread: no `agent_id`.
- Subagent: `agent_id` `a7461c9950cb72a41`, `agent_type` `test-ui` (`maxTurns: 80`), and `transcript_path` of session `fe975b7e-35e8-4a4c-b5c9-09cf68fc5951`. That resolves to `subagents/agent-a7461c9950cb72a41.jsonl`, 11,091,701 bytes, the largest #10 file of `research/turn-budget-facts.md`. This is the full path: the transcript is parsed, a note is printed and a record is appended.

| Input | Runs | Median | Min | Max | Output |
|---|---|---|---|---|---|
| main thread | 20 | 0.051 s | 0.050 s | 0.052 s | none, exit 0 |
| subagent, 11 MB | 20 | 0.084 s | 0.083 s | 0.088 s | `Turn 74 of 80 (6 left): ...`, exit 0 |
| `node -e 0` baseline | 20 | 0.042 s | 0.041 s | 0.044 s | - |

- The subagent count of 74 equals the 74 requests that `research/turn-budget-facts.md` gives for that file.
- `/tmp/atb-check3/.pipeline/metrics-atb-check3-sub.jsonl` got 20 `turn-note` records (`turn` 74, `maxTurns` 80). The main input wrote none.
- This repository's `.pipeline/` held 44 `metrics-*` files before and after the runs, and none named `atb-check3`.
- These figures are about a quarter of the estimate in `research/turn-budget-facts.md` (node start 0.18-0.19 s by `/usr/bin/time`). The bare-node baseline here is 0.042 s. So the hook adds about 0.01 s on the main thread and about 0.04 s on the 11 MB file.

## Verdict

Checks 1-3 pass: ready for review.

One open observation goes to the reviewer and does not block. The count is sometimes one short (check 1: 3 of 7 records), when the batch's own `assistant` record reaches the disk after the hook reads the file. This is within the P4 fallback ("one short: no change"), but the probe's "exact on every row" does not hold on 2.1.323. Each such record repeats the previous `turn` value, and the card counts it once.

Cleanup: `/tmp/atb-check1-sonnet`, `/tmp/atb-check1-opus`, `/tmp/atb-check3` and the scratch scripts were deleted after this file was written. No `claude`, `cds` or `@cap-js/mcp-server` process that this launch started is left running. The transcripts stay under `~/.claude/projects/-private-tmp-atb-check1-*`; they hold item queries and the note only.
