# ADR-0018: Context budget by structure, not by line counts

Date: 2026-09-24. Status: accepted (user, 2026-09-24, pipeline chore `context-budget`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context

The pipeline's reading rules used line counts as a proxy for "short": the SessionStart hook printed the first 40 lines of `docs/STATE.md`, the protocol told every agent to read those 40 lines, the retro skill asked to keep `docs/LESSONS.md` under about 40 lines, and the upstream digest was cut at 16 lines. The number 40 came from the plan of 2026-09-06 as a guess of "one screen" and was never measured.

Measured on 2026-09-23: a line is neither a size unit nor a meaning unit. In `docs/STATE.md` one paragraph is one line of up to 3.7 KB, so the first 40 lines weighed 17 KB (about 4,300 tokens) and were injected into every session and read by every agent, while line 40 fell inside the "Open debt" table and cut seven of nine rows silently; the digest cut printed half of a 32-line section without saying so. The feature documents grew the same way: the templates weigh 1 and 2.3 KB, the last feature's `CONTEXT.md` and `PLAN.md` 62 and 46 KB, read whole by six agents in a row, with the 31 KB "Screens" section irrelevant to backend agents. Prompts and rules absorbed retro lessons as dated stories (12 lines in 9 files), and the MCP routing was restated in 15 files.

## Decision

Four principles replace every "N lines" rule:

1. The unit of a cut is a section or a file, never a line. A section is printed or read whole, or not at all.
2. The budget lives on the writer's side: a template fixes the shape, a check catches a shape violation, the reader reads whole and cuts nothing.
3. A safety cap is visible: when a printed section exceeds its cap, the output carries a marker naming how much was cut and where to read the rest. A silent cut is worse than no cap.
4. A number is taken from a measurement and pinned as a ratchet: the ceiling equals the measured value, and only an explicit retro decision, with a line in `docs/CHANGELOG.md`, raises it.

Applied as eight links:

- `docs/STATE.md` follows `templates/STATE.md`: `## Now` with six labeled lines, `## Open debt` as table rows, `## What works` as list items, `## Decisions` as a pointer. Narrative lives in `docs/CHANGELOG.md` and the feature `SUMMARY.md`. `stateShapeErrors()` in `scripts/lib/doc-shapes.mjs` is run by the PostToolUse check and blocks in `stop-gate.mjs`; `session-start.mjs` prints `Now` and `Open debt` by heading with a byte cap and a visible marker. The PreCompact note moves to `.pipeline/sessions.log`.
- Feature documents are split by audience: `PLAN.md` (one criterion per line, steps as table rows), `CONTEXT.md` (the implementers' brief), `SCREENS.md` (the `ux-designer` deliverable, read by UI roles only), `research/*.md` (experiments and facts, read by `architect` and `reviewer`). `planShapeErrors()` and `contextShapeErrors()` run on edit and at the phase 1 gate through `scripts/check-feature-docs.mjs`.
- Prompts and rules carry rules, not stories: a line may contain a date only as a pointer `(CHANGELOG YYYY-MM-DD)`. The MCP routing lives once, in protocol section 3 and `MCP_RULES`. `test/prompt-budget.test.js` pins the byte size of every prompt, rule and skill file recorded in `test/prompt-budget.json` (`node scripts/prompt-budget.mjs --record` after a retro decision) and rejects dated stories.
- `docs/CHANGELOG.md` is read by its top date section only (`docs-keeper`, `reviewer`); a past year is archived to `docs/changelog/<year>.md`.
- The `/feature` orchestrator passes a reading list per role and a "do not read" list; `reviewer` step 8 points to `docs/LESSONS.md` and `PATTERNS.md`.
- Agent memory topics name the ADR they depend on; the retro deletes a topic whose ADR is superseded.
- `readSection()` in `scripts/lib/hook-utils.mjs` replaces `readLines()`; display caps that print a count ("30 of N") stay.
- The retro skill keeps `docs/LESSONS.md` by shape (one `Pending` line per lesson with a destination), not by a line count.

## Alternatives

| Option | Why rejected |
|---|---|
| Keep line counts, tune the numbers (40 to 60, 16 to 32) | a line still measures nothing; the cut stays silent and lands mid-table again as soon as a paragraph grows |
| Token counts instead of lines | closer to cost, but still cuts mid-sentence, and a tokenizer is not available in a hook without a dependency |
| No caps at all, rely on prompts to keep files short | the files grew 30 to 60 times over their templates under exactly that regime |
| Trim on the reader's side with a summary step | spends tokens to save tokens, and every agent would summarize differently |

## Consequences

- Every session start costs about 1,000 tokens of project state instead of about 4,300; each feature agent reads the brief instead of 27,000 tokens of research.
- A STATE or PLAN edit that breaks the shape is reported on PostToolUse and blocks the Stop gate; a hand-written narrative can no longer accumulate there.
- Prompt growth becomes a decision: the ratchet test fails on growth until the retro records the new size.
- [x] `templates/STATE.md`, `templates/feature/CONTEXT.md`, `PLAN.md`, `SCREENS.md`
- [x] `scripts/lib/doc-shapes.mjs`, `hook-utils.mjs` (`readSection`), `file-checks.mjs`, `scripts/hooks/session-start.mjs`, `stop-gate.mjs`, `pre-compact.mjs`
- [x] `scripts/check-feature-docs.mjs`, `scripts/prompt-budget.mjs`, `test/doc-shapes.test.js`, `test/prompt-budget.test.js`, `test/prompt-budget.json`
- [x] protocol, `feature`, `spec`, `retro` skills; `architect`, `ux-designer`, `fiori-app-dev`, `test-ui`, `ui-verifier`, `reviewer`, `docs-keeper` prompts; rules with dated lines or restated MCP routing; CLAUDE.md invariants 1 and 9
- [x] `docs/STATE.md` reshaped; stale agent-memory topics removed
- [ ] First `/feature` run after this chore confirms the phase 1 shape gate and the reading list

## Sources

- Measurements of 2026-09-23 and 2026-09-24 (`wc -c` per section of `docs/STATE.md`, `docs/features/*/PLAN.md`, `CONTEXT.md`, `docs/CHANGELOG.md`; dated lines in `.claude/**`)
- Claude Code documentation: sub-agents (CLAUDE.md, preloaded skills and `MEMORY.md` are injected at subagent start; path rules load when a matching file is read), hooks (SessionStart, Stop, SubagentStop, PreCompact inputs), prompt caching (CLAUDE.md and hooks are snapshotted at session start)
- ADR-0014 (MCP audit), ADR-0016 (write route), ADR-0017 (generated files), `docs/ai-pipeline-plan.md` section 5.6 (origin of the 40-line rule)
