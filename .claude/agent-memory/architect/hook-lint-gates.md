---
name: hook-lint-gates
description: How the hook lint gates really behave (isUnder brace bug, SubagentStop ui5lint/app ESLint scope, npx fetch, empty-stdout-as-clean) and the ADR-0029 second amendment D-G that fixes them (2026-10-25)
metadata:
  type: project
---

Facts found in #27 step 4 part 1 (2026-10-25). Verify against the code before relying on them: part 2 implements the fixes.

- `globToRegExp` (`scripts/lib/hook-utils.mjs`) escaped `{`/`}` before its `{` branch, so `isUnder()` never expanded `{a,b}` although its JSDoc said so. The only brace glob in `scripts/**` was the SubagentStop ui5lint filter `app/**/webapp/**/*.{js,xml,html}`, so SubagentStop linted only `manifest.json`. Fix (amendment D): the `{` branch comes first, and one exported `UI5_SCOPE` in `file-checks.mjs` replaces both spellings.
- Decision 7 promised that SubagentStop blocks on app ESLint errors, but only ui5lint ran there. Amendment E adds an app ESLint pass for `webapp/**/*.js` outside `test/` and `localService/`.
- `npx ui5lint` without an app install walks up, then asks the registry (package `ui5lint` is a 404 today). Every reader parsed `stdout || '[]'`, so a crash (exit 2, stderr only) read as clean. Amendment F: a tool runs only if `<app>/node_modules/.bin/<tool>` exists; otherwise a "not installed" note and an advisory at SubagentStop. One JSON reader treats a non-zero exit without a report as a failure that blocks at SubagentStop. The root ESLint shares the reader but has no install check.
- ui5lint exit codes (`@ui5/linter` `lib/cli/base.js`): 1 with the JSON report when errors are found, 2 with the message on stderr only on failure.
- ui5lint lints XML only as `*.view.xml` and `*.fragment.xml` (`lib/linter/xmlTemplate/linter.js:9`). Any other path on its command line, such as `localService/metadata.xml`, fails the whole run with exit 2 and no report. So a glob that feeds ui5lint must follow its resource globs: `UI5_SCOPE` = `*.{js,html}`, `*.{view,fragment}.xml` and `manifest.json` (no exclusion list). The first amendment D draft (`*.{js,xml,html}`) missed this, because the spec checked the glob matcher but not what the tool accepts. It was caught by the implementer's stop condition. Probe recipe: a temp app (ui5.yaml, package.json, manifest, `node_modules` symlink) and a scratch `.mjs` that spawns `.bin/ui5lint` per path with `cwd`. JS under `test/` and `localService/`, HTML, and fragments answer exit 0 (2026-10-25).
- Dependabot: `@cap-js/openapi` (pinned 1.6.0, amendment A) is excluded from the `sap-cap` group (`exclude-patterns`, amendment G), so its red Swagger guard blocks only its own PR.

**Why:** a gate that silently checks nothing looks green. The user decided on 2026-10-25 to fix all four in-feature ([[feedback-fix-review-gaps-in-feature]]).

**How to apply:** when a plan step relies on a hook gate, check that the glob actually matches (there is a test now), that the tool is installed in the app, and that the step's agent cannot be blocked by existing findings (`npm run lint` and `lint:js` in `app/products` are clean as of 2026-10-25). Related: [[pipeline-hook-output-and-state-drift]].
