# Project state

Updated by the `docs-keeper` agent at the end of every task and by the PreCompact hook. The first 40 lines are printed at the start of every session.

## Where we are

- Date: 2026-09-09
- Branch: `main` at `c9d9839` (merge of `feature/products-draft-edit`, pushed; CI run 34141175799 green: backend, UI lint, OPA5 journeys). `main` holds two merged feature runs (`categories-code-list`, `products-draft-edit`), the English pipeline, CI and Dependabot.
- Pipeline: stages 0–4 of the plan are implemented and exercised by two full `/feature` runs (`categories-code-list`, `products-draft-edit`); CI and Dependabot are in place. Not done: packaging as a plugin (stage 5).
- Retro follow-ups applied in this branch: `maxTurns` raised (test-ui, ui-verifier, docs-keeper 80; reviewer 50; architect, test-backend 60), `feature` skill updates STATE after every phase, `test-all` gained a dev-server smoke step and a Cyrillic scan, PostToolUse hook flags Cyrillic, `metadata.test.js` checks that `localService/metadata.xml` equals the compiled EDMX (16 tests), CLAUDE.md invariant 10 (English everywhere the AI reads) and a request-to-skill routing table.
- All docs, agent memories, feature files and ADRs are English now; Russian remains only in i18n `ru` bundles, `.texts.csv`, asserted test values and the owner's plan `docs/ai-pipeline-plan.md`.
- Feature `products-draft-edit` merged 2026-09-07 (`c9d9839`): `@odata.draft.enabled` on `CatalogService.Products` (ADR-0012), 22 backend tests, OPA5 17/17 with 0 skipped, browser verification "ready for review" (`docs/features/products-draft-edit/VERIFICATION.md`), review with zero blocking findings, retro triaged (`8d21809`).
- Next feature `catalog-authorization`: specification and ADR-0013 (proposed) are on `main` (`efb05bf`); starts after the marker feature via `/feature` with the architect's recommended options (Viewer/Editor roles, `@requires` on the service, `@restrict` on `Products`, mocked users alice/bob Editor and a new `viewer`, anonymous 401 incl. `$metadata`), then `liveMode` for the List Report, then the deployment ADR.
- 2026-09-09: `@ui5/mcp-server` pinned in `.mcp.json` (it was started unpinned by the `ui5` plugin, against ADR-0009); STACK.md gained "Setup on a new machine" (plugins are not installed by `enabledPlugins`). Agent allowlists carry both tool prefixes (`mcp__plugin_ui5_ui5-mcp-server__*`, `mcp__ui5-mcp-server__*`) until the next session restart shows which one is live; then the stale one is removed.
- LESSONS is an inbox (0 pending decisions, 4 pending upstream). The protected-file follow-ups of the retro were applied on 2026-09-09 on the user's request (agents `ui-verifier`, `architect`, skill `feature`, protocol section 3, rule `tests-backend.md`); `/retro` transfers lessons into hooks, rules, tests, templates and agent prompts.
- Next steps (user decision 2026-09-09): marker feature first (`@Common.SemanticKey` on `Products`, draft and lock marker in the List Report row), then `catalog-authorization`, `liveMode` for the List Report, the deployment ADR; New Sandbox migration; pipeline stage 5 (plugin packaging) when a second project appears.

## What works

