---
name: probing-runtime-behavior
description: How to check actual OData responses (error codes, targets, DraftMessages) in this repo before asserting them; Vitest 5 here hides console output of passing tests
metadata:
  type: project
---

To verify what the running service actually returns (error `code`/`target`, `DraftMessages`, status of a second DELETE), write a throwaway `test/zz-probe.test.js` that appends its findings to a file in the session scratchpad, run it with `npx vitest run test/zz-probe.test.js`, then delete it before `npm test`.

**Why:** Vitest 5 in this project (`vitest.config.mjs`, `globals: true`) does not print `console.log` of passing tests even with `--silent=false`, and `npm test` runs `vitest run --silent`. Writing to a file is the only reliable way to see probe output. The probe must live under `test/` because the include pattern is `test/**/*.test.{js,mjs}`; it must be removed before the final `npm test` or it is counted as a test.

**How to apply:** Use this whenever a plan states expected runtime behavior that a test could pass vacuously (empty arrays, optional fields, regex targets). Confirmed on 2026-09-07 for the draft feature: `DraftMessages` is `[]` (present, empty) on a draft PATCH without violations; `ASSERT_MANDATORY` on `draftActivate` has target `in/name` while `ASSERT_TARGET` has plain `category_code`; DELETE of a missing draft is 404. Related: [[user-profile]] (reply to the user in Russian, files in English).
