# business-rules-wiki: summary

Completion date: 2026-10-28. Commits: `7c42fab` (spec), `d0274a7` (tooling), `ffc5e01` (backfill), `d26bd5a` (root lookup and inline-code link fixes), `6ed24b7` (pipeline integration and mirror), `0f38623` (review fixes), `5d31162` (docs part 1), `b9f7726` (verification); the documentation of part 2 is committed by the orchestrator. Issue #28, ADR-0030 (accepted 2026-10-26, amendment A-F accepted 2026-10-27). One-file PR #43 (`wiki.yml` to `main`, merged `6e008bb` on 2026-10-28).

## What was done
- Model, service, UI: nothing. No file under `db/`, `srv/`, `app/` or `_i18n/` changed; `metadata.xml` and the snapshot are untouched.
- Wiki content, `docs/wiki/` (74 files, 335 KB of which `graph.json` is 132 KB): 22 active and 11 planned rule pages (`BR-<AREA>-NNN`, areas ACCESS, PRODUCTS, DETAILS, IMPORT), 9 domain pages, 7 how-to pages, 14 ADR digests and the pipeline decisions list, `Home.md`, `Glossary.md`, `_Footer.md`. Pages are English, hand-written, with frontmatter (`code`, `messages`, `elements`, `verified`) and a History table.
- Generators and CLI: `scripts/gen-wiki.mjs` writes `graph.json`, five folder indexes, `_Sidebar.md` and `api/Catalog-service-API.md` from the OpenAPI document, stamped by `wikiSourcesHash`; `npm run docs:registry` and `npm run docs:wiki` run it; `check-docs-fresh.mjs` reports stale wiki files. `scripts/wiki.mjs`: `find`, `related`, `for-path`, `next-id`, `confirm`, `audit`, `export`. Shapes: `wikiPageShapeErrors` in `scripts/lib/doc-shapes.mjs`, a branch in `scripts/lib/file-checks.mjs`.
- Pipeline: the protocol step "`wiki.mjs for-path` before an edit" and the `## Rules touched` report section, the `docs-keeper` rule-page step, the `/feature` phase 6 gate, `/gen-docs`, `/test-all`, the path rule `.claude/rules/docs-wiki.md`, a CI step `node scripts/wiki.mjs audit`.
- Mirror: `.github/workflows/wiki.yml` runs `node scripts/wiki.mjs export .wiki-out`, then the pinned `github-wiki-action` v5.0.6 with `strategy: init`, `preprocess: false`, `ignore: graph.json`.
- Tests: `test/wiki.test.js` (11 tests), +1 in `test/doc-shapes.test.js`, +1 in `test/hooks-file-checks.test.js`; `npm test` 244 in 15 files (was 231 in 14).
- Documentation: PATTERNS (3 rows), CONVENTIONS, TESTING, `CLAUDE.md` map row, README, LESSONS, ADR-0030 consequence (part 1, `5d31162`); SUMMARY, registry, STATE, CHANGELOG (part 2).

