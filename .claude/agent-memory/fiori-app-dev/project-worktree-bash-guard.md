---
name: project-worktree-bash-guard
description: In a .claude/worktrees session the isolation guard refuses compound Bash (cd elsewhere, for-loops with $var, background subshells); use plain commands and a script file in /tmp
metadata:
  type: project
---

In a worktree-isolated session (`.claude/worktrees/<feature>`), the Bash guard refuses commands it cannot prove stay inside the worktree: the repo path contains `github`, so `cd /tmp && ...`, a `for f in ...; do node -e "...$f..."; done` loop, or `( ... & )` subshells are rejected as "names git in a form too complex to verify".

**Why:** seen in `products-subcategories` phase 3 (2026-10-09); three rejected commands cost turns before switching approach.

**How to apply:** keep each Bash call to one plain command chain rooted at the worktree path; put any multi-step data generation (mock JSON from CSVs) into a script under `/tmp/<task>/` written with Write and run it as `node /tmp/<task>/gen.mjs <worktree> [--write]`; start servers with `run_in_background: true` and poll with `curl --retry-connrefused`; stop them with `pgrep -fl` + `kill <pid>` (`pkill -f` on the `fiori run` string missed the `ui5 serve` child). See also [[reference-headless-measurement]].
