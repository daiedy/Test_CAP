# Context hygiene: verification

Date: 2026-11-11. Agent: `test-backend` (agent id `a0aaa4c36e41f08e1`, session `b05b4d6a-802e-4de7-8d37-c2107c6ebaa2`), PLAN step 10, phase 4. Branch `feature/context-hygiene` at 9eb5077 (phase 2 commit), uncommitted: `docs/STATE.md`, `docs/codemie/` (not part of this check).

Checks 1-6 are the six phase 4 criteria of `PLAN.md` (Migration, Live brief, Live gate, Green run, Baseline, Rework rule). Each check: the command, its short output or record excerpt, the verdict. No UI change in this feature: the manual scenario, network and console sections of the template do not apply.

## Check 1: Migration

Shape and ceilings:
```
$ node scripts/check-feature-docs.mjs products-validations
docs/features/products-validations: PLAN.md and CONTEXT.md keep the shape of the templates. 6 brief(s) within the ceilings of test/context-budget.json.
exit=0
$ node scripts/check-feature-docs.mjs context-hygiene
docs/features/context-hygiene: PLAN.md and CONTEXT.md keep the shape of the templates. 4 brief(s) within the ceilings of test/context-budget.json.
exit=0
```

Ceilings against the per-group maximum of both `--all` runs:
```
$ node scripts/feature-brief.mjs products-validations --all
largest per role group: backend 47,508, ui 46,085, verifier 8,931, docs 17,531
$ node scripts/feature-brief.mjs context-hygiene --all
  cap-backend-dev    phase 2  steps 2, 3, 5, 6, 7, 8  57,639 bytes  backend, ceiling 57,639
  test-backend       phase 2  steps 9           50,907 bytes  backend, ceiling 57,639
  test-backend       phase 4  steps 10          41,154 bytes  backend, ceiling 57,639
  docs-keeper        phase 6  steps 12          15,235 bytes  docs, ceiling 17,531
largest per role group: backend 57,639, docs 15,235
```

| Group | #10 max | #44 max | Per-group maximum | `test/context-budget.json` `briefs.bytes` | `sources` |
|---|---|---|---|---|---|
| backend | 47,508 | 57,639 | 57,639 | 57,639 | `context-hygiene` |
| ui | 46,085 | none | 46,085 | 46,085 | `products-validations` |
| verifier | 8,931 | none | 8,931 | 8,931 | `products-validations` |
| docs | 17,531 | 15,235 | 17,531 | 17,531 | `products-validations` |

`resumesAfterReport: 0` is pinned in the same file. The backend figure is 57,639, not the 55,677 of the step 4 measurement in Q10: the #44 `cap-backend-dev` 2 brief grew with the Q10 lines of step 5 and the record of step 9 measured the documents as they stood then (CONTEXT "Relevant lessons", CHANGELOG 2026-09-11 rule). Equal to the maximum, as the criterion asks.

Word diffs (whole outputs: `.pipeline/logs/verify-wd-10.log`, `.pipeline/logs/verify-wd-44-total.log`, per commit `.pipeline/logs/verify-wd-44-37521e3.log`, `.pipeline/logs/verify-wd-44-fad85e9.log`).

#10, `git diff --word-diff main -- docs/features/products-validations/PLAN.md docs/features/products-validations/CONTEXT.md`: 26 insertions, 13 deletions by `--stat` (whole lines), 0 word deletions (`grep -c '\[-'` = 0). Every inserted word token:
```
6 x {+### Phase <N>: ...+} / {+### Every phase+}   (Phase 2: backend, 3: UI, 4: verification, 5: review, 6: documentation; Every phase)
10 x {+<N>:+} at the start of a Phase cell          (1: x2, 2: x4, 3: x2, 4:, 5:, 6:)
{+All:+} {+UI:+}                                    (prefixes of the existing ### Rule catalogue, ### Preventing controls)
{+### All: Message keys, seed and contract+}       (a new reader subsection heading over existing text)
```
No criterion or step wording changed: markers only.

