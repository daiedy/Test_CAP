# ADR-0008: Mock server @sap-ux/ui5-middleware-fe-mockserver instead of sap.ui.core.util.MockServer

Date: 2026-09-07. Status: accepted.

## Context
The mode without a backend was implemented on `sap.ui.core.util.MockServer`, which does not support OData V4, and did not work. `ui5.yaml` declared the `sap-fe-mockserver` middleware without the package installed and with a wrong path to the data, because of which `npm start` crashed and intercepted `/odata`.

## Decision
- The `@sap-ux/ui5-middleware-fe-mockserver` ^2 package in devDependencies and `ui5.dependencies`.
- A separate `app/products/ui5-mock.yaml` with the mock server (`generateMockData: true`, data from `webapp/localService/mockdata/<EntitySet>.json` as arrays). `ui5.yaml` contains only the proxy to `:4004`.
- Scripts: `npm start` (proxy), `npm run start-mock` (mock). The files `mockserver.js`, `initMockServer.js`, `mockServer.html`, `ui5-local.yaml` are removed.
- The `metadata.xml` snapshot is regenerated with the `cds compile '*' --to edmx-v4 -s CatalogService -l en` command.

## Alternatives
| Option | Why rejected |
|---|---|
| Finish the Sinon fake server | A custom OData V4 implementation ($filter, $expand, $count) does not pay off |
| Real backend only | `cds watch` is fast, but the mock is needed for OPA5 journeys and offline work |

## Consequences
- Mock data is maintained by hand; the `data.md` rule requires updating it together with the CSV if they must match.
- Verified 2026-09-07: `$metadata`, `Products`, auto-generated `Currencies`, the FLP page in mock mode respond with 200.

## Sources
- https://github.com/SAP/open-ux-odata/tree/main/packages/ui5-middleware-fe-mockserver
- https://github.com/SAP/open-ux-odata/blob/main/docs/DefiningMockdata.md