## Acceptance criteria
Evidence is the named test in `npm test` (244 passed in 15 files on the part 2 tree), the part 2 command output below, or the report named.
- [x] Page shape (criteria 1-2), temp-wiki findings (3), generated files in sync (4), graph nodes and edges (5), `for-path`, `find`, `related` (6), `audit` in a temp project (7), `check-docs-fresh.mjs` stale wiki files (8), `next-id` (9): `test/doc-shapes.test.js`, `test/hooks-file-checks.test.js`, `test/wiki.test.js`, all green.
- [x] Workflow shape (10) and the flat export with wiki-ready links and exit 1 on an unmappable link (11): the two named `test/wiki.test.js` tests, green.
- [x] `node scripts/wiki.mjs audit` prints `wiki audit: clean` (phase 7 gate, 2026-10-28); `node scripts/check-docs-fresh.mjs` prints `docs/registry is fresh.` after `npm run docs:registry` ("docs/registry, docs/api and docs/wiki updated (sources 08e900114137a7b9)").
- [x] Backfill counts: 22 active and 11 planned rule pages, 9 domain, 7 how-to, 14 digests plus the pipeline list, 74 files, 335 KB; the Cyrillic grep lists no wiki file and `wikiStatus` flags a Cyrillic page (test).
- [x] History rows and digests: `REVIEW.md`, 0 blocking, a script over all 33 rule pages found a dated first row linking a SUMMARY or an ADR on each; digest paraphrase check done by the reviewer (the stale ADR-0021 digest was fixed, see Defects).
- [x] Protocol, `docs-keeper`, `/feature`, `/gen-docs`, `/test-all`, `docs-wiki.md`, prompt budget: `test/prompt-budget.test.js` green (phase 4 gate, re-recorded after `0f38623` and `5d31162`); `ci.yml` step "Wiki audit" present.
- [x] Mirror run and rendering: `VERIFICATION.md` (verdict "Ready for review", no defect): dry run 40719647854 and run 40719796267 at `5d31162`, wiki `master` at `7a54858`, 7 scenarios with screenshots (Home with sidebar and footer, no raw frontmatter, bare page links across folders without 404, folder indexes, blob link at the run's SHA, mirror equals export, API page and Access section).
- [x] The wiki documents its own change: `node scripts/wiki.mjs find ADR-0030` returns `docs/wiki/decisions/Pipeline-decisions.md` (phase 7 gate, 2026-10-28).
- [x] Documentation updated: PATTERNS, CONVENTIONS, TESTING, `CLAUDE.md`, README, LESSONS (part 1), registry, STATE, CHANGELOG, SUMMARY (part 2); `node scripts/check-docs-fresh.mjs` green.

No criterion is left without fresh evidence.

## Deviations from the plan
- Step 0 probe (user, 2026-10-26): GitHub Wiki renders frontmatter raw (the opening `---` as a rule, the keys as a setext heading), so the optional `export <dir>` became part of the feature, as the plan's risk anticipated.
- Amendment A-F (user decision 2026-10-27, step 4): the pinned action v5.0.6 rewrites `.md` links of top-level files only and makes no `blob/` URL; the subfolder and repository-link rewriting the spec quoted exists only on its unreleased `master`. The user chose that our export writes wiki-ready links: bare page names with anchors, blob URLs of the run's commit (`GITHUB_SHA`), a flat folder, `preprocess: false`, exit 1 on an unmappable link. `rebaseLinks` was replaced by `mapLinkTargets`/`resolveLink`; the workflow test and the export link test were added (10 to 11 tests).
- Counts: `npm test` 244 in 15 files as planned; the 8 generated files and 74 exported files as measured at the gates.
- Bare page names without `./` resolve on Gollum (VERIFICATION scenario 3), so the `./<page>` fallback of the plan's risk was not needed.

## Defects found and fixed during the feature
- `scripts/wiki.mjs` took the working directory as the project root and saw no wiki from `docs/` or `app/products`: it finds the root from any subfolder (`d26bd5a`).
- The link reader missed a link whose text holds inline code: fixed in `mapLinkTargets`, the one reader behind `wikiStatus`, the graph edges and the export (`d26bd5a`).
- The generated API page claimed `Currencies` is writable (the Operations column copied the OpenAPI methods) and omitted the sign-in requirement: it now names the column as the OpenAPI document's, states that roles and read-only code lists are enforced at run time and lists the `BR-ACCESS-*` rules (`0f38623`, REVIEW Important 1 and Minor 2).
- The ADR-0021 digest paraphrased only the original Decision and was stale against its amendments (`subcategory` mandatory, the repeated column, the size guard): restated (`0f38623`, REVIEW Important 2).
- REVIEW Minor 1 (a commit to a file named in a page's `code` changes the stamps and re-runs the mirror on merge to `main`) is documented in PATTERNS and ADR-0030 (`5d31162`).

## New items for the registry
No entity, action, handler or fragment. New scripts and exports: `scripts/gen-wiki.mjs` (`readPages`, `wikiSourcesHash`, `buildGraph`, `writeWiki`, `wikiStatus`, `mapLinkTargets`, `resolveLink`), `scripts/wiki.mjs`, `wikiPageShapeErrors`; the registry was regenerated (it also writes `docs/api` and `docs/wiki`).

## Cost
Measured at the close on 2026-10-28 (`node scripts/metrics.mjs feature business-rules-wiki`): 4 sessions, 2026-10-26 .. 2026-10-28, active 3h 57m, waiting 2d 8h (mostly the plan gate and the one-file pull request), agent-minutes 5h 54m (parallelism 1.5). Cost $77.40 by transcript (cost-state $27.72, recovered 78%); cache hit 95%, context mean 129K, peak 356K.
- Per phase: 0 $0.44, 1 $22.73 (spec), 2 $10.36, 3 $11.81, 4 $18.35, 5 $0.82, 6 $7.93, 7 $4.95.
- Rework flagged $28.84: phase 3 $9.08 (the CLI root lookup and inline-code link fixes, the test tightening), phase 4 $12.50 (the amendment A-F round: `architect`, `cap-backend-dev`, `test-backend`), phase 6 $6.38 (the review fixes and the re-review), phases 5 and 7 $0.88.
- Agents: `architect` 3 launches $21.19, `cap-backend-dev` 6 $17.59, `test-backend` 3 $5.21, `docs-keeper` 9 $5.03, `reviewer` 1 (2 resumes) $4.82, `ui-verifier` 1 $0.53, orchestrator $23.03. Turn-limit stops: `cap-backend-dev` 1 (phase 2), `reviewer` 1.
- Gates: one STATE budget block; review 0 blocking of 4 findings; criteria 22/22; MCP queries 41, none unexplained; lines +4210 / -252.

## Lessons
Part 1 put the feature's lessons into `docs/LESSONS.md`; nothing is added in part 2. The rule proposals: none open.

## Open debt
- `PRODUCTS_IMPORT_UNKNOWN_COLUMN` (`en`, `ru`) omits `subcategory` from the allowed columns: a `/feature` fix, then `wiki.mjs confirm` the IMPORT page (STATE open debt).
- The 6 `@assert` constraints are still absent from `DOMAIN-MODEL.md` (`annots()` in `gen-registry.mjs` prints `@assert.` keys only); the wiki rule pages and `audit` cover them.
- `graph.json` slimming (132 KB of 335 KB): drop `type`, `folder` and empty arrays (REVIEW size note).
- A Stop advisory for stale wiki pages was deliberately left out (CONTEXT Q8); `audit` runs in CI, `/test-all` and the phase 6 gate only.
