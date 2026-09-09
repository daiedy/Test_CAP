# Stack and versions

State as of 2026-09-09. Versions are updated through `upstream-check` (see `docs/upstream/UPDATES.md`), changes are recorded in `docs/CHANGELOG.md`.

## Environment

| Component | Version | Note |
|---|---|---|
| Node.js | 22 LTS (22.23.2) | Installed via Homebrew `node@22`. cds 10 and the SAP tools require >= 22 |
| npm | 10.x | |
| `@sap/cds-dk` globally | 10.0.7 | `npm i -g @sap/cds-dk@10`, provides the `cds` command |
| Claude Code | 2.1.x | Plugins `ui5@claude-plugins-official`, `cap-developer@cap` enabled at project level; they are not installed automatically, see "Setup on a new machine" |

## Backend

| Package | Version | Why |
|---|---|---|
| `@sap/cds` | ^10 (10.0.6) | CAP runtime. Yearly major, the previous major is supported for 12 months |
| `@sap/cds-dk` | ^10 (10.0.7) | CLI: `cds watch`, `cds compile`, `cds add`, `cds lint` |
| `@cap-js/sqlite` | ^3 (3.0.2) | SQLite for development and tests, `node:sqlite` driver by default |
| `@cap-js/cds-test` | ^1 (1.0.2) | `cds.test()` for service tests |
| `vitest`, `@vitest/coverage-v8` | ^5 | Main test runner as recommended by capire since April 2026 |
| `eslint`, `@sap/eslint-plugin-cds` | ^10, ^4 | `cds lint`, config `eslint.config.mjs` |
| `prettier` | ^3 | JS formatting |
| `@sap/cds-common-content` | ^3 (3.2.0) | ISO code lists for currencies, countries, languages for `sap.common.*`; imported in `db/schema.cds` |
| `express` | ^4 | Transitively for CAP |

Database in development: SQLite in-memory, CSV deployed on every start (`cds watch`). The `db.sqlite` file is created only by `cds deploy` and is not committed. The productive database is not chosen (HANA Cloud per `mta.yaml`, decision postponed).

## UI

| Package | Version | Why |
|---|---|---|
| SAPUI5 from CDN `https://ui5.sap.com` | current, minUI5Version 1.136.0 | Fiori Elements V4 (`sap.fe.templates`), FLP sandbox |
| `@ui5/cli` | ^4 (4.0.65) | Build and development server |
| `@sap/ux-ui5-tooling` | ^1.32 | `fiori run`, proxy, appreload |
| `@sap-ux/ui5-middleware-fe-mockserver` | ^2 (2.4.16) | OData V4 mock without backend, `ui5-mock.yaml` |
| `@ui5/linter` | ^1 (1.23.5) | `ui5lint`, deprecated APIs, CSP, manifest |
| `@sap-ux/eslint-plugin-fiori-tools` | ^10 | ESLint for Fiori applications (wired in phase 3) |
| `@sap/ux-specification` | ^1.144 | Schemas for Fiori tools and the page editor |
| `@sap-ux/ui5-test-writer` | ^1.9.6 (1.9.6) | Generates OPA5 page objects for Fiori Elements V4 from the app model |
| `ui5-test-runner` | ^5.14.0 (5.14.0) | Runs QUnit/OPA5 without a browser via `npm run test:ui` (`app/products`) |

## Agent tools

| Tool | Version | Role |
|---|---|---|
| `@cap-js/mcp-server` (`cds-mcp`) | 0.0.5 | `search_model`, `search_docs` for CAP |
| `@sap-ux/fiori-mcp-server` (`fiori-mcp`) | 1.12.2 | Generation and modification of Fiori Elements, `search_docs` |
| `@ui5/mcp-server` (`ui5-mcp-server`, pinned in `.mcp.json`; overrides the unpinned server bundled with the `ui5` plugin) | 0.2.18 | API, guidelines, `run_ui5_linter`, `run_manifest_validation` (defective in 0.2.18, `ui5lint` instead) |
| `chrome-devtools-mcp` | 1.8.0 | UI check in the browser |
| Plugin `ui5@claude-plugins-official` | 0.1.8 | 8 UI5 best practices skills; its bundled MCP server is replaced by the pinned project entry |
| Plugin `cap-developer@cap` | 1.0.0 | CAP development skill from the CAP team |

MCP versions are pinned in `.mcp.json` and bumped only through `upstream-check` (ADR-0009).

## Setup on a new machine

Plugins are not installed automatically: `enabledPlugins` in `.claude/settings.json` only enables plugins that are already installed on the machine. Without them the UI agents lose the UI5 MCP tools and the `ui5-best-practices*` skills and silently fall back to model knowledge. Steps for a new participant or a CI agent:

1. Node 22 and cds-dk: `brew install node@22`, `npm i -g @sap/cds-dk@10`; in GUI sessions `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
2. Dependencies: `npm ci` in the root and in `app/products`.
3. Plugins, once per machine (`claude-plugins-official` is built in and needs no `marketplace add`):
   ```bash
   claude plugin marketplace add capire/skills
   claude plugin install cap-developer@cap
   claude plugin install ui5@claude-plugins-official
   ```
4. Restart the Claude Code session so `.mcp.json` and the plugins load. `/mcp` must list `cds-mcp`, `fiori-mcp`, `chrome-devtools` and `ui5-mcp-server`; the SessionStart hook prints STATE and the environment check.
5. Google Chrome for `chrome-devtools-mcp` (the `ui-verifier` agent).

## Planned for phases 3-4

`wdio-ui5-service` (E2E), Renovate.
