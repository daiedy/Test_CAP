# ADR-0023: Pipeline state hygiene: drafted specs, STATE drift feedback, worktrees outside the git audit

Date: 2026-10-05. Status: accepted (user, 2026-10-06, feature `pipeline-state-hygiene`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
Issue #15, `docs/LESSONS.md` Pending 2026-09-29 (two entries). Three gaps in how the pipeline sees its own state:
- The briefing (ADR-0019) knows three states: `in-progress` (continue), `spec-ready` (`/feature`), else `/spec`. `/spec` by design sets no label and writes no STATE line until the plan is approved, so a plan being written is invisible; the briefing said "no feature in work" while `architect` drafted #14, and recommended `/spec #14` again, which would relaunch `architect` over the drafts.
- `## Now` of `docs/STATE.md` (ADR-0018) went stale after the user merged #7 with a `!` command (`0485310`): `Branch:` still named the feature branch, `Last commit:` and `Next:` the pre-merge state. The Stop gate compares STATE only with changed code paths, so a clean tree passed. A committed STATE cannot name its own commit, so `Last commit:` is legitimately one first-parent commit behind HEAD after every pipeline commit (measured over ten commits, `docs/features/pipeline-state-hygiene/research/state-drift.md` section 1).
- A parallel Claude Code session's worktree `.claude/worktrees/<name>/` (untracked, locked) appears in `git status --porcelain -uall` as one entry under `.claude/**`; the Stop gate's protected audit (ADR-0016) blocked on it and advised `git checkout --`, a destructive suggestion for another session's work. Claude Code's own documentation says to gitignore `.claude/worktrees/`.

Claude Code hook facts (code.claude.com/docs/en/hooks.md, 2026-10-05): plain stdout of a Stop hook on exit 0 reaches only the debug log; `hookSpecificOutput.additionalContext` on exit 0 is non-error feedback that continues the conversation under the `stop_hook_active` loop guard.

## Decision
1. **Drafted spec.** An open `feature` issue without `spec-ready` and `in-progress` whose `docs/features/<name>/` holds `PLAN.md` or `CONTEXT.md` is a drafted spec. The queue tags it, and the recommendation order becomes: `in-progress` (continue), then a drafted spec (review the plan in the folder; approve it or resume the `/spec` session, never start `/spec #N` over the drafts), then the first unblocked item (`/feature` with `spec-ready`, else `/spec`). No label and no STATE value: the folder is the evidence, as ADR-0019 already treats it.
2. **STATE drift.** `scripts/lib/state-now.mjs` owns `projectNow()` (moved from `backlog.mjs`, re-exported there) and the pure `stateDrift()`: drift when the first token of `Branch:` differs from `git branch --show-current` (not on a detached HEAD), or when the leading hash of `Last commit:` does not resolve, is not an ancestor of HEAD, or is more than one first-parent commit behind it. The SessionStart briefing prints the drift as its last line (`PIPELINE_LANG`, `scripts/i18n/pipeline*.properties`) and records the drift key (branch, HEAD, the two STATE values) in `.pipeline/state-drift.json`. The Stop gate checks the same rule before its clean-tree exit and, for a key not yet recorded, exits 0 with `hookSpecificOutput.additionalContext` asking to update `Branch`, `Last commit` and `Next`; it never exits 2 for drift, records the key, and adds no `gate` metric reason. A block by another check wins and leaves the key unrecorded.
3. **Worktrees.** `.claude/worktrees/` is in `.gitignore`. `protectedWriteHit()` (the git-based audit of SubagentStop and Stop) additionally exempts `.claude/worktrees/**`; `protectedHit()` and the PreToolUse guards are unchanged, so the main session still may not write into a parallel session's checkout. The Stop gate's block message for an untracked protected entry no longer advises `git checkout --`.

## Alternatives
| Option | Why rejected |
|---|---|
| A new label or `Phase: spec` STATE value for a drafted spec | `/spec` writes no STATE line (ADR-0019); the ADR-0022 phase parser takes the first integer of `Phase:`; the folder already proves the state |
| `Last commit:` must equal HEAD | Fires after every pipeline commit: a commit cannot name itself |
| Commit distance without `--first-parent` | Every merge on `main` reads as two behind (false positives on `fdd2a82`, `7ebc61f`) |
| Stop advisory on plain stdout | Reaches only the debug log; the model never sees it |
| Blocking Stop gate (exit 2) while STATE drifts | Blocks read-only turns and every `git pull` until STATE is edited; the issue asks for a warning |
| Drift line in the UserPromptSubmit hook | Its contract is "never prints" (ADR-0022); it would repeat on every prompt |
| `.claude/worktrees/**` in `PROTECTED_EXCEPTIONS` | Also opens the Edit/Write and Bash guards for the main session over another session's checkout, including protected files there that merge later |
| Recognising registered worktrees with `git worktree list` | After the `.gitignore` line no worktree under `.claude/worktrees/` reaches `git status`; extra git call without a case |
| A prompt rule "update `## Now` after a `!` git command" | The hook text delivers the instruction when it matters; prompts are a byte ratchet (ADR-0018) |

## Consequences
- Simpler: a session after an out-of-pipeline merge or pull is told once, in its own language at start and in English at the end of the turn, what to update; a drafted plan is not overwritten by a repeated `/spec`.
- Harder: each new drift costs one model continuation at Stop; `.pipeline/state-drift.json` is one more gitignored state file.
- PATTERNS gains an Infrastructure row "Advisory from a Stop hook": `hookSpecificOutput.additionalContext` on exit 0, once per key in `.pipeline/`, never exit 2.
- `templates/STATE.md`, `CONVENTIONS.md` and the rules are unchanged; ADR-0019's recommendation order is amended by decision 1, ADR-0016's audit scope by decision 3.
- Not covered: a subagent with `isolation: "worktree"` started from the main session would have its edits denied by `protect-files.mjs`, because the path lies under `.claude/**` of the main root; no pipeline agent uses that isolation today. Supporting it needs the guards to re-base a worktree path before matching, a separate decision.

## Sources
- Issue #15; `docs/LESSONS.md` Pending 2026-09-29.
- `docs/features/pipeline-state-hygiene/research/state-drift.md` (history probe, hook output facts, worktree probe).
- https://code.claude.com/docs/en/hooks.md ("Exit code 0", "Stop decision control"); https://code.claude.com/docs/en/worktrees.md.
- ADR-0016, ADR-0017, ADR-0018, ADR-0019, ADR-0022.
