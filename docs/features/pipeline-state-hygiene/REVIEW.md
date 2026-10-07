# pipeline-state-hygiene: review

Date: 2026-10-07. Reviewer: `reviewer` (PLAN step 7). Scope: `git diff fdd2a82..HEAD` (code commit `0dfe23d`) plus the uncommitted `docs/STATE.md`, `PLAN.md` ticks and `VERIFICATION.md`. `docs/codemie/` is a foreign untracked folder, out of scope.

## Blocking
- none

## Important
- none

## Minor
- `docs/features/pipeline-state-hygiene/VERIFICATION.md:122,131` vs `PLAN.md:19,33` (criterion 10, step 6 check): the harness labels the advice "Stop hook additional context"; the criterion and step 6 say "Stop hook feedback", after the hooks-page quote in `research/state-drift.md` section 2 ("shown in the transcript as hook feedback"). The content and the count (one entry, no hook error) match, so the tick holds and the approved PLAN text stays as is → `docs-keeper` (step 8): the new PATTERNS row "Advisory from a Stop hook" and `SUMMARY.md` name the label as observed ("Stop hook additional context", Claude Code 2.1.289), so the next live check does not look for a string that never appears.
- `docs/STATE.md:11` (uncommitted): `Last commit: 0dfe23d feat(pipeline): pipeline-state-hygiene drift, worktrees`, but `git log -1 --format='%h %s' 0dfe23d` prints `0dfe23d feat(pipeline): pipeline-state-hygiene briefing, drift feedback, worktrees`. Not a budget cut: with the real subject `statePrintedBytes()` is 4066 of 4096. The drift rule reads only the hash, so nothing fires; it is still a STATE line that misquotes git in the feature that teaches STATE to match git → `docs-keeper` (step 8): copy the subject verbatim (`git log -1 --format='%h %s'`) when it next writes `## Now`.
- `scripts/lib/backlog.mjs:109-110` (`recommend()`), `test/backlog.test.js` "marks a drafted spec and recommends its review": implementer choice (a), a drafted spec is recommended for review even when its issue is blocked. Not a defect: ADR-0023 decision 1 orders "a drafted spec" before "the first unblocked item" and qualifies only the latter; a draft of a blocked issue exists only when the user ran `/spec` on it deliberately, approving it is valid work, approval sets `spec-ready` and the recommendation moves on; the queue tag still shows "after #M". But no assertion pins the blocked case, so a later "only unblocked drafts" edit would pass every test silently → `docs-keeper` (step 8): state "blocked or not" in the PATTERNS row; optionally one assertion (a blocked draft still gives `kind: 'review'`) in a later `test-backend` change.

## Checked and in order
Step 7 list:
- No second `## Now` parser: `readSection(..., '## Now')` callers are `state-now.mjs:55` (the moved `projectNow()`, its `line()` regex byte-identical to the removed one in `backlog.mjs`), `post-edit.mjs:31`, `doc-shapes.mjs` and the `session-start.mjs:100` print, the last three untouched by the diff.
- No second git wrapper: the only added `run('git', ...)` is the local lambda of `projectNow()` (`state-now.mjs:53`), moved from `backlog.mjs`; `currentBranch()`, `run()`, `readSection()`, `exists()`, `emitJson()` come from `hook-utils.mjs`.
- No second sandbox helper: `test/fixtures/hook-sandbox.mjs` is the extraction; `hooks-metrics.test.js` imports it and its `it(`/`expect` lines diff to zero against `fdd2a82` (only helper bodies moved); `backlog.test.js` and `hooks-state-hygiene.test.js` import the same file.
- No new label, STATE value or `GATE_REASONS` entry: `LABELS` unchanged, `metrics-log.mjs`, `doc-shapes.mjs`, `templates/` absent from `git diff --stat`; the drift test asserts `records` equal `[{event:'turn-end', blocked:false}]` (no `gate`).
- Guards still deny `.claude/worktrees/**`: `protectedHit()` unchanged (diff touches only `protectedWriteHit()` and adds `WORKTREES`); its consumers are `protect-files.mjs:33` and `protect-files-bash.mjs:93`. Probed in a scratch copy of `scripts/` with `PIPELINE_ALLOW_PROTECTED` unset: Write into `.claude/worktrees/demo/notes.md` gives `permissionDecision: "deny"`; Bash `echo x > .claude/worktrees/demo/notes.md` and `cp a .claude/worktrees/demo/scripts/hooks/x.mjs` give `"ask"`, the Bash guard's normal decision for every protected path. `subagent-stop.mjs:196` and `stop-gate.mjs:123` use `protectedWriteHit()`, so the exemption covers both git audits, as ADR-0023 decision 3 says.
- No Cyrillic outside `pipeline_ru.properties`: a Perl scan of every file in the range plus the uncommitted ones finds it only in `scripts/i18n/pipeline_ru.properties` and asserted values of `test/backlog.test.js`; `VERIFICATION.md` quotes the rendered `ru` briefing, which `file-checks.mjs:110` exempts.

