---
name: context-hygiene-design
description: What fills a pipeline agent's context (measured on the #28 run, 2026-11-09), Claude Code transcript and hook facts found on the way, the ADR-0031 design for #44 context-hygiene, its plan gate of 2026-11-10 (decision 7 rework by fresh launch) the probe gate of 2026-11-11 (decision 8 handback gate, F6/F8 facts) and Q10 (brief ceilings by max-merge over both migrated folders)
metadata:
  type: project
---

Spec for #44 `context-hygiene` written 2026-11-09 (`docs/features/context-hygiene/`). Plan approved 2026-11-10 with the recommended option for Q1-Q7; ADR-0031 and the ADR-0018 amendment accepted at the gate, Status lines flip at step 12 (docs-keeper phase). Depends on ADR-0018, ADR-0022, ADR-0031.

Gate amendments of 2026-11-10: the card counts compactions per launch and shows launches, resumes and compactions apart (D18; the compaction record kind is measured in step 7, not known yet). ADR-0031 decision 7, rework by fresh launch, four levels: rule in the `feature` and `spec` skills, report saved by SubagentStop under `.pipeline/logs/report-<type>-<id>.md`, a PreToolUse gate on `SendMessage` (`resume-gate.mjs`, denies when the addressee's transcript holds a `SubagentHandback` record, no deny-once), and a zero ratchet `resumesAfterReport` in `test/context-budget.json`. Reason: the architect of this spec was resumed at about 380K tokens for a small edit; six narrow `docs-keeper` launches peaked at 43-122K against 280K for one. Probe facts F7 (`SendMessage` hook input, subagent transcript path) and F8 (`last_assistant_message` holds the handback) guard the two hook-dependent levels.

Probe gate 2026-11-11 (Claude Code 2.1.322, `research/hook-probe-results.md`), amendment Q8/Q9: F8 failed in auto mode (no `last_assistant_message` key after a `SubagentHandback`; the key exists only on a plain-text end), so the report file comes from PostToolUse `SubagentHandback` `tool_input.message`. F6 condition: a SubagentStop exit 2 after a handback reaches nobody (3 of 3), so the lint, protected and MCP blocks of `subagent-stop.mjs` were silent in auto mode before #44; ADR-0031 decision 8 moves them to PreToolUse `SubagentHandback` (`handback-gate.mjs`, shared `scripts/lib/handover-checks.mjs`), deny with the whole reason, bounded by `HANDBACK_DENY_MAX` (documented 3 retries, not measured; F9 in step 5), pass recorded as gate `handback-limit`; SubagentStop blocks only when the key is present. A deny reason or stderr of 12,000 characters arrives whole; `HOOK_OUTPUT_MAX` = 10,000 applies to `additionalContext` per string. A resumed agent gets no SubagentStart context at all. Q9 read as all three blocking exits (lint, protected, mcp), flagged to the user.

Measured on the `/feature` run of #28 (session `5fcef594`, 21 launches, Claude Code 2.1.310); the scripts are in the feature's `research/` folder while it exists:

- A context by characters: tool results 42%, thinking 25% (signatures included), everything else small. Tool results: Bash 1,700.9K, Read 825.5K of 2,597.4K.
- Shell prints and searches (`sed`, `cat`, `grep`, loops, `awk`) are 53% of tool-result characters; agents read files through Bash as much as through Read, so a hook on `Read` sees half.
- Check commands are 3.4% and already short (green `npm test` 739 bytes, a red run about 1.6K per failure). The cuts are in the hook relays (`lastLines(40)` in the Stop gate, `slice(0, 20)` in `lintNote()`, `slice(0, 30)` in SubagentStop), not in the commands.
- Feature documents plus the feature's own ADR are 19.5%: the ADR reached 10 of 21 agents although no reading list names it.
- A whole-file `Read` repeated by the same agent: 0 of 70. "PLAN.md read twice" in the issue was two launches. Any-route repeats at most 7.6%.
- Peak follows the request count of a launch (66 requests: 280.6K tokens; 4 requests: 43.1K).

Claude Code facts found on the way:

- 2.1.310 transcripts hold `api-request`, `api-request-blob`, `api-request-shape` records that repeat the content blocks: count tool results only from `user` records.
- Hook context shows in a transcript as an `attachment` of type `hook_additional_context` with `hookEvent`, `hookName`, `toolUseID`: the evidence for any "does this hook output reach the agent" probe. History here: PostToolUse and PreToolUse Write reached subagents, SubagentStart was never emitted.
- `Read` does not dedupe: two whole reads of an unchanged file returned the content twice (2.1.316).
- Hooks are snapshotted at session start, so a new hook cannot be probed in the session that registers it: probe in a temp project outside the repository.
- Transcripts are pruned after 30 days: write a baseline into `research/` on the day it is measured.

Project facts:

- `planAssignments()` returns null for a plan whose Steps `Phase` cells have no phase number, which is what `templates/feature/PLAN.md` shows: plan-aware rework silently fell back for #10. ADR-0031 decision 1 makes `<N>: <label>` a shape rule.
- `templates/**` is not in `PROTECTED`; `scripts/lib/**` is. The issue's scope hint had it the other way round.
- ESLint (`npm run lint`, `lint:js`) lints `.mjs` files under `docs/features/*/research/`: a scratch script uses `process.stdout.write`, not `console.log`.
- Nine features since ADR-0018: PLAN.md 18.6K-41.5K bytes, CONTEXT.md 8.3K-36.5K, SCREENS.md 23.2K-92.6K. A role brief of #10 is an estimated 53-62% of PLAN plus CONTEXT and always above the 10,000-character hook limit.
- Step 4 migration (2026-11-11), measured briefs: #10 `cap-backend-dev` 47,508 bytes, `test-backend` 46,514, `fiori-app-dev` 46,085, `test-ui` 44,922, `ui-verifier` 8,931, `docs-keeper` 17,531; #44 `cap-backend-dev` 55,677 (six steps in one phase), `test-backend` 48,973 / 39,429, `docs-keeper` 14,744. `recordCeilings()` replaced each group's ceiling with the last recorded feature's figure (no max), so ceilings recorded from #10 would make #44's own check red. User decision Q10 (2026-11-11): the ceiling is the per-group maximum over both migrated folders and `--record` merges by maximum (never lowers; a lower ceiling is a retro decision with a CHANGELOG line); PLAN criterion "Brief record", step 5 Files. The amendment itself grew the #44 `cap-backend-dev` 2 brief to 57,639 bytes: a figure quoted in a plan describes the documents before the edit that quotes it.
- Marking rules learned in the migration: a `###` subsection runs to the next heading, so paragraphs after a table belong to it; split with an `All` heading before you mark a table `UI`. A criterion that spans the two model phases (contract test, `metadata.xml` per phase) goes under `### Every phase`, or the other phase's brief loses it. `### Every phase` may sit between phase sections; the order is free, and keeping it in place makes the word diff pure insertions.

**Why:** the issue assumed check output and repeated reads were the bulk; the measurement moved the weight to the role brief and to the relays. Re-deriving it costs a session and the transcripts expire.

**How to apply:** when the plan gate answers Q1-Q7, reconcile PLAN, CONTEXT and ADR-0031 in one step. For any later "context" claim, measure with the transcript scripts first. See [[claude-code-transcript-facts]], [[pipeline-hook-output-and-state-drift]], [[hook-lint-gates]].
