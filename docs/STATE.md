# Project state

Dashboard of the project, kept in the shape of `templates/STATE.md` (ADR-0018): `## Now` holds only the six labeled lines, `## Open debt` only table rows, `## What works` only list items. The SessionStart hook prints `Now` and `Open debt` whole, every agent reads them at protocol step 2. Narrative belongs in `docs/CHANGELOG.md` and in the feature `SUMMARY.md`, not here. Updated by `docs-keeper` at the end of every task and by the `/feature` orchestrator after every phase gate.

## Now

- Date: 2026-10-09
- Branch: feature/products-subcategories
- Feature: products-subcategories (#8)
- Phase: 2: backend
- Last commit: 2bd5aee docs(spec): products-subcategories plan and ADR-0024
- Next: phase 2 gate (npm run lint, npm test 162 green after PLAN steps 1-5), then phase 3 fiori-app-dev steps 6-7

## Open debt

| Item | Resolution | Who |
|---|---|---|
| FLP sandbox still uses the legacy bootstrap (`sandbox.js`, `Container.createRenderer`, deprecated since 1.120, no successor); calls carry `ui5lint-disable` directives | Migrate to the New Sandbox with the `modernize-flp-sandbox` skill from the `ui5-modernization` plugin (needs UI5 >= 1.147; CDN is 1.152) | user decides |
| `mta.yaml`, `xs-security.json` are drafts without productive dependencies | Separate ADR before any deployment work; `cds add xsuaa --for production` will generate the `CatalogViewer`/`CatalogEditor` role templates and scopes from the CDS role names already in place (ADR-0013) | user |
| `fiori-mcp` 1.12.2 `list_functionality` has no id for `filterFields` or `liveMode`; both set by hand under the ADR-0020 exception to ADR-0007 | `upstream-watcher` re-checks on each bump; drop the exception once covered | upstream-watcher |
| FLP sandbox has no `data-sap-ui-flexibility-services`; variant `Save As` 404s and `eraseDirtyChangesOnVariant` erases the change on switch | Add a Session/LocalStorageConnector to `flpSandbox.html` (also needed for the New Sandbox migration); regress via an OPA5 `VariantManagement` select | user |
| Root `.prettierrc` (single quotes, es5 commas) contradicts `app/products` ESLint (double quotes, no dangling comma) | ESLint wins today (orchestrator decision); align the configs | user |
| A forked session's `session` card counts the parent's copied history | Cut the scope at the fork point | architect |
| `initialLoad: true` in `manifest.json` is a boolean; UI5 1.153.0 logs `DEPRECATED: boolean value not allowed for 'initialLoad'`, supported `Disabled\|Enabled\|Auto` (found 2026-10-07) | Set `Enabled` through Fiori MCP, confirm the List Report still loads on open, OPA5 green | fiori-app-dev |
## What works

- Backend on cds 10.1.1, Node 22: `npm run watch` (`cds watch`, port 4004), `npm run lint`, `npm test` (162 tests in 11 files: 66 in `test/catalog-service.test.js`, 20 in `test/products-import.test.js`, 10 in `test/metadata.test.js` incl. the `$metadata` snapshot, 11 in `test/backlog.test.js`, 7 in `test/hooks-protect-bash.test.js`, 8 in `test/hooks-registry-gate.test.js`, 4 in `test/hooks-state-hygiene.test.js`, 9 in `test/doc-shapes.test.js`, 3 in `test/prompt-budget.test.js`, 15 in `test/metrics.test.js`, 9 in `test/hooks-metrics.test.js`), `npm run docs:registry`
- UI: `npm start` (proxy, :8080) and `npm run start-mock` in `app/products` both open the app from the FLP sandbox; `ui5lint` 0 problems; `npm run lint:js` (Fiori tools ESLint) 0 errors
- Object Page editing of `Products` through drafts (ADR-0012): Edit, Save, Cancel with discard confirmation, Create and Delete on the List Report, Editing Status filter, draft lock across users
- List Report row shows a draft/lock marker (ADR-0015, feature `products-draft-marker`): `Common.SemanticKey: [ name ]` renders a `sap.m.ObjectMarker` in the `Product Name` cell — text-only `Draft` for an own draft, icon-plus-text `LockedBy`/`UnsavedBy` for another user's draft; verified in `en` and `ru`, keyboard-reachable, with the Editing Status filter narrowing to the marked row
- List Report and Object Page show `Products.rating` as a `sap.m.RatingIndicator` star column/field (feature `products-rating-column`, #5): `UI.DataPoint #Rating` with `Visualization: #Rating` referenced by a `UI.DataFieldForAnnotation` in `UI.LineItem` (`#Low` importance, last column) and in `UI.FieldGroup #GeneralInfo`; `@assert.range: [0, 5]` rejects an out-of-range `PATCH` and `draftActivate`; editable for `alice`/`bob`, read-only for `viewer`; `en`/`ru` labels verified
- List Report table toolbar button "Import from Excel" creates products in bulk from an uploaded `.xlsx` workbook (feature `products-excel-upload`, #7): collection-bound action `CatalogService.importProducts`, all-or-nothing with one message per bad row, at most 1,000 rows, workbook unzipped size guarded to 10 MB (`srv/lib/products-import.js` `unzippedSize`), `Common.SideEffects` refreshes the table, `@mandatory` on the `file` parameter marks the dialog field required; hidden for `viewer`; `en`/`ru` verified; see `README.md` for the workbook columns
- Pipeline metrics (#14, ADR-0022): `node scripts/metrics.mjs feature <name>` prints the cost, time and rework card from transcripts and `.pipeline/` records (parser `scripts/lib/transcript-usage.mjs`), `compare` lists `docs/metrics/history.jsonl` (5 features), the SessionStart briefing shows the last line; proved by `test/metrics.test.js` and `test/hooks-metrics.test.js`
- STATE hygiene (#15, ADR-0023): the SessionStart briefing ends with a drift warning when `## Now` disagrees with git (`stateDrift()` in `scripts/lib/state-now.mjs`: other branch, unknown or non-ancestor `Last commit:`, more than 1 first-parent commit behind); the Stop gate repeats it once per drift key as `additionalContext` and never blocks; an open issue with a `PLAN.md` or `CONTEXT.md` folder is tagged "plan drafted" and recommended for review; a worktree under `.claude/worktrees/` no longer blocks the Stop gate
- UI tests: `npm run test:ui` in `app/products` (`ui5-test-runner` against `npx cds serve --in-memory --port 4004`, credentials from `app/products/ui5-test-runner.json`): 42 passed (40 `opaTest`s + 2 QUnit), 0 skipped
- Project-level Claude Code plugins: `ui5`, `cap-developer`; MCP in `.mcp.json`: `cds-mcp`, `fiori-mcp`, `chrome-devtools`, `ui5-mcp-server` (pinned 0.3.2 since 2026-10-07; the plugin's unpinned server `plugin:ui5:ui5-mcp-server` is toggled off in `/mcp` on each machine). Setup on a new machine: `docs/architecture/STACK.md`
- Pipeline: 11 subagents in `.claude/agents`, 12 skills, 11 path-based rules, 7 hook events in `.claude/settings.json` (incl. the MCP audit on PostToolUse and PostToolUseFailure), the `docs/registry` registry, the release watcher `scripts/watch-releases.mjs` and the `upstream-check.yml` and `ci.yml` workflows, `.github/dependabot.yml`
- `CatalogService` requires authentication (ADR-0013): logging in as `alice` or `bob` (`CatalogEditor`, browser Basic prompt, empty password) shows Create, Delete and Edit as before; logging in as `viewer` (`CatalogViewer`) shows the same 15-row List Report and Object Page but without those four actions - the read-only singleton `CatalogService.Permissions` drives `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` in `app/products/annotations/Products.cds` through the short singleton path `/Permissions/isEditor`, which opens the Object Page without the UI5 `$select` TypeError (ADR-0013 amendment).

## Decisions

See `docs/decisions/` (ADR-0001 to ADR-0021); the accepted ways are rows in `docs/architecture/PATTERNS.md`.
