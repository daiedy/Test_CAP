---
name: file-checks-temp-app
description: How to test checkUi5/runFileChecks of scripts/lib/file-checks.mjs on a temp app without network or vacuous greens - npx walk-up, ui5lint 404, which app ESLint rules fire under webapp/test and localService
metadata:
  type: project
---

`test/hooks-file-checks.test.js` (docs-toolchain step 4, 2026-10-25) calls the live
`runFileChecks(tmp, r)` on a realpath temp root, as `hooks-registry-gate.test.js` does. That is
allowed because the lib writes only `<root>/docs/registry/.stale`, and ESLint and ui5lint only read.
Apps are copies of the `app/products` files `ui5.yaml`, `package.json` and `eslint.config.mjs`, plus a
`node_modules` symlink. Nothing is written into the linked `node_modules`, which was checked with `find -newer`.

**Why:** `checkUi5` runs `npx ui5lint` for every app that has a `ui5.yaml`. npx looks for
`node_modules/.bin/<name>` in each directory from the app up to `/`, then globally, then on the
registry, and it assumes `--yes` without a TTY. With no install on that path, npx requests a package
named `ui5lint`, which does not exist (`npm view ui5lint` gives 404), and the note stays silently
null. It is a network call on each edit and a name-squatting risk. It was reported, not fixed.

**How to apply:**
- An "app without node_modules" case needs a `node_modules` link at the temp root, so that ui5lint
  resolves locally. The same link puts an ESLint on the walk-up path, which makes the
  `.bin/eslint` guard mutation-sensitive.
- To show a `webapp/test` exclusion with a real input: the app config keeps only `semi`,
  `linebreak-style` and `sap-opa5-autowait-true` there, so use a missing semicolon. A JSDoc gap
  alone gives no finding in `webapp/test`.
- If `webapp/localService/*.js` is named explicitly, ESLint warns "File ignored" (the config ignores
  it), so the hook's own exclusion is the only thing that keeps the note away.
- Cost: about 1.3 s per app ESLint run and 0.5 s per ui5lint call. A webapp `.js` file pays for both.
- Filter ESLint notes with `/^eslint[ :]/`: the timeout note is `eslint: 60 s limit exceeded.`
- Proof: a scratch copy of `scripts/` plus the test, and a `run.mjs` mutation runner, as in
  [[contract-test-red-proof]]. 13 of 13 mutations went red and 2 green controls stayed green, in about 2 min.
