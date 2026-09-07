# ADR-0002: Vitest and @cap-js/cds-test for backend tests, $metadata snapshot as the contract

Date: 2026-09-07. Status: accepted.

## Context
The project had no tests. Since April 2026 capire names Vitest the primary runner for `cds.test` and announces a gradual move away from Jest. Changes to the OData contract (new fields, renames) break the Fiori application silently, so a contract test is needed.

## Decision
`@cap-js/cds-test` ^1 with Vitest ^5. Service tests in `test/<service>.test.js`, in-memory SQLite, data from `db/data`. Contract: `test/metadata.test.js` compiles `CatalogService` to EDMX V4 via `cds.compile.to.edmx` and compares it with a Vitest snapshot. The snapshot is updated only with `npx vitest -u` and an entry in `docs/CHANGELOG.md`. The `npm test` command is run by the Stop hook and in CI.

## Alternatives
| Option | Why rejected |
|---|---|
| Jest | SAP announced the end of its support in `cds.test`; problems with ESM |
| `node --test` via `cds test` | Less practice in the community, no snapshots out of the box |
| Comparing the whole `$metadata` response over HTTP | capire advises checking what is essential; compilation is more deterministic and faster |

## Consequences
- `import.meta.dirname` (Node 22) to specify the project root in `cds.test`.
- All tests in one process: `cds.test()` as the first call, no runner-specific mock functions.
- Coverage via `@vitest/coverage-v8`.

## Sources
- https://cap.cloud.sap/docs/node.js/cds-test
- https://cap.cloud.sap/docs/releases/2026/apr26
- https://cap.cloud.sap/docs/releases/2026/jun26
