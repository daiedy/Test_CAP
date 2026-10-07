# pipeline-state-hygiene: verification

Date: 2026-10-07. Agent: `test-backend` (PLAN step 6), then the orchestrator (live Stop check). Short form: no UI, so no scenario table, network evidence or browser console; every command below ran on the committed tree `0dfe23d`, with only the orchestrator's `Phase:` edit of `docs/STATE.md` and the foreign untracked `docs/codemie/` in the working tree.

## Automated tests
`npm test` on the committed tree (criteria 1-8 and 12); per-file counts from `npx vitest run --reporter=verbose`.
```
 Test Files  11 passed (11)
      Tests  137 passed (137)
   Start at  04:04:49
  11 test/backlog.test.js
  45 test/catalog-service.test.js
   9 test/doc-shapes.test.js
   8 test/hooks-metrics.test.js
   6 test/hooks-protect-bash.test.js
   8 test/hooks-registry-gate.test.js
   3 test/hooks-state-hygiene.test.js
   9 test/metadata.test.js
  15 test/metrics.test.js
  20 test/products-import.test.js
   3 test/prompt-budget.test.js
test/prompt-budget.json: unchanged against HEAD
```
Result: passed; 137 tests in 11 files, as planned.

## Syntax: `node --check` on the changed `.mjs` (criterion 11)
`git diff --name-only bb8bf9e 0dfe23d -- '*.mjs'` lists six files: the five scripts plus the test fixture, all checked.
```
node --check scripts/lib/state-now.mjs -> exit 0
node --check scripts/lib/backlog.mjs -> exit 0
node --check scripts/lib/protected-paths.mjs -> exit 0
node --check scripts/hooks/session-start.mjs -> exit 0
node --check scripts/hooks/stop-gate.mjs -> exit 0
node --check test/fixtures/hook-sandbox.mjs -> exit 0
```
Result: passed.

## Lint and format: `npx eslint scripts test`, `npm run format:check` (criterion 11)
```
$ npx eslint scripts test
npx eslint scripts test -> exit 0          (no findings printed)

$ npm run format:check
> prettier --check --no-error-on-unmatched-pattern "srv/**/*.js" "test/**/*.js" "scripts/**/*.mjs"
Checking formatting...
All matched files use Prettier code style!
npm run format:check -> exit 0
```
Result: passed.

## Worktrees ignored: `git check-ignore -q .claude/worktrees/demo/x` (criterion 9)
Run directly in the repository; the PreToolUse Bash guard let the read-only command through, so no scratch script was needed.
```
$ git check-ignore -q .claude/worktrees/demo/x; echo "exit $?"
exit 0
$ git check-ignore -v .claude/worktrees/demo/x
.gitignore:70:.claude/worktrees/	.claude/worktrees/demo/x
```
Result: passed (exit 0; the matching rule is the ADR-0023 line of `.gitignore`).

## SessionStart smoke (criterion 10, the start half)
`printf '%s' '{"source":"startup"}' | node scripts/hooks/session-start.mjs` on the real repository. STATE `## Now` says `Branch: feature/pipeline-state-hygiene`, `Last commit: 0dfe23d` = HEAD (0 behind), so no drift line is expected and none is printed. The briefing is in `ru` because `PIPELINE_LANG=ru` is set for this machine; the three uncommitted files are the orchestrator's STATE edit, the foreign `docs/codemie/` and this file.
```
exit 0
valid JSON; keys: systemMessage, hookSpecificOutput | hookEventName: SessionStart
--- systemMessage ---
Брифинг
Язык: ru (PIPELINE_LANG в .claude/settings.local.json, env)
Сейчас: фича pipeline-state-hygiene (#15), фаза 4: verification, ветка feature/pipeline-state-hygiene, незакоммиченных файлов: 3, последний коммит 0dfe23d feat(pipeline): pipeline-state-hygiene briefing, drift feedback, worktrees.
Очередь: P2 #8 products-subcategories, #9 products-details-section (после #8), #10 products-validations, #11 sandbox-flex-connector, #15 pipeline-state-hygiene (в работе)
Рекомендуется сейчас: продолжить #15 pipeline-state-hygiene (в работе, /feature #15).
Последняя записанная фича: pipeline-metrics (#14), стоимость $125.22, активно 9ч 50м, доработки 16% стоимости (node scripts/metrics.mjs compare).
Открытый долг: 14 пункт(ов), docs/STATE.md.
--- additionalContext: STATE drift present: false | length 5323
.pipeline/state-drift.json: absent before and after the run (no drift, no key written)
```
Side effect: one `session` record in the gitignored `.pipeline/metrics-unknown.jsonl` (no `session_id` on stdin); `.pipeline/current-session` untouched.
Result: passed (valid JSON, exit 0, no drift line on a STATE that matches git). The stale case is pinned in the sandbox by `test/hooks-state-hygiene.test.js` "SessionStart prints the drift and records its key".

