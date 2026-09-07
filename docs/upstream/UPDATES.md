# Upstream dependency update digest

This file is maintained by the `upstream-watcher` agent through the `upstream-check` skill. Data source: the script `scripts/watch-releases.mjs`, which without the model downloads npm dist-tags, CAP release pages, GitHub Atom feeds and UI5 version JSON files, compares them with `docs/upstream/versions.json` and prints a diff. The agent reads only the diff and writes a new section here at the top: what changed, whether it affects the project, which actions are recommended. The script itself runs locally (`node scripts/watch-releases.mjs`) or weekly in GitHub Actions (`.github/workflows/upstream-check.yml`).

Reading rule: sections go from newest to oldest. Every section contains two lists, "Affects the project" and "Does not affect", and a list of recommended actions. This file does not change the versions in `.mcp.json` and `package.json`, it only recommends.

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
| `@ui5/mcp-server` | 0.2.18 | via the `ui5` plugin 0.1.8 |
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
