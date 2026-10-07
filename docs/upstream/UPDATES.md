# Upstream dependency update digest

This file is maintained by the `upstream-watcher` agent through the `upstream-check` skill. Data source: the script `scripts/watch-releases.mjs`, which without the model downloads npm dist-tags, CAP release pages, GitHub Atom feeds and UI5 version JSON files, compares them with `docs/upstream/versions.json` and prints a diff. The agent reads only the diff and writes a new section here at the top: what changed, whether it affects the project, which actions are recommended. The script itself runs locally (`node scripts/watch-releases.mjs`) or weekly in GitHub Actions (`.github/workflows/upstream-check.yml`).

Reading rule: sections go from newest to oldest. Every section contains two lists, "Affects the project" and "Does not affect", and a list of recommended actions. This file does not change the versions in `.mcp.json` and `package.json`, it only recommends.

## 2026-10-07

31 sources checked, 0 errors (28 changed). Versions below verified with `npm view <pkg> version` and `cds version` on 2026-10-07.

### Affects the project
- `@ui5/mcp-server` 0.2.18 → 0.3.2 (pinned 0.2.18 in `.mcp.json`): 0.3.2 fixes "Prevent meta-schema collision when external schema uses https:// draft URI", closing issue #447 "run_manifest_validation always fails: schema with key or id http://json-schema.org/draft-06/schema already exists" (closed 2026-10-05, completed). This is the open-debt defect behind the `ui5lint` workaround. 0.3.0 is breaking: the roots-based path restriction is removed, tools now accept any absolute path (harmless here). No other manifest-related entries in 0.2.19 to 0.3.2. Fix not yet confirmed by a run in this project. Sources: https://github.com/UI5/mcp-server/releases/tag/v0.3.2, https://github.com/UI5/mcp-server/issues/447, https://github.com/UI5/mcp-server/releases/tag/v0.3.0.
- `@sap-ux/fiori-mcp-server` 1.12.2 → 1.15.6 (pinned 1.12.2): 1.13.0 `navigationEntity` in entityConfig, 1.14.0 `enableTypeScript`/`namespace`/`viewName` for `generate_fiori_app_odata`, 1.15.0 adaptation-project tools, 1.15.5 and 1.15.6 adaptation-project type selection and Copilot marketplace packaging. The CHANGELOG has no mention of `filterFields`, custom filter fields or `liveMode`, so the open debt (both set by hand under ADR-0020) is NOT resolved. Source: https://github.com/SAP/open-ux-tools/blob/main/packages/fiori-mcp-server/CHANGELOG.md.
- SAPUI5 CDN 1.152.0 → 1.153.0 (active version is now 1.153.*; CDN not pinned, ADR-0006; confirmed by `https://ui5.sap.com/resources/sap-ui-version.json`: 1.153.0, build 2026-09-30). `sap/ui/core` and `sap/fe/core` 1.153.0 release notes contain nothing about `_Helper.aggregateExpandSelect`, `$select`, `$edmJson` `$Path` or singleton paths, so the per-page-load TypeError (STATE open debt) is not known to be fixed. Relevant new `sap.fe.core` items: runtime API to activate/deactivate filter fields and update their labels from a controller extension (possibly relevant to the manual `filterFields` setup), `onBeforeExecuteAction` in EditFlow, FieldControl for dynamic mandatory child fields. Sources: https://ui5.sap.com/1.153.0/test-resources/sap/fe/core/relnotes/changes-1.153.json, https://ui5.sap.com/1.153.0/test-resources/sap/ui/core/relnotes/changes-1.153.json, https://ui5.sap.com/versionoverview.json.
- `@sap/cds` 10.0.6 → 10.1.1 and `@sap/cds-dk` 10.0.7 → 10.1.0 (minor, `^10` in `package.json`): local install is already `@sap/cds` 10.1.1 and `@sap/cds-dk` 10.1.0 (`cds version`); the global `cds-dk` is still 10.0.7. The 10.1.0 and 10.1.1 `@sap/cds` changelogs have no entry on positional `req.error(status, 'KEY')` leaving the numeric status in `details[].code`, nor on `sap-messages` texts and `Accept-Language`, so both LESSONS entries marked "re-check on cds 10.1.1" are not confirmed fixed and need a test run. Relevant fixes: `@assert` messages with `{i18n>...}` placeholders no longer mistaken for structured `error(...)` results; unknown key names in OData key predicates now give 400; parent-readable check no longer masks system errors as 404; static `@restrict.where` on collection-bound actions is now enforced (check the catalog action authorization). `cds watch` ignores the `.cds` folder by default. Sources: https://cap.cloud.sap/docs/releases/2026/changelog.md (September 2026), `node_modules/@sap/cds/CHANGELOG.md`.
- `@cap-js/sqlite` 3.0.2 → 3.1.1 (`^3`, installed 3.1.1; `@sap/cds-dk` still nests 3.0.2): in range, no action beyond the green test run. Source: https://github.com/cap-js/cds-dbs/releases/tag/sqlite-v3.1.1.
- `@cap-js/mcp-server` 0.0.5 → 0.0.6 (pinned 0.0.5 as `cds-mcp`): default embedding model changed to `sentence-transformers/all-MiniLM-L6-v2` (CAP AI SQLite `VECTOR_EMBEDDING`), `--model` flag and `CDS_MCP_MODEL`, fix for full embeddings re-download on every startup, per-request model isolation. Source: https://github.com/cap-js/mcp-server/releases/tag/v0.0.6.
- `chrome-devtools-mcp` 1.8.0 → 1.10.1 (pinned 1.8.0): two minors, used by `ui-verifier`; changelog not read in detail. Source: https://github.com/ChromeDevTools/chrome-devtools-mcp/releases.
- `@ui5/linter` 1.23.5 → 1.23.7 (`^1`): patch, picked up by install. Source: https://github.com/UI5/linter/releases/tag/v1.23.7.
- `@ui5/cli` 4.0.65 → 4.0.70 (`^4`), `@sap/ux-ui5-tooling` 1.32.0 → 1.33.0 (`^1.32.0`), `@sap-ux/ui5-middleware-fe-mockserver` 2.4.16 → 2.4.17 (`^2`): in range, picked up by install.
- `@sap-ux/ui5-test-writer` 1.9.6 → 1.15.6: now in `app/products/package.json` as `^1.13.1`; in range.

