---
name: vitest-u-runs-whole-suite
description: In Test_CAP `npx vitest run -u test/metadata.test.js` still ran all 18 test files; -u rewrites every mismatching snapshot, so check git status of test/__snapshots__ afterwards (2026-11-12)
metadata:
  type: feedback
---

`npx vitest run -u test/metadata.test.js` ignored the file filter and ran the whole suite (18 files, ~60 s) on 2026-11-12 (products-validations phase 2). Only the `$metadata` snapshot changed that time, but `-u` would also rewrite any other mismatching snapshot.

**Why:** the contract rule makes the implementer run `npx vitest -u` after every OData model change. A legitimately red test elsewhere could then get a wrong snapshot written without anyone noticing.

**How to apply:** after `-u`, run `git status --short test/__snapshots__` and expect only `metadata.test.js.snap`. Budget about a minute for the run. Run `cds compile ... > metadata.xml` and `npm run docs:registry` before the full `npm test`; otherwise the `metadata` and `api-docs` sync tests show up as extra red files. See [[registry-chain-in-temp-copy]].
