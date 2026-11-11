# context-hygiene: hook probe results (PLAN step 2)

Date: 2026-11-11. Author: `cap-backend-dev`. Read by steps 3-8 and by `reviewer`. Facts F1-F8 are those of `CONTEXT.md` "All: probe facts and fallbacks (step 2)". Script: `research/hook-probe.mjs`. Evidence lists record kinds, keys, sizes and the probe's own tokens only (privacy rule of `docs/metrics/definitions.md`).

## Verdict

Claude Code **2.1.322** (`version` of every transcript record of the four runs). `HOOK_OUTPUT_MAX` = **10,000** characters.

| # | Result | One line | Fallback to apply |
|---|---|---|---|
| F1 | confirmed | SubagentStart `additionalContext` reaches the agent before its first prompt as one `hook_additional_context` attachment; the agent quoted the token | none |
| F2 | confirmed | 9,500 and 10,000 arrive whole, 10,001 and 10,500 become a path plus a 2,000-character preview; the cap is per string, not per stdout | none (`HOOK_OUTPUT_MAX` = 10,000) |
| F3 | confirmed | PreToolUse `Read` in a subagent carries `agent_id`, `agent_type`, `tool_input.file_path`, and `offset`, `limit` only when given | none |
| F4 | confirmed | the deny reason reaches the agent as an error `tool_result`; the identical retry fires the hook again and passes | none |
| F5 | confirmed | SubagentStart fires again on a `SendMessage` resume with the same `agent_id`; on that resume no `additionalContext` is injected at all, not even a new string | none (see "Beyond the facts" 1) |
| F6 | confirmed, with a condition | a delivered exit-2 stderr of 12,000 characters arrives whole (Stop, SubagentStop before a report, a PreToolUse deny reason); a SubagentStop exit 2 issued after the agent's `SubagentHandback` reaches nobody (3 of 3 blocks, background and foreground launches) | relays need no stderr cap; the SubagentStop lint block needs a plan amendment, see "Open questions" 2 |
| F7 | confirmed | PreToolUse fires on `SendMessage`; `tool_input.to` is the bare agent id; the addressee path derives from `transcript_path`; a delivered report is an `assistant` record with a `tool_use` block named `SubagentHandback` | none |
| F8 | **failed** (auto mode) | after a `SubagentHandback`, SubagentStop input has no `last_assistant_message` key at all; the key exists only when the agent ends in plain text, and then holds that text | CONTEXT fallback: the orchestrator pastes the previous report's `## Files` and `## Open questions` into the rework message; a better source is measured, see "Open questions" |

## Setup

`node research/hook-probe.mjs build <dir> [variant]` writes a throwaway project outside the repository (the script refuses a path inside it): `.claude/settings.json` with the probe hooks, `.claude/agents/hook-probe.md` (tools `Read`, `model: inherit`, `maxTurns: 15`), `target.txt` (4 lines), and a copy of the script as the hook runtime (`node <dir>/hook-probe.mjs hook <mode>`). Every hook appends its full stdin JSON to `<dir>/logs/<mode>.jsonl`; those logs stay in the temp project. `run` calls `claude -p` with cwd = `<dir>` and an environment stripped of every `CLAUDE*` and `PIPELINE_*` variable (no nested-session or messaging socket); `analyze` prints keys, kinds, sizes and probe tokens. The repository's `.claude/settings.json` and `scripts/hooks/` were not touched; every hook mode was run once with test JSON before the first live run.

Registered hooks: SubagentStart (matcher `hook-probe`): `start-f1` (token), `start-size-9500`, `-10000`, `-10001`, `-10500` (sized strings with BEGIN, END and a `[@N]` marker every 1,000 characters), `start-f5` (a new token only on a repeated start of the same `agent_id`); PreToolUse `Read` (deny the first whole read per agent and file), `SendMessage` (derive the addressee path, read it), `SubagentHandback` (log `tool_input.message`); PostToolUse `SubagentHandback` (log); SubagentStop (matcher `hook-probe`: save `last_assistant_message`, read `agent_transcript_path`, exit 2 with 12,000 characters on the agent's first stop); Stop (exit 2 with 12,000 characters on the session's first stop).

Command (printed by `build`; the main prompt launches the probe agent, resumes it with `SendMessage` after its report, waits for the second report):

`claude -p '<main prompt>' --output-format json --model claude-haiku-5-5 --permission-mode auto --permission-prompts none --setting-sources project --strict-mcp-config --no-chrome --max-turns 12 --max-budget-usd 3 --session-id <uuid>` (variant `manual`: `--permission-mode dontAsk --allowedTools Read,Agent,SendMessage` instead of `auto`).

