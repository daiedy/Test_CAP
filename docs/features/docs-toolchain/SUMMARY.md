# docs-toolchain: summary

Completion date: 2026-10-26. Commits: `9ee1c32` ... `c89ad4a` (plan, research and ADR-0029; backend descriptions; consumer descriptions; OpenAPI export, JSDoc page and jsdoc lint; pipeline rules, skills and hook gate; brace globs, SubagentStop app ESLint and linter guards; the documentation commit follows). GitHub issue #27.

## What was done
- Why: the 16 CDS doc comments of the project reached nothing (the Node.js compiler drops them unless `cdsc.docs` is on), no OpenAPI document existed, and JSDoc was required by CONVENTIONS but checked by nobody. Issue #28 (business-rules wiki) consumes the results.
- Model and service (ADR-0029 decisions 1-3): `cds.cdsc.docs: true` in `package.json`; doc comments (one English sentence each) above the `annotate` statements and own elements in `srv/annotations/*.cds`, and at the service, action, type and singleton definitions in `srv/catalog-service.cds`; service header `@protocol: 'odata-v4'`, `@title: 'Product Catalog API'`, `@Core.SchemaVersion: '1.0.0'`. Deliberate contract change: `metadata.xml` 1591 to 1674 lines, `Core.Description` 4 to 69 (plan estimate about 1670 and 67).
- Generated documents (decisions 4, 5, 8): `scripts/gen-api-docs.mjs` writes `docs/api/CatalogService.openapi3.json` (OpenAPI 3.0.2, 69 paths, 44 schemas, 11 tags, two-space JSON stamped with `info['x-sources']`); `scripts/gen-registry.mjs` writes `docs/registry/JSDOC.md` (4 files, 88 symbols) and shows descriptions in `DOMAIN-MODEL.md`; `npm run docs:api`, `npm run docs:registry`; `check-docs-fresh.mjs` checks the stamp and `JSDOC.md`.
- Swagger UI in development (decision 6): `cds-swagger-ui-express` as a dev dependency, `/$api-docs/odata/v4/catalog`; `@cap-js/openapi` pinned to 1.6.0 (amendment A), `scarfSettings` off (C).
- JSDoc gate (decision 7): the jsdoc rule set in the root and app ESLint configs, `npm run lint:js` in CI and `/test-all`; backfill of 4 blocks in `srv/catalog-service.js` and 4 in `DetailsForm.js`.
- Hook gates (amendments D-G): brace globs expand in `globToRegExp`; one `UI5_SCOPE`; SubagentStop runs the app ESLint; ui5lint and the app ESLint run only when installed in the app; a linter failure without a report blocks; Dependabot excludes the converter from the `sap-cap` group (`exclude-patterns`).
- Tests: `test/metadata.test.js` +2 (16), `test/api-docs.test.js` (9), `test/hooks-file-checks.test.js` (7), `test/hooks-subagent-stop.test.js` (4); `npm test` 209 to 231 in 14 files; `npm run test:ui` 82/82 at the phase 2 gate.
- Documentation: ADR-0029 with amendments A-G; PATTERNS, CONVENTIONS, TESTING, STACK, README, the three templates; registry, STATE, CHANGELOG, LESSONS.
- Proofs moved out of CHANGELOG: hook tests by 6 mutations of a scratch copy of `scripts/` (brace branch after the escape branch, no `APP_ESLINT_EXCLUDE` at SubagentStop, an install check that walks up, a repeated "not installed" note, a run without a report read as clean, every webapp XML in `UI5_SCOPE`), each red for exactly the expected tests; app ESLint file-check tests by 13 mutations; `api-docs.test.js` by 36 mutations plus 1 that must stay green, and the 1.7.0 defect simulated by adding `csn = cds.clone(csn)` to a copy of the 1.6.0 converter, which turned the Swagger test red; sandbox proof of the hook scripts with 11 payloads from a `createSandbox()` copy (undocumented `ext` function exit 2, documented exit 0, app without `node_modules` exit 0 with two advisories and no npx call, regenerated `metadata.xml` exit 0, `sap.ui.getCore()` exit 2, unloadable config exit 2, `webapp/test` file exit 0). `npm test` counts on the way: 212 (step 2), 220 (step 3), 224 (step 4 part 1), 231. Swagger plugin cost: median 23.01 s with it against 23.71 s with `CDS_SWAGGER=false` on the server-starting files, so the `test` script is unchanged.

## User decisions
- D1 (2026-10-25): `globToRegExp` expands brace alternatives; one shared `UI5_SCOPE` (ADR-0029 D).
- D2: SubagentStop runs the app ESLint and blocks on its errors (E).
- D3: both hook paths run ui5lint and the app ESLint only when installed in the app; a failed run is a failure, not "no findings"; a persistent failure keeps blocking (F).
- D4: the converter gets its own Dependabot PR through `exclude-patterns` (G).
- D5: the user posts an issue on the 1.7.0 defect to `cap-js/openapi`; the orchestrator drafts the text.
- D6 (2026-10-26): the yuml.me ER diagram of the Swagger UI is kept and recorded; a confidential project sets `cds.swagger.diagram: false`.
- D7 (2026-10-26): the orchestrator prepares an issue text for `chgeo/cds-swagger-ui-express` (served document not localized), and the user posts it.
- Plan gate 2026-10-14 (CONTEXT items 1-6) and phase 3 items 6-8 (pin, pretty-printed document, `scarfSettings`) are in `CONTEXT.md` "User decisions".

