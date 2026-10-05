---
name: hook-sandbox
description: How to test hooks that write .pipeline/ or inspect the git tree (subagent-stop, stop-gate, session-start, post-edit) without touching the real repo; the macOS tmpdir symlink pitfall
metadata:
  type: project
---

Run hooks from a sandbox: `fs.realpathSync(fs.mkdtempSync(...))`, copy `scripts/hooks`, `scripts/lib`, `scripts/i18n` into it, add `.gitignore` (`.pipeline/`, `.claude/.gate-state.json`), `git init -b <branch>` and commit with `-c user.name/-c user.email/-c commit.gpgsign=false/-c core.hooksPath=/dev/null`. `repoRoot()` follows the script's own location, so every write lands in the sandbox and the git-based gates (changed files, protected paths, STATE shape) see a known tree; mutate with files + `git checkout -- . && git clean -fdq` in `finally`. Reference: `test/hooks-metrics.test.js` (step 8 of `pipeline-metrics`, 2026-09-29).

**Why:** on the real tree `subagent-stop`/`stop-gate` results depend on whatever is uncommitted (eslint, protected writes, PIPELINE_ALLOW_PROTECTED inherited from the user's session), and `session-start`/`pre-compact`/`post-edit` overwrite or append to real `.pipeline/` files. The realpath matters: macOS `os.tmpdir()` is `/var/...`, a symlink to `/private/var/...`; ESM `import.meta.dirname` is the real path, so a `file_path` under `/var/...` falls outside the repo and `post-edit` silently exits (cost one red run).

**How to apply:** any test that spawns a hook with side effects. In the child env delete `PIPELINE_ALLOW_PROTECTED`, `PIPELINE_SKIP_GATE` and the GitHub tokens, set an empty `GH_CONFIG_DIR` (see [[metrics-cli-offline]]), and `npm_config_update_notifier=false` when `stop-gate` reaches `npm test`. Never symlink `node_modules` into the sandbox unless eslint must run: `npx` without a local install downloads.
