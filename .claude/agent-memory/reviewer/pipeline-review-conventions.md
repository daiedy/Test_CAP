---
name: pipeline-review-conventions
description: How the /feature pipeline hands work to the reviewer: what is intentionally unfinished at review time (registry, SUMMARY, PATTERNS/TESTING/templates, VERIFICATION.md), where run artifacts live, and which checks to re-run yourself instead of trusting reports.
metadata:
  type: project
---

The review step always runs before `docs-keeper` (step numbers differ per plan: 16/17 in `categories-code-list`, 10/11 in `products-draft-edit`). At review time these are expected, not findings: missing `SUMMARY.md`, unrefreshed or uncommitted `docs/registry/*`, PATTERNS/TESTING/templates not yet updated, stale "Next steps" wording in STATE. `ui-verifier` runs in parallel with the reviewer, so `VERIFICATION.md` may not exist yet while `screenshots/` already does; UI runner output (`ui5-test-runner`) is gitignored (`app/products/report/`), so the OPA "passed" claim rests on agent reports plus `VERIFICATION.md`.

Since the second run the PLAN carries an explicit reviewer checklist in the "Review" step row; the orchestrator's task message repeats it with numbered items and asks for evidence per item (command output quoted). Work through that list first, then the generic protocol.

**Why:** First run (2026-09-07): the orchestrator said not to flag registry drift; VERIFICATION.md was absent at review time. Second run (same day): same hand-off shape, plus explicit "do not start or stop dev servers" because ui-verifier owns :4004.

**How to apply:** Report registry/STATE/PATTERNS gaps as "for docs-keeper", not blocking. Re-run yourself: `npm run lint`, `npm test`, `node scripts/check-docs-fresh.mjs`, `npx prettier --check` on changed test files, `diff <(cds compile '*' --to edmx-v4 -s CatalogService -l en) app/products/webapp/localService/metadata.xml`, and `ui5lint` in `app/products` (cheap, ~10 s). In zsh quote grep globs (`--include='*.cds'`, `ls srv/*.js` fails with "no matches found" when empty, which is the wanted evidence). Do not write a REVIEW.md unless the plan lists it as a step artifact; return findings in the message.
