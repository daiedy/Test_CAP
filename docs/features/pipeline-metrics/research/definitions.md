# pipeline-metrics: definitions and measured transcript facts

Date: 2026-09-29. Author: `architect`. Read by `cap-backend-dev` (steps 2-4), `test-backend` (step 5), `reviewer`. Every figure below was measured on session `6ecbd7a4` (feature #7, `products-excel-upload`) with narrow `jq` filters; no conversation content was read. Claude Code version in the records: 2.1.282.

## 1. Sources and their status

| Source | Path | Status | What it gives |
|---|---|---|---|
| Main transcript | `~/.claude/projects/<slug>/<session>.jsonl`; `slug` = cwd with `/` replaced by `-`; hook input `transcript_path` | internal, unstable; read only through `scripts/lib/transcript-usage.mjs` | usage, timestamps, tool calls, `gitBranch`, `cost-state` |
| Subagent transcript | `<session>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json`; hook input `agent_transcript_path` | internal | the agent's usage and timeline; meta: `agentType`, `description`, `requestShape` (`background`), `toolUseId`, `spawnDepth` |
| Hooks | `SessionStart`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, `PreCompact`, `PostToolUse` | official API | markers (phase, prompt, gate) and the official transcript paths |
| MCP audit | `.pipeline/mcp-audit-<session>.jsonl` (ADR-0014) | project API | MCP-first compliance, `skipped-unjustified`, `ok:false` |
| Event log (new) | `.pipeline/metrics-<session>.jsonl` | project API, shapes in `research/data-flow.md` | everything the hooks can see |
| Baseline (new) | `docs/metrics/history.jsonl` | committed | one line per finished feature |

Record fields the parser reads, nothing else: `type`, `timestamp`, `requestId`, `agentId`, `gitBranch`, `toolUseResult` (presence only), `message.model`, `message.usage.{input_tokens, cache_creation_input_tokens, cache_creation.ephemeral_5m_input_tokens, cache_creation.ephemeral_1h_input_tokens, cache_read_input_tokens, output_tokens, output_tokens_details.thinking_tokens}`, `message.content[].type` and `.name` (tool name), `.input.subagent_type` (Agent) and `.input.to` (SendMessage); on `cost-state`: `totalCostUSD`, `modelUsage`, `totalAPIDuration`, `totalToolDuration`, `totalDuration`, `totalLinesAdded`, `totalLinesRemoved`, `hasUnknownModelCost`. Text, thinking and prompt content are never read into memory beyond `JSON.parse` of the line.

Record types seen in the main file (1,193 lines): `assistant` 287, `user` 179, `system` 107 (`turn_duration` 49, `stop_hook_summary` 55, `away_summary` 2, `local_command` 1), `cost-state` 1, `attachment` 237, `file-history-snapshot` 10, plus UI state (`ai-title`, `atis-latch`, `last-prompt`, `mode`, `queue-operation`). Subagent files hold only `assistant`, `user`, `attachment`.

## 2. Request and tokens

- D1 **Request** = the set of `assistant` records sharing one `requestId` (main: 287 records, 162 requests; every record has a `requestId`). Usage of a request = per field the **maximum** across its records. Measured: in the main file all records of a request carry identical usage; in subagent files the usage grows with the stream (opus output summed over first records 126,403, over last records 226,811). Summing every record overcounts (main cache read 52.2M instead of 29.9M).
- D2 **Tokens by kind** per request: `input` (uncached), `cacheWrite5m` and `cacheWrite1h` (`cache_creation.ephemeral_*`; their sum equals `cache_creation_input_tokens`), `cacheRead`, `output` (includes thinking; `output_tokens_details.thinking_tokens` is reported as a detail, not priced separately), `model` from `message.model`. `<synthetic>` records (2 in #7, zero usage) are skipped and counted under `skipped`. Measured 5m/1h split in #7: opus 3.52M / 0.65M, sonnet 1.21M / 0 (the prototype priced every write at the 1h rate).
- D3 **Context of a call** = `input + cacheRead + cacheWrite5m + cacheWrite1h`; per agent: average and peak. **Cache hit ratio** = Σ cacheRead / Σ context. Measured #7 (prototype figures): about 130K per call, 95% of token volume is cache read.
- D4 **Cost** = Σ over models and kinds of `tokens × price[model][kind] / 1e6`, prices from `scripts/lib/model-pricing.json` (`recordedAt`, `perMTok`). Seed values (prototype, not verified against the published price list; step 3 verifies): `claude-opus-5-5` input 4, cacheWrite5m 5, cacheWrite1h 8, cacheRead 0.20, output 20; `claude-sonnet-5` 2 / 2.5 / 4 / 0.20 / 10; `claude-haiku-4-5-20251001` from the price list. An unknown model gives `costUSD: null` for that model and a warning `unknown-model:<name>`, never a silent zero.

## 3. Time

- D5 **Timeline** of a scope (a session, a feature, or one agent) = the sorted timestamps of its `assistant` and `user` records; subagent records are merged into the session's timeline. Gap `g_i = t_{i+1} - t_i`. A gap is a **tool gap** when record `i` is an `assistant` record whose last content block is `tool_use` with a name other than `AskUserQuestion` (its result arrives when the user answers) and other than `Agent`/`SendMessage` (the subagent's own records fill that time on the merged timeline); every other gap is a **turn gap** (Claude finished, the user or a background agent is next).
- D6 **Active time** = Σ `min(g_i, cap_i)` with `cap = IDLE_MS` (5 min) for a turn gap and `cap = TOOL_MS` (10 min, the Bash tool's maximum `timeout`; the Stop gate allows 700 s) for a tool gap. Both constants live once in `scripts/lib/pipeline-metrics.mjs`, are overridable by CLI flags (`--idle`, `--tool`) and are printed in the card header. Idle while the user is away drops out by construction; a background agent working while the user is away counts through its own records. `system/turn_duration` is not used (one turn stayed open 17.7 h with a background agent, `pendingBackgroundAgentCount: 1`). Measured with a single 5-minute cap (prototype): main 162.3 active min of 5,103.6 wall min; step 3 reports the same session with both caps so the difference is known.
- D7 **Lead time** = `t_last - t_first` of the scope. **Waiting for the user** = lead − active (includes nights). Per feature, lead runs from the first record on the feature's branch (or its `/spec` prompt, see `data-flow.md` join rule) to the last.
- D8 **Agent-minutes** = Σ over the main thread and every agent of the active time computed on that thread's own records (D6 on the unmerged timeline). **Parallelism** = agent-minutes / active time of the merged timeline; ≥ 1 by construction. Cross-check per session: `cost-state.totalAPIDuration + totalToolDuration` (#7: 171.7 + 27.8 min) is a lower bound of the merged active time.

## 4. Attribution

- D9 **Agent** = the transcript file: main thread, or `agent-<id>` with `agentType` from `.meta.json` (live: `agent_type` from the hook input; `<id>` equals the `agent_id` of the MCP audit). **Launch** = an `Agent` tool_use in the main thread (`input.subagent_type`); **resume** = a `SendMessage` tool_use whose `input.to` is an agent id (#7: 11 launches, 23 resumes over 8 agents); **relaunch** = a further launch of an `agentType` already launched in the feature.
- D10 **Feature** = every record whose `gitBranch` is `feature/<name>`, across all sessions of the project directory, plus the records of a session between a `prompt` marker `{ command: 'spec' | 'feature', arg }` naming the feature (by kebab name or `#N`, resolved through `docs/features/<name>/` or the issues cache `.pipeline/issues.json`) and the next command marker. Measured: sessions span features (`0bb70a42` holds #5 and #6) and features span sessions (#6 in `0bb70a42` and `0f92618d`; `catalog-authorization` in `e9ead85a` and `29ece8c2`), so the join is per record, never per session. History before the event log: branch only; a `/spec` run on `main` before this feature is unattributed (stated in the card as `spec: not attributed`).
- D11 **Phase** = the value of the `- Phase:` line of `docs/STATE.md` at the moment the `/feature` orchestrator edits it (PostToolUse `phase` marker, `research/data-flow.md`): the first integer 0-7 in the value, else `none`. A record at time `t` belongs to the latest marker before `t` of the same feature; before the first marker: phase `0`. **Round** of a phase = number of markers with that phase number (a phase re-entered after a defect counts again). Fallback without markers (history): the **home phase** of the agent type: `architect`, `ux-designer` → 1; `cap-backend-dev`, `test-backend` → 2; `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` → 3; `ui-verifier` → 4; `reviewer` → 5; `docs-keeper` → 6; main thread → `orchestration`.
- D12 **Rework** (live) = a launch while the current phase marker differs from the agent type's home phase; (history) = a launch whose home phase is lower than the highest home phase launched so far in the feature. **Rework share** = cost of rework launches / feature cost. #7 by the history rule: architect (after fiori-app-dev), ux-designer, architect (after reviewer), ui-verifier (after docs-keeper): 4 of 11 launches, ≈19% of cost (prototype pricing; 22% with every cache write at the 1h rate).

## 5. Reconciliation against `cost-state` (the 12% gap)

`cost-state` exists once per closed session (`timestamp: null`, `hasUnknownModelCost: false` in #7; absent in an open session and in `0f92618d`). Per model it holds `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUSD`. Transcript sums (D1, whole session) against it:

| Model | input | cache write | cache read | output | note |
|---|---|---|---|---|---|
| opus-5-5 | 1,522 vs 289,089 (1%) | 4.17M vs 4.67M (89%) | 100.4M vs 133.3M (75%) | 226,811 vs 653,814 (35%) | `thinkingTokens` 226,569 equals the transcript output within 0.1% |
| sonnet-5 | 702 vs 117,186 (1%) | 1.21M vs 1.36M (88%) | 58.0M vs 69.9M (83%) | 82,047 vs 176,961 (46%) | `thinkingTokens` 68,136 |
| haiku-4-5 | absent vs 903 | | | 15 | no `assistant` record uses haiku: an auxiliary call (title generation) |

Dollar view (prototype pricing): $75.25 recovered of $85.73 (88%). Candidates step 3 tests, in this order, each with the kind and model it would explain:

- H1 Auxiliary API calls without an `assistant` record: main-thread records carry `advisorModel` and `serverClassifierRequest` fields; `ai-title` records exist; haiku appears only in `cost-state`. Would explain uncached `input` (1% recovered), part of cache read and output for both models.
- H2 Aborted or retried requests (`totalAPIDuration - totalAPIDurationWithoutRetries` = 175 s in #7) stream usage that Claude Code counts but never lands as a record.
- H3 Output semantics: Claude Code's `outputTokens` may add the running snapshot of every streamed chunk, or count thinking twice; the equality `thinkingTokens ≈ Σ max output` is the lead. Test: sum `output_tokens_details.thinking_tokens` (13,264 on first records) against both fields.
- H4 Cache write rate: the prototype priced all writes at the 1h rate; the measured 5m/1h split changes the dollar figure without changing the token gap.
- H5 Compaction summaries and the `<synthetic>` model: none and 2 records with zero usage in #7; expected to explain nothing.

Rule for v1 (ADR-0022): the parser reports per model and kind `transcript`, `costState`, `ratio`; a session whose recovered dollar ratio is below `RECONCILE_MIN = 0.95` prints a warning line, never fails. When `cost-state` exists, the card shows `unattributed = costState − Σ agents` as its own row so the total equals Claude Code's own figure; the per-agent and per-phase split stays proportional to what the transcript attributes.
