# ADR-0001: Node.js 22 and cds 10 as the base platform

Date: 2026-09-07. Status: accepted.

## Context
The project was on `@sap/cds` 8.9 with `@sap/cds-dk` 9.4, without Node.js installed. cds 8 is out of support, and all current SAP tools for agentic development (`@sap-ux/fiori-mcp-server`, `@cap-js/cds-test` 1.x, `@sap/cds-dk` 10) require Node ≥ 22. Major CAP versions are released once a year, the previous major receives only critical fixes for 12 months.

## Decision
Node.js 22 LTS (Homebrew `node@22`), `@sap/cds` ^10, `@sap/cds-dk` ^10 globally and in devDependencies, `@cap-js/sqlite` ^3. The project was migrated without `cds upgrade`, since there was no custom code. Field `engines.node: ">=22"` in package.json.

## Alternatives
| Option | Why rejected |
|---|---|
| Stay on cds 8 | No support, SAP tools are incompatible, MCP servers target cds 9+ |
| cds 9 | Another migration in a year; cds-dk is already 10 |
| nvm instead of Homebrew | An extra layer for a single version; Homebrew is already installed |

## Consequences
- The default SQLite driver is `node:sqlite`; the ExperimentalWarning in the logs is acceptable.
- `cds.features.ieee754compatible: true`: Decimal and Int64 from SQLite arrive as strings, tests compare strings (TESTING.md).
- Write operations return `{ affected }`; `srv.entities` is a getter.
- Major upgrades are planned for June of every year via `release-check` and the `cap-upgrade` skill.

## Sources
- https://cap.cloud.sap/docs/releases/schedule
- https://cap.cloud.sap/docs/releases/migration/cds10
- https://cap.cloud.sap/docs/releases/2026/jun26