| Run | Variant | Session | Launch | Result |
|---|---|---|---|---|
| 1 | `handback` (auto mode, report through `SubagentHandback`) | `7b71eb2d` | background (`async_launched`, meta `requestShape: background`) | success, 35.4 s, $0.0081 |
| 2 | `plain-first` (auto mode; the agent's first turn ends in plain text before any report) | `db5f7e8f` | foreground (`status: completed`) | success, 30.7 s, $0.0064 |
| 3 | `manual` (dontAsk mode: no `SubagentHandback` tool) | `12cb7c22` | foreground | success, 40.4 s, $0.0080 |
| 4 | `handback-gate` (auto mode; first `SubagentHandback` denied with a 12,000-character reason; every SubagentStop after a report exits 2, at most twice) | `1f96505a` | foreground (`status: completed`) | success, 49.8 s, $0.0097 |

The launch mode was the model's choice in each run (the prompt asked for the foreground); this project sets neither `CLAUDE_CODE_FORK_SUBAGENT` nor `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`, so pipeline launches can take either shape.

## Evidence per fact

### F1 SubagentStart `additionalContext`: confirmed

- Agent transcript (run 1, line 6): `type: attachment`, `attachment.type: hook_additional_context`, `attachment.hookEvent: SubagentStart`, `attachment.hookName: SubagentStart`; attachment keys `type, content, hookName, toolUseID, hookEvent`; record keys add `rendered` (one `{content}` of 24,308 characters) and `renderedRole: system`. Written at 23:45:21.161, before the first `api-request` of the agent.
- `attachment.content` is an array with one string per hook that returned a value (5 strings: 2,352; 23; 9,500; 10,000; 2,353). The order follows hook completion, not registration (the 10,001 hook finished first and is `content[0]`), so a reader must not rely on the position.
- The F1 string `PROBE-F1-TOKEN-25CB8D5C` (23 characters) is `content[1]`; the agent quoted it in its report (`SubagentHandback` `input.message`, 1,929 characters). Runs 2-4 repeat the shape.
- Next to it, each hook command leaves an `attachment.type: hook_success` record (keys `type, hookName, toolUseID, hookEvent, content, stdout, stderr, exitCode, command, durationMs`) whose `stdout` holds the raw JSON output whole (10,080 characters for the 10,001 hook, `exitCode: 0`). That copy is not model context: the step 7 parser counts `hook_additional_context` and ignores `hook_success.stdout`.

### F2 output cap: confirmed, `HOOK_OUTPUT_MAX` = 10,000

| Probed string | In `attachment.content` | BEGIN / END | Last `[@N]` | Saved file |
|---|---|---|---|---|
| 9,500 | 9,500 characters | both | `[@9000]` | none |
| 10,000 | 10,000 characters | both | `[@9000]` | none |
| 10,001 | 2,352 characters | BEGIN only | `[@1000]` | `<session>/tool-results/hook-<uuid>-SubagentStart-<id>-1-additionalContext.txt`, 10,001 characters, whole |
| 10,500 | 2,353 characters | BEGIN only | `[@1000]` | `...-6-additionalContext.txt`, 10,500 characters, whole |

The 10,000 hook printed 10,079 characters of JSON on stdout and arrived whole, so the cap applies to the `additionalContext` field, not to stdout. The replacement is the file path plus a preview of the first 2,000 characters, as documented; the model is not asked to read the file.

### F3 PreToolUse `Read` input in a subagent: confirmed

- Keys (run 1, three calls): `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort{level}, hook_event_name, tool_name, tool_input, tool_use_id`.
- Whole read: `tool_input` = `{file_path}` only; `offset` and `limit` are absent, not null. Partial read: `{file_path, offset, limit}`, both numbers.
- `agent_id` is the bare id (`a8b6ea5ece7ceba65`, the name of `subagents/agent-<id>.jsonl`), `agent_type` is `hook-probe`. `session_id` and `transcript_path` are the main session's, not the agent's: the read ledger keys on `agent_id`, never on `transcript_path`.

### F4 deny on `Read` and the retry: confirmed

- First whole read denied: agent transcript `user` record with a `tool_result` block `is_error: true`, content 132 characters carrying `PROBE-F4-DENY-25CB8D5C`; record keys `toolDenialKind: permission-rule` and `permissionDecision: {decision: reject, source: hook, reasonType: hook, reasonCode: hook:PreToolUse}`; `toolUseResult` a string of 139 characters.
- The identical retry fired the hook again (`pre-read.jsonl` holds 3 inputs: deny, pass whole, pass partial) and returned the file (`tool_result` 90 characters, `permissionDecision.decision: accept`). The agent quoted the reason and the retry's first line in its report. Same in runs 2-4. The `additionalContext` fallback is not needed.
- Side effect for step 7: a hook deny is countable in the transcript by `permissionDecision.source: hook` with `reasonCode: hook:PreToolUse`.

### F5 SubagentStart on a resume: confirmed

- Each of the six SubagentStart hooks logged two inputs with the same `agent_id` `a8b6ea5ece7ceba65`: at launch (23:45:21) and at the `SendMessage` resume (23:45:45). Input keys both times: `session_id, transcript_path, cwd, prompt_id, agent_id, agent_type, hook_event_name`.
- The resume delivery in the agent transcript is a `user` record with `origin.kind: coordinator` and `isMeta: true` (194 characters).
- On the resume Claude Code wrote six `hook_success` records (lines 47-52, the new `PROBE-F5-RESUME-25CB8D5C` among the stdouts) and re-saved the two oversize strings under `tool-results/`, but wrote no `hook_additional_context` record; the resumed agent listed the F1 and F2 tokens and not the F5 one. In 2.1.322 a resumed agent gets no SubagentStart context, new or repeated (the documentation says only an already present copy is skipped). Runs 2 and 3 repeat this.

### F6 exit-2 stderr above 10,000 characters: confirmed, with a condition

| Run | Event | When | Delivered | Size in the transcript | END marker | Model's reply |
|---|---|---|---|---|---|---|
| 1 | Stop | main thread's first stop | `user` record, `isMeta: true` | 12,115 (12,000 plus a 115-character wrapper); `system/stop_hook_summary.hookErrors[0]` 12,095, `preventedContinuation: false`, `level: suggestion` | visible | `PROBE-F6-STOP-SEEN`, `[@11000]` |
| 3 | Stop | main thread's first stop | same shape | 12,122; `hookErrors[0]` 12,102 | visible | same |
| 2 | SubagentStop | agent's first stop, plain-text end, no report yet | agent transcript `user` record | 12,136 | visible | `PROBE-F6-SUBAGENTSTOP-SEEN`, `[@11000]` |
| 3 | SubagentStop | agent's first stop, report as plain text (no handback tool) | same | 12,131 | visible | same |
| 1 | SubagentStop | agent's first stop, 0.25 s after its `SubagentHandback` (PostToolUse 23:45:40.688, SubagentStop 23:45:40.940), background launch | **nowhere** | 0 occurrences of `F6-SUBAGENTSTOP` in the main and the agent transcript; the agent did not continue (its next record is the resume at 23:45:44.874) | | |
| 4 | SubagentStop | agent's stop 0.07 s after its first delivered report (2,022 characters; PostToolUse 23:52:43.869, SubagentStop 23:52:43.936, `decision: block`, `afterHandback: true`), foreground launch | **nowhere** | 0 occurrences of `F6-SUBAGENTSTOP` in both transcripts; the main thread went on to `SendMessage` at 23:52:47 | | |
| 4 | SubagentStop | stop after the resumed run's report (304 characters; SubagentStop 23:52:54.933, second `block`) | **nowhere** | 0 occurrences; `stop_hook_active: false` at both stops | | |
| 4 | PreToolUse deny on `SubagentHandback` | agent's first report (2,022 characters) | agent transcript `user` record, `tool_result` | 12,040 (`toolUseResult` 12,047) | visible | `PROBE-F6-HANDBACK-SEEN`, `[@11000]`; then the agent called `SubagentHandback` again with the same 2,022-character message, which passed and was delivered |

A delivered exit-2 stderr or deny reason is neither cut nor saved to a file at 12,000 characters: the 10,000 cap does not apply to stderr or `permissionDecisionReason`, so the relays of step 6 need no stderr variant of `HOOK_OUTPUT_MAX` (the CONTEXT fallback is not needed). The condition: a SubagentStop exit 2 after a delivered report was dropped in all three cases (run 1 background, run 4 foreground twice), while the same block before any report (runs 2, 3) was delivered. The run 4 deny path shows where a gate still reaches an auto-mode agent: a PreToolUse deny on `SubagentHandback`, whose reason arrives whole and makes the agent fix and report again. See "Open questions" 2.

### F7 PreToolUse on `SendMessage`: confirmed

- Fires in the main thread (input has no `agent_id` or `agent_type`). Input keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort{level}, hook_event_name, tool_name, tool_input, tool_use_id`.
- `tool_input` keys: `to, summary, message, type, recipient, recipient_kind, content`; values `to` = `recipient` = the bare agent id `a8b6ea5ece7ceba65` (no `agent-` prefix), `type: message`, `recipient_kind: agent`.
- Path derivation, verified to exist at hook time in runs 1-3: `transcript_path` (`~/.claude/projects/<slug>/<session_id>.jsonl`) without `.jsonl`, plus `/subagents/agent-<to>.jsonl`, with a leading `agent-` stripped from `to`. A `to` that is a name does not map to a file (`agent-<id>.meta.json` keys: `agentType, isBuiltIn, launchedWithDefaults, description, toolUseId, spawnDepth, requestShape, requestNonInteractive, pickedEffortModel, finished`; no `name` key without agent teams), so a name is an unknown addressee and passes, as the plan says.
- Record kind of a delivered report in the addressee's transcript: a `type: assistant` record whose `message.content` holds a `tool_use` block with `name: SubagentHandback` and `input.message` (run 1 line 44, 1,929 characters, sha-256 prefix `7246047ca0779cd0`, equal to the PreToolUse `SubagentHandback` `tool_input.message`), followed by a `user` record with its `tool_result` (94 characters). The same `tool_use` block reappears inside later `api-request-blob` records (the request history of the resumed run, line 53), so the gate counts `type: assistant` records only.
- In the parent's transcript the report arrives as a `user` record with `origin.kind: peer`, `origin.handback: true`, `origin.handbackReportText` (equal hash), `origin.from` (agent id), `origin.name` (agent type) for a background launch (run 1), and as the Agent tool's `toolUseResult.handbackReport.text` with `toolUseResult.handback` for a foreground launch (run 2). The `SendMessage` result carries `success, message, resumedAgentId, revivedAgentId, pin`.

### F8 SubagentStop `last_assistant_message`: failed in auto mode

| Run | Stop | `last_assistant_message` | Equals the report |
|---|---|---|---|
| 1 | after the first `SubagentHandback` (1,929 characters) | key absent | no file written |
| 1 | after the second `SubagentHandback` (533) | key absent | no file written |
| 2 | plain-text first turn | 17 characters (`PROBE-PLAIN-FIRST`) | no |
| 2 | after the block reply | 47 characters (the `SEEN` line); saved file = that line | no (the report, 598 characters, came later through `SubagentHandback`) |
| 2 | after the `SubagentHandback` | key absent | |
| 3 | report as plain text (no handback tool) | 1,947 characters, equal to the agent's final `assistant` text | yes |
| 3 | after the block reply | 160 characters (the `SEEN` line) overwrote the saved report | no |

In auto mode, which the pipeline uses (agents report through `SubagentHandback`, protocol section 8), the saved file cannot equal the report. The report is available whole elsewhere:
- PreToolUse and PostToolUse on `SubagentHandback`: input keys `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort, hook_event_name, tool_name, tool_input{message}, tool_use_id`, PostToolUse also `tool_response{success, message}` and `duration_ms`; `tool_input.message` 1,929 and 533 characters with the transcript's hashes.
- At SubagentStop time `agent_transcript_path` already holds the `assistant` `tool_use:SubagentHandback` record with the equal hash (run 1 both stops, run 2 third stop), so the flush lag of the final message does not hide it.

## Beyond the facts

1. A resume gets no fresh SubagentStart context (F5), so a brief cannot reach a resumed agent; this supports ADR-0031 decision 7 (rework by fresh launch) and makes the "Hook silence" resume dedupe a cost saving only (no double injection happens either way).
2. Run 3: when SubagentStop blocks an agent that ended with its report as plain text, the parent receives the agent's reply to the block (906 characters with the `SEEN` line) as the Agent result, not the report.
3. The transcript format of 2.1.322 adds kinds next to those of #28: in the main session `session-owner`, `queue-operation`, `atis-latch`, `last-prompt`, `tools-used`, `cost-state`, `api-request`, `api-request-shape`, `api-request-blob`, attachments `budget_usd`, `total_tokens_reminder`, `prompt_snapshot`, `deferred_tools_delta`, `agent_listing_delta`; in the agent transcript `hook_success`, `hook_additional_context`, `prompt_snapshot`, `api-request*`. `api-request-blob` repeats message content, so a parser that does not skip it counts tool results twice (the plan's "ignores `api-request*` records" holds).

## Open questions

Plan amendments for the user and `architect`; PLAN.md and CONTEXT.md are unchanged by this step. Steps 3-8 wait for these decisions. The plan's own rule: a failed fact stops the phase until the fallback is applied.

Decided 2026-11-11: Q8 (question 1, option a) and Q9 (question 2, the checks move into #44), see PLAN.md "Open questions".

1. **F8 failed: where the saved report comes from (criterion "Report on disk", step 6, ADR-0031 decision 7 level 2).** "SubagentStop writes `last_assistant_message` whole" cannot be met in auto mode: the key is absent after a `SubagentHandback`. Options:
   - (a) Proposed: a PostToolUse hook on `SubagentHandback` writes `tool_input.message` to `.pipeline/logs/report-<agent_type>-<agent_id>.md`. The message is whole, equal to the delivered report, and `agent_id` and `agent_type` are in the input. It fires once per delivery, so a resume overwrites the file with the latest report. This needs a new matcher `SubagentHandback` in `.claude/settings.json` (step 5's registration, protected) and a new or extended hook script. In a non-auto session (no handback tool) SubagentStop keeps writing `last_assistant_message`, which run 3 shows is the report there.
   - (b) SubagentStop reads the last `type: assistant` `tool_use:SubagentHandback` `input.message` from `agent_transcript_path`, through `scripts/lib/transcript-usage.mjs` (no second transcript reader). The record is present at stop time (runs 1, 2, 4). Same matcher set as today, but it adds a transcript parse to every stop, and SubagentStop also fires for internal agents (empty `agent_type`).
   - (c) The CONTEXT fallback: the orchestrator pastes the previous report's `## Files` and `## Open questions` into the rework message. No hook change, but it moves text through the orchestrator's context, which decision 7 tries to avoid.
   Criterion wording for (a): "PostToolUse on `SubagentHandback` writes `tool_input.message` whole to `.pipeline/logs/report-<agent_type>-<agent_id>.md`, and SubagentStop writes `last_assistant_message` when the input has it". Step 9's test fixture then needs a `SubagentHandback` PostToolUse input.
2. **F6 run 1/4: the SubagentStop lint block reaches no auto-mode agent after its report (criterion "Relay", step 6; also today's `subagent-stop.mjs` lint and MCP gates, ADR-0014, ADR-0016).** In 2.1.322, a pipeline agent reports through `SubagentHandback` and then stops. Its SubagentStop exit 2 is then dropped: not shown to the agent, not shown to the parent, no transcript trace (3 of 3). The lint and MCP gates of `scripts/hooks/subagent-stop.mjs` therefore block nothing in auto mode today. Only the hook's own records (for example the `gate` record) remain. The relay rewrite of step 6 would format a message nobody reads. Proposed: move the blocking checks to PreToolUse on `SubagentHandback`. Run 4 measured that a `deny` there delivers its reason whole (12,040 characters) and the agent fixes and calls `SubagentHandback` again. Claude Code retries up to three times (documented), so the gate must allow on the fourth attempt or after the existing once-per-agent rule. SubagentStop keeps the checks for non-auto sessions and the plain-text end. This touches `.claude/settings.json`, `scripts/hooks/subagent-stop.mjs` (or a new `handback-gate.mjs`), ADR-0031 decision 4 and ADR-0016. It is a pipeline-wide change beyond #44's scope, so the user should decide whether it enters this feature or becomes a backlog issue. The "Relay" criterion would then name the `SubagentHandback` deny reason instead of "the SubagentStop lint block".
3. **F5 side finding (criterion "Hook silence", step 5).** A resume gets no SubagentStart `additionalContext` at all, so the "brief hash equals" branch only saves the brief file write. No amendment is needed. The brief header check in "Risks" should not count on a resumed agent seeing a new phase's brief.
4. **F7 detail for step 5 and step 7.** The resume gate and the "resumes after a report" figure look for `type: assistant` records with a `tool_use` block `name: SubagentHandback`. They must skip `api-request-blob`, which repeats the block in a resumed run's request history. They strip a leading `agent-` from `to`, and they treat a `to` without a `subagents/agent-<to>.jsonl` file as an unknown addressee. A resume delivery in the addressee transcript is `type: user`, `origin.kind: coordinator`, `isMeta: true`, as the plan assumes. D18 in step 7 can name these kinds.