- Backend on cds 10.0.6, Node 22: `npm run watch` (`cds watch`, port 4004), `npm run lint`, `npm test` (22 tests, $metadata snapshot), `npm run docs:registry`
- UI: `npm start` (proxy, :8080) and `npm run start-mock` in `app/products` both open the app from the FLP sandbox; `ui5lint` 0 problems; `npm run lint:js` (Fiori tools ESLint) 0 errors
- Object Page editing of `Products` through drafts (ADR-0012): Edit, Save, Cancel with discard confirmation, Create and Delete on the List Report, Editing Status filter, draft lock across users
- UI tests: `npm run test:ui` in `app/products` (`ui5-test-runner` against `npm run watch` on :4004): 17 passed, 0 skipped
- Project-level Claude Code plugins: `ui5`, `cap-developer`; MCP in `.mcp.json`: `cds-mcp`, `fiori-mcp`, `chrome-devtools`, `ui5-mcp-server` (pinned 0.2.18 since 2026-09-09, overrides the plugin's unpinned server; loaded after a session restart). Setup on a new machine: `docs/architecture/STACK.md`
- Pipeline: 11 subagents in `.claude/agents`, 12 skills, 11 path-based rules, 6 hooks in `.claude/settings.json`, the `docs/registry` registry, the release watcher `scripts/watch-releases.mjs` and the `upstream-check.yml` and `ci.yml` workflows, `.github/dependabot.yml`

## Open debt

| Item | Resolution | Who |
|---|---|---|
| FLP sandbox still uses the legacy bootstrap (`sandbox.js`, `Container.createRenderer`, deprecated since 1.120, no successor); calls carry `ui5lint-disable` directives | Migrate to the New Sandbox with the `modernize-flp-sandbox` skill from the `ui5-modernization` plugin (needs UI5 >= 1.147; CDN is 1.152) | user decides |
| Keyboard hack for the Explore button in `Component.js` (setTimeout, internal ushell id) | Deliberate decision of the author. Do not touch without a request; the alternative via `CommandExecution` is described in LESSONS | user |
| `Products.price` Decimal(10, 2) instead of the convention Decimal(15, 2) | Kept, ADR-0003. Change at the first model migration | architect |
| `mta.yaml`, `xs-security.json` are drafts without productive dependencies | Separate ADR before any deployment work | user |
| CI and Dependabot added 2026-09-07 (`ci.yml`: backend, UI lint, OPA5 journeys; `dependabot.yml`: weekly, grouped, majors of CAP excluded). First run failed (root ESLint picked up the UI config, UI lockfile out of sync), fixed in `8ec176b`; run 34112716975 green: backend, UI lint, OPA5 journeys | Watch Dependabot PRs on Mondays | user |
| `run_manifest_validation` of UI5 MCP 0.2.18 fails with a draft-06 schema error | Workaround via `ui5lint`; wait for a new `@ui5/mcp-server` version via `upstream-check`, then bump the pin in `.mcp.json` | upstream-watcher |
| List Report needs the Go button before the table reloads (FE default, avoids server round trips on every filter change); the user finds it inconvenient for a 15-row catalog | Set `liveMode: true` on `ProductsList` via Fiori MCP `execute_functionality`; tiny feature, needs a PLAN because it changes `manifest.json` and the OPA5 filter journey | user |
| UI tests run only against the live stack (`npm run watch`); the mock (`npm run start-mock`) does not serve `ru` | Known limitation of `sap-fe-mockserver`, no alternative found | |
| List Report shows no draft or lock marker in the row: `Products` has no `Common.SemanticKey` (verified 2026-09-07, `products-draft-edit/VERIFICATION.md` scenarios 4 and 6); Editing Status filter and the Object Page lock popover work | Small follow-up feature: `@Common.SemanticKey: [name]` in `app/products/annotations/Products.cds` (UI layer), contract snapshot and journeys re-checked | next `/feature` (user, 2026-09-09) |

## Accumulated decisions

See `docs/decisions/`. Key ones: cds 10 + Node 22 (ADR-0001), Vitest + cds-test (ADR-0002), annotations split into semantics in `srv/annotations` and UI in `app/<app>/annotations` (ADR-0004), JavaScript and ESM (ADR-0005), Fiori Elements V4 via Fiori MCP (ADR-0007), mock via `sap-fe-mockserver` (ADR-0008), MCP-first and pinned versions (ADR-0009), `UPPER_SNAKE` code format for own code lists (ADR-0010), the ValueList for associations to a CodeList is generated by the compiler and fixed code lists use a dropdown (ADR-0011), draft editing on `CatalogService.Products` with explicit `IsActiveEntity: true` for non-Fiori clients, no configuration, no handlers (ADR-0012).

## Sessions
- 2026-09-07 15:17 UTC: branch feature/products-draft-edit, changed files 6, compaction auto
