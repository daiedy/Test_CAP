---
name: wiki-temp-projects
description: What a temp project needs for the business-rules wiki tests (check-docs-fresh --fix, audit, export) and a mutation-harness pitfall; test/wiki.test.js, 2026-10-26
metadata:
  type: project
---

Temp-project facts for `test/wiki.test.js` (#28 business-rules-wiki, phase 2):

- `check-docs-fresh.mjs --fix` spawns `join(cwd, 'scripts/gen-registry.mjs')`, so the temp project needs a copy of `scripts/` (`fs.cpSync`) as well as a `node_modules` symlink (gen-registry calls `npx cds compile`). With a two-file CDS model the whole chain (registry, real OpenAPI export, wiki) takes about 0.85 s.
- `node scripts/wiki.mjs audit` in a temp project needs only `srv/*.cds`, `_i18n/messages.properties` and `docs/wiki/`; `@sap/cds` resolves from the script's own location. It takes about 0.3 s for two runs plus two `confirm`s.
- `exportWiki()` output starts with the blank line that followed the frontmatter, before the H1: locate the H1, never assume line 0.
- `related` prints `- none` for an empty side: filter it before checking the listed paths.

**Why:** these cost three red runs to discover; the phase 3 resume tightens the `// phase 3:` assertions in the same file.

**How to apply:** for mutation proofs, take the `from` string from code, not a phrase that also appears in the file's header comment: `String.replace` hits the first match, and a comment hit looks like a test gap ("header text changed: green"). See [[contract-test-red-proof]].