## Stop smoke (criterion 10, the gate half)
`printf '%s' '{"stop_hook_active":false}' | node scripts/hooks/stop-gate.mjs` on the committed tree. Working tree at the run:
```
 M docs/STATE.md                                         (orchestrator's Phase/Last commit/Next edit, left as is)
?? docs/codemie/                                         (foreign untracked folder, left as is)
?? docs/features/pipeline-state-hygiene/VERIFICATION.md  (this file)
```
None of them is a protected path or under the code paths (`db srv app test _i18n`: 0 entries), and STATE names HEAD, so the gate has nothing to block and no drift to report. The session carries `PIPELINE_ALLOW_PROTECTED=1`, so the gate also ran a second time without it (`env -u PIPELINE_ALLOW_PROTECTED`) to rule out a hidden protected-path block.
```
run 1 (session env):                     exit 0, stdout empty, stderr empty
run 2 (PIPELINE_ALLOW_PROTECTED unset):  exit 0, stdout 0 bytes, stderr 0 bytes
.pipeline/state-drift.json: absent (no drift, no advice, no key)
records (.pipeline/metrics-unknown.jsonl, no session_id on stdin):
{"ts":"2026-10-07T00:04:17.171Z","event":"turn-end","blocked":false}
{"ts":"2026-10-07T00:04:24.921Z","event":"turn-end","blocked":false}
```
Result: passed. The gate says nothing and exits 0 on the clean tree; there is no `gate` record and no `additionalContext`. The drift advice itself (once per key, exit 0, silent under `stop_hook_active`) is pinned in the sandbox by `test/hooks-state-hygiene.test.js` "Stop gives drift feedback once and never blocks"; the live advice is the orchestrator's check below.

## Briefing: `node scripts/backlog.mjs briefing` (criterion 10, the start half)
Run in the machine's language (`ru`) and once with `PIPELINE_LANG=en`. As expected, there is no drift line: STATE names HEAD, 0 behind, same branch. The live queue also shows criterion 2 on real data: `docs/features/pipeline-state-hygiene/` holds `PLAN.md`, but #15 carries `in-progress`, so it is tagged "in work" and continued, not "plan drafted".
```
## Брифинг
Язык: ru (PIPELINE_LANG в .claude/settings.local.json, env)
Сейчас: фича pipeline-state-hygiene (#15), фаза 4: verification, ветка feature/pipeline-state-hygiene, незакоммиченных файлов: 3, последний коммит 0dfe23d feat(pipeline): pipeline-state-hygiene briefing, drift feedback, worktrees.
Очередь: P2 #8 products-subcategories, #9 products-details-section (после #8), #10 products-validations, #11 sandbox-flex-connector, #15 pipeline-state-hygiene (в работе)
Рекомендуется сейчас: продолжить #15 pipeline-state-hygiene (в работе, /feature #15).
Последняя записанная фича: pipeline-metrics (#14), стоимость $125.22, активно 9ч 50м, доработки 16% стоимости (node scripts/metrics.mjs compare).
Открытый долг: 14 пункт(ов), docs/STATE.md.
exit 0

## Briefing
Language: en (PIPELINE_LANG in .claude/settings.local.json, env)
Now: feature pipeline-state-hygiene (#15), phase 4: verification, branch feature/pipeline-state-hygiene, 3 uncommitted file(s), last commit 0dfe23d feat(pipeline): pipeline-state-hygiene briefing, drift feedback, worktrees.
Queue: P2 #8 products-subcategories, #9 products-details-section (after #8), #10 products-validations, #11 sandbox-flex-connector, #15 pipeline-state-hygiene (in work)
Recommended now: continue #15 pipeline-state-hygiene (in work, /feature #15).
Last recorded feature: pipeline-metrics (#14), cost $125.22, active 9h 50m, rework 16% of cost (node scripts/metrics.mjs compare).
Open debt: 14 item(s), docs/STATE.md.
exit 0
```
Result: passed (exit 0 in both languages, no drift line on a matching STATE).

## Live Stop check (orchestrator)
Criterion 10, observed on 2026-10-07 in the live session (Claude Code, session started with `PIPELINE_ALLOW_PROTECTED=1`, HEAD `0dfe23d`). The orchestrator set `Last commit:` in `## Now` to `fdd2a82` (two first-parent commits behind HEAD) with the Edit tool and ended the turn. The next turn opened with exactly one entry, delivered by Claude Code as "Stop hook additional context":

```
Stop hook advice (ADR-0023, once per drift, nothing is blocked): STATE drift: Last commit fdd2a82 is 2 first-parent commits behind HEAD. Update Branch, Last commit and Next in ## Now of docs/STATE.md. Git now: branch feature/pipeline-state-hygiene, HEAD 0dfe23d feat(pipeline): pipeline-state-hygiene briefing, drift feedback, worktrees.
```

- No hook error and no block: the turn ended normally, the advice arrived as context, not as a "Stop hook error" or a blocking reason.
- The key was recorded once: `.pipeline/state-drift.json` holds `{"key":"feature/pipeline-state-hygiene 0dfe23ddddde94e8b40c22af4694a0a4a75ea089 feature/pipeline-state-hygiene fdd2a82","at":"2026-10-07T00:05:57.354Z"}`.
- STATE restored right after: `Last commit: 0dfe23d ...` with the Edit tool.
- Naming: the harness labels the entry "Stop hook additional context", not "Stop hook feedback" as PLAN criterion 10 words it; the content and the count match the criterion.

## Verdict
ready for review

- Criterion 9 (`git check-ignore`): passed.
- Criterion 11 (`node --check`, eslint, format): passed.
- Criterion 10 (live Stop feedback): passed, one advisory entry, no hook error, STATE restored.
- Criterion 12 (prompt budget): passed, `npm test` green with `test/prompt-budget.json` unchanged.