### Does not affect
- `@sap/cds-compiler` 7.0.3 → 7.1.1: transitive; installed 7.0.3 at root (cds-dk nests 7.1.0). Fixes concern actions with entity parameters and `@hierarchy` views, not used.
- `@ui5/cli` `next` 5.0.0-alpha.13: prerelease, not recommended.
- cds-dbs postgres, hana and db-service releases: the project uses SQLite only.
- `wdio-ui5-service` 3.0.12, wdi5 v3.0.12, `ui5-test-runner` 5.14.1: not installed, phase 3 (consider these versions when installing).
- `capire/skills` commit "recommend cds add data --keys-only workflow": matches the 10.1.0 `cds add data --keys-only` option, no project change.
- `SAP-docs/sapui5` What's New commit, `@sap-ux/*` generators and other open-ux-tools releases (repo-app-import, ui-service, ui5-library-*): not used.
- UI5 LTS list unchanged (1.148 is still the nearest LTS; 1.153 is the new active non-LTS version).
- `@sap/cds` 10.1.0 features (`sqlite:memory` preset, `hana-serverless`, native `fetch` destinations, UCL, messaging): not used.

### Recommended actions
- [x] Done 2026-10-07: the user bumped the pin and reconnected in `/mcp`; `run_manifest_validation` on `app/products/webapp/manifest.json` returned `{"isValid":true,"errors":[]}` where 0.2.18 failed with the draft-06 error minutes before. Bump `ui5-mcp-server` in `.mcp.json` from `@ui5/mcp-server@0.2.18` to `@ui5/mcp-server@0.3.2`, restart the MCP server, then call `mcp__ui5-mcp-server__run_manifest_validation` on `app/products/webapp/manifest.json`. If it runs without the draft-06 error: drop the open-debt row in `docs/STATE.md`, update the LESSONS entry of 2026-09-07 and the fallback line in `.claude/rules/ui5-webapp.md` and the `project-protocol` skill table; if it still fails, record the new error. Confirm with `cd app/products && npm run lint` (ui5lint stays green).
- [ ] Re-test the two cds 10.1.1 LESSONS entries with the installed 10.1.1 (`npm test` plus a direct check of the positional `req.error(409, 'KEY')` response `details[].code` and the `sap-messages` text with `Accept-Language: ru`). Update both entries ("fixed in 10.1.1" or "still open in 10.1.1"); remove the workaround in PATTERNS only after a green `npm test`. The 10.1.1 changelog gives no sign of a fix, so expect "still open".
- [ ] Run `npm test` and `npm run lint` once against the installed 10.1.1 and `@cap-js/sqlite` 3.1.1 (the static `@restrict.where` enforcement for collection-bound actions is a behavior change that could affect `catalog-authorization`); then align the global `cds-dk` with `npm i -g @sap/cds-dk@10.1.0` (user decision).
- [ ] Do not bump `@sap-ux/fiori-mcp-server` for the filter-field debt, nothing in 1.12.2 to 1.15.6 covers it; keep the ADR-0020 exception. Optional: bump the pin to 1.15.6 after reading 1.13.0 and 1.14.0 (additive changes), confirm with `list_functionality` on `app/products` and `npm test`. Re-check on the next bump.
- [ ] Check the UI5 1.153.0 CDN in the running app: `/run-app` and look for the `$select` TypeError in the browser console; if it is gone or unchanged, update the STATE open-debt row and the LESSONS entry of 2026-09-16. Run `cd app/products && npm test` (OPA5) against 1.153.0. Consider the new `sap.fe.core` filter-field runtime API for the manual `filterFields` setup. Optionally pin UI5 1.148 LTS in `ui5.yaml` (ADR-0006).
- [ ] Optional: bump `@cap-js/mcp-server` to 0.0.6 and `chrome-devtools-mcp` to 1.10.1 in `.mcp.json` after a first-use check (`search_model` and one `ui-verifier` run); the new embedding model may trigger a one-time download.

