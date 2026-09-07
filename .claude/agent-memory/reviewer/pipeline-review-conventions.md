---
name: pipeline-review-conventions
description: How the /feature pipeline hands work to the reviewer (step 16): what is intentionally unfinished at review time and where run artifacts live, so they are not reported as defects.
metadata:
  type: project
---

At reviewer step 16 of `/feature`, uncommitted `docs/registry/*` regeneration is expected (docs-keeper commits the final registry in step 17), STATE/CHANGELOG/PATTERNS final wording is also step 17. UI runner output (`ui5-test-runner`) is not stored in the repo (`app/products/report/` is gitignored); the only durable copy is `docs/features/<name>/VERIFICATION.md` written by `ui-verifier` (step 15), so if it is missing the OPA "passed" claim rests on agent reports only.

**Why:** First run (`categories-code-list`, 2026-09-07): the orchestrator explicitly said not to flag registry drift; VERIFICATION.md was absent at review time while screenshots existed.

**How to apply:** Report registry drift as "in order, pending step 17"; list stale STATE/LESSONS/CHANGELOG lines as "Important for docs-keeper" rather than blocking; verify metadata.xml by recompiling (`cds compile '*' --to edmx-v4 -s CatalogService -l en`) and diffing instead of trusting reports.