#44, since the spec commit 389c3f8: `git log --oneline 389c3f8..HEAD -- docs/features/context-hygiene/PLAN.md docs/features/context-hygiene/CONTEXT.md` lists exactly two commits (4a16c70 and 9eb5077 touch neither file):
- 37521e3 `docs(spec): context-hygiene amendment Q8, Q9 after the hook probe` (PLAN 33 lines, CONTEXT 57 lines changed): the Q8 and Q9 decision lines in both files; the "Result 2026-11-11" column of F1-F8; the CONTEXT section `### Backend: the handback gate (ADR-0031 decision 8, Q9)`; five new criteria "Handback gate, deny / MCP / limit / plain-text end / safety"; the report-source criterion reworded from SubagentStop `last_assistant_message` to PostToolUse `SubagentHandback` `tool_input.message` (Q8); the relay criterion extended by "the handback gate's deny reason"; step 5, 6, 9, 11, 12 rows extended by `handback-gate.mjs`, `handover-checks.mjs`, `handback-limit` and the ADR-0014, ADR-0016 notes; the Probe criterion ticked `[ ]` to `[x]` without a word change.
- fad85e9 `docs(spec): context-hygiene step 4 markers and amendment Q10` (PLAN 22, CONTEXT 17 lines changed): the markers `### Phase 2: scripts, hooks and tests`, `### Phase 4: verification`, `### Phase 5: review`, `### Phase 6: documentation` (the Phase cells already had `<N>: ` at 389c3f8); Q10: the decision lines, the new criterion "Brief record", the Migration criterion amended ("against the ceilings of `test/context-budget.json`", "apart from the amendment Q10 of this plan", "each recorded ceiling equals the per-group maximum of ... `context-hygiene --all` (Q10)"), step 5 row `+ scripts/lib/feature-brief.mjs (recordCeilings() max-merge, Q10)` and "Feature brief (decision 2, Q10)", step 9 row `+ over both migrated folders`; CONTEXT "Ceilings (Q10)", the measured brief row, the `recordCeilings()` file row, the lesson and open-questions lines.

Outside criteria and steps fad85e9 also changed two preamble lines of PLAN.md: the date and status line, including `Gate mode: [-semi-autonomous.-]{+autonomous.+}`, and the sentence about the markers ("Step 4 (done 2026-11-11) added the four `### Phase <N>` headings ... from the start"). Neither is a criterion or step; the gate-mode change matches the orchestrator's brief ("Gate mode: autonomous").

Verdict: **pass**. Both folders green against the ceilings, each ceiling equals the per-group maximum, #10 changed by markers only, #44 criterion and step changes trace to the amendments Q8, Q9 (37521e3) and Q10 (fad85e9) plus the step 4 markers.

## Check 2: Live brief

Why in this session: the criterion asks for "a session started after the settings change". This session (`b05b4d6a-802e-4de7-8d37-c2107c6ebaa2`, first metrics record `{"ts":"2026-11-10T23:37:05.873Z","event":"session","source":"clear",...}`) started before the last write of `.claude/settings.json` (mtime 2026-11-11 09:10:02 +0400 = 05:10:02Z; committed in 9eb5077), yet the hooks are demonstrably live without a restart:
- the PostToolUse `SubagentHandback` matcher, registered mid-session, wrote the reports of the earlier agents: `.pipeline/logs/report-cap-backend-dev-a4326dcfbe5bae7da.md` at 09:11:44 (102 seconds after the settings write), then `report-cap-backend-dev-a7000d453e5e5c7f1.md` 09:24:35, `-a398e8cecca718676.md` 09:43:06, `-a2593b1121a24a307.md` 09:52:37, `report-test-backend-a13c7ee15630cbaa0.md` 10:07:41, `report-test-backend-a6b796148d3603cad.md` 10:09:09;
- every earlier agent of the feature received its brief pointer: `brief` records in the session metrics for `a4326dcfbe5bae7da`, `a7000d453e5e5c7f1`, `a398e8cecca718676`, `a2593b1121a24a307` (`cap-backend-dev`, phase 2) and `a6b796148d3603cad`, `a13c7ee15630cbaa0` (`test-backend`, phase 2).