## 2026-09-07: baseline

First run, the state is recorded in `docs/upstream/versions.json`. 31 sources checked, no errors.

| Package or source | Version as of 2026-09-07 | In the project |
|---|---|---|
| `@sap/cds` | 10.0.6 | ^10 (10.0.6) |
| `@sap/cds-dk` | 10.0.7 | ^10 (10.0.7), globally 10.0.7 |
| `@sap/cds-compiler` | 7.0.3 | transitively |
| `@cap-js/cds-test` | 1.0.2 | ^1 (1.0.2) |
| `@cap-js/sqlite` | 3.0.2 | ^3 (3.0.2) |
| `@cap-js/mcp-server` | 0.0.5 | pinned 0.0.5 in `.mcp.json` |
| `@sap-ux/fiori-mcp-server` | 1.12.2 | pinned 1.12.2 in `.mcp.json` |
| `@ui5/mcp-server` | 0.2.18 | pinned 0.2.18 in `.mcp.json` as `ui5-mcp-server` since 2026-09-09 (before that unpinned, started by the `ui5` plugin 0.1.8 as `npx -y @ui5/mcp-server`) |
| `chrome-devtools-mcp` | 1.8.0 | pinned 1.8.0 in `.mcp.json` |
| `@ui5/cli` | 4.0.65 | ^4 |
| `@ui5/linter` | 1.23.5 | ^1 |
| `@sap/ux-ui5-tooling` | 1.32.0 | ^1.32 |
| `@sap-ux/ui5-middleware-fe-mockserver` | 2.4.16 | ^2 |
| `@sap-ux/ui5-test-writer` | 1.9.6 | not installed, phase 3 |
| `ui5-test-runner` | 5.14.0 | not installed, phase 3 |
| `wdio-ui5-service` | 3.0.11 | not installed, phase 3 |
| SAPUI5 on CDN | 1.152.0 | manifest `minUI5Version` 1.136.0, CDN not pinned |
| SAPUI5 LTS | 1.148, 1.136, 1.120 and older | nearest LTS to pin: 1.148 |
| CAP release notes | `releases/index.md`: 3 headings; `releases/2026/changelog.md`: 28 headings | |
| GitHub feeds | cds-dbs (sqlite v2.4.1 in the 2.x branch), cds-test v1.0.2, mcp-server v0.0.5, open-ux-tools, UI5/linter v1.23.5, UI5/mcp-server v0.2.18, openui5 v1.152.0, wdi5 v3.0.11, plugins-coding-agents v0.1.8, capire/skills, SAP-docs/sapui5 What's New | |

Baseline notes:

- All versions in `package.json` match the current ones on npm, nothing lags behind.
- The latest commit in `capire/skills` changes the Node.js recommendation to ESM, which matches our ADR on ESM.
- The `@cap-js/sqlite` 2.x branch keeps receiving patches, but the project is on 3.x, not relevant to us.
