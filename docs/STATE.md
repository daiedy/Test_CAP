# Project state

Dashboard of the project, kept in the shape of `templates/STATE.md` (ADR-0018): `## Now` holds only the six labeled lines, `## Open debt` only table rows, `## What works` only list items. The SessionStart hook prints `Now` and `Open debt` whole, every agent reads them at protocol step 2. Narrative belongs in `docs/CHANGELOG.md` and in the feature `SUMMARY.md`, not here. Updated by `docs-keeper` at the end of every task and by the `/feature` orchestrator after every phase gate.

## Now

- Date: 2026-09-25
- Branch: feature/products-rating-filter
- Feature: products-rating-filter (#6)
- Phase: 4 Verification (UI phase done: steps 4, 4c, 5, 6, 6a; 36 OPA5 + 2 QUnit green)
- Last commit: 3d56b96 docs(products-rating-filter): fiori-mcp gap record and ADR-0020 exception
- Next: `ui-verifier` PLAN step 7, then review and documentation

## Open debt

| Item | Resolution | Who |
|---|---|---|
| FLP sandbox still uses the legacy bootstrap (`sandbox.js`, `Container.createRenderer`, deprecated since 1.120, no successor); calls carry `ui5lint-disable` directives | Migrate to the New Sandbox with the `modernize-flp-sandbox` skill from the `ui5-modernization` plugin (needs UI5 >= 1.147; CDN is 1.152) | user decides |
| Keyboard hack for the Explore button in `Component.js` (setTimeout, internal ushell id) | Deliberate decision of the author. Do not touch without a request; the alternative via `CommandExecution` is described in LESSONS | user |
| `Products.price` Decimal(10, 2) instead of the convention Decimal(15, 2) | Kept, ADR-0003. Change at the first model migration | architect |
| `mta.yaml`, `xs-security.json` are drafts without productive dependencies | Separate ADR before any deployment work; `cds add xsuaa --for production` will generate the `CatalogViewer`/`CatalogEditor` role templates and scopes from the CDS role names already in place (ADR-0013) | user |
| `$edmJson` `$Path` through the entity container (`/CatalogService.EntityContainer/Permissions/isEditor`, used by the three `UI.*Hidden` annotations, ADR-0013) trips an unguarded UI5 1.152.0 defect once per page load on :4004: `Failed to read path ... - TypeError: Cannot read properties of undefined (reading '$select')` (`_Helper.aggregateExpandSelect`, `_Helper-dbg.js:238`). Deterministic, identical for both roles, no functional impact measured (full record linked from `docs/features/catalog-authorization/SUMMARY.md`) | Try the documented fallback short path `/Permissions/isEditor`, regenerate the contract, re-verify in a browser | architect |
| The OPA5 suite for `catalog-authorization` authenticates as one user (`alice`) per run, so the hidden state for a `CatalogViewer` has no automated regression guard; only the backend tests (`@restrict`) and `ui-verifier`'s blocking viewer criterion cover it | Add a second runner config `ui5-test-runner-viewer.json` and a `test:ui:viewer` script only if the hidden state ever regresses (user decision 2026-09-10, PLAN "Open questions") | user |
| CI and Dependabot added 2026-09-07 (`ci.yml`: backend, UI lint, OPA5 journeys; `dependabot.yml`: weekly, grouped, majors of CAP excluded). First run failed (root ESLint picked up the UI config, UI lockfile out of sync), fixed in `8ec176b`; run 34112716975 green: backend, UI lint, OPA5 journeys | Watch Dependabot PRs on Mondays | user |
| `run_manifest_validation` of UI5 MCP 0.2.18 fails with a draft-06 schema error | Workaround via `ui5lint`; wait for a new `@ui5/mcp-server` version via `upstream-check`, then bump the pin in `.mcp.json` | upstream-watcher |
| List Report needs the Go button before the table reloads (FE default, avoids server round trips on every filter change); the user finds it inconvenient for a 15-row catalog | Set `liveMode: true` on `ProductsList` via Fiori MCP `execute_functionality`; tiny feature, needs a PLAN because it changes `manifest.json` and the OPA5 filter journey | user |
| UI tests run only against the live stack (`npm run watch`); the mock (`npm run start-mock`) does not serve `ru` | Known limitation of `sap-fe-mockserver`, no alternative found | |

## What works

- Backend on cds 10.0.6, Node 22: `npm run watch` (`cds watch`, port 4004), `npm run lint`, `npm test` (69 tests in 7 files: 30 in `test/catalog-service.test.js`, 7 in `test/metadata.test.js` incl. the `$metadata` snapshot, 7 in `test/backlog.test.js`, 6 in `test/hooks-protect-bash.test.js`, 7 in `test/hooks-registry-gate.test.js`, 9 in `test/doc-shapes.test.js`, 3 in `test/prompt-budget.test.js`), `npm run docs:registry`
- UI: `npm start` (proxy, :8080) and `npm run start-mock` in `app/products` both open the app from the FLP sandbox; `ui5lint` 0 problems; `npm run lint:js` (Fiori tools ESLint) 0 errors
- Object Page editing of `Products` through drafts (ADR-0012): Edit, Save, Cancel with discard confirmation, Create and Delete on the List Report, Editing Status filter, draft lock across users
- List Report row shows a draft/lock marker (ADR-0015, feature `products-draft-marker`): `Common.SemanticKey: [ name ]` renders a `sap.m.ObjectMarker` in the `Product Name` cell — text-only `Draft` for an own draft, icon-plus-text `LockedBy`/`UnsavedBy` for another user's draft; verified in `en` and `ru`, keyboard-reachable, with the Editing Status filter narrowing to the marked row
- List Report and Object Page show `Products.rating` as a `sap.m.RatingIndicator` star column/field (feature `products-rating-column`, #5): `UI.DataPoint #Rating` with `Visualization: #Rating` referenced by a `UI.DataFieldForAnnotation` in `UI.LineItem` (`#Low` importance, last column) and in `UI.FieldGroup #GeneralInfo`; `@assert.range: [0, 5]` rejects an out-of-range `PATCH` and `draftActivate`; editable for `alice`/`bob`, read-only for `viewer`; `en`/`ru` labels verified
- UI tests: `npm run test:ui` in `app/products` (`ui5-test-runner` against `npx cds serve --in-memory --port 4004`, credentials from `app/products/ui5-test-runner.json`): 28 passed, 0 skipped
- Project-level Claude Code plugins: `ui5`, `cap-developer`; MCP in `.mcp.json`: `cds-mcp`, `fiori-mcp`, `chrome-devtools`, `ui5-mcp-server` (pinned 0.2.18 since 2026-09-09; the plugin's unpinned server `plugin:ui5:ui5-mcp-server` is toggled off in `/mcp` on each machine). Setup on a new machine: `docs/architecture/STACK.md`
- Pipeline: 11 subagents in `.claude/agents`, 12 skills, 11 path-based rules, 7 hook events in `.claude/settings.json` (incl. the MCP audit on PostToolUse and PostToolUseFailure), the `docs/registry` registry, the release watcher `scripts/watch-releases.mjs` and the `upstream-check.yml` and `ci.yml` workflows, `.github/dependabot.yml`
- `CatalogService` requires authentication (ADR-0013): logging in as `alice` or `bob` (`CatalogEditor`, browser Basic prompt, empty password) shows Create, Delete and Edit as before; logging in as `viewer` (`CatalogViewer`) shows the same 15-row List Report and Object Page but without those four actions - the read-only singleton `CatalogService.Permissions` drives `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` in `app/products/annotations/Products.cds`. `npm test` **38 passed**, `npm run test:ui` **25 opaTests, 0 skipped**.

## Decisions

See `docs/decisions/` (ADR-0001 to ADR-0018); the accepted ways are rows in `docs/architecture/PATTERNS.md`.
