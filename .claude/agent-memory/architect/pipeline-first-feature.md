---
name: pipeline-first-feature
description: Outcome of the first /feature pipeline run (categories-code-list, completed and retro'd 2026-09-07), what the architect should reuse from its plan structure, and the doc inconsistencies that were still open afterwards.
metadata:
  type: project
---

The first real `/feature` run, `categories-code-list`, completed on 2026-09-07 (7 commits, review without blocking findings, retro written into `docs/LESSONS.md` as "Retro of the first run"). Decisions taken: ADR-0010 (UPPER_SNAKE codes, String(20)) and ADR-0011 (ValueList auto-generated from CodeList, fixed-values dropdown, `Common.Text` on the code list key) accepted; UI tests (OPA5 via `@sap-ux/ui5-test-writer` + `ui5-test-runner`) are part of features; mockdata synced with CSV. The edit journey stayed `opaTest.skip` because `Products` was not draft-enabled; that debt became the second feature `products-draft-edit` (ADR-0012, see [[cds10-draft-behavior]]).

**Why:** The run doubled as a pipeline shakedown. Its plan structure (key-decisions table, criteria mapped to test names, per-step developer details, "Decisions for the user" replacing open questions after approval, risks table) was validated by the user and the orchestrator; the design phase (`ux-designer` "Screens" section) produced real plan changes, so it is load-bearing.

**How to apply:** Reuse that plan structure for every feature. Known inconsistencies still to watch after 2026-09-07: `CONVENTIONS.md` section 3 says the FK is `category_ID` while code lists give `category_code`; `templates/service.test.js` still posts `category: 'Furniture'` (pre-CodeList); `.claude/rules/ui-annotations.md` still describes a hand-written `@Common.ValueList` (protected file, needs a user request); the registry generator does not show compiler-generated value lists or draft artifacts (`scripts/gen-registry.mjs` uses `cds.compile.for.nodejs`). List these as pre-existing debt rather than re-deriving them. Retro-driven pipeline fixes (agent `maxTurns`, STATE update per phase in the `feature` skill, smoke test of `npm run watch`) were proposed to the user; check STATE before assuming they were applied.