So the check runs on this launch in this session.

This launch's transcript `~/.claude/projects/-Users-anton-straltsou-github-Test-CAP/b05b4d6a-802e-4de7-8d37-c2107c6ebaa2/subagents/agent-a0aaa4c36e41f08e1.jsonl`, record 3 (keys and text only):
```
record keys:     parentUuid,isSidechain,agentId,attachment,type,uuid,timestamp,rendered,renderedRole,sessionKind,userType,entrypoint,cwd,sessionId,version,gitBranch
attachment keys: type,content,hookName,toolUseID,hookEvent
type: hook_additional_context   hookEvent: SubagentStart   hookName: SubagentStart
content: ["Your brief of feature context-hygiene, phase 4: .pipeline/brief/test-backend-4.md (41,154 bytes, 10 sections; above the 10,000-character limit of a hook string, so handed by path). Read it whole as protocol step 1; read a whole feature document only for a section the brief lists under \"Not included\"."]
```
Record 2 is the `hook_success` attachment of the same hook (`hookName: SubagentStart:test-backend`, `content: ""`).

Matching metrics records in `.pipeline/metrics-b05b4d6a-802e-4de7-8d37-c2107c6ebaa2.jsonl` (lines 79, 80):
```
{"ts":"2026-11-11T06:11:04.376Z","event":"agent-start","agent":"a0aaa4c36e41f08e1","agentType":"test-backend"}
{"ts":"2026-11-11T06:11:04.380Z","event":"brief","agent":"a0aaa4c36e41f08e1","agentType":"test-backend","feature":"context-hygiene","phase":"4","bytes":41154,"mode":"path","hash":"983ccb8289398895e1d353d93bdf945c25f5c12d531e2c17a00ae5dfde6d3707"}
```
The bytes (41,154) equal the `test-backend` phase 4 row of `node scripts/feature-brief.mjs context-hygiene --all` (check 1). The brief was read whole as step 1 of this launch. Brief path named by this launch's report: `.pipeline/brief/test-backend-4.md`.

Verdict: **pass**.

## Check 3: Live gate

Three whole `Read` calls (no `offset`, `limit`) of the unchanged repository file `docs/features/context-hygiene/research/context-measurements.md` (6,700 bytes) by this launch, back to back:

1. First call: content returned (82 lines).
2. Second call: denied, the tool result is the read-gate reason:
   ```
   PreToolUse:Read hook error: Read gate (ADR-0031 decision 3): you already read docs/features/context-hygiene/research/context-measurements.md whole at 2026-11-11T06:13:09.597Z and it is unchanged since (sha256 ccfd8148a209), so its content is still in your context; use that copy. If you need the whole file anyway, repeat this Read: the second attempt passes. A Read with offset and limit always passes.
   ```
3. Third call: content returned (82 lines).

Gate record, `grep '"gate"' .pipeline/metrics-b05b4d6a-802e-4de7-8d37-c2107c6ebaa2.jsonl | grep a0aaa4c36e41f08e1` (count 1):
```
{"ts":"2026-11-11T06:13:10.033Z","event":"gate","hook":"read-gate","agent":"a0aaa4c36e41f08e1","agentType":"test-backend","reason":"reread"}
```