Implementer choice (b): when the drift advice fires on the full-pass path, its JSON replaces the `Stop gate passed. <notes>` stdout (`stop-gate.mjs:99-107, 267`). Not a defect: research section 2 quotes the hooks page that a Stop hook's exit-0 stdout goes to the debug log only, so the replaced line never reached Claude or the user; a hook that emits structured output must print one JSON object, so printing both would break the parse; `hooks-state-hygiene.test.js:165` pins it. Side note, not in this diff: the `docs/LESSONS.md holds N entries; run /retro` note travels on the same debug-only line, so it has never reached anyone.

Plan conformance and code:
- Criteria 1-12 are met and tested as PLAN names them; criterion 13 (documentation) is step 8. The ADR-0023 decisions match the code: `MAX_BEHIND = 1`, `--first-parent`, branch check skipped on a detached HEAD, the key holds branch, HEAD and both STATE values, a later block leaves the key unrecorded (`hooks-state-hygiene.test.js:127-135`), the untracked-entry message without `git checkout --` (`:224`).
- Drafted spec: `specDrafts()` has no existing equivalent (the other `readdirSync` callers list `.claude/agents`, the registry sources and a single feature folder); the queue match is folder name to the issue name before `:`, the name the recommendation text prints as `docs/features/{1}/`.
- `projectNow()` display unchanged on the real repo: `node scripts/backlog.mjs briefing` (en) prints no drift line (STATE names HEAD `0dfe23d`).
- The stop gate now imports `backlog.mjs` (and through it `pipeline-metrics.mjs`) for `renderDriftLine()`; measured load time 0.05 s, the same as `state-now.mjs` alone, and `session-start.mjs` already had that dependency.
- Changes outside the plan: only `.claude/agent-memory/{architect,test-backend}/**` (in `PROTECTED_EXCEPTIONS`, English).
- Expected at this point, owned by `docs-keeper` (step 8): CHANGELOG has the `test` line but not the `pipeline` line; STATE "What works" still says 130 tests in 10 files; PATTERNS row and SUMMARY absent; the registry is fresh and unchanged.

Commands run by the reviewer (2026-10-07):
- `npm test`: `Test Files 11 passed (11)`, `Tests 137 passed (137)`, exit 0.
- `npm run lint`: 0 errors, 2 `no-console` warnings, both in the gitignored `.pipeline/verify/build-verify-workbooks.mjs`, not in the diff.
- `npx eslint scripts test`: exit 0, no output.
- `npm run format:check`: "All matched files use Prettier code style!", exit 0.
- `node --check` on the six changed `.mjs`: all ok.
- `node scripts/check-docs-fresh.mjs`: "docs/registry is fresh.", exit 0.
- `git check-ignore -v .claude/worktrees/demo/x`: `.gitignore:70:.claude/worktrees/`, exit 0.

## Verdict
ready to commit
