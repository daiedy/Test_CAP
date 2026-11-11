---
name: hook-test-mutation-check
description: how to prove hook tests discriminate without touching scripts/ (scratch-root table harness, deny-mutation for allow-on-error rules), plus linter facts that decide which fixture text proves a skip
metadata:
  type: project
---

Tests must not change `scripts/**`, so a mutation check runs on a scratch root: copy `scripts/`, `test/fixtures/`, the test files, `package.json` and `vitest.config.*`; symlink `node_modules` and `app/products`; apply one string replacement per mutation; run `npx vitest run <files>` in the scratch root and list the red titles. `test/fixtures/hook-sandbox.mjs` resolves its root from its own location, so the sandbox copies the mutated scripts. On 2026-10-25 a mutation (dropping `APP_ESLINT_EXCLUDE` at SubagentStop) survived the first draft, which showed the draft could not prove the skip.

Linter facts behind that (app/products config, 2026-10-25):
- The app ESLint config has no error rule for `webapp/test/**` (`semi` is a warning there, an error elsewhere), and it ignores `webapp/localService/**` itself ("File ignored" warning). A pass at SubagentStop therefore proves nothing unless the text is unparsable: ESLint reports a fatal error (severity 2), while ui5lint reports nothing for a syntax error.
- npm writes one `_logs` file per npx call into `npm_config_cache`. A fresh empty cache that is still empty after the run proves that no linter ran. Set `npm_config_update_notifier=false`, or npm appends an update notice to stderr on the first call with a fresh cache.

Harness shape that worked (context-hygiene #44, 2026-11-11, 36 mutations in one background run): a `.mjs` written with Write OUTSIDE the repo (the Bash guard matches protected path names in command text), a table `[name, file, from, to, testFile, title]`, `npx vitest run <file> -t <title> --reporter=json --outputFile=...` per mutation, a control run without a mutation first, and a `MISSING` line when `from` is not found (it catches a pattern copied wrong).
- A safety rule that sits behind an outer `try/catch` that allows ("an unreadable ledger allows") is overdetermined: removing the null guard still allows through the catch. Mutate it to DENY instead (emit a deny where it returns) to prove the test.
- A cheap `lint` finding in a sandbox without an app: an untracked `scripts/*.mjs` plus `npm_config_offline=true` and an empty cache: root `npx eslint` fails fast without a JSON report, which the hand-over checks count as a lint error.

**Why:** a test that stays green under the mutation it is meant to catch only looks like coverage.

**How to apply:** for every new gate test, name the mutation each `it` catches, and run the harness before handing over. Related: [[feedback-turn-budget]].
