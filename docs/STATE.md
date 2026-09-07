# Project state

Updated by the `docs-keeper` agent at the end of every task and by the PreCompact hook. The first 40 lines are printed at the start of every session.

## Where we are

- Date: 2026-09-07
- Branch: `feature/products-draft-edit` from `main` 6784760 (main pushed, CI green). `main` holds the merged first feature run (`feature/categories-code-list`) and the English translation of the pipeline; pushed.
- Pipeline: stages 0–4 of the plan are implemented and exercised by one full `/feature` run. Not done: CI for tests and linters, Dependabot, packaging as a plugin (stage 5).
- Retro follow-ups applied in this branch: `maxTurns` raised (test-ui, ui-verifier, docs-keeper 80; reviewer 50; architect, test-backend 60), `feature` skill updates STATE after every phase, `test-all` gained a dev-server smoke step and a Cyrillic scan, PostToolUse hook flags Cyrillic, `metadata.test.js` checks that `localService/metadata.xml` equals the compiled EDMX (16 tests), CLAUDE.md invariant 10 (English everywhere the AI reads) and a request-to-skill routing table.
- All docs, agent memories, feature files and ADRs are English now; Russian remains only in i18n `ru` bundles, `.texts.csv`, asserted test values and the owner's plan `docs/ai-pipeline-plan.md`.
- Active feature: `products-draft-edit` on branch `feature/products-draft-edit`. Phase 2 committed (`535c21b`): `@odata.draft.enabled` on `CatalogService.Products`, 22 backend tests green, snapshot and `metadata.xml` regenerated. Phase 3 committed: step 6 done (mock mode emulates the draft cycle without data changes), step 7 done (`EditCategoryOnObjectPageJourney` un-skipped, Cancel/discard test added; `npm run test:ui` 17/17, 0 skipped). Next: step 9 `ui-verifier`, step 10 `reviewer`, step 11 `docs-keeper`, retro, merge to `main`.
- Next feature `catalog-authorization`: specification and ADR-0013 (proposed) committed on this branch (`efb05bf`); starts after the draft feature is merged, with the architect's recommended options unless the user objects.
- LESSONS is an inbox (2 pending upstream entries); `/retro` transfers lessons into hooks, rules, tests and agent prompts.
- Next steps: user decisions on ADR-0012 (draft vs inline edit), `liveMode` for the List Report, New Sandbox migration; pipeline stage 5 (plugin packaging) when a second project appears.

## What works

- Backend on cds 10.0.6, Node 22: `npm run watch` (`cds watch`, port 4004), `npm run lint`, `npm test` (15 tests, $metadata snapshot), `npm run docs:registry`
- UI: `npm start` (proxy, :8080) and `npm run start-mock` in `app/products` both open the app from the FLP sandbox; `ui5lint` 0 problems; `npm run lint:js` (Fiori tools ESLint) 0 errors
- UI tests: `npm run test:ui` in `app/products` (`ui5-test-runner` against `npm run watch` on :4004): 11 passed, 5 skipped (`EditCategoryOnObjectPageJourney` under `opaTest.skip`, no draft)
- Project-level Claude Code plugins: `ui5`, `cap-developer`; MCP: `cds-mcp`, `fiori-mcp`, `chrome-devtools` (after a session restart)
- Pipeline: 11 subagents in `.claude/agents`, 12 skills, 11 path-based rules, 6 hooks in `.claude/settings.json`, the `docs/registry` registry, the release watcher `scripts/watch-releases.mjs` and the `upstream-check.yml` and `ci.yml` workflows, `.github/dependabot.yml`

## Open debt

| Item | Resolution | Who |
|---|---|---|
| FLP sandbox still uses the legacy bootstrap (`sandbox.js`, `Container.createRenderer`, deprecated since 1.120, no successor); calls carry `ui5lint-disable` directives | Migrate to the New Sandbox with the `modernize-flp-sandbox` skill from the `ui5-modernization` plugin (needs UI5 >= 1.147; CDN is 1.152) | user decides |
| Keyboard hack for the Explore button in `Component.js` (setTimeout, internal ushell id) | Deliberate decision of the author. Do not touch without a request; the alternative via `CommandExecution` is described in LESSONS | user |
| `Products.price` Decimal(10, 2) instead of the convention Decimal(15, 2) | Kept, ADR-0003. Change at the first model migration | architect |
| `mta.yaml`, `xs-security.json` are drafts without productive dependencies | Separate ADR before any deployment work | user |
| CI and Dependabot added 2026-09-07 (`ci.yml`: backend, UI lint, OPA5 journeys; `dependabot.yml`: weekly, grouped, majors of CAP excluded). First run failed (root ESLint picked up the UI config, UI lockfile out of sync), fixed in `8ec176b`; run 34112716975 green: backend, UI lint, OPA5 journeys | Watch Dependabot PRs on Mondays | user |
| `run_manifest_validation` of UI5 MCP 0.2.18 fails with a draft-06 schema error | Workaround via `ui5lint`; wait for a new `@ui5/mcp-server` version via `release-check` | release-watcher |
| List Report needs the Go button before the table reloads (FE default, avoids server round trips on every filter change); the user finds it inconvenient for a 15-row catalog | Set `liveMode: true` on `ProductsList` via Fiori MCP `execute_functionality`; tiny feature, needs a PLAN because it changes `manifest.json` and the OPA5 filter journey | user |
| The `Products` Object Page without draft has no edit mode; the category editing scenario in `EditCategoryOnObjectPageJourney.js` is under `opaTest.skip` | The draft decision is a separate feature with an ADR | user |
| UI tests run only against the live stack (`npm run watch`); the mock (`npm run start-mock`) does not serve `ru` | Known limitation of `sap-fe-mockserver`, no alternative found | |

## Accumulated decisions

See `docs/decisions/`. Key ones: cds 10 + Node 22 (ADR-0001), Vitest + cds-test (ADR-0002), annotations split into semantics in `srv/annotations` and UI in `app/<app>/annotations` (ADR-0004), JavaScript and ESM (ADR-0005), Fiori Elements V4 via Fiori MCP (ADR-0007), mock via `sap-fe-mockserver` (ADR-0008), MCP-first and pinned versions (ADR-0009), `UPPER_SNAKE` code format for own code lists (ADR-0010), the ValueList for associations to a CodeList is generated by the compiler and fixed code lists use a dropdown (ADR-0011).

## Sessions
- 2026-09-07 15:17 UTC: branch feature/products-draft-edit, changed files 6, compaction auto
