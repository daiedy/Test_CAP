---
name: pinned-action-read-at-ref
description: Read a GitHub action's README and source at the pinned commit, not the default branch; github-wiki-action v5.0.6 lacks the subfolder and blob/ link rewriting its master README documents (2026-10-26)
metadata:
  type: feedback
---

Read an action's behaviour at the pinned commit: `gh api "repos/<owner>/<action>/contents/<file>?ref=<sha>"` (quote the URL in zsh, `?` globs), and `gh api repos/<owner>/<action>/compare/<sha>...master` for what the default branch adds on top. `gh api .../readme` without `ref` returns the default branch.

**Why:** business-rules-wiki research quoted the README of `Andrew-Chen-Wang/github-wiki-action` from `master` ("pages served flat by basename, cross-directory links rewritten, repository links become blob/ URLs"). The pinned v5.0.6 (`1bbb428`) has none of it: its preprocess visits only top-level `.md` files and only strips `.md` from links that stay at or below the folder. `master` (`93c86ef`, 8 commits ahead, same day) adds it, but no release has it yet. Measured on the export: 441 page links and 219 repository links in subfolder pages left as they are.

**How to apply:** any plan step that pins an action and relies on its documented behaviour. Check the source at the pin before writing the workflow, and report a gap as an open question; do not move the pin silently. Related: [[openapi-converter-local-copy]] (the local copy wins, the same kind of "documented vs. installed" gap).
