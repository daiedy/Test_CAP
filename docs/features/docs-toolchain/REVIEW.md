# docs-toolchain: review

Date: 2026-10-26. Reviewer: `reviewer`. Diff: `git diff bebb34c..HEAD` (9ee1c32..c89ad4a, 63 files) plus the uncommitted `VERIFICATION.md`, `screenshots/` (7 PNG) and the `docs/STATE.md` `## Now` edits. Read: CONTEXT.md, PLAN.md, `research/docs-facts.md` (section 10 in full, sections 4-5 by grep), VERIFICATION.md, ADR-0029 with amendments A-G.

## Blocking
- none

## Important
- none

## Minor
- `docs/features/docs-toolchain/VERIFICATION.md:47` and ADR-0029 "Consequences" `docs/decisions/ADR-0029-docs-toolchain.md:107`: the Swagger document served by `cds-swagger-ui-express` is not localized, and nothing records it. The plugin compiles `service.model` with no locale (`node_modules/cds-swagger-ui-express/lib/middleware.js:49`), while `cds compile -l en` runs `cds.localize` (`node_modules/@sap/cds-dk/bin/compile/index.js:297`). Measured: `@cap-js/openapi` 1.6.0 `compile(cds.compile.for.nodejs(await cds.load('srv')), {service:'CatalogService', 'openapi:url':'/odata/v4/catalog', 'openapi:diagram':true})` (the middleware's call) carries 7 `{i18n>` strings with 3 distinct keys. Six are `{i18n>UserID.Description}` and `{i18n>CurrencyCode.Description}`, SAP's `@description` from `@sap/cds/common`, on the `createdBy`/`modifiedBy`/`currency` properties of `CatalogService.Products`, `-create` and `-update`. One is `{i18n>Products.import Products}`, the operation tag of `importProducts`. The committed `docs/api/CatalogService.openapi3.json` has 0, and the same document after `cds.localize(csn, 'en', …)` has 0. VERIFICATION line 47 blames the raw braces on the "known cosmetic converter issue, PLAN risk and decision D5". That is two defects in one: the converter humanizes the key ("Products.import Products", the PLAN risk and the subject of D5), and the plugin does not localize (the braces, and it also hits SAP's descriptions). The ADR "Known limits" line names only the first. Owner: `docs-keeper` (STACK Swagger line, SUMMARY "Known limits", ADR-0029 line 107 known limits, a corrected VERIFICATION line 47). Not blocking: see question 4.
- `docs/features/docs-toolchain/VERIFICATION.md:35` and `node_modules/cds-swagger-ui-express/lib/middleware.js:53`: opening the Swagger UI makes the developer's browser fetch an ER diagram of the model from the third-party host `yuml.me`. The plugin defaults `'openapi:diagram'` to `true`, and the verifier logged "External (yuml.me ER diagram images in the Swagger description): 200". Research section 5 lists `diagram (true)` as an option default. The PLAN "Risks" line on `/$api-docs/**` covers only anonymous local access, and ADR-0029 decision 6 ("default `cds.swagger` options") does not say that the default sends entity and association names off the machine. Owner: `docs-keeper` records it in STACK and SUMMARY. Whether to set `"cds": { "swagger": { "diagram": false } }` is a user decision, because it changes decision 6.
- `docs/decisions/ADR-0029-docs-toolchain.md:54`, `:121`, `:122`: the evidence cites scratch probes at `/tmp/architect-ui5lint-probe/run.mjs` and `/tmp/architect-openapi-probe/probe.mjs`, which do not survive the session. Replace them with the reproducible commands (question 2). Owner: `docs-keeper` (or `architect`).
- `scripts/gen-registry.mjs:141` (`jsdocOf`, new) and `scripts/gen-registry.mjs:401`, the `REUSE-CATALOG.md` block (`const exp = /(?:\/\*\*([\s\S]*?)\*\/\s*)?export…/`, pre-existing): the generator now holds two JSDoc readers. The old regex takes the first non-tag line of the block before an `export` in `srv/lib`. `jsdocOf` parses every block of the same files, including that description. Not a blocking duplicate: the regex predates the feature, ADR-0029 decision 5 keeps the one-line Purpose column, and both outputs are generated and fresh. The next change to the REUSE-CATALOG block should derive the Purpose column from `jsdocOf(src).symbols` instead of keeping a second reader. Owner: `cap-backend-dev`, later change.
- `docs/CHANGELOG.md:5-30` (section `## 2026-10-25`): 26 lines and 20,062 bytes for one feature. Seven entries run from 1,163 to 3,592 characters, and the part 2 pipeline entry has a 17-line nested list. Consolidation list under question 5. Owner: `docs-keeper`.

## Checked and in order
- Gates, run fresh on 2026-10-26 (PATH with node@22, `PIPELINE_LANG=en`):
  - `npm run lint` exit 0.
  - `npm run lint:js` (root) exit 0.
  - `npm test`: `Test Files 14 passed (14)`, `Tests 231 passed (231)`, `Duration 35.02s`, exit 0.
  - `node scripts/check-docs-fresh.mjs`: `docs/registry is fresh.`
  - `node scripts/check-feature-docs.mjs docs-toolchain`: "PLAN.md and CONTEXT.md keep the shape of the templates."
  - `cds compile '*' --to edmx-v4 -s CatalogService -l en` against `metadata.xml`: no diff. The file has 1674 lines and 69 `Core.Description`, the figures in CHANGELOG.
  - `app/products`: `npm run lint` "No findings detected", `npm run lint:js` 0 errors, 10 warnings.
- Prettier: `--list-different` on the changed JS and MJS flags only `app/products/eslint.config.mjs` (one line over the print width) and `DetailsForm.js`. Both are outside the `format`/`format:check` scope (`srv`, `test`, `scripts`), and `DetailsForm.js` was already unformatted on bebb34c. No finding.
- Generated files untouched by hand:
  - A `git archive HEAD` export with linked `node_modules` was regenerated with `node scripts/gen-registry.mjs`. `docs/api/CatalogService.openapi3.json` came out byte-identical, and `docs/registry/*` differs only in the header date of 4 files.
  - `metadata.xml` equals a fresh compile, and the snapshot test is green.
- No `@description`, `@Core.Description` or `@Core.LongDescription` in `db/`, `srv/` or `app/products/annotations` (`grep -rnE` rc=1).
- Every doc comment on a projection is one sentence: the 9 `annotate` statements in `srv/annotations/*.cds`, plus the service, `importProducts` and its 2 parameters, `ProductsImportFile` and its 3 elements, and `Permissions`/`isEditor`. Every own element in the CONTEXT "Affected entities" table has its sentence. That includes the bare `subcategories;`, `values;` and `selections;` entries, which carry only a doc comment.
- Service-path logic exists once. `scripts/gen-api-docs.mjs` has no path formula: the server URL comes from the converter and `@protocol`. The only formula is the pre-existing `SERVICES.md` one in `gen-registry.mjs` (unchanged since bebb34c). The test asserts the literal `/odata/v4/catalog`.
- Hooks:
  - One exported `UI5_SCOPE` in `file-checks.mjs`, imported by `subagent-stop.mjs`; the old literal is gone.
  - One install check, `appHasTool`, and one report reader, `readLintReport` behind `runLinter`. `checkJs`, `checkUi5`, `eslintErrors` and `appErrors` all use them, and the `'[]'` fallbacks and the `run` import in `subagent-stop.mjs` are gone.
  - `globToRegExp` puts the brace branch before the escape branch, as amendment D says.
- Both ESLint jsdoc blocks are identical except for the `require-jsdoc` contexts and `no-undefined-types` (ADR-0029 Consequences line 106).
- Duplicates: none of the rejected mechanisms of research section 10 is present.
  - Absent: `--docs` flags, `--openapi:url`, `--openapi:diagram`, `jsdoc-to-markdown`/`jsdoc`/`typedoc`, `flat/recommended-error`, a hand-written `server.js`, a byte comparison in `check-docs-fresh.mjs`, OpenAPI under `docs/registry/`.
  - `cds-swagger-ui-express` is a devDependency only.
  - `JSDOC.md` is a new page; the only overlap is the internal reader in Minor 4.
- `_i18n/*` and `app/products/webapp/i18n/*` are unchanged (`git diff --stat bebb34c..HEAD` empty).
- Language: no new Cyrillic in the 65 changed files plus VERIFICATION and REVIEW. The only hits are the pre-existing trigger phrases and grep class in `.claude/skills/*/SKILL.md`, unchanged lines.
- `.github/workflows/ci.yml` has the step "ESLint (JavaScript, JSDoc)" running `npm run lint:js`. `.github/dependabot.yml` `sap-cap` keeps its 4 patterns and adds `exclude-patterns: ["@cap-js/openapi"]`.
- Every criterion's named test exists: `metadata.test.js` +2, `api-docs.test.js` 10, `hooks-file-checks.test.js` 7, `hooks-subagent-stop.test.js` 4.
- `docs/STATE.md` "Now" keeps its 6 lines in the template shape and only their values changed.
- Not checked:
  - The `npm run test:ui` rerun (the phase 2 gate record stands).
  - The `post-edit.mjs` sandbox run of step 4.
  - The MCP audit logs.
  - The PNG content of `screenshots/`.

## Orchestrator questions
1. **Pointer lines in `srv/catalog-service.cds` (lines 42, 51, 65): useful, keep. Not blocking, no finding.** CONVENTIONS has no rule on comment content. ADR-0029 decision 2(d) makes a developer note in `srv/*.cds` a `//` line, and the pointers are such notes. They sit exactly on the 3 projections whose doc comment was moved out of the service file and that still carry a `//` developer block. A reader who sees that block and no doc comment learns where the API description now lives, so the old second source is not re-created. The other 6 projections have no comment block and need no pointer. If the file is touched again, one service-head line ("API descriptions of the projections: the doc comments in `srv/annotations/<Entity>.cds`") next to the existing `// UI annotations live in app/products/annotations.` would be the uniform form. It is not required.
2. **ADR-0029 `/tmp` probe paths: yes, replace them. Non-blocking (Minor 3).** Re-run today in `app/products`: `npx ui5lint --format json webapp/localService/metadata.xml` exits 2, writes 0 bytes to stdout, and stderr reads "Specified file pattern 'webapp/localService/metadata.xml' did not match any resource". For the exit-0 side, cite the test that now pins it: `test/hooks-file-checks.test.js` "sends only the resources ui5lint lints to ui5lint" (a fragment reaches ui5lint, `metadata.xml` makes no npx call). `:121` has the same problem with `/tmp/architect-openapi-probe/probe.mjs`: cite `npx cds compile srv --to openapi -l en -s all` and the sync test "keeps docs/api/CatalogService.openapi3.json in sync with the model" instead.
3. **Test cost: nothing is redundant. Non-blocking, no finding.**
   - Verbose run of the 3 new files (17.4 s wall):
     - `hooks-file-checks`: 3113, 1814, 1, 614, 0, 600 and 903 ms.
     - `hooks-subagent-stop`: the shared blocked run in `beforeAll`, then 5733 ms (the pass run), 0, 82 and 766 ms.
     - `api-docs`: under 0.6 s per test.
   - The second `hooks-file-checks` test (1.8 s) is the only proof on the `checkUi5` path of two things. `APP_ESLINT_SCOPE` is `webapp/**/*.js`, not `ext/` alone (`controller/x.js` gets `semi` and no jsdoc rule). And `APP_ESLINT_EXCLUDE` keeps `localService/` out: without it, ESLint's "File ignored" warning would make a note. The SubagentStop test proves the exclusion on a different filter (`subagent-stop.mjs` `appErrors`, `js = rels.filter(…)`).
   - The 5.7 s pass run is expensive because SubagentStop also runs `runFileChecks` on every changed file without an `edit` audit record (the write-route advisories, up to 12 files). That is real hook behaviour. Seeding audit records would cut it, but the test would then no longer run the hook as agents meet it. Not recommended.
   - `CDS_SWAGGER=false` is not needed for this: the Swagger test costs 62 ms.
4. **Swagger localization: a documented limitation, not a blocking gap. Non-blocking (Minor 1).**
   - Measured: 7 `{i18n>` strings, 3 distinct keys, in the document the plugin serves. The committed document has 0.
   - Criterion 6 ("no `{i18n>` placeholder and no Cyrillic") targets the committed `docs/api` document and holds. The Swagger criterion names title, version, tag descriptions, the `Products` schema description and the try-out. All are English doc-comment literals with no i18n key, and the verifier saw all of them.
   - ADR-0029 decision 6 makes the Swagger UI a development aid, and the committed document is the consumer artifact (#28).
   - Fix options, none implemented:
     - (a) an upstream issue or PR to `chgeo/cds-swagger-ui-express` asking it to run `cds.localize(service.model, <locale>, …)` on the compiled document, as `cds compile -l` does. A user decision, like D5.
     - (b) a hand-written registration in `server.js` that serves a localized document: a rejected mechanism (research section 10), so an ADR amendment is needed.
     - (c) point the Swagger UI at the committed `docs/api` file: also a custom registration, and the live view is lost.
     - (d) accept and document it in STACK, SUMMARY and the ADR known limits. Recommended.
   - Neither (a) nor (d) removes the humanized "Products.import Products" key, which is the converter defect of D5.
5. **CHANGELOG `## 2026-10-25`: consolidate. Non-blocking (Minor 5).** For `docs-keeper`:
   - (a) Merge the two `pipeline:` entries for step 4 (line 26, part 1, 2,717 chars; lines 8-24, part 2) into one entry with the final behaviour: brace globs, one `UI5_SCOPE`, the app ESLint at the edit and at SubagentStop, the install check, the failure rule, Dependabot.
   - (b) Merge the two `test:` entries for the hook tests (line 25, 2,308 chars; line 7, 2,365 chars) into one: the file names, the criteria they verify, and the final figure `npm test` 231/231.
   - (c) Move the proof narratives (the "Proved by 6 mutations…" list and the "Sandbox proof" sub-list of 6 bullets) and the intermediate counts (212, 224) to SUMMARY, or drop them. CHANGELOG says what changed.
   - (d) Cut the step 3 entries (`test:` line 27, 3,592 chars; `srv:` line 28, 3,196 chars) to what changed and the recorded gate figures: 69 paths, 44 schemas, the pin and its reason in one clause.
   - (e) Keep the `srv:` round 2 entry (line 30) and the 2026-10-14 entries, which carry the required 1674/69 contract figure.

## Input for docs-keeper (phase 6)
- `PATTERNS.md`: the new rows "Description of an entity, element, action or type", "Generated API documentation" and "JSDoc requirement and gate"; "Shared function for several handlers" points to the rule set (ADR-0029 Consequences line 100).
- `CONVENTIONS.md`: section 2 (`docs/api/`), section 3 (doc-comment placement, one English sentence, no `@description`), section 4 (the jsdoc rule set defines "JSDoc on every exported function"), section 5 (JSDoc on every function of `webapp/ext/**`), section 8 (`docs/api/CatalogService.openapi3.json` and `docs/registry/JSDOC.md` generated by `npm run docs:registry`).
- `TESTING.md`: the Static row gains root `npm run lint:js`. New row "Generated docs freshness" (`check-docs-fresh.mjs` stamp, `api-docs.test.js` byte comparison). Name the hook tests `hooks-file-checks`/`hooks-subagent-stop` and their offline empty npm cache technique.
- `STACK.md`:
  - `cds-swagger-ui-express` 0.11.0 (dev).
  - `eslint-plugin-jsdoc` ^65.4.2 at root and app (engines `node ^22.22.2`).
  - `@cap-js/openapi` 1.6.0 as a pinned root devDependency with its reason, and the Dependabot exclude.
  - `scarfSettings`.
  - Minor 1 (served document not localized) and Minor 2 (yuml.me diagram).
- `README.md`: the commands `docs:api` and `lint:js`; the Swagger URL; a "Documentation" paragraph (`docs/api/`, `JSDOC.md`); "Check 5" with the SubagentStop app ESLint pass, ui5lint on webapp JS/HTML/view and fragment XML, the install check and the failure rule.
- Templates: `annotations-semantic.cds` (doc comments, `@Core.Description` dropped from the header), `service.cds` (`@protocol`, `@title`, `@Core.SchemaVersion`, doc comments), `entity.cds` (developer-note doc comment).
- ADR-0029:
  - Replace the `/tmp` probe citations (Minor 3, question 2).
  - Add the non-localized served document to "Known limits" (line 107).
  - Tick the consequence checkboxes if any.
- `VERIFICATION.md:47`: separate the converter's humanized key from the plugin's missing localization (Minor 1).
- `PLAN.md`: tick "i18n unchanged" (verified here: `git diff --stat bebb34c..HEAD -- _i18n app/products/webapp/i18n` is empty), the Swagger/VERIFICATION criterion and the Review criterion (0 blocking).
- `STATE.md`:
  - "Now" after review.
  - "What works" gains the documentation toolchain.
  - "Open debt" rows: the `@cap-js/openapi` 1.6.0 pin (drop when a fixed release exists, D5 upstream issue), the non-localized Swagger document, and the yuml diagram if the user keeps the default.
- `CHANGELOG.md`: the consolidation of question 5, and one `docs:` line for phase 6.
- `SUMMARY.md`: cost, known limits (humanized action tag, non-localized served document, yuml diagram, pin), the proof narratives moved out of CHANGELOG, permalink.
- `LESSONS.md` candidates:
  - `isUnder` silently matched nothing for brace globs for months, and only a glob test exposed it.
  - `cds compile --to openapi` prefers a project-local `@cap-js/openapi` (`cds._local`) over the cds-dk copy.
  - ui5lint fails the whole run (exit 2, no report) on any XML path that is not a view or a fragment.
  - The reviewer hit the 50-turn limit on a 63-file branch with REVIEW.md still a skeleton.
- Registry: fresh now; regenerate only if phase 6 touches sources.

## Verdict
ready to commit (0 blocking, 0 important, 5 minor; every minor is owned by `docs-keeper` in phase 6 or deferred to a later change)