Ledger, `grep a0aaa4c36e41f08e1 .pipeline/read-ledger-b05b4d6a-802e-4de7-8d37-c2107c6ebaa2.jsonl`:
```
{"ts":"2026-11-11T06:11:07.401Z","event":"read","agent":"a0aaa4c36e41f08e1","agentType":"test-backend","file":".pipeline/brief/test-backend-4.md","hash":"983ccb82...","bytes":41154}
{"ts":"2026-11-11T06:13:09.597Z","event":"read","agent":"a0aaa4c36e41f08e1","agentType":"test-backend","file":"docs/features/context-hygiene/research/context-measurements.md","hash":"ccfd8148...","bytes":6700}
{"ts":"2026-11-11T06:13:10.033Z","event":"deny","agent":"a0aaa4c36e41f08e1","agentType":"test-backend","file":"docs/features/context-hygiene/research/context-measurements.md","hash":"ccfd8148...","reason":"reread"}
```
(hashes shortened here, whole in the ledger). The brief read at step 1 was recorded and never denied (one whole read). The third call passed without a further ledger line: the deny for the (agent, file, hash) triple exists, so the gate allows and the first `read` record stays the reference; the CONTEXT rule ("recorded as `read`" for a whole read, "deny once ... no `deny` for that triple yet") does not require a second `read` line, so this is not a defect.

Verdict: **pass**: denied once with the reason, passed on the retry, one `gate` record `reread`.

## Check 4: Green run

`npm test > .pipeline/logs/verify-npm-test-20261111T061336Z.log 2>&1` (stdout and stderr together), exit 0. The whole output, 13 lines, 232 bytes:
```

> product-catalog@1.0.0 test
> vitest run --silent


 RUN  v5.0.5 /Users/anton_straltsou/github/Test_CAP


 Test Files  18 passed (18)
      Tests  278 passed (278)
   Start at  10:13:36
   Duration  56.61s (tests 99%, import 1%)

```
`grep -c ExperimentalWarning .pipeline/logs/verify-npm-test-20261111T061336Z.log` → `0`. Baseline of 2026-11-09 (`research/context-measurements.md`): 246 tests in 16 files, 739 bytes in 19 lines, 6 of them `ExperimentalWarning: SQLite`.

Verdict: **pass**: 278 of 278 green in 18 files, no `ExperimentalWarning` line.

## Check 5: Baseline

The #28 transcripts are not pruned yet (21 `agent-*.jsonl` files under `~/.claude/projects/-Users-anton-straltsou-github-Test-CAP/5fcef594-d91b-4697-a0a6-8173de6fc194/subagents/`), so the command is checked against the figures, not replaced by the research file.

`node scripts/metrics.mjs context 5fcef594-d91b-4697-a0a6-8173de6fc194`, exit 0, 39 lines, 9,400 bytes; it prints in `PIPELINE_LANG` (`ru` in this session), whole output `.pipeline/logs/verify-metrics-context-28.log`. Rerun with `PIPELINE_LANG=en` for this file (whole output `.pipeline/logs/verify-metrics-context-28-en.log`), the same figures; summary lines, per-type table and resumes after a report:
```
## Context: session 5fcef594-d91b-4697-a0a6-8173de6fc194

Launches 21, resumes 5, compactions 0, resumes after a report 3; startup max 32.1K, peak max 280.6K tokens; tool results 2,597.4K characters in 771 results (Bash 1,700.9K, Read 825.5K, Edit 19.3K, mcp__cds-mcp__search_docs 15.3K, mcp__cds-mcp__search_model 13.6K, mcp__chrome-devtools__evaluate_script 12.0K, Write 7.0K, SubagentHandback 1.5K, ...)
Main thread: startup 65.3K, peak 464.8K tokens, compactions 0, requests 183, tool results 287.5K characters
| Agent | Launches | Resumes | Compactions | Startup max | Peak max |
|---|---|---|---|---|---|
| cap-backend-dev | 6 | 1 | 0 | 22.9K | 280.6K |
| test-backend | 3 | 0 | 0 | 23.4K | 145.5K |
| docs-keeper | 9 | 1 | 0 | 23.3K | 122.4K |
| architect | 1 | 1 | 0 | 25.7K | 220.8K |
| reviewer | 1 | 2 | 0 | 22.2K | 222.7K |
| ui-verifier | 1 | 0 | 0 | 32.1K | 60.3K |

Resumes after a report (3): architect ae514ed1edbad3d45 at 2026-10-27 16:30 UTC, context 216.5K tokens; reviewer a929d591f2f8ab22a at 2026-10-27 19:11 UTC, context 213.9K tokens; docs-keeper a540804f36b1ffa31 at 2026-10-27 19:15 UTC, context 54.3K tokens
```

