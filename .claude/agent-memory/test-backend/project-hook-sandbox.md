---
name: hook-sandbox
description: How to test hooks that write .pipeline/ or inspect the git tree (subagent-stop, stop-gate, session-start, post-edit) without touching the real repo; the shared createSandbox() fixture, the macOS tmpdir symlink pitfall, worktree and language traps
metadata:
  type: project
---

Use `createSandbox({ prefix, session, files })` from `test/fixtures/hook-sandbox.mjs` (extracted 2026-10-07, pipeline-state-hygiene step 4; used by `hooks-metrics`, `hooks-state-hygiene` and the `projectNow()` part of `backlog.test.js`). It returns `{ root, git, put, rev, commit, resetTree, hook, log, appended, remove }`: a realpath temp repo with copies of `scripts/hooks`, `scripts/lib`, `scripts/i18n`, `.gitignore` (`.pipeline/`, `.claude/.gate-state.json`), `stateDoc()` STATE and a CHANGELOG committed as `init` on `feature/fixture-live`; `hook()` strips `PIPELINE_ALLOW_PROTECTED`, `PIPELINE_SKIP_GATE` and GitHub tokens and sets an empty `GH_CONFIG_DIR`. Do not write a second sandbox helper: the reviewer treats it as a duplicate.

**Why:** `repoRoot()` follows the script's own location, so every hook write lands in the sandbox and the git-based gates see a known tree. The realpath matters: macOS `os.tmpdir()` is `/var/...`, a symlink to `/private/var/...`; a `file_path` under `/var/...` falls outside the repo and `post-edit` silently exits.

**How to apply:**
- Prefer one sandbox per `it` when the test depends on the history or on `.pipeline/state-drift.json`; `remove()` in `finally`.
- Pass `{ PIPELINE_LANG: 'en' }` to a SessionStart hook: the session running `npm test` may carry `PIPELINE_LANG=ru` and the briefing would switch language.
- `npm_config_update_notifier=false` when `stop-gate` reaches `npm test`; a committed `package.json` with `"test": "node -e 0"` plus a `test/*.test.js` lets the full gate pass in the sandbox.
- A `git worktree add` checkout shows as one entry `?? <path>/` in `git status --porcelain -uall`; do not `resetTree()` (git clean) after creating one, remove the sandbox instead.
- Paths containing the protected `.claude/worktrees` string go into files via Write, never into Bash command text (the PreToolUse Bash guard matches it). Mutation proofs: [[contract-test-red-proof]].
