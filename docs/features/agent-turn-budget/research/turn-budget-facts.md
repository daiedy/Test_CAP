# agent-turn-budget: measurements and framework facts

Date: 2026-11-13. Author: `architect`. Claude Code 2.1.322, Node v22.23.2. Read by `architect` and `reviewer`, and by the steps of PLAN.md that name this file. Script: `research/turn-count.mjs` (counts and kinds only, no text). Transcripts are pruned after 30 days, so the figures are written here on the day they were measured.

## 1. A turn is one request, and the limit applies per run

`node docs/features/agent-turn-budget/research/turn-count.mjs <session dir>` over the #10 session `fe975b7e` (25 launches) and seven other sessions with subagents. A run starts at the launch or at a `user` record with `origin.kind: coordinator` (a `SendMessage` resume, `RESUME_ORIGIN` of `transcript-usage.mjs`).

| Launch (#10, `fe975b7e`) | Type | `maxTurns` then | Requests (distinct `requestId` of `assistant` records) | Tool uses | Report |
|---|---|---|---|---|---|
| `aed176718d3be724e` | `ui-verifier` | 80 | 80 | 115 | none |
| `af2d76eafa2d32002` | `ui-verifier` | 80 | 80 | 144 | none |
| `af51750d9be545852` | `ui-verifier` | 80 | 80 | 136 | none |
| `ac37316c6b008c146` | `fiori-app-dev` | 60 | 60 | 101 | none |
| `ab645ac3430d2bed3` | `reviewer` | 50 | 50 | 55 | none |
| the other 20 launches | | | 3-74 | | delivered |

- F-A. The 5 stopped launches hold exactly `maxTurns` requests (5 of 5); every launch below its limit delivered a report (20 of 20). The main transcript names each stop in a `task-notification` record: `Agent "<description>" stopped at its <M>-turn limit (partial result; SendMessage to task-id to continue)` (5 of 5, with the `maxTurns` in force then, 50 and 60 for the two types raised since).
- F-B. The limit is per run. Resumed agents in other sessions: `ui-verifier` runs `[80, 80, 37]`, `[80, 80, 13]`, `[80, 80, 52, 80, 76, 43, 3, 36, 37, 20]` (`eecd975d`); `test-ui` `[80, 29]`; `cap-backend-dev` `[60, 40]` (`ef481b20`). A resume after a limit stop gets a fresh `maxTurns`, so the count restarts at the last `coordinator` record.
- F-C. Wrap-up cost: a run resumed only to finish and hand back after a limit stop took 4-10 turns, median 6, 80th percentile 8 (14 runs: `cap-backend-dev` 6, 10, 4, 8, 8; `reviewer` 6, 4, 6, 5; `architect` 8; `ux-designer` 4; `test-backend` 5; `fiori-app-dev` 8, 6). Runs that continued the work (`test-ui` 29, `cap-backend-dev` 40, `test-backend` 26) are not wrap-ups and are left out.
- F-D. Tool uses per turn: 1.4-1.8 in the stopped verifier launches (115-144 for 80 turns); a turn with parallel calls fires PostToolUse once per call.
- F-E. The `[handback-send-enforce]` nudge of a denied `SubagentHandback` (#44 F9, probe transcript `cb896791`, 3 records) is a `user` record with `isMeta: true` and no `origin`, so it does not start a run.

## 2. Cost of one hook call

| Measure | Value |
|---|---|
| `node -e 0` (wall, `/usr/bin/time`, 3 runs) | 0.18-0.19 s |
| `node` importing `hook-utils.mjs` and `transcript-usage.mjs` | 0.20-0.25 s |
| `readTranscript()` + `requests()` of a whole file, 1.36 MB (`aed17671`, 80 requests) | 24.2 ms |
| same, 2.19 MB (`af51750d`, 80 requests) | 30.5 ms |
| same, 11.09 MB (`a7461c99`, `test-ui`, 74 requests, the largest #10 file) | 103.0 ms |
| tail read of the last 256 KB with a regex, same three files | 1.1-1.6 ms (6-22 ids, not the run's count) |
| regex over the whole file, same three files | 7.8-44.3 ms (equal counts) |

- F-F. The node start dominates: at most 0.35 s per call with the whole parse on the largest file, 0.2 s on the main thread when the hook exits before importing the transcript library. Per turn (PostToolBatch, section 3) a full `ui-verifier` run of 80 turns pays about 80 x 0.25 s = 20 s; per tool call (PostToolUse) 115-144 calls, about 36 s, and parallel calls start parallel processes.
- F-G. A tail read saves at most 0.1 s against a 0.18 s start and needs a persisted cursor plus a search for the run boundary; the regex reader bypasses `transcript-usage.mjs`, the only transcript reader (PATTERNS "Pipeline metric").

## 3. Claude Code facts (documentation fetched 2026-11-13; the probe settles what is marked "probe")

- F-H. `PostToolBatch`: "Runs once after every tool call in a batch has resolved, before Claude Code sends the next request to the model"; no matcher, fires on every occurrence; input `tool_calls[]`; `hookSpecificOutput.additionalContext` is "injected once before the next model call" (code.claude.com/docs/en/hooks.md, PostToolBatch). Not named in the Claude Code CHANGELOG, so its presence in 2.1.322 and inside a subagent is probe P1.
- F-I. `PostToolUse` and `PostToolUseFailure` `additionalContext` arrive "next to the tool result"; MCP tools "appear as regular tools in tool events"; a hook inside a subagent carries `agent_id` and `agent_type` (hooks.md, "Hooks in subagents", "Add context for Claude"). The #44 probe (F1-F9) never returned context after an MCP tool, and no project hook does (`mcp-audit.mjs` prints nothing): probe P2.
- F-J. `transcript_path` "is written asynchronously and may lag the in-memory conversation, so it may not yet include the current turn's most recent messages when a hook fires" (common input fields). The count at hook time may be one short: probe P4. #44 F8 found the `assistant` `tool_use` record already on disk at SubagentStop.
- F-K. "When the subagent reaches the limit, Claude Code returns its output marked as partial, and Claude can resume it" (sub-agents.md, `maxTurns`; partial marking since 2.1.246). Whether a `SubagentHandback` issued in the last allowed turn is delivered is probe P6.
- F-L. A hook inside a subagent gets the main session's `transcript_path`; the agent file is `<transcript_path without .jsonl>/subagents/agent-<agent_id>.jsonl` (#44 F3, F7; `resume-gate.mjs`).
- F-M. Subagent frontmatter accepts `hooks` scoped to that agent (sub-agents.md "Hooks in subagent frontmatter"); rejected in the ADR draft (eleven copies of one hook).

## 4. Answers to the five plan-gate questions of #60

1. Threshold: a share with a floor, reserve `R = max(6, ceil(M / 10))`, warnings from turn `M - R`: 30 → 24, 60 → 54, 70 → 63, 80 → 72. The floor is the measured median wrap-up (F-C, 6); the share gives 8 at 80, the measured 80th percentile. A fixed margin of 8 takes 27% of a 30-turn `ux-designer`; a per-role figure is a second tuning place next to `maxTurns` with no data that roles differ.
2. Frequency: every turn from the threshold, the text sharpening at the last two turns. The delegation deadline was ignored 2 of 2 times (#10); one notice in a long context is the same kind of text. Cost: at most 8 notes of about 300 characters per run, against 3,711.2K characters of tool results in the 25 launches of #10.
3. Cost: one hook per turn on PostToolBatch (F-H), whole-file parse through `transcript-usage.mjs` (F-F, F-G); the main thread exits before the import. Fallback when P1 fails: PostToolUse and PostToolUseFailure on every tool, one warning per turn kept by an exclusive-create marker file per agent and turn.
4. MCP: documented (F-I), never observed in this project: probe P2 before phase 2 (`research/hook-probe.md`).
5. #59: separate, as the issue already records (#59 blocked by #58 and #60). This feature delivers the per-launch fields #59 needs (D19 in `docs/metrics/definitions.md`, `turnLimitStops` and `turnWarnings` in the history line); #59 owns the briefing, the `retro` record and the retro skill, which overlap #58, so a merge would make #60 wait for #58.
