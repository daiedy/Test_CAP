# pipeline-state-hygiene: context

Date: 2026-10-05. Author: `architect`. Branch: `feature/pipeline-state-hygiene`. Issue: #15.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). There is no UI, so no `SCREENS.md`. Measurements, hook output facts and rejected mechanisms are in `research/state-drift.md`, read by `architect` and `reviewer` and by the steps that name it.

## Request
Pipeline state hygiene, two related gaps found on 2026-09-29 (issue #15). (1) The SessionStart briefing detects a "spec in progress" state (`docs/features/<name>/` exists for an open issue without the `spec-ready` label) instead of recommending `/spec #N` again, and warns when the `Branch:` / `Last commit:` lines of `## Now` in `docs/STATE.md` differ from git after an operation made outside the pipeline, such as a merge run through a `!` command. (2) `.claude/worktrees/` goes to `.gitignore` (and, in the user's words, to `PROTECTED_EXCEPTIONS`), so a parallel session's locked agent worktree does not trip the Stop gate's protected-file check, whose advice (`git checkout --`) would destroy that session's work. Evidence: `docs/LESSONS.md` `## Pending`, both 2026-09-29 entries; `/retro` removes them once this is done.

## User decisions
- Gate mode autonomous: only the plan approval and red checks stop the pipeline.
- No UI and no OData model change; pipeline tooling only.
- The current session has no `PIPELINE_ALLOW_PROTECTED=1`; phases 2-7 write protected paths (`scripts/lib/**`, `scripts/hooks/**`) and need a session the user starts with it.
- Keep the change independent of the pipeline-metrics code; reuse `projectNow()`.
- Plan approved 2026-10-06 with the four recommended answers; ADR-0023 accepted.
- STATE drift: warning only, the SessionStart briefing line plus one Stop `additionalContext` feedback per drift key, never exit 2.
- "Spec in progress" is derived from the folder only; no `Phase: spec` value in STATE.
- Worktrees: `.gitignore` plus an exemption of `.claude/worktrees/**` in `protectedWriteHit()` only; the guards keep denying writes into it; the untracked-entry block message drops the `git checkout --` advice; no `git worktree list` recognition (deliberate deviation from the issue's literal `PROTECTED_EXCEPTIONS`).
- No new prompt rule line; `test/prompt-budget.json` stays as recorded.

## Affected entities and services
No CDS entity, service or annotation is touched (`mcp__cds-mcp__search_model`: `CatalogService` and the template services only). The objects are pipeline scripts:

| Object | Exists now | What changes |
|---|---|---|
| `scripts/lib/backlog.mjs` `projectNow()` | branch, dirty count, last commit, `Feature:` / `Phase:` of `## Now` | moves to `scripts/lib/state-now.mjs` and is re-exported from `backlog.mjs` (same pattern as the `i18n.mjs` re-export); gains `stateBranch`, `stateCommit`, `behind` |
| `scripts/lib/state-now.mjs` | does not exist | new: `projectNow(root)`, pure `stateDrift(now)`, `driftKey(now)`, read/write of `.pipeline/state-drift.json`; imports only `hook-utils.mjs` |
| `scripts/lib/backlog.mjs` `buildQueue()`, `recommend()`, `renderBriefing()`, `renderQueueList()`, `collectBriefing()` | three states: `in-progress`, `spec-ready`, else `/spec` | a queue item gets `specDraft` (folder with `PLAN.md` or `CONTEXT.md`, no `spec-ready`, no `in-progress`); `recommend()` kind `review` ranks after `continue` and before the first unblocked item; the drift line is the last line of the briefing |
| `scripts/i18n/pipeline.properties`, `pipeline_ru.properties` | `briefing.*` keys | new `briefing.specdraft`, `briefing.recommend.review`, `briefing.drift.*` in both bundles |
| `scripts/hooks/session-start.mjs` | prints the briefing | no new code path beyond passing drift to the briefing and writing the drift key |
| `scripts/hooks/stop-gate.mjs` | check 4 protected audit, STATE shape, then exits early on a clean code tree | drift check before the early exit: `additionalContext` feedback once per key, never exit 2; check 4 advice for an untracked (`??`) entry no longer says `git checkout --` |
| `scripts/lib/protected-paths.mjs` `protectedWriteHit()` | exempts `PROTECTED_EXCEPTIONS` and generated files | also returns null for `.claude/worktrees/**` (git-based audit only); `protectedHit()` and the guards unchanged |
| `.gitignore` | `.pipeline/`, `.claude/.gate-state.json`, ... | `.claude/worktrees/` with a one-line comment |
| `test/hooks-metrics.test.js` | sandbox helpers local to the file | helpers move to `test/fixtures/hook-sandbox.mjs`, assertions unchanged |

## What already exists and is reused
`docs/registry/` covers `db/`, `srv/`, `app/` only; `scripts/lib/` was read by hand.
- `projectNow()` (`scripts/lib/backlog.mjs`): moved and extended, not copied.
- `readSection()`, `run()`, `currentBranch()`, `changedFiles()`, `isUnder()`, `emitJson()`, `exists()` (`scripts/lib/hook-utils.mjs`): all git calls, section reading and JSON output go through them; no second section reader or glob matcher.
- `STATE_NOW_LABELS` (`scripts/lib/doc-shapes.mjs`): the label names of `## Now`.
- `t()`, `loadBundle()` (`scripts/lib/i18n.mjs`): texts of the briefing.
- `protectedWriteHit()` vs `protectedHit()` split of ADR-0017: the worktree exemption goes into the git-based half, exactly like `docs/registry/**`.
- `.pipeline/` (gitignored) for the drift key, next to `issues.json` and the metrics logs.
- Test idioms: pure-function tests of `test/backlog.test.js`; the git sandbox of `test/hooks-metrics.test.js` (`spawnSync` with stdin JSON, `git init` in `os.tmpdir()`, real path), extracted once into `test/fixtures/hook-sandbox.mjs` and used by both files.
- Would be a mistake to write anew: a second `## Now` parser (post-edit.mjs keeps its own `Phase:` read, untouched), a second git wrapper, a new label or STATE value for "spec in progress", a `gate` metric reason for the feedback (it is not a block, `GATE_REASONS` stays).

## Applicable patterns
- PATTERNS "Language of the chat and the briefing": texts in `scripts/i18n/pipeline*.properties`, `en` and `ru` in the same change (ADR-0019).
- PATTERNS "Record a wish, order the queue": the recommendation is derived from issues plus local evidence, no new label (ADR-0019).
- ADR-0016 / ADR-0017 split: the PreToolUse guards use `protectedHit()`, the git-based gates `protectedWriteHit()`.
- ADR-0018: `## Now` keeps six labeled lines; the drift check reads them, never adds one.
- `.claude/rules/pipeline-config.md`: every changed hook passes `node --check` and a manual run with JSON on stdin (`printf '%s'`).
- No PATTERNS row for a non-blocking Stop hook feedback or for STATE drift: ADR needed, draft `docs/decisions/ADR-0023-pipeline-state-hygiene.md` (proposed).

## Relevant lessons
- LESSONS Pending 2026-09-29: STATE `## Now` goes stale after a `!` git command; the briefing has no "spec in progress" state (this feature).
- LESSONS Pending 2026-09-29: the Stop gate reads a parallel session's `.claude/worktrees/<name>/` as a protected change; local workaround `.claude/worktrees/` in `.git/info/exclude` (this feature).
- `.claude/rules/pipeline-config.md`: zsh `echo` breaks JSON on stdin; feed hooks with `printf '%s'` or a file.
- Agent memory `test-suite-shape`: re-derive test counts per plan (today 130 tests in 10 files).

## Open questions
None: the four plan-gate questions are decided, see "User decisions".
