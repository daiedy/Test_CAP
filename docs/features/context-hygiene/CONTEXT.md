# Context hygiene: context

Date: 2026-11-09, amended 2026-11-10 and 2026-11-11 (probe gate, Q8 and Q9; brief ceilings after step 4, Q10). Author: `architect`. Branch: `feature/context-hygiene`. Issue #44 (P1). Decisions: ADR-0031 and the ADR-0018 amendment, accepted by the user on 2026-11-10; ADR-0031 decision 7 level 2 and decision 8 amended 2026-11-11 with notes on ADR-0014 and ADR-0016; step 12 wrote the accepted form of their Status lines (2026-11-11).

This file is the brief for the implementers (ADR-0018). Per-launch tables, the scratch scripts and the rejected mechanisms are in `research/context-measurements.md`, read by `architect` and `reviewer` unless a step names it. The subsections already carry the reader prefix of ADR-0031 decision 1 (`All`, `Backend`); this feature has no UI role.

## Request

Keep the context window of every pipeline agent free of stale and duplicated material so that its reasoning stays on the task, with fewer hallucinations; saving tokens is a side benefit, not the goal. Three parts, all without cutting information: (1) tool output is short at the source, the full log is on disk with its path, never a character or line cap; (2) a hook against repeated reads of an unchanged file; (3) PLAN.md and CONTEXT.md get role-specific sections and a hook hands each agent its own slice at start instead of the whole files. A per-agent context card in `scripts/metrics.mjs` measures the effect, before and after on `/feature #10`.

## User decisions

