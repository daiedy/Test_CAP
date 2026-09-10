# ADR-0016: Shell writes are gated by the git state, not by trusting the write route

Date: 2026-09-10. Status: accepted (user, 2026-09-10, retro of `products-draft-marker`).

## Context

Until now every pipeline check hung off the `Edit`/`Write` tool calls. `protect-files.mjs` (PreToolUse) denies an edit of a protected path, `post-edit.mjs` (PostToolUse) runs the per-file-type checks and writes the ADR-0014 `edit` audit record, and `subagent-stop.mjs` compares those records with the MCP attempts. None of the three sees a `Bash` tool call, so a file written with redirection, a heredoc or a script skipped all of them at once.

This was found on 2026-09-09 in phase 3 of `products-draft-marker` and confirmed from the other side by the MCP audit log: `app/products/annotations/Products.cds` was changed by commit `1287c3c` and carries **zero** `edit` records, so the ADR-0014 gate could not see the single file the feature actually changed. The premise as first written in `docs/LESSONS.md` was too broad and was corrected during the retro: `subagent-stop.mjs` already lints whatever `changedFiles()` reports, whoever wrote it, so the lint half was never blind. What was missing for a shell-written file was `cds compile`, the Cyrillic and i18n scans, the sandbox and `ui5.yaml` lesson checks, the protected-path denial and the `edit` records.

The tension to respect: the shell route was also the project's own documented mechanism for maintaining protected files, because `PIPELINE_ALLOW_PROTECTED` is read from the Claude Code process environment and a hook only sees `Edit`/`Write`. A fix that closes the hole without leaving a human-held door shut the pipeline out of its own configuration — which is exactly what happened in the first implementation attempt of this ADR, when the guardrail locked the session out of the five fixes it still needed.

## Decision

Two layers, in this order of authority.

1. **The boundary is the git state.** `subagent-stop.mjs` compares the changed files with the `edit` audit records; the difference is what was written outside `Edit`/`Write`. Those files get the full per-file-type dispatch, now extracted into `scripts/lib/file-checks.mjs` and shared with `post-edit.mjs`, and any protected path among them blocks the hand-over with exit 2. `stop-gate.mjs` repeats the protected-path audit for the main thread. This layer cannot be evaded, because a write is visible in `git status` whatever produced it.
2. **A guardrail catches the ordinary accident early.** The new PreToolUse hook `protect-files-bash.mjs` (matcher `Bash`) pattern-matches the command for a write to a protected path. It **denies** a subagent — an unattended `/feature` run must not stall on a prompt, and a subagent has no business editing the pipeline's own configuration — and returns **`ask`** for the main thread, so the user approves a deliberate maintenance edit in the moment rather than restarting the session. Its false negatives (a path built at runtime, a generator, base64) are accepted by design; layer 1 is what catches those.

The only sanction either layer honours is `PIPELINE_ALLOW_PROTECTED=1`, read from the Claude Code process environment, which an agent cannot set for itself: a variable exported inside a Bash command reaches that command's shell, not the hook. `scripts/lib/**` joins the protected list, because the checks themselves now live there.

The decision table of the guardrail is pinned by `test/hooks-protect-bash.test.js` (6 tests, 23 assertions) rather than by a manual smoke run.

## Alternatives

| Option | Why rejected |
|---|---|
| A PostToolUse `Bash` hook that re-runs the checks over `git status` after every shell call | Cannot attribute a write to one agent among several running in parallel, or tell it from `prettier --write`, a build or a test run; and it taxes the most-used tool in the pipeline on every call. The same attribution objection already rejected a git-status check in ADR-0014 |
| Documentation only: a rule line telling agents to use `Edit`/`Write` | This is the status quo that produced the finding, and it competes with a harness setting that nudges the model to edit through Bash. Compliance is unmeasurable |
| Narrow the `Bash` grant per agent (`Bash(git *)`, `Bash(npm *)`) | Prefix patterns cannot express "write" versus "read": `Bash(node *)` still permits `node -e "fs.writeFileSync(...)"`. Costs more in interrupted runs than it saves |
| Treat a `chore/*` branch as sanction, next to the environment variable | Tried in the first implementation and removed: a branch name is not a boundary, `git checkout -b chore/x` is one command away for any agent. It would have been a lock the agent holds the key to |
| `ask` for subagents too, so nothing is ever hard-denied | Stalls an unattended `/feature` run on a permission prompt. `deny` lets the agent adapt and report instead |
| Keep `deny` for the main thread and rely on restarting with the environment variable | Works, and it is how this very change was applied, but it forces a session restart for every pipeline chore and switches the guard off for everything at once. `ask` keeps the boundary and narrows it to one approval |

## Consequences

- `scripts/lib/file-checks.mjs` and `scripts/lib/protected-paths.mjs` are new and shared; `post-edit.mjs` shrinks from 306 to 41 lines and is now only the audit record plus the dispatch call.
- `subagent-stop.mjs` also lints `scripts/**/*.mjs` and `scripts/**/*.js`, which it did not before — the gap that let four `no-useless-escape` errors into the first version of the guardrail.
- A pipeline chore needs either the user's approval at the `ask` prompt or a session started with `PIPELINE_ALLOW_PROTECTED=1`. Rule `pipeline-config.md` says so.
- The per-file checks at hand-over are capped at 12 files, and the gate says out loud when it skipped some.
- `docs/LESSONS.md` loses its last pending decision.

## Sources

- `docs/LESSONS.md`, entry of 2026-09-09 corrected 2026-09-10; `docs/CHANGELOG.md` 2026-09-09 "pipeline"; `.pipeline/mcp-audit-*.jsonl` of the marker run (267 records, zero `edit` records for `app/products/annotations/Products.cds`).
- Claude Code hooks reference: `PreToolUse` accepts `permissionDecision` `"allow" | "deny" | "ask"`, where `"ask"` shows the user a permission prompt; a hook process inherits the parent environment.
- ADR-0009 (pinned versions and protected configuration), ADR-0014 (MCP audit soft gate).
