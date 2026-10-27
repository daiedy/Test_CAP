# business-rules-wiki: review

Date: 2026-10-27. Reviewer: `reviewer` (PLAN step 6). Scope: `git diff 40748e9..HEAD` (7c42fab spec, d0274a7 tooling, ffc5e01 backfill, d26bd5a fixes, 6ed24b7 pipeline integration and mirror). The phase 5 mirror verification has not run (it needs PR #43 merged) and is out of scope.

## Blocking
- none

## Important
- `scripts/gen-wiki.mjs:503-560` (`entitySets`, `renderApiPage`) → `docs/wiki/api/Catalog-service-API.md:12,18` The generated API page states two things about the service that are not true, on a page that mirrors to the public wiki. (1) Its "Operations" column copies the HTTP methods of the OpenAPI document, so it lists `Currencies` as "read, create, update, delete". `Currencies` is an explicitly auto-exposed `sap.common` code list, and the CDS docs say such entities "can be accessed directly, but only as `@readonly`" (`mcp__cds-mcp__search_docs` "auto-exposed entities read-only"; `SERVICES.md` row `Currencies | autoexposed`). The OpenAPI document still carries `post`/`patch`/`delete` for `/Currencies`, and the page passes that on as an operation of the catalog. (2) The "Authentication" line says only "the OpenAPI document declares no security scheme". The service has `@requires: 'authenticated-user'` (`SERVICES.md` line 8; rule page `Only-signed-in-users-reach-the-catalog.md`, BR-ACCESS-001), so a public reader takes that line to mean an open API. ADR-0030 decision 4 lists "authentication" as page content. This is the step 2 choice "the API page states no security scheme", and I reject it in this form. → Rename the column to say where the verbs come from (for example "Methods in the OpenAPI document"), or drop it, and add one sentence that roles and read-only code lists are enforced at run time (`SERVICES.md`). In the Authentication line, link the access rule pages instead of the absent scheme, for example "every request needs a signed-in user; roles: [Viewers read, editors change](...)". The generator can find them as `rules/` pages tagged `authentication`/`access`, or through a fixed link to `rules/` like the existing `SERVICES.md` link. Re-render, and extend the byte-comparison test only through the fresh output. Owner: `cap-backend-dev` (generator), then `npm run docs:wiki`.
- `docs/wiki/decisions/Products-are-imported-from-an-Excel-workbook.md:14-15` The ADR-0021 digest paraphrases only the original Decision paragraph and none of the four amendments. Its contract is therefore stale: "a header row naming `name`, `description`, `price`, `currency`, `stock`, `category`, `rating` and `imageUrl` ... the mandatory columns are `name`, `price`, `currency`, `stock` and `category`", and "the import itself checks only ... the structure of the workbook, the row limit and duplicate names". ADR-0021 amendment 4 (2026-10-10) made `subcategory` a mandatory column and added the per-row category check (amendment 4 E). Amendment 2 refuses a repeated header column and adds the decompression guard. The digest contradicts its own linked rule page `The-header-row-names-known-columns-once-and-includes-the-mandatory-ones.md` (six mandatory columns incl. `subcategory`) and the how-to `Import-products-from-Excel.md:21`. ADR-0030 decision 1 asks for "compiled truth ... rewritten to the current state", and the other amended product ADRs are folded in: ADR-0003 price precision, the ADR-0026 replacement by ADR-0027. I checked all 14 digests for amendments (`grep '^## Amendment'` on each ADR against the digest): only this one presents a superseded decision. The amendments of ADR-0013, 0024, 0027 and 0029 are technical and correctly left out. → Rewrite the Decision section to the amended contract (nine columns incl. `subcategory`, six mandatory, a repeated column refused, the per-row subcategory-category check, the size guard), add `docs/features/products-subcategory-cascade/SUMMARY.md` to `sources`, and keep "What it means" as it is. Owner: `docs-keeper`; non-blocking, because the fix is a page edit of the phase 7 kind.

## Minor
- `scripts/gen-wiki.mjs:329-358` (`wikiSourcesHash`) The step 2 choice "the hash covers the files named in `code`" is right: decision 4 puts the current `codeHash` into every `graph.json` node, so without those files in the stamp a code change would leave `graph.json` stale without any report. Its consequence is not written down anywhere, though. Every commit that touches one of the 19 files named in `code` (among them `db/schema.cds`, `srv/annotations/*.cds`, `srv/catalog-service.js`, `_i18n/messages*.properties`, `app/products/annotations/Products.cds`) changes the `sources:` header of the 7 generated Markdown files and `graph.json`. The `Stop` gate's `--fix` regenerates them, and the merge push then matches `paths: ['docs/wiki/**']` of `wiki.yml`. So the mirror runs for most code merges, which is the case the ADR's Alternatives row "Mirror on every push to `main`" rejects as running "for nothing". It also re-pins the blob URLs (amendment C), which is a benefit. → Record it in phase 7 in the PATTERNS row "Generated wiki files and the GitHub Wiki mirror", plus one ADR-0030 consequence line: "the stamp covers the `code` files; a code change regenerates the wiki stamps and re-mirrors". No code change. Owner: `docs-keeper`.
- `.claude/skills/gen-docs/SKILL.md:9` Step 3 still reads `git diff --stat docs/registry docs/api`. Steps 1-2 now regenerate and audit `docs/wiki` too, so the regenerated wiki files are left out of the diff the skill reports to the user. → `git diff --stat docs/registry docs/api docs/wiki`, re-record the prompt budget. Protected file: maintenance session or user approval.

## Checked and in order
Gates run fresh by the reviewer on HEAD `6ed24b7` (2026-10-27, `PIPELINE_LANG=en`):
`npm test` → `Test Files 15 passed (15)`, `Tests 244 passed (244)`; `node scripts/check-docs-fresh.mjs` → `docs/registry is fresh.`; `node scripts/wiki.mjs audit` → `wiki audit: clean`; `node scripts/check-feature-docs.mjs business-rules-wiki` → `PLAN.md and CONTEXT.md keep the shape of the templates.`; `npm run lint` → 0 errors, 2 `no-console` warnings in `.pipeline/verify/build-verify-workbooks.mjs` (an untracked scratch file outside the branch); `npx prettier --list-different` on the new and changed scripts, tests and `wiki.yml` → nothing listed.

- Duplication (research `llm-wiki-pattern.md` section 5, CONTEXT "What already exists"):
  - One stamp mechanism: the generated Markdown header is read by `recordedHash()` of `registry-sources.mjs`, and `graph.json` carries `x-sources`. `codeHash`/`wikiSourcesHash` use the `sourcesHash()` algorithm (sha256, 16 hex) over other file sets; this is no second format.
  - Globs go through `isUnder` (`codeFiles`, `pagesForPath`).
  - One link reader: `mapLinkTargets`/`resolveLink` feed `markdownLinks` (graph edges, `brokenLinks`) and the export (`exportText` → `wikiTarget`).
  - One frontmatter reader: `parseFrontmatter` in `doc-shapes.mjs`, imported by `gen-wiki.mjs` and `wiki.mjs`.
  - The Cyrillic range is the hook's, U+0400-U+04FF.
  - The private `walk()` in `gen-wiki.mjs` is a third copy next to `registry-sources.mjs` (not exported, protected) and `gen-registry.mjs`. That follows the existing precedent and is no finding.
  - The domain page `Products.md` paraphrases and does not copy the `DOMAIN-MODEL.md` table. The API page links the OpenAPI document and copies nothing.
- Decision digests: compared with the Decision paragraph of ADR-0028 (all 11 parts, plus the rejected R7/R9/R14 rows the PLAN step 3f asks for, sourced from the #10 CONTEXT user decisions), ADR-0013, ADR-0021, ADR-0026 and ADR-0029. No digest repeats Alternatives or Consequences. "Why" is a two-sentence paraphrase of the Context, which the four-section shape of decision 3 requires. One deviation of another kind (ADR-0021, stale against its amendments) is under Important, and that check was run over all 14.
- History: a script over all 33 rule pages finds a first History row on every page, dated with `since`, and linking an existing `docs/features/<name>/SUMMARY.md` and/or `docs/decisions/ADR-*.md`. The 11 planned #10 rules link ADR-0028 and are dated 2026-10-14 (the #10 plan gate). `Price-stock-and-rating...` and `A-product-needs-a-name...` link ADR-0004, matching `git log -S'@assert.range'`/`-S'@mandatory'` → `3dec9ad` 2026-09-07.
- Generated files untouched by hand: a fresh `renderWiki()` equals all 8 committed generated files byte for byte (`hash 817f5ba6360dc2b7 generated files 8 differences 0`). `git show --stat` shows no edit of them in `d26bd5a` or `6ed24b7`.
- Protected lib edits:
  - `doc-shapes.mjs` adds only the `WIKI_*` constants, the helpers (`yamlScalar`, `parseFrontmatter`, `wikiFileName`, `outsideFences`, `wiki*Errors`) and `wikiPageShapeErrors`, plus three header-comment lines. No existing function changed.
  - `file-checks.mjs` adds two imports and the `docs/wiki/**/*.md` dispatch branch.
- `code` entries: 19 distinct entries over 49 pages, every one a single file, none a glob or folder.
- Public wiki: no secret, token, private path, `.claude/` or `.pipeline` reference. The only `localhost` is the development Swagger link. The mock users `alice`/`bob`/`viewer` are public in `package.json` and README. "Any password works" is correct, because `mocked-users.js:29` checks a password only when one is configured.
- Prompt edits:
  - Minimal and consistent: the protocol step 3 sentence (`grep -c "wiki.mjs for-path"` = 1) and `## Rules touched`, `docs-keeper` step 6 (later steps renumbered), feature phase 6/7, gen-docs, test-all step 4, the new `docs-wiki.md`. `test/prompt-budget.json` was re-recorded.
  - Line 32 of `docs-wiki.md` names `export <dir>` without `--ref`/`--repo-url`. That is not a defect: the rule loads for page editors, who never export; the workflow runs the export without options; the phase 5 step names `--ref`; and the usage text and the header comment of `wiki.mjs` document both options.
- Step 2 design choices, all accepted except the API page one under Important:
  - The hash covers the `code` files; see Minor 1 for the consequence.
  - The frontmatter reader lives in `doc-shapes.mjs`, because the edit-time check in a protected lib cannot import an unprotected script. It is a helper of the shape function.
  - The page shape is strict (file name from the title, exact sections in order), as decision 1 says.
  - `next-id` reads only frontmatter ids, as decision 2 says ("an id quoted in prose does not count"; retire, never delete).
  - The export details follow amendment A-F.
- Step 4 interpretations, all accepted:
  - A half-set `GITHUB_*` is a usage error: amendment D says "both or neither", and usage errors exit 1.
  - Collision findings carry no line: a basename has none, and E's `<file>:<line>` form is for links.
  - Any `_*.md` counts as a frame, consistently in `file-checks`, `readWikiFiles.special` and the export. Only the two frames exist today.
  - `encodeURIComponent` is a no-op on `wikiFileName` basenames, and a kept query is harmless.
  - A missing `sources` entry becomes plain text in the export and is reported by `wikiLint` through `check-docs-fresh` at Stop and in CI.
- Size: `graph.json` is 132,044 bytes. The 417 edges take 70.6 KB pretty-printed, the 66 nodes 53.4 KB. The redundancy is `type: "link"` on every edge (the only type), `folder` (derivable from `path`) and empty `aliases` (55/66) and `adr` (51/66). This costs nothing that matters:
  - The agents reach it only through the CLI, one `JSON.parse`.
  - It is not mirrored.
  - Its diffs per regeneration are the stamp and the changed `codeHash` lines.
  - No prompt tells an agent to Read it.

  Compact edges would roughly halve the file. That is optional and no finding.
- Tests: `test/wiki.test.js` has 11 tests covering criteria 3-11 one by one, plus the key-table export and root-lookup tests. Every export spawn passes `--ref`/`--repo-url` or strips `GITHUB_*` (lines 753-761). `doc-shapes` +1 accepts every committed page and rejects 11 mutations. `hooks-file-checks` +1 runs from the sandbox.
- Workflow `wiki.yml`:
  - Pins are by SHA with version comments.
  - `contents: write` at workflow level, which suits a job of one checkout plus the action.
  - The input reaches the job only through `with:` and the output through `env:`, so there is no script injection.
  - The export needs no install, because `wiki.mjs` imports Node built-ins only and `@sap/cds` loads lazily in `audit`.
- CI: the "Wiki audit" step sits after "Registry freshness".
- CHANGELOG 2026-10-27 has lines per step.
- The uncommitted `STATE.md` change (phase 6, PR #43) belongs to the orchestrator. The untracked `docs/codemie/` is outside the feature.
- Not reviewed: phase 5, the mirrored wiki rendering and the bare-name links. PLAN Risks already cover them.

## Re-review 2026-10-27
Scope: the uncommitted fix batch on top of `6ed24b7`: `scripts/gen-wiki.mjs`, the regenerated `docs/wiki` files, the ADR-0021 digest, `.claude/skills/gen-docs/SKILL.md`, `test/prompt-budget.json`, `docs/CHANGELOG.md`.

### Important 1 (API page): fixed
- `accessLines()` lists the active `BR-ACCESS-*` rule pages with id and summary under "Authentication and roles, checked by the service at run time": BR-ACCESS-001, 002 and 003 in `Catalog-service-API.md:12-15`. Security schemes appear only when the document declares one, and without an access page the line falls back to `SERVICES.md`.
- The column is now "Operations in the OpenAPI document". A sentence before the table says that roles and read-only code lists are enforced at run time and links `SERVICES.md`.
- The implementer chose not to load the CDS model in the generator: it would make the generator async, sit outside the stamp, and the export runs without an install. That is consistent with the dependency-free export of amendment D and is recorded in the CHANGELOG line.
- `Currencies` still shows the document's verbs, but the column header and the sentence now attribute them correctly.

### Important 2 (ADR-0021 digest): fixed
- The Decision section now states the amended contract: 9 columns incl. `subcategory`, each at most once, 6 mandatory, codes for currency, category and subcategory, 1,000 rows and 10 MB unpacked, and the per-row subcategory-category pre-check with the constraint kept as the guard. `sources` adds both SUMMARYs (`products-excel-upload`, `products-subcategory-cascade`).
- It now agrees with the BR-IMPORT-002 page and the how-to.
- Optional wording nit, not counted: paragraph 1 still says "The import itself checks only ... the structure of the workbook, the row limit and duplicate names", and the closing sentence of paragraph 2 qualifies it.

### Minor 2 (gen-docs diff): fixed
- Step 3 is now `git diff --stat docs/registry docs/api docs/wiki`, and `test/prompt-budget.json` is re-recorded (green in `npm test`).

### Minor 1: open, for phase 7
- The re-mirror on code merges goes to the PATTERNS row and an ADR-0030 consequence line (`docs-keeper`), as planned.

### Gates (fresh)
- A fresh `renderWiki()` equals the 8 committed-to-be generated files (`hash 0873ac0aca582d5b differences 0`).
- `npm test` → `Test Files 15 passed (15)`, `Tests 244 passed (244)`.
- `node scripts/check-docs-fresh.mjs` → `docs/registry is fresh.`
- `node scripts/wiki.mjs audit` → `wiki audit: clean`.
- `node scripts/check-feature-docs.mjs business-rules-wiki` → shape kept.
- `npx prettier --list-different scripts/gen-wiki.mjs` → nothing listed.

## Verdict
ready to commit: 0 blocking. Of the original 2 important and 2 minor findings, 3 are fixed. Minor 1 stays for phase 7.