- From the issue: nothing is cut by a character or line cap ("a cap silently drops what matters and causes glitches"); the writer decides the short form and prints the path of the whole.
- From the issue: sections per agent in the plan and the context, and hooks that hand an agent its section.
- Standing (ADR-0018, 2026-09-24): cut by section or file, the budget on the writer, a visible cap, numbers from a measurement pinned as a ratchet.
- Standing (#10 plan gate, 2026-10-14): prevent before validate; a control that makes the mistake impossible comes before a message.

Plan approved on 2026-11-10 (the recommended option for Q1-Q5, Q6 and Q7 as asked, two amendments and an extension of the same day):
- Q1 Read gate strength: deny once per agent, file and content hash; the retry passes.
- Q2 SCREENS.md enters the brief's reading list by the template's section names, no markers.
- Q3 Part 1 is relays and report wording only, no runner `scripts/check.mjs`.
- Q4 `autoCompactWindow` stays out of scope; the user decides again after `/feature #10` with the context card in hand.
- Q5 Shell prints stay; the card shows the figure.
- Q6 The #10 documents are re-marked in step 4 without re-approval. Consequence: D12 (`docs/metrics/definitions.md`) reads the plan from the first approved commit, so #10 stays on the home-phase fallback either way; #44 is unaffected because its markers come before its approval commit.
- Q7 ADR-0031 and the ADR-0018 amendment are accepted as proposed; step 12 flips both Status lines.
- Amendment 1, compaction counter: the context card also shows per launch the number of compactions, next to the peak (ADR-0031 decision 5, PLAN criterion "Context figures"; the record kind is measured on #28 in step 7 and named in `docs/metrics/definitions.md` D18).
- Amendment 2, rework by fresh launch (ADR-0031 decision 7): a rework launch is by default a new agent of the owning type with the brief from the SubagentStart hook, the orchestrator's defect list and the path of the previous report; a resume via `SendMessage` only when the agent stopped mid-step and its deliverable on disk is behind its progress; also for `/spec` (amendments after the plan gate go to a fresh `architect` with the file list and the exact edits). The card shows launches, resumes and compactions separately. Reason: a resumed agent carries every stale tool result of its first run (the architect of this specification was resumed at about 380K tokens for a small edit); the deliverable is on disk by protocol step 10; six narrow `docs-keeper` launches peaked at 43-122K against 280K for one long launch.
- Extension of amendment 2, enforcement levels 3 and 4: a PreToolUse hook on `SendMessage` (`scripts/hooks/resume-gate.mjs`, step 5) denies a resume of an agent whose transcript already holds a `SubagentHandback` record and names the replacement; an agent stopped at its turn limit without a report, an unreadable transcript and an unknown addressee pass; each deny writes a `gate` record `resume`, no deny-once. The card lists per feature the resumes after a report with the context size at the resume, and `test/context-budget.json` pins the count at zero.

Probe gate on 2026-11-11 (`research/hook-probe-results.md` "Open questions" 1 and 2):
- Q8 Report source (F8 failed in auto mode): a PostToolUse hook on `SubagentHandback` writes `tool_input.message` whole to `.pipeline/logs/report-<agent_type>-<agent_id>.md`; SubagentStop keeps writing `last_assistant_message` when its input has that key (a plain-text end, a non-auto session). New matcher in `.claude/settings.json` (protected, allowed in this session).
- Q9 Blocking checks before the handback (F6 condition): a SubagentStop exit 2 after a `SubagentHandback` reaches nobody, so the blocking checks of `subagent-stop.mjs` move into #44: they run on PreToolUse `SubagentHandback` and deny with the whole reason, a check about the report reads `tool_input.message`, and the attempt after the platform's retry limit passes with a `gate` record. SubagentStop keeps its records and stays the gate for a plain-text end. ADR-0031 decision 8; ADR-0014 and ADR-0016 change in mechanism (the hook event), not in rule.

After step 4 on 2026-11-11:
- Q10 Brief ceilings: the ceiling of a role group in `test/context-budget.json` is the per-group maximum over the migrated folders `products-validations` and `context-hygiene` (step 4: backend 55,677 bytes from #44 `cap-backend-dev` 2, ui 46,085 from #10 `fiori-app-dev` 3, verifier 8,931 from #10 `ui-verifier` 4, docs 17,531 from #10 `docs-keeper` 6), and `feature-brief.mjs --record` merges by maximum, never lowering a group's ceiling; a lower ceiling is a retro decision with a CHANGELOG line (ADR-0018 principle 4). Reason: #44's own backend brief is above #10's, and a last-writer record would lower the docs ceiling below #10.

## Affected entities and services

No CDS entity, service, handler or UI artifact changes; `mcp__cds-mcp__search_model` has nothing to answer here. The objects are pipeline files.

### All: measured facts (2026-11-09)

Session `5fcef594` is the `/feature` run of #28 (`business-rules-wiki`): 21 subagent launches, Claude Code 2.1.310. Scripts are in `research/`; each prints sizes, names and paths only.

| Figure | Value | Source |
|---|---|---|
| Startup and peak per launch | startup 21.5K-32.1K tokens; peak 43.1K-280.6K tokens; delegation message 2.1K-5.0K characters, median 3.9K | `measure-transcripts.mjs` |
| What a context consists of, by characters | tool results 42%, thinking 25%, Bash inputs 6%, instructions 6%, user messages 5%, MCP instructions 3% | `measure-context-composition.mjs` |
| Tool results | 2,597.4K characters: Bash 1,700.9K in 474 calls, Read 825.5K in 70 calls, every other tool together under 70K | `measure-transcripts.mjs` |
| Bash by program | `sed` 419.6K, `cat` 380.5K, `grep` 288.1K, loops 132.5K, `awk` 76.8K, `git diff` 63.2K, `ls` 47.3K; shell prints and searches together 1,387.9K, 53% of all tool results | `measure-transcripts.mjs` |
| Check commands | vitest, eslint, prettier, `format:check`, `lint:js`, `check-docs-fresh`, `node --check`, `wiki.mjs`: 87.6K, 3.4% of all tool results | `measure-transcripts.mjs` |
| Feature documents | `PLAN.md` 181.9K to 7 agents, `CONTEXT.md` 67.8K to 4, the feature's ADR-0030 152.6K in 13 deliveries to 10 agents; `docs/features/**` plus that ADR are 19.5% of all tool results | `measure-top-files.mjs` |
| Repeat deliveries of a file to one agent | by any route at most 197.3K (7.6%): Bash prints 139.3K, Read 58.0K; whole-file Read repeats without an own edit in between: 0 of 70 | `measure-file-deliveries.mjs`, `measure-transcripts.mjs` |
| Read does not dedupe | two whole reads of an unchanged 622-byte file in one subagent returned the content twice (Claude Code 2.1.316) | this spec session |
| Check output today | green `npm test` 739 bytes in 19 lines, 6 of them a repeated Node `ExperimentalWarning` (about 510 bytes); a red run with two failures, one a 20-line drift in an 88K string: 3,254 bytes; `npm run lint` 285, `format:check` 204, `check-docs-fresh` 24, `wiki.mjs audit` 18 bytes | commands run 2026-11-09, temp project for the red run |
| Size of feature documents | nine features since ADR-0018: PLAN.md 18.6K-41.5K bytes (median 27.4K), CONTEXT.md 8.3K-36.5K (median 14.8K), SCREENS.md 23.2K-92.6K (five features) | git history at each prune commit |
| #10 documents | PLAN.md 31,623 bytes (criteria 15,099, steps 8,745), CONTEXT.md 36,532 ("Affected" 21,769), SCREENS.md 92,580 | `measure-docs.mjs` |
| Briefs, measured at step 4 (2026-11-11, migrated documents before the Q10 amendment) | #10: `cap-backend-dev` 2 47,508; `test-backend` 2 46,514; `fiori-app-dev` 3 46,085; `test-ui` 3 44,922; `ui-verifier` 4 8,931; `docs-keeper` 6 17,531 bytes. #44: `cap-backend-dev` 2 55,677; `test-backend` 2 48,973; `test-backend` 4 39,429; `docs-keeper` 6 14,744 bytes. Every brief above `HOOK_OUTPUT_MAX` (10,000) is handed by path; only the #10 `ui-verifier` brief goes whole | `node scripts/feature-brief.mjs <name> --all` |
| Phase column | `planAssignments()` returns null for the #10 plan and for `templates/feature/PLAN.md`: a Phase cell without the phase number, so plan-aware rework falls back to the home-phase rule | one-off call of `scripts/lib/pipeline-metrics.mjs` |
| Hook context in this project's transcripts | `additionalContext` reached subagents from PostToolUse (228 Edit, 45 Write) and PreToolUse Write (2); SessionStart up to 5,353 characters; none from SubagentStart yet; PostToolUse input carries `agent_id` and `agent_type` in a subagent | `probe-hook-context-history.mjs`, `.pipeline/mcp-audit-5fcef594*.jsonl` |

### All: probe facts and fallbacks (step 2)

Documented behaviour is from `code.claude.com/docs/en/hooks.md` and `sub-agents.md`, checked against Claude Code 2.1.316 on 2026-11-09. Step 2 proves each fact in a temp project outside the repository before a file of steps 3-8 depends on it. The run of 2026-11-11 (Claude Code 2.1.322) is in the last column; its evidence is in `research/hook-probe-results.md`.

| # | Fact the design depends on | Evidence the probe records | Fallback when it fails | Result 2026-11-11 |
|---|---|---|---|---|
| F1 | SubagentStart `additionalContext` is injected into the subagent before its first prompt (documented, never used here) | a `hook_additional_context` record with `hookEvent: SubagentStart` in the agent transcript, and the agent quotes a token from it | the hook still writes the brief file; the orchestrator runs `node scripts/feature-brief.mjs <name> <agent> <phase>` and puts the printed path into the delegation message | confirmed: one attachment, one string per hook in completion order, so a reader never relies on the position |
| F2 | a hook string above 10,000 characters is saved to a file and shown as a preview of up to 2,000 (documented, per string, no setting) | strings of 9,500 and 10,500 characters; `HOOK_OUTPUT_MAX` is the largest probed size that arrived whole | pointer mode always, no inline brief | confirmed: 10,000 whole, 10,001 a path plus a 2,000-character preview; the cap is per string, not per stdout; `HOOK_OUTPUT_MAX` = 10,000 |
| F3 | PreToolUse on `Read` in a subagent carries `agent_id`, `agent_type`, `tool_input.file_path`, `offset`, `limit` (agent fields documented, no Read example) | the keys of the hook input | the gate keys on the main thread only and the brief redirect is dropped | confirmed: `offset` and `limit` are absent, not null, on a whole read; `session_id` and `transcript_path` are the main session's, so the ledger keys on `agent_id` |
| F4 | `permissionDecision: "deny"` on `Read` shows the reason to the model, and the same call repeated fires the hook again | the agent reports the reason and the result of the retry | an `additionalContext` note instead (measured for PreToolUse Write); if that fails too, decision 3 is dropped and the card keeps the figure | confirmed: the retry fires the hook again and passes; a hook deny is countable as `permissionDecision.source: hook` |
| F5 | SubagentStart fires again on a resume with the same `agent_id` (`docs/metrics/data-flow.md` section 2) | two probe records with one id | no resume dedupe is needed | confirmed, and a resumed agent gets no SubagentStart context at all, new or repeated: the dedupe saves only the brief write; the resume delivery is a `user` record with `origin.kind: coordinator`, `isMeta: true` |
| F6 | stderr of an exit-2 Stop or SubagentStop hook above 10,000 characters: whole or cut (not documented) | a block message of 12,000 characters | relays apply `HOOK_OUTPUT_MAX` to stderr as well | confirmed with a condition: stderr and a PreToolUse deny reason of 12,000 arrive whole, so no stderr cap; a SubagentStop exit 2 after a `SubagentHandback` reaches nobody (3 of 3): decision Q9, "Backend: the handback gate" |
| F7 | PreToolUse fires on `SendMessage`, its `tool_input` carries the addressee (`to`), and the addressee's transcript path can be derived from it (`~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl` per the Claude Code docs); a delivered report appears in that transcript as a `SubagentHandback` record (added 2026-11-10, decision 7 level 3) | the hook input keys, the derived path and the record kind read from the probe agent's transcript after its handback | a note-only hook (`additionalContext`) plus the level 4 ratchet | confirmed: the path is `transcript_path` without `.jsonl` plus `/subagents/agent-<to>.jsonl`, a leading `agent-` stripped from `to`; a `to` that is a name is an unknown addressee; count `type: assistant` records with a `tool_use` block `SubagentHandback` only and skip `api-request-blob`, which repeats the block |
| F8 | SubagentStop `last_assistant_message` holds the SubagentHandback report whole (`docs/metrics/data-flow.md` lists the field; its content is not measured) (added 2026-11-10, decision 7 level 2) | the saved file equals the probe agent's report | the orchestrator pastes the previous report's `## Files` and `## Open questions` sections into the rework message | failed in auto mode: after a `SubagentHandback` the key is absent; it holds the text of a plain-text end only. Decision Q8 replaces the fallback: PostToolUse `SubagentHandback` writes `tool_input.message` |

Relied on without a probe: one hook per matcher, so the missing order between parallel hooks does not matter; a file mentioned with `@` fires no PreToolUse, so the gate does not see it; no hook removes content already in a context window (an assumption, the documentation is silent); `updatedToolOutput` exists and is not used for cutting; main-thread compaction does not touch subagent transcripts.

### Backend: the markers (ADR-0031 decision 1)

- `PLAN.md` `## Acceptance criteria`: every criterion sits under `### Phase <N>: <label>` (N the `/feature` phase, 2 to 6) or under `### Every phase`. A `### Phase <N>` heading needs a step row of phase N.
- `PLAN.md` `## Steps`: the `Phase` cell starts with `<N>: `, the `Agent` cell names agent types in backticks (the keys of `HOME_PHASE` in `scripts/lib/pipeline-metrics.mjs`, the same reading as `planAssignments()`).
- `CONTEXT.md`: a `##` section without subsections is for every reader. A section may be split into `### <Readers>: <title>` subsections, `Readers` a comma list of `All`, `Backend` (`cap-backend-dev`, `test-backend`), `UI` (`fiori-app-dev`, `ui5-freestyle-dev`, `test-ui`). Text before the first subsection is for every reader.
- `SCREENS.md`: no marker. The template's section names select (Q2).
- No legacy switch: only two folders hold a `PLAN.md` (`products-validations`, `context-hygiene`); step 4 marks both. A pruned folder keeps `SUMMARY.md` alone and `check-feature-docs.mjs` is never run on it.

### Backend: the brief (ADR-0031 decision 2)

| Agent type | From PLAN.md | From CONTEXT.md | SCREENS.md reading list |
|---|---|---|---|
| `cap-backend-dev`, `test-backend` | preamble, own step rows with the table header, criteria of its phase and of every phase | `Request`, `User decisions`, unsplit sections except `Open questions`, `All` and `Backend` subsections | none |
| `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` | the same | the same with `UI` instead of `Backend` | every section except `Floorplan and duplication check`, `Alternatives`, `Open questions for the user`; the two developers also without `Verifier scenarios` |
| `ui-verifier` | own step rows, criteria of phases 3 and 4 and of every phase | none, as today | every section except the three plan-gate sections |
| `docs-keeper` | own step rows, every criterion | none, as today | none |
| `reviewer`, `architect`, `ux-designer`, any other type | no brief: reads whole | | |

- Layout of `.pipeline/brief/<agent-type>-<phase>.md`: a header (feature, phase, step numbers, the content hashes of the sources), `## Your steps`, `## Acceptance criteria`, the CONTEXT sections in file order, `## Reading list` (SCREENS sections with line ranges; the feature's ADR only for a decision a step row names; `research/` only for a file a step row names), `## Not included` (file, heading and bytes of every omitted section).
- Feature and phase: the `Feature` and `Phase` lines of `docs/STATE.md` `## Now` (`featureNameOf`, `phaseOf`). Without an own step row in that phase the brief is of the last own phase before it, else the highest, headed "(own steps; current phase N)" (`briefPhase()`); without a feature, `PLAN.md` or any own row: nothing.
- Hand-over: the whole brief as `additionalContext` when it is at most `HOOK_OUTPUT_MAX` characters, otherwise one pointer (path, bytes, section count, "read it whole as protocol step 1"). The hook appends `{ event: 'brief', agent, agentType, feature, phase, bytes, mode, hash }` to the metrics log; a resumed agent id gets no brief and no record (F5: a resume receives no SubagentStart context).
- Ceilings (Q10): `test/context-budget.json` holds per role group the maximum of the largest briefs of the two migrated folders, `products-validations` and `context-hygiene` (step 4 figures: "User decisions" Q10). `feature-brief.mjs --record` merges by maximum: per group it keeps the higher of the recorded and the measured bytes and it keeps the other keys of the file, so a record never lowers a ceiling. `check-feature-docs.mjs` fails above the ceiling. A record run and a lower ceiling are retro decisions with a CHANGELOG line (ADR-0018 principle 4), like `test/prompt-budget.json`.

### Backend: the read gate (ADR-0031 decision 3, Q1)

- `scripts/hooks/read-gate.mjs`, PreToolUse matcher `Read`. Ledger `.pipeline/read-ledger-<session>.jsonl` through `sessionLogFile()`, `appendSessionLog()`, `readJsonl()`; pruned with the audit after 14 days.
- A whole-file read (no `offset`, `limit`, `pages`) of a repository file is recorded as `{ event: 'read', agent, agentType, file, hash, bytes }`, `hash` the sha256 of the content.
- Deny once, with the reason, when the same agent id has a `read` of that file with the same hash and no `deny` for that triple yet; the reason names the time of the first read and says that a second attempt passes. The deny is recorded and counted as a `gate` with the reason `reread`.
- Deny once when an agent id with a `brief` record reads the active feature's `PLAN.md` or `CONTEXT.md` whole; the reason names the brief path; gate reason `brief`.
- Never denied: a partial read, a changed file, another agent id, a file outside the repository, any internal error.
- `pre-compact.mjs` appends `{ event: 'reset', agent: 'main' }`: reads before a compaction of the main thread no longer count.

### Backend: relays without cuts (ADR-0031 decision 4, Q3)

`relay(root, name, text, summarize)` in `scripts/lib/hook-utils.mjs` returns the text whole when it fits `HOOK_OUTPUT_MAX` (10,000, F2); otherwise it writes `.pipeline/logs/<name>-<UTC stamp>.log` and returns the structural summary with that path. No head, no tail. Stderr and a deny reason are not cut by Claude Code (F6), so there is no stderr variant of the limit.

| Site | Today | After |
|---|---|---|
| `scripts/lib/file-checks.mjs` `lintNote()` | first 20 findings, no marker | every finding, or counts per rule and severity with the log path |
| `scripts/hooks/subagent-stop.mjs` lint block and the handback gate's deny reason (decision 8) | first 30 errors, no marker | the same helper, called once in `blockText()` of `scripts/lib/handover-checks.mjs` for both hooks |
| `scripts/hooks/stop-gate.mjs` red `npm test` | last 40 lines | the output whole, or the `FAIL` lines, the two summary lines and the log path |
| `stop-gate.mjs` registry failure, `file-checks.mjs` `cds compile`, prettier, a linter run without a report | `truncate()` at 1,200, 1,500, 600 characters; the last 1,000 | whole, or the byte count and the log path |
| `file-checks.mjs` Cyrillic lines | first 10 and a count | every line number |

Unchanged: `truncate()` for the audit `subject` and the justification text (fields of a log record), the 80-character quote of an offending line in `doc-shapes.mjs`, `capped()` in SessionStart (a visible cap with the path, ADR-0018 principle 3), `CHECK_LIMIT` in SubagentStop (prints what it skipped). The check commands themselves stay as they are: their output is already one line per finding. Protocol section 8 "Checks" and section 6 name the verdict a command printed and its log path instead of "last lines"; `/test-all` likewise.

### Backend: the handback gate (ADR-0031 decision 8, Q9)

- Why: in auto mode an agent reports through `SubagentHandback` and then stops; a SubagentStop exit 2 after that call reaches nobody (F6, 3 of 3), while a PreToolUse deny on `SubagentHandback` arrives whole (12,040 characters, probe run 4) and the agent fixes and calls again. The three blocking exits of `subagent-stop.mjs` move: `lint` (root ESLint, per app ui5lint and ESLint, ADR-0029 amendment D-F), `protected` (a protected path among files without an `edit` record, ADR-0016 layer 1), `mcp` (an MCP gap without `## MCP not used`, ADR-0014).
- `scripts/hooks/handback-gate.mjs` (P, new) serves two registrations by `hook_event_name`, as `mcp-audit.mjs` serves PostToolUse and PostToolUseFailure: PreToolUse `SubagentHandback` runs the checks, PostToolUse `SubagentHandback` writes the report (Q8). Measured input keys: `agent_id`, `agent_type`, `tool_input.message`; PostToolUse also `tool_response`.
- One implementation: `scripts/lib/handover-checks.mjs` (P, new) takes `errorLines()`, `eslintErrors()` and `appErrors()` from `subagent-stop.mjs` unchanged, plus `handoverFindings(root, input, report)` (today's inline blocks: the changed files from `changedFiles()`, the lint scope, `protectedWriteHit()` and `reasonFor()` on files without an `edit` record, `mcpGaps()` with the `## MCP not used` marker and the `justification` record through `appendAudit()`) and `blockText(findings, next)` (today's three stderr texts; `next` is "call SubagentHandback again" or "finish again"). Both hooks call them; no second lint, protected-path or MCP-audit logic. `runLinter()`, `appHasTool()`, `notInstalledNote()`, `runFileChecks()`, `editedFiles()`, `readAudit()`, `agentKey()`, `recordGate()` stay in their libraries and are called.
- Scope, both hooks: lint covers the changed files with an `edit` record of this agent id (`editedFiles()`) and the changed files with no `edit` record at all (written outside Edit/Write, linted whoever wrote them, ADR-0016); a file that only another agent's records explain is skipped. The sandbox files of `test/hooks-subagent-stop.test.js` carry no record, so its cases stay in scope.
- Report checks read `tool_input.message` (SubagentStop: `last_assistant_message`): `mcp` passes with the `## MCP not used` section and writes `justification`; `protected` passes when the report names every listed path (the deny asks for them under `## Open questions`); `lint` needs a fix.
- Deny: `permissionDecision: deny` with the text of `blockText()`, through `relay()` from step 6. Each deny appends `{ event: 'handback-deny', agent, agentType, reason }` to the audit log (the count) and `recordGate()` with hook `handback-gate` and reason `lint`, `protected` or `mcp`. The `mcp` reason denies once per agent id (ADR-0014 blocks once): a second attempt without the section passes and writes `skipped-unjustified`.
- Retry limit. Measured (run 4): one deny, and the second attempt was delivered. Not measured: the limit itself; documented: up to three retries. `HANDBACK_DENY_MAX` = 3 denies per agent id and session is the starting value; step 5 measures the limit with a probe variant `handback-limit` (every attempt denied; the number of attempts and whether the parent receives a report after the last) as F9 in `research/hook-probe-results.md` before the registration, and sets the constant so that the pass falls on an attempt the platform still runs. That attempt passes with `recordGate()` reason `handback-limit` (new in `GATE_REASONS`), so the card and `/retro` show a report that left with open findings.
- SubagentStop still fires after the handback: it keeps `agent-stop`, the write-route advisories (`runFileChecks()` up to `CHECK_LIMIT`) and, on a plain-text end, the report file. It blocks (exit 2, `stop_hook_active` for the MCP repeat, as today) only when its input has `last_assistant_message`: a plain-text end, whose block reaches the agent (F6 runs 2, 3). Without the key the report went through `SubagentHandback` (F8) and the gate already ran on the same files. Whether a SubagentStop `systemMessage` after a handback reaches the user is not probed; the records are the durable channel.
- Safety: an unreadable input, a call without `agent_id` (the main thread has no handback) and an internal error allow without output. An internal agent (`internalAgent()`) is checked without records, as today.
- Report (Q8): PostToolUse writes `tool_input.message` whole to `.pipeline/logs/report-<agent_type>-<agent_id>.md`; a later delivery of the same agent id overwrites it; `session-start.mjs` prunes it with the logs.

### Backend: the context card (ADR-0031 decision 5)

- New fields of `slim()`, sizes and identifiers only: the `id` of every `tool_use`; for `Read`, `Edit`, `Write` the `input.file_path` and whether `offset` or `limit` is set; for `Bash` the program class of `input.command` (`print`: cat, sed, head, tail, awk, nl; `search`: grep, rg, find, ls, wc; `git`; `check`: npm, npx, node; `other`), never the command; per `tool_result` block its `tool_use_id` and the length of its text; for a `hook_additional_context` attachment `hookEvent` and the length. Records of type `api-request`, `api-request-blob`, `api-request-shape` are skipped: they repeat the blocks.
- D14 startup context: D3 of the thread's first request. D15 tool-result characters by tool, Bash by program class. D16 repeat read: a whole-file `Read` of a path the thread already read whole with no `Edit` or `Write` of it by the thread in between; the figure is the characters of the repeats. D17 the five largest results of a launch as tool, path or program class, and characters. D18 launch kinds (2026-11-10): per launch the number of compactions; per agent type the launches, the resumes (a `SendMessage` delivery, the `origin.kind` `coordinator` record of section 1) and the compactions as three figures; and the resumes after a report (a `coordinator` delivery after a `SubagentHandback` record in the same agent file) with the agent type and D3 of the request that follows the delivery. The record kind that identifies a compaction is not yet named in `docs/metrics/definitions.md` (section 1 excludes "compaction summaries" from D9 as string `user` records, and `pre-compact.mjs` writes a `compact` metric for the main thread only): step 7 measures it on the #28 session alongside the other figures and names it in section 1.
- Output: `node scripts/metrics.mjs context <name|#N|session>` prints one row per launch with the compactions next to the peak, and per agent type launches, resumes and compactions; the feature card gains a context line per agent type and the list of resumes after a report; `record` writes `context` into the history line (launches, resumes, compactions, `resumesAfterReport`, startup and peak maximum, tool-result characters, brief characters, repeat-read characters, `reread`, `brief` and `resume` gates), fails when `resumesAfterReport` is above the ceiling pinned in `test/context-budget.json` (0), and `compare` prints the deltas.
- Baseline: the #28 figures above. After: the card of `/feature #10`, plus the deterministic document figure (brief bytes against the whole files) from step 4.

### Backend: files and protection

| Object | Exists now | What changes |
|---|---|---|
| `templates/feature/PLAN.md`, `CONTEXT.md`, `SCREENS.md` | shapes of ADR-0018; not protected | phase subsections, `<N>: <label>` Phase cells, reader subsections, one reader line |
| `scripts/lib/doc-shapes.mjs` (P) | `planShapeErrors()`, `contextShapeErrors()`, `sections()` | marker rules; `###` parsing inside a section |
| `scripts/lib/feature-brief.mjs` (P, new), `scripts/feature-brief.mjs` (new) | nothing suitable | role groups, `briefFor()`, `writeBrief()`, `recordCeilings()` with the max-merge of Q10, the CLI |
| `scripts/check-feature-docs.mjs` | shape check of one folder | also the brief ceilings |
| `scripts/hooks/subagent-start.mjs` (P) | writes `agent-start`, prints nothing by decision | hands the brief, writes `brief` |
| `scripts/hooks/read-gate.mjs`, `scripts/lib/read-ledger.mjs` (P, new), `.claude/settings.json` (P) | no hook on `Read` | the gate and its registration |
| `scripts/hooks/resume-gate.mjs` (P, new), `.claude/settings.json` (P) | no hook on `SendMessage` | the resume gate of decision 7 level 3: derives the addressee's transcript path (F7), denies when it holds a `SubagentHandback` record with the replacement and the saved report path in the reason, passes without a report, with an unreadable transcript or an unknown addressee; `gate` record `resume`; registered next to the read gate |
| `scripts/hooks/handback-gate.mjs`, `scripts/lib/handover-checks.mjs` (P, new), `.claude/settings.json` (P) | the blocking checks live inline in `subagent-stop.mjs`; no hook on `SubagentHandback` | decision 8: the checks moved to `handover-checks.mjs`, run on PreToolUse `SubagentHandback`; PostToolUse `SubagentHandback` writes the report (Q8); matchers PreToolUse and PostToolUse `SubagentHandback`, registered last with the others |
| `scripts/hooks/pre-compact.mjs`, `session-start.mjs` (P) | compact record; prune of audit and metrics | ledger reset; prune of ledger, briefs and logs |
| `scripts/lib/hook-utils.mjs`, `file-checks.mjs`, `scripts/hooks/stop-gate.mjs`, `subagent-stop.mjs` (P) | `truncate()`, `lastLines()`, `slice()` on output | `relay()`; `subagent-stop.mjs` calls `handoverFindings()`, blocks a plain-text end only, and saves `last_assistant_message` whole as `.pipeline/logs/report-<agent_type>-<agent_id>.md` when its input has the key (decision 7 level 2, F8, Q8), on a pass and on a block alike |
| `scripts/lib/transcript-usage.mjs`, `pipeline-metrics.mjs`, `metrics-log.mjs`, `mcp-audit.mjs`, `state-now.mjs` (P), `scripts/metrics.mjs`, `scripts/i18n/pipeline*.properties` | D1-D13, the card, `GATE_REASONS`, `pruneSessionLogs()` | D14-D17, `context`, reasons `reread`, `brief`, `resume` and `handback-limit`, prune by name pattern, one reader of a `## Now` line |
| `.claude/skills/project-protocol`, `feature`, `spec`, `test-all`; eight agent prompts and `ux-designer.md`; `.claude/rules/pipeline-config.md` (P) | "read PLAN.md and CONTEXT.md whole", the reading table, "last lines"; `feature` lines 67-68 "the owning agent (or the resumed one)" and "resume it with SendMessage ... relaunch only if it does not answer" | "read your brief; a whole file only for a section the brief lists as not included"; the delegation message keeps the feature name, step numbers, gate mode, turn budget and what changed since approval; verdict and log path; the fresh-launch rule of decision 7 in `feature` (rework: a new agent of the owning type with the defect list and the report path; resume only mid-step with the deliverable behind) and `spec` (one line: amendments after the plan gate go to a fresh `architect` with the file list and the exact edits); protocol section 8 names the saved report under `.pipeline/logs/`; protocol section 2 step 5 and section 8 and `pipeline-config.md` say the hand-over checks fire when the agent calls `SubagentHandback` (decision 8) |
| `docs/metrics/definitions.md`, `data-flow.md`, `vitest.config.mjs`, `test/**` | | field list (D18, the compaction record kind, the `SubagentHandback` and `coordinator` markers), records, fixture keys; no repeated Node warning; tests of PLAN step 9; `test/context-budget.json` also pins `resumesAfterReport` at 0 |

## What already exists and is reused

- `scripts/lib/doc-shapes.mjs` `sections()`, `planShapeErrors()`, `contextShapeErrors()`: extended, no second parser of the feature documents.
- `scripts/lib/pipeline-metrics.mjs` `phaseOf()`, `featureNameOf()`, `HOME_PHASE`, `planAssignments()` (`cellsOf()`): the phase number, the feature name and the agent types of a step row are read the same way by the brief.
- `scripts/lib/hook-utils.mjs` `readSection()`, `readJsonl()`, `sha256()`, `emitJson()`, `rel()`, `insideRepo()`; `scripts/lib/mcp-audit.mjs` `agentKey()`, `sessionLogFile()`, `appendSessionLog()`, `pruneSessionLogs()`: the ledger is a third log of the same layout, not a new format.
- `scripts/lib/metrics-log.mjs` `appendMetric()`, `recordGate()`, `metricsAgent()`, `GATE_REASONS`: the `brief` event and the two gate reasons.
- `scripts/lib/transcript-usage.mjs` `slim()`, `scopeThreads()`, `requests()`, `contextOf()`: the only reader of transcripts stays the only one; the resume gate asks it whether an agent file holds a `SubagentHandback` record instead of parsing the file itself; `usageByModel().ctxPeak` already gives the peak.
- `scripts/hooks/protect-files.mjs`: the PreToolUse decision shape (`permissionDecision`, `additionalContext`) and the "deny, record a gate" order; `subagent-stop.mjs` MCP check: the block-once pattern of ADR-0014.
- `scripts/hooks/subagent-stop.mjs` `errorLines()`, `eslintErrors()`, `appErrors()` and its inline protected-write and MCP blocks: moved, not copied, into `scripts/lib/handover-checks.mjs` for the handback gate and SubagentStop (decision 8); `mcp-audit.mjs` serving two events is the precedent for one script on PreToolUse and PostToolUse `SubagentHandback`.
- `scripts/prompt-budget.mjs` and `test/prompt-budget.json`: the `--record` ratchet copied in shape by `feature-brief.mjs --record` and `test/context-budget.json`.
- `test/fixtures/hook-sandbox.mjs` `createSandbox()`, `stateDoc()`; `test/fixtures/transcript-fixture.mjs`: extended, no new fixture builder.
- Nothing suitable exists for slicing a document by reader or for a ledger of reads; `scripts/prune-feature.mjs` and `scripts/hooks/post-edit.mjs` are not touched.

## Applicable patterns

- "Pipeline metric" (ADR-0022): a new figure is a formula in `pipeline-metrics.mjs` fed by the parser, with a fixture case; no second reader.
- "Advisory from a Stop hook" (ADR-0023): which hook output reaches the model; a block is exit 2 or a deny with a `gate` record, advice is `additionalContext`.
- "Hook lint gates" (TESTING): a hook is tested from a sandbox copy, one test per promised syntax and one for the crash path.
- Rule `pipeline-config.md`: a new hook passes `node --check` and one run with test JSON outside the repository before it is registered.
- No row for a role brief, a read gate, a relay of check output, a rework launch or a gate on the handback: ADR needed, ADR-0031 adds five rows at step 12.

## Relevant lessons

- ADR-0029 amendment D-F (2026-10-25): a gate that silently checks nothing looks green; a matcher gets a test per syntax and for the crash path. Applies to the marker rules and the gate.
- CHANGELOG 2026-09-11: a figure names the phase and the copy it was measured on. The brief sizes above are measured at step 4 on the migrated documents before the Q10 amendment; the record of step 9 measures the documents as they stand then.
- ADR-0030 amendment (2026-10-27): a design that quoted an unreleased behaviour was caught only by the step 0 probe. Hence step 2 before any dependent code.
- Agent memory, 2026-10-09: the Bash guard denies a command whose text names a protected path, also in a temp directory; the probe project uses its own folder names and documents are written with Write and Edit.
- `/feature` rule: agents that edit `scripts/` run one at a time and no suite runs meanwhile.

## Open questions

None open. The six gate questions of the issue and PLAN Q1-Q7 are decided (user, 2026-11-10), Q8 and Q9 at the probe gate and Q10 after step 4 (user, 2026-11-11); the list is under "User decisions":

- Check output: every check already prints one line per finding (measured above), so no command changes and no runner is added (Q3); the cuts are in the hook relays, which get `relay()` and `.pipeline/logs/`; the report names the verdict line and the log path.
- Repeated reads: deny once per agent, file and content hash with the reason; the retry passes, so a compaction needs no detection and no N exists (Q1).
- Marker syntax and budgets: `### Phase <N>: <label>`, `### Every phase`, `### <Readers>: <title>`; SCREENS.md by its template section names (Q2); the ceiling is the per-group maximum of the largest briefs of the two migrated folders, recorded by a max-merge in `test/context-budget.json` next to `resumesAfterReport: 0` (Q10).
- The delegation message shrinks: the brief carries steps, criteria, context and the reading list; the message keeps the feature name, step numbers, gate mode, turn budget and what changed since approval. Baseline median 3.9K characters; the card shows the figure after.
- Who gets a slice: the five implementer and tester types, `ui-verifier`, `docs-keeper`. `reviewer`, `architect` and `ux-designer` read whole. A rework launch is a fresh agent with the brief, the defect list and the saved report path (amendment 2); the #10 documents are re-marked without re-approval (Q6).
- `autoCompactWindow`: out of scope, decided again after `/feature #10` with the compaction counter of amendment 1 on the card (Q4); shell prints stay and the card shows the figure (Q5). Also out: `updatedToolOutput`, a wrapper around the check commands, a hook on Bash prints, MCP instruction size at startup, the launch granularity of `/feature`, republishing the manual pages outside the repository.
