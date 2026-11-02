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

- Phase 3 (2026-10-26): `npm run docs:wiki` in a temp copy needs `package.json`, a `scripts/` copy and a `node_modules` link; compare the whole `docs/wiki` tree byte for byte instead of touching the repo. `writeWiki` skips unchanged files, so repo mtimes show whether a stray run wrote anything.
- A parallel agent editing `scripts/` can leave a `cpSync` snapshot mid-edit (`ReferenceError: LINK is not defined` in the copy while the in-process import was fine): rerun before suspecting the test.
- Red proof for CLI root rules: scratch copy of `scripts test package.json`, `orig/` backups, the old `wiki.mjs` from `git show d0274a7:` plus an appended `export function wikiRoot(start) { return start; }` (old cwd-as-root behaviour, so the import still resolves), per-rule string mutations, `-t '<it A>|<it B>'` with the JSON reporter: 5 of 5 red, about 1 min.

- Phase 4 (2026-10-27, export link mapping): an `export` spawn must pass `--ref` and `--repo-url` or get an env with every `GITHUB_*` removed, because CI sets `GITHUB_SHA` during `npm test`; prove it by running the file once with `GITHUB_SHA`/`GITHUB_SERVER_URL`/`GITHUB_REPOSITORY` set and once with only `GITHUB_SERVER_URL`. On the committed wiki, `_Footer.md` holds a hand-written `tree/main` URL of the repository, so "every repository link is a pinned blob URL" must exempt URLs that appear verbatim in the source. `yaml` (2.x, YAML 1.2) resolves from node_modules: `on` stays a string key and `preprocess: false` parses as a boolean.
- Phase 4 red proof: an `rsync -a --exclude node_modules --exclude .git` copy plus a `run.mjs` with expected red sets per mutation, 41 mutations in about 3 min. The "old code" mutation needs the old `gen-wiki.mjs` too, or the old `wiki.mjs` fails on import. `strategy: init` also occurs in the `wiki.yml` header comment: anchor YAML mutations with their indentation.

**Why:** these cost three red runs to discover; the phase 3 resume tightens the `// phase 3:` assertions in the same file.

**How to apply:** for mutation proofs, take the `from` string from code, not a phrase that also appears in the file's header comment: `String.replace` hits the first match, and a comment hit looks like a test gap ("header text changed: green"). See [[contract-test-red-proof]].