| Figure | Expected (criterion, step 7) | Printed | `research/context-measurements.md` |
|---|---|---|---|
| Launches | 21 | 21 | 21 launches |
| Tool results | 2,597.4K characters | 2,597.4K in 771 results | 2,597.4K in 771 results |
| Bash, Read, Edit, Write | | 1,700.9K, 825.5K, 19.3K, 7.0K | 1,700.9K, 825.5K, 19.3K, 7.0K |
| `mcp__cds-mcp__*`, `mcp__chrome-devtools__*` | | 15.3K + 13.6K = 28.9K; 12.0K + 1.2K + 782 + 112 + 101 + 35 = 14.2K | 28.9K, 14.2K |
| Startup max, peak max | | 32.1K, 280.6K tokens | 21.5K-32.1K, 43.1K-280.6K |
| Resumes | 5 | 5 | not measured there |
| Compactions | 0 | 0 | not measured there |
| Resumes after a report | 3 | 3 | not measured there |

The per-launch rows (startup, peak, requests, tool results) of the card equal the 21 rows of the research table.

Verdict: **pass**.

## Check 6: Rework rule

```
$ grep -rn 'or the resumed one' .claude/skills .claude/agents
exit=1   (no output)
$ grep -rn -i 'resume it with SendMessage\|relaunch only if' .claude/skills .claude/agents
exit=1   (no output; the old feature lines 67-68 named in CONTEXT are gone)
```

`grep -n -i 'relaunch\|new agent\|rework\|decision 7'` over the two skills matches one line in each, so each states the rule once.

`.claude/skills/feature/SKILL.md` line 59, the rule sentences:
> A rework (a defect in an agent's output, even a one-line fix, or a stop at the turn limit or the stream watchdog) goes to a new agent of the owning type, which reads its brief or, without one, the documents (protocol section 2 step 1). Your message carries the defect list with the evidence, what `git status` shows it already wrote, and the path of the previous report, `.pipeline/logs/report-<agent-type>-<agent-id>.md` (ADR-0031 decision 7). Resume with SendMessage only an agent stopped mid-step whose deliverable on disk is behind its progress ("first tool call: write the file"); the resume gate denies a resume after a report.

`.claude/skills/spec/SKILL.md` line 13, the rule sentence:
> Amendments after the plan gate go to a fresh `architect` with the file list and the exact edits (ADR-0031 decision 7).

Both match decision 7 as the criterion words it: a rework is a new agent of the owning type with the defect list and the report path; a resume only for an agent stopped mid-step whose deliverable on disk is behind its progress; `/spec` amendments to a fresh `architect`.

Verdict: **pass**.

## Verdict

Ready for review. Checks 1-6 pass: Migration, Live brief, Live gate, Green run (278 of 278, no `ExperimentalWarning`), Baseline (21 launches, 2,597.4K, resumes 5, compactions 0, resumes after a report 3), Rework rule. No defect found. Notes for the reviewer, none blocking: the backend ceiling is 57,639 bytes rather than the 55,677 quoted in Q10 (the step 9 record measured the documents after the Q10 lines; it equals the per-group maximum as the criterion asks); fad85e9 also changed the PLAN preamble's gate mode from semi-autonomous to autonomous, outside criteria and steps.
