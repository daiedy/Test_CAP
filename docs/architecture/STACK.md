# Stack and versions

State as of 2026-10-26. Versions are updated through `upstream-check` (see `docs/upstream/UPDATES.md`) and the weekly Dependabot pull requests, changes are recorded in `docs/CHANGELOG.md`.

## Environment

| Component | Version | Note |
|---|---|---|
| Node.js | 22 LTS (22.23.2) | Installed via Homebrew `node@22`. cds 10 and the SAP tools require >= 22 |
| npm | 10.x | |
| `@sap/cds-dk` globally | 10.0.7 | `npm i -g @sap/cds-dk@10`, provides the `cds` command; the project's own dev dependency is 10.1.2 and `npx cds` uses that one |
| Claude Code | 2.1.x | Plugins `ui5@claude-plugins-official`, `cap-developer@cap` enabled at project level; they are not installed automatically, see "Setup on a new machine" |

## Backend

| Package | Version | Why |
|---|---|---|
| `@sap/cds` | ^10 (10.1.1) | CAP runtime. Yearly major, the previous major is supported for 12 months |
| `@sap/cds-dk` | ^10 (10.1.2) | CLI: `cds watch`, `cds compile`, `cds add`, `cds lint` |
| `@cap-js/sqlite` | ^3 (3.1.2) | SQLite for development and tests, `node:sqlite` driver by default |
| `@cap-js/cds-test` | ^1 (1.0.2) | `cds.test()` for service tests |
| `vitest`, `@vitest/coverage-v8` | ^5 (5.0.5) | Main test runner as recommended by capire since April 2026 |
| `eslint`, `@sap/eslint-plugin-cds` | ^10 (10.13.0), ^4 (4.2.5) | `cds lint`, config `eslint.config.mjs` |
| `prettier` | ^3 (3.9.10) | JS formatting |
| `eslint-plugin-jsdoc` | ^65.4.2 | JSDoc rule set of ADR-0029, in the root `eslint.config.mjs` (`srv/**/*.js`) and in `app/products/eslint.config.mjs` (`webapp/ext/**/*.js`); engines `node ^22.22.2 \|\| >=24.15.0`; two installations, one per `package.json` |
| `cds-swagger-ui-express` | ^0.11.0 | Dev plugin (devDependency, never runtime): Swagger UI at `/$api-docs/odata/v4/catalog/` under `cds watch`, login `alice`; registers itself on `cds.on('bootstrap')` |
| `@cap-js/openapi` | 1.6.0, exact devDependency | OpenAPI converter for `docs/api/CatalogService.openapi3.json` and for the Swagger UI. Pinned because 1.7.0 answers 500 on the Swagger document of a draft-enabled service (`cds.clone(csn)` on the served model); `cds compile --to openapi` prefers the project-local converter over the copy in `@sap/cds-dk`. The defect is reported upstream as cap-js/openapi#204 (https://github.com/cap-js/openapi/issues/204), the fix is PR #207 (open, not merged on 2026-10-26). Drop the pin after a release that contains PR #207, in the change that regenerates the document, and check that the Swagger test is green. The tag "Products.import Products" of the 1.6.0 output is fixed in 1.7.0 (#180) and ends with the pin. A Dependabot bump comes as its own PR (`exclude-patterns` in the `sap-cap` group), and its red Swagger test in `test/api-docs.test.js` is the intended guard (ADR-0029 amendments A, G) |
| `@sap/cds-common-content` | ^3 (3.2.0) | ISO code lists for currencies, countries, languages for `sap.common.*`; imported in `db/schema.cds` |
| `express` | ^5 (5.3.0) | Web server under CAP. `@sap/cds` 10 declares `express ^4.22.1 \|\| ^5`; the project has no custom `server.js` or express middleware, so the major bump (Dependabot #1) needed no code change |

`package.json` sets `"scarfSettings": { "enabled": false }`: the install-time analytics of `@scarf/scarf` (a dependency of `swagger-ui-dist`) stay off for every local `npm install` (ADR-0029 amendment C).

Known limits of the Swagger document served in development (ADR-0029):
- It is not localized: `cds-swagger-ui-express/lib/middleware.js:49` compiles `service.model` without `cds.localize`, which leaves 7 `{i18n>` strings (3 keys); reported upstream as chgeo/cds-swagger-ui-express#275 (https://github.com/chgeo/cds-swagger-ui-express/issues/275).
- Its ER diagram image is fetched from yuml.me, so the structure of the model (entity, type, association, entity-set and action names, no data) leaves the machine when Swagger UI opens. The user decided on 2026-10-26 to keep it, because this repository is public anyway. A confidential project sets `cds.swagger.diagram: false`.
- The committed `docs/api/CatalogService.openapi3.json` has neither problem (compiled with `-l en`, no diagram).

Database in development: SQLite in-memory, CSV deployed on every start (`cds watch`). The `db.sqlite` file is created only by `cds deploy` and is not committed. The productive database is not chosen (HANA Cloud per `mta.yaml`, decision postponed).

## UI

| Package | Version | Why |
|---|---|---|
| SAPUI5 from CDN `https://ui5.sap.com` | current, minUI5Version 1.136.0 | Fiori Elements V4 (`sap.fe.templates`), FLP sandbox |
| `@ui5/cli` | ^4 (4.0.71) | Build and development server |
| `@sap/ux-ui5-tooling` | ^1.33 (1.33.0) | `fiori run`, proxy, appreload |
| `@sap-ux/ui5-middleware-fe-mockserver` | ^2 (2.4.18) | OData V4 mock without backend, `ui5-mock.yaml` |
| `@ui5/linter` | ^1 (1.23.7) | `ui5lint`, deprecated APIs, CSP, manifest |
| `@sap-ux/eslint-plugin-fiori-tools` | ^10 (10.17.2) | ESLint for Fiori applications (wired in phase 3) |
| `@sap/ux-specification` | ^1.144 | Schemas for Fiori tools and the page editor |
| `@sap-ux/ui5-test-writer` | ^1.18.2 (1.18.2) | Generates OPA5 page objects for Fiori Elements V4 from the app model |
| `ui5-test-runner` | ^5.14.2 (5.14.2) | Runs QUnit/OPA5 without a browser via `npm run test:ui` (`app/products`) |

## Agent tools

| Tool | Version | Role |
|---|---|---|
| `@cap-js/mcp-server` (`cds-mcp`) | 0.0.5 | `search_model`, `search_docs` for CAP |
| `@sap-ux/fiori-mcp-server` (`fiori-mcp`) | 1.12.2 | Generation and modification of Fiori Elements, `search_docs` |
| `@ui5/mcp-server` (`ui5-mcp-server`, pinned in `.mcp.json`; the unpinned server bundled with the `ui5` plugin registers separately as `plugin:ui5:ui5-mcp-server` and is toggled off in `/mcp`) | 0.3.2 | API, guidelines, `run_ui5_linter`, `run_manifest_validation` (works since 0.3.2; 0.2.18 failed with a draft-06 schema error) |
| `chrome-devtools-mcp` | 1.8.0 | UI check in the browser |
| Plugin `ui5@claude-plugins-official` | 0.1.8 | 8 UI5 best practices skills; its bundled MCP server is toggled off in `/mcp` in favour of the pinned project entry |
| Plugin `cap-developer@cap` | 1.0.0 | CAP development skill from the CAP team |

MCP versions are pinned in `.mcp.json` and bumped only through `upstream-check` (ADR-0009).

## CI and dependency updates

- `.github/workflows/ci.yml` runs the backend tests, the UI lint and the OPA5 journeys; green since `8ec176b` (setup history in `docs/CHANGELOG.md`, 2026-09-07).
- `.github/dependabot.yml` opens weekly, grouped pull requests; patch and minor ones merge automatically once CI is green (`.github/workflows/dependabot-automerge.yml` sets `gh pr merge --auto`; the `main` branch protection requires "Backend lint, tests, docs", "UI lint" and "OPA5 journeys", admins may still push directly), majors and red ones wait for the user; CAP majors are excluded (they go through `/upgrade-cds`), and so are `ui5-test-runner` majors: v6 needs Node.js >= 24.11.1 and comes with the move to Node 24 (`docs/upstream/UPDATES.md`, 2026-10-26). Dependabot alerts and security updates are enabled in the repository settings; the `security` group (`applies-to: security-updates`) bundles the security pull requests into one per directory, outside the weekly schedule and the cooldown, and the `ignore` list holds for them too.
- Routine: the user reviews the Dependabot pull requests weekly (Mondays). After merging them on GitHub, `git fetch` and merge `origin/main` before the next push, keep the lock files as Dependabot wrote them (local npm 10.9.8 only strips `libc` metadata), then `npm install` in the root and in `app/products` and `npm test` (done on 2026-10-07 with pull requests #18 and #19).

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
4. Restart the Claude Code session so `.mcp.json` and the plugins load; approve the four project servers when asked. `/mcp` must list `cds-mcp`, `fiori-mcp`, `chrome-devtools` and `ui5-mcp-server`; the SessionStart hook shows the briefing in the terminal and hands the briefing, STATE and the environment check to Claude.
5. In `/mcp` toggle off `plugin:ui5:ui5-mcp-server`, the unpinned server bundled with the `ui5` plugin, so that only the pinned `ui5-mcp-server` runs. Claude Code stores the toggle per machine and project in `~/.claude.json` (`disabledMcpServers`); it cannot be committed. Check: `pgrep -fl 'ui5/mcp-server'` shows one process, `@ui5/mcp-server@0.3.2`.
6. Google Chrome for `chrome-devtools-mcp` (the `ui-verifier` agent).
7. GitHub CLI for the backlog (ADR-0019): `brew install gh`, `gh auth login` with the `repo` scope; the briefing shows the cached queue or a one-line notice without it.
8. Language of the chat and the briefing: `"env": { "PIPELINE_LANG": "ru" }` in `.claude/settings.local.json` (per machine, gitignored); unset means English for the scripts and the user's language for the chat.

## Planned for phases 3-4

`wdio-ui5-service` (E2E), Renovate.
