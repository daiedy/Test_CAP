---
name: sandbox-hook-run-from-scratch
description: How to satisfy the pipeline-config "run each hook once from a sandbox copy" rule without a test file - drive createSandbox() from a /tmp scratch .mjs with a stubbed global expect
metadata:
  type: feedback
---

To run new or changed hooks once from a sandbox copy before registering them (pipeline-config rule) when test files belong to a later step, import `test/fixtures/hook-sandbox.mjs` by absolute path from a scratch script under `/tmp/<task>/run.mjs` and set `globalThis.expect = () => ({ toMatch() {} })` first: `appended()` calls the vitest global `expect`, and `box.log()` / `box.hook()` work without it. `createSandbox({ files })` takes extra files (a small fixture feature from `templates/feature/*.md` gives an inline brief, the real feature docs a pointer brief). It copies only `scripts/hooks`, `scripts/lib`, `scripts/i18n`, not the `scripts/*.mjs` CLIs; for a lib function that writes into `test/` (e.g. `recordCeilings()`), use a separate mkdtemp root.

For a red lint, copy `app/products/{ui5.yaml,package.json,eslint.config.mjs,webapp/manifest.json}` to `app/demo/`, symlink `app/demo/node_modules` to `app/products/node_modules`, and add `node_modules` to `.gitignore` via `files`; for a red `npm test` in `stop-gate.mjs`, add a sandbox `package.json` (`"type": "module"`, `"test": "vitest run --silent"`), symlink the root `node_modules` to the repo's, touch STATE and CHANGELOG, and give every `box.hook()` a fresh offline npm cache (`npm_config_cache`, `npm_config_offline`, `npm_config_update_notifier=false`). `resetTree()` keeps the ignored symlinks (step 6, 2026-11-11).

**Why:** step 5a of #44 (2026-11-11) needed the evidence (exact stdin JSON and output per run) and test files were reserved for step 9; the child env of `box.hook()` already strips `PIPELINE_ALLOW_PROTECTED`.

**How to apply:** any hook change under `scripts/hooks/` or `scripts/lib/`; print stdin, stdout and the appended metrics and ledger records per run and paste them into the report. See also [[worktree-bash-guard-file-writes]].
