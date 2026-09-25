---
name: test-suite-shape
description: Current shape of the test suites and which files need cds.test auth - re-derive counts before writing a plan that quotes them
metadata:
  type: project
---

Test counts in plans go stale fast. Re-derive them before writing acceptance criteria: count `it(` per file in `test/` and `opaTest(` per journey in `app/products/webapp/test/integration/`.

**Why:** the `catalog-authorization` plan of 2026-09-07 was written against an assumed 22 backend tests; by 2026-09-10 `main` had 29 in three files, including the Bash-guardrail test that did not exist when the plan was written (it came from ADR-0016). On 2026-09-25 `docs/STATE.md` still said 57 while `main` had 64, because `test/backlog.test.js` (7, ADR-0019) landed after the STATE line was written. The criterion "every backend test file sets `defaults.auth`" was therefore wrong.

**How to apply:** not every test file is a service test. The Bash-guardrail, registry-gate, doc-shapes, prompt-budget and backlog tests drive scripts through `spawnSync` or pure functions — no `cds.test`, no HTTP, no server — so they must **not** set `defaults.auth`. Word TESTING rule 5 and any plan criterion as "every test file that starts a server with `cds.test`". Quote counts per phase gate, never a single total.

State on `main` at `831dd42` (2026-09-25): `test/catalog-service.test.js` 26 `it`s, `test/metadata.test.js` 6, `test/hooks-protect-bash.test.js` 6, `test/hooks-registry-gate.test.js` 7, `test/doc-shapes.test.js` 9, `test/prompt-budget.test.js` 3, `test/backlog.test.js` 7 (total 64); 25 `opaTest`s in six journeys (3, 6, 6, 4, 2, 4).

Related: [[pipeline-first-feature]], [[cap-mocked-auth-behavior]], [[role-aware-ui-singleton]], [[fe-v4-rating-datapoint]].
