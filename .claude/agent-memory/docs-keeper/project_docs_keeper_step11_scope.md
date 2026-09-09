---
name: project-docs-keeper-step11-scope
description: What docs-keeper (step 11 of the /feature pipeline) is expected to touch, and which files in the working tree belong to other agents.
metadata:
  type: project
---

In Test_CAP's `/feature` pipeline, `docs-keeper` is always the last agent (PLAN.md step 11), invoked after `reviewer` (step 10) finds zero blocking issues. Its fixed checklist, confirmed across `categories-code-list` and `products-draft-edit`:

- `npm run docs:registry` + `node scripts/check-docs-fresh.mjs` (never hand-edit `docs/registry/*`).
- `docs/CHANGELOG.md`: edit the existing same-day bullet(s) for the feature rather than duplicating; add a `docs` line naming the ADR acceptance, PLAN approval, VERIFICATION verdict, review outcome, SUMMARY, and any PATTERNS/TESTING/template changes.
- `docs/STATE.md`: "Where we are" (mark the feature done, list results), "What works" (test counts), "Open debt" (close resolved rows, add new ones with a "Who" owner), "Accumulated decisions" (append the new ADR one-liner). Never touch "Sessions".
- `docs/architecture/PATTERNS.md` / `TESTING.md` / `templates/*`: only when the feature's ADR's "Consequences" section says so.
- The ADR itself: fix the `Status:` line (see [[feedback-adr-status-line-format]]), tick consequences.
- `docs/features/<name>/PLAN.md`: tick the "Documentation" acceptance criteria, mark the plan `Status: done (...)`, append a "Done YYYY-MM-DD (`docs-keeper`): ..." note to the step-11 row itself.
- `docs/features/<name>/SUMMARY.md`: new file from `templates/feature/SUMMARY.md` (see [[feedback-write-tool-blocks-summary]] for a tooling snag).
- `docs/LESSONS.md`: add an inbox section at the top with one paragraph per non-obvious finding, source-attributed; genuinely upstream-blocked items go in the existing "Pending upstream" section instead. `/retro` (the next session) triages everything docs-keeper adds here.

**Default assumption, not touched unless the task says otherwise:** `docs/features/<name>/VERIFICATION.md` and its `screenshots/` (written by `ui-verifier`), and anything under `.claude/agent-memory/reviewer/` or `.claude/agent-memory/ui-verifier/` (those agents' own persistent memory). In `categories-code-list`/`products-draft-edit` the task brief called these out as "not yours, leave it" when they appeared in `git status`.

**This default was explicitly overridden in `products-draft-marker`** (step 9, not 11 — this plan had no phase-2/backend step): the task brief's own COMMIT section named `VERIFICATION.md`, its `screenshots/`, and `.claude/agent-memory/**` written during the run as files to `git add` and include in docs-keeper's single commit, citing CONVENTIONS section 7 ("agent memory rides in phase commits"). Content-wise these files were still untouched (still not docs-keeper's to *edit*), only staged and committed by docs-keeper because the orchestrator judged no other phase commit would pick them up.

**How to apply:** at the start of a docs-keeper run, diff `git status --porcelain -uall` against the task's stated file list before touching anything. Treat `VERIFICATION.md`/`screenshots/`/other agents' `agent-memory/` as read-only content either way — but check the task's explicit COMMIT instructions (not just the default assumption) for whether docs-keeper's own commit should `git add` them alongside the docs it authored.
