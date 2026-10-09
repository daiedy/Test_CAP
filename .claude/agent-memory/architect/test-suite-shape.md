---
name: test-suite-shape
description: Current shape of the test suites and which files need cds.test auth - re-derive counts before writing a plan that quotes them
metadata:
  type: project
---

Test counts in plans go stale fast. Re-derive them before writing acceptance criteria: count `it(` per file in `test/` and `opaTest(` per journey in `app/products/webapp/test/integration/`.

**Why:** the `catalog-authorization` plan of 2026-09-07 was written against an assumed 22 backend tests; by 2026-09-10 `main` had 29 in three files, including the Bash-guardrail test that did not exist when the plan was written (it came from ADR-0016). On 2026-09-25 `docs/STATE.md` still said 57 while `main` had 64, because `test/backlog.test.js` (7, ADR-0019) landed after the STATE line was written. The criterion "every backend test file sets `defaults.auth`" was therefore wrong.

**How to apply:** not every test file is a service test. The Bash-guardrail, registry-gate, doc-shapes, prompt-budget and backlog tests drive scripts through `spawnSync` or pure functions — no `cds.test`, no HTTP, no server — so they must **not** set `defaults.auth`. Word TESTING rule 5 and any plan criterion as "every test file that starts a server with `cds.test`". Quote counts per phase gate, never a single total.

State on `main` at `7f18788` (2026-10-08, re-counted for the `sandbox-flex-connector` spec): `npm test` 139 tests in 11 files (STATE "What works" lists them); 40 `opaTest`s in nine journeys (FilterProductsByCategory 4, EditCategoryOnObjectPage 6, CategoryShownAsName 3, DraftMarkerInListReport 6, RoleAwareActions 2, RatingShownAsStars 3, ImportProducts 3, RatingRangeFilter 8, RussianLocale 5) plus 2 QUnit tests = 42 in `npm run test:ui`. Earlier snapshot (`831dd42`, 2026-09-25): 64 backend tests, 25 `opaTest`s in six journeys.

Related: [[pipeline-first-feature]], [[cap-mocked-auth-behavior]], [[role-aware-ui-singleton]], [[fe-v4-rating-datapoint]].
