# pipeline-state-hygiene: measurements and framework facts

Date: 2026-10-05. Author: `architect`. Read by `architect` and `reviewer`; plan steps 2 and 4 name this file for `cap-backend-dev` and `test-backend`.

## 1. Why `Last commit:` cannot simply equal HEAD

A committed `docs/STATE.md` cannot name the commit that contains it. Every commit that carries a STATE update therefore names its parent (on a merge, the first parent or the merge base). An exact `Last commit == HEAD` rule would fire after every pipeline commit.

Probe (read-only, 2026-10-05, on the real history): for each commit C, the `Last commit:` hash H stored in `C:docs/STATE.md`, then `git merge-base --is-ancestor H C`, `git rev-list --count --first-parent H..C` and `git rev-list --count H..C`.

| C | STATE `Branch:` in C | H | ancestor | first-parent count | all count | Real drift? |
|---|---|---|---|---|---|---|
| fdd2a82 (merge) | main | 7ebc61f | yes | 1 | 2 | no |
| 16a1aa9 | main | 7ebc61f | yes | 1 | 1 | no |
| 7ebc61f (merge) | main | 515e7cb | yes | 1 | 2 | no |
| 368f152 | main | 515e7cb | yes | 1 | 1 | no |
| 515e7cb | main | 08dca4a | yes | 1 | 1 | no |
| 08dca4a (merge of origin/main) | feature/pipeline-metrics | f50d600 | yes | 2 | 15 | yes, stale |
| f033ce5 | feature/pipeline-metrics | f50d600 | yes | 1 | 1 | no |
| f50d600 | feature/pipeline-metrics | 3d71ee7 | yes | 1 | 1 | no |
| 3d71ee7 | main (but on feature/pipeline-metrics) | 0485310 | yes | 8 | 8 | yes, the #14 spec-time staleness |
| 0485310 (the `!` merge of #7) | feature/products-excel-upload (but on main) | fabe6f0 | yes | 1 | 2 | yes, caught by the branch rule only |

Rule derived from the table: drift when (a) the first token of `Branch:` differs from `git branch --show-current` (skipped on a detached HEAD, empty output), or (b) the leading hash of `Last commit:` does not resolve (`git rev-parse --verify -q <h>^{commit}`, exit 1 for `0000000`), is not an ancestor of HEAD, or is more than 1 first-parent commit behind HEAD. `--first-parent` is needed: without it every merge on `main` reads as 2 behind (fdd2a82, 7ebc61f) and would be a false positive. On the history above the rule flags exactly the three real cases and none of the seven correct ones. The `!` merge of #7 is caught by (a) alone, which is why both checks are needed.

The working tree today (`Branch: feature/pipeline-state-hygiene`, `Last commit: fdd2a82`, HEAD fdd2a82) is 0 behind: no drift.

## 2. Claude Code hook output (code.claude.com/docs/en/hooks.md, fetched 2026-10-05, Claude Code 2.1.289 installed)

Not SAP, so not in an MCP server; the official page is the source.

- Exit code 0 stdout of a `Stop` hook goes to the debug log only; Claude never sees it ("For most events, Claude Code writes stdout to the debug log and doesn't show it in the transcript. The exceptions are `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, and `PostModelSwitch`"). The current "Stop gate passed" text is therefore invisible. A plain-stdout advisory in the Stop gate would not reach the model.
- `Stop` accepts `hookSpecificOutput.additionalContext` on exit 0: "Non-error feedback for Claude. The conversation continues so Claude can act on it, but unlike `decision: "block"` it is shown in the transcript as hook feedback rather than a hook error". It goes through the same loop protection as a block (`stop_hook_active`, 8-consecutive-continuation cap). This is the only non-blocking channel that makes the model act at the end of a turn.
- `systemMessage` is shown to the user only.
- `SessionStart` `additionalContext` reaches Claude; `systemMessage` reaches the user (`session-start.mjs` already emits both).

Consequence for the design: the Stop "advisory" is an `additionalContext` continuation, not stdout and not exit 2. Because each continuation costs a model turn, the hook reports one drift once (a key of branch, HEAD, `Branch:` value and `Last commit:` hash in `.pipeline/state-drift.json`), and SessionStart writes the same key, so the Stop feedback fires only for drift that appears during the session, which is the incident of #7.

## 3. Worktrees (code.claude.com/docs/en/worktrees.md, fetched 2026-10-05)

- `claude --worktree`, `isolation: "worktree"` and background sessions create `.claude/worktrees/<name>/` on a branch `worktree-<name>`; the page says verbatim: "Add `.claude/worktrees/` to your `.gitignore` so worktree contents don't appear as untracked files in your main checkout."
- While an agent runs, Claude Code holds a `git worktree lock` on its worktree.
- Hook `cwd` follows Claude into a worktree, `${CLAUDE_PROJECT_DIR}` stays at the main checkout.

Probe (temp repo under `/tmp`, path `nested/demo` instead of `.claude/worktrees/demo`, because the PreToolUse Bash guard matches the protected path string even outside the repository): `git worktree add nested/demo` plus a file inside, `git worktree lock`; `git status --porcelain -uall` lists one entry `?? nested/demo/` (an embedded checkout is not recursed even with `-uall`); after `nested/` in `.gitignore` the entry is gone and `git check-ignore -v nested/demo/f.txt` names the rule. So the Stop gate's check 4 sees exactly one path `.claude/worktrees/<name>/`, matched by `.claude/**`, and a `.gitignore` line removes it. The block message then advises `git checkout -- <path>`, which does nothing for an untracked entry and invites a delete of the other session's work.

## 4. Rejected mechanisms

| Mechanism | Why not |
|---|---|
| `Last commit == HEAD` | Fires after every pipeline commit (section 1) |
| Count without `--first-parent` | Every merge on `main` reads as 2 behind |
| Stop advisory on plain stdout | Debug log only (section 2) |
| Stop exit 2 while drift persists | Blocks read-only Q&A turns and a `git pull` of upstream commits; the user asked for a warning in the issue hints |
| UserPromptSubmit drift line | Its contract is "never prints" (ADR-0022, `user-prompt.mjs` header); would repeat on every prompt |
| `.claude/worktrees/**` in `PROTECTED_EXCEPTIONS` | Also opens the Edit/Write and Bash guards: the main session could write into a parallel session's checkout, including protected files there that later merge with its branch |
| `git worktree list` recognition | After the `.gitignore` line no worktree under `.claude/worktrees/` reaches `git status`; a worktree elsewhere inside the repository is not a Claude Code default |
| `Phase: spec` in STATE | `/spec` writes no STATE line (ADR-0019, skill step 5) and the phase marker parser takes the first integer of `Phase:` (ADR-0022) |