## Deviations from the plan
- Step 3 found that `cds-swagger-ui-express` brings `@cap-js/openapi` 1.7.0, so the export no longer ran the converter bundled with cds-dk; the exact pin 1.6.0, the pretty-printed document and `scarfSettings` were added (ADR-0029 amendments A-C).
- Step 4 found that `isUnder()` never expanded braces and that the hooks ran less than decision 7 said; part 2 (amendments D-G) fixed the matcher, added the SubagentStop app ESLint, the install check, the failure rule and the Dependabot exclusion.
- `UI5_SCOPE` follows the resources ui5lint lints, not the first form `*.{js,xml,html}`, because ui5lint fails the whole run on any XML that is not a view or a fragment.
- The service file doc comments of three projections were cut to one sentence with `//` developer notes (phase 2 gate, round 2).

## Known limits
- The bound action tag reads "Products.import Products": `@cap-js/openapi` 1.6.0 humanizes the `@title` key before localization (D5 covers the upstream report).
- The served Swagger document is not localized (`cds-swagger-ui-express` compiles with no locale): 7 `{i18n>` strings, SAP's `UserID.Description` and `CurrencyCode.Description` and the tag; the committed `docs/api` document has none (D7).
- The Swagger page fetches an ER diagram of the model from `yuml.me` (plugin default `openapi:diagram: true`); entity and association names leave the machine (D6).
- `@cap-js/openapi` stays at 1.6.0 until a release serves a draft-enabled service; a bump arrives as its own Dependabot PR and turns the Swagger test red for that PR only.
- `docs/api/**` is not a protected path; the byte-comparison test is the guard. Swagger UI renders operations lazily (only some tag sections are in the DOM on load); the OpenAPI contract is intact.
- Descriptions are English only (the recorded exception to invariant 7).

## Follow-ups
- `scripts/gen-registry.mjs` holds two JSDoc readers (`jsdocOf` and the older `export` regex of the `REUSE-CATALOG.md` block); derive the Purpose column from `jsdocOf(src).symbols` at the next change of that block (`cap-backend-dev`).
- Check whether the double-encoded Object Page key `Products('Notebook%2520Set')` predates this feature (`fiori-app-dev`, STATE debt).
- Drop the converter pin when a fixed `@cap-js/openapi` exists (`upstream-watcher`, STATE debt).
- Metrics: the D10 feature scope misses a session launched from the main checkout that works in a feature worktree. Its records carry `gitBranch: main`, and its markers are split between two `.pipeline/` directories. See "Cost"; record the history line once the scope covers it (`architect`, user decision).
- Optional: one service-head line in `srv/catalog-service.cds` pointing to the doc comments in `srv/annotations/<Entity>.cds`, next to the existing UI annotations line.

## New items for the registry
`docs/api/CatalogService.openapi3.json`, `docs/registry/JSDOC.md`, `scripts/gen-api-docs.mjs` (`writeOpenApi`, `stampOpenApi`, `openapiRecordedHash`, `apiDocsStatus`), `file-checks.mjs` exports (`UI5_SCOPE`, `APP_ESLINT_SCOPE`, `APP_ESLINT_EXCLUDE`, `appHasTool`, `notInstalledNote`, `readLintReport`); the registry is regenerated.

## Cost
Two cards, measured at the close on 2026-10-26. `metrics feature` misses session `ef481b20` (2026-10-24 .. 2026-10-26, phase 2 round 2 to phase 7). That session was launched from the main checkout, so its transcript records carry `gitBranch: main` in the main project directory. Its `/feature #27` prompt marker sits in the main checkout's `.pipeline/` and its phase markers in the worktree's, so the D10 join finds neither. No `history.jsonl` line is recorded until the scope covers it.
- `metrics feature docs-toolchain`: 4 sessions, 2026-10-14 .. 2026-10-24 (plan, research, phase 2 round 1). Cost $29.49 by transcript (cost-state $48.94, recovered 60%), active 1h 40m, agent-minutes 2h 6m.
- `metrics session ef481b20`: phase 2 round 2 to phase 7. Cost $58.78 by transcript (no cost-state record), active 3h 26m, agent-minutes 5h 18m.
  - Per phase: 2 $1.86, 3 $45.17, 4 $2.86, 5 $3.93, 6 $3.62.
  - Rework flagged $36.47, all in phase 3: `cap-backend-dev` 4 launches $17.82, `test-backend` 3 $12.03, `architect` 2 $6.61. These are the step 3 and 4 relaunches after turn limits and the amendment A-G rounds.
  - Turn-limit stops: `cap-backend-dev` 2, `test-backend` 1, `reviewer` 1.
- Together about $88 by transcript (about $108 with the earlier sessions' cost-state reference), active about 5h 6m.

## Lessons
Entries in `docs/LESSONS.md` dated 2026-10-26: plugin cost measured directly, `require-jsdoc` option merge, the npx ancestor lookup, a glob matcher tested against every promised syntax, "no report" versus "empty report", ui5lint XML scope, the `libc` lockfile strip, the served versus exported Swagger document, a reviewer on a large branch writes its file first.

## Open debt
STATE "Open debt" rows: the `@cap-js/openapi` pin (`upstream-watcher`) and the double-encoded Object Page key (`fiori-app-dev`).

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, VERIFICATION.md, research, screenshots of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/5dc70fb5acbcbf20586d1361e45bb7eb33eb0f46/docs/features/docs-toolchain (commit `5dc70fb`).
