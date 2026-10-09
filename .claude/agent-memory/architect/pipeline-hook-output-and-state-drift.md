---
name: pipeline-hook-output-and-state-drift
description: Which Claude Code hook outputs reach the model (Stop stdout does not; Stop additionalContext does), why STATE Last commit is one first-parent commit behind HEAD, worktree git-status shape; basis of ADR-0023 (proposed 2026-10-05)
metadata:
  type: project
---

Facts established for #15 `pipeline-state-hygiene` (ADR-0023 accepted 2026-10-06; the user took all four gate recommendations as-is, including the deviation from the issue's literal PROTECTED_EXCEPTIONS; details in `docs/features/pipeline-state-hygiene/research/state-drift.md` while the folder exists).

- Stop hook exit 0 plain stdout goes to the debug log only (the stop gate's "Stop gate passed" text is invisible). Non-blocking feedback that the model acts on: `{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"..."}}` on exit 0; it continues the conversation under the `stop_hook_active` guard, so every use costs a turn: dedupe by a key in `.pipeline/`. `systemMessage` = user only. UserPromptSubmit/SessionStart stdout does reach the model. Source: code.claude.com/docs/en/hooks.md (Claude Code 2.1.289).
- A committed `docs/STATE.md` cannot name its own commit: `Last commit:` is legitimately 1 first-parent commit behind HEAD. Count with `git rev-list --count --first-parent`; without `--first-parent` every merge on main reads as 2. The `!` merge of #7 was caught only by the `Branch:` mismatch, so both checks are needed.
- A nested worktree shows in `git status --porcelain -uall` as one `?? <dir>/` entry; Claude Code docs say to gitignore `.claude/worktrees/`.
- The PreToolUse Bash guard matches protected path strings even for commands in `/tmp`: probe with a different directory name. It also denies a Bash heredoc or script that only writes a doc whose text names a protected path (an ADR sentence naming `.claude/rules/db-model.md`, 2026-10-09): write docs with Read + Edit, not Bash.
- `scripts/lib/**` is protected too (not only `scripts/hooks/**`); `test/` is not. Budgeted prompt files include `.claude/rules/pipeline-config.md`: a "document it in the rule" scope hint means a prompt-budget re-record.

**Why:** these decide where an advisory can live and what "stale STATE" means; re-deriving costs a session.

**How to apply:** for any new pipeline check, choose block (exit 2) vs feedback (`additionalContext`) explicitly, and never rely on Stop stdout. See [[test-suite-shape]], [[claude-code-transcript-facts]].
