---
name: test-suite-shape
description: Current shape of the test suites and which files need cds.test auth - re-derive counts before writing a plan that quotes them
metadata:
  type: project
---

Test counts in plans go stale fast. Re-derive them before writing acceptance criteria: count `it(` per file in `test/` and `opaTest(` per journey in `app/products/webapp/test/integration/`.

**Why:** the `catalog-authorization` plan of 2026-09-07 was written against an assumed 22 backend tests; by 2026-09-10 `main` had 29 in three files, including the Bash-guardrail test that did not exist when the plan was written (it came from ADR-0016). The criterion "every backend test file sets `defaults.auth`" was therefore wrong.

**How to apply:** not every test file is a service test. The Bash-guardrail test drives a hook script through `spawnSync` — no `cds.test`, no HTTP, no server — so it must **not** set `defaults.auth`. Word TESTING rule 5 and any plan criterion as "every test file that starts a server with `cds.test`".

State on `main` at `fecb925` (2026-09-10): `test/catalog-service.test.js` 19 `it`s, `test/metadata.test.js` 4, `test/hooks-protect-bash.test.js` 6 (total 29); 23 `opaTest`s in five journeys.

Related: [[pipeline-first-feature]], [[cap-mocked-auth-behavior]], [[role-aware-ui-singleton]].
