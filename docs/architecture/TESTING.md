# Testing strategy

## Levels

| Level | Tool | Where | When it runs |
|---|---|---|---|
| Static | `cds lint`, `ui5lint`, `prettier --check` | root, `app/products` | PostToolUse hook on every changed file, CI |
| OData contract | Vitest snapshot of `cds compile '*' --to edmx-v4 -s CatalogService -l en` | `test/metadata.test.js` | `npm test`, Stop hook, CI |
| Service | `@cap-js/cds-test` + Vitest, SQLite in-memory | `test/<service>.test.js` | `npm test`, Stop hook, CI |
| UI unit | QUnit | `app/products/webapp/test/unit/` | `ui5-test-runner`, CI (phase 3) |
| UI scenarios | OPA5 journeys on `sap.fe.test`, run with `npm run test:ui` in `app/products` while `npm run watch` runs in the root | `app/products/webapp/test/integration/` | `ui5-test-runner`, CI (phase 3) |
| End-to-end | wdi5 against `cds watch` | `app/products/webapp/test/e2e/` | on schedule and before a release (phase 3) |

## Rules

1. Every change in `db/` or `srv/` is accompanied by a service test or an update of an existing one. Every contract change is recorded by updating the snapshot with `npx vitest -u` and a line in `docs/CHANGELOG.md`.
2. Tests use data from `db/data/*.csv`. A test does not create data it can take from CSV.
3. `cds.test()` is called first, before any imports of cds submodules. The project folder is passed explicitly: `cds.test(import.meta.dirname + '/..')`.
4. Behavior is checked, not the full response: `expect(data.value).to.containSubset([...])` instead of `deep.equal` of the whole response.
5. Authorization: `defaults.auth = { username: 'alice' }`; the access-denied test is a separate `it`.
6. A test does not count as done until it has been run: the agent attaches the `npm test` output to the report.
7. Claiming "tests pass" without a fresh run is forbidden by the protocol.

## Commands

```bash
npm test                  # all backend tests, quiet output
npm run test:watch        # during development
npm run test:coverage     # v8 coverage in coverage/
npm run lint              # cds lint
cd app/products && npm run lint   # ui5lint
```

## cds 10 specifics

- Decimal and Int64 from SQLite arrive as strings: `expect(product.price).to.equal('1299.99')`.
- Write operations return `{ affected }`, not the changed rows.
- `srv.entities` is a getter, not a function.
- UI tests (`ui5-test-runner`) run only against the live stack (`npm run watch` on :4004): `fiori run` (`npm start`, :8080) does not serve `/products/webapp` from the FLP sandbox, and the mock server ignores `Accept-Language`, so the `ru` journey cannot pass there.
- On a draft-enabled entity (ADR-0012), `POST` without `IsActiveEntity: true` creates a draft and skips `@mandatory`; address active data explicitly with `IsActiveEntity=true` in payloads and keys.
- On `draftActivate`, the `ASSERT_MANDATORY`/`ASSERT_RANGE` targets are prefixed `in/<field>` (for example `in/name`), while `ASSERT_TARGET` on a new draft is the plain field path (for example `category_code`); match `target` by a suffix regex (`/category_code$/`) and assert `code` exactly instead.
- `DraftMessages` is `[]` on a clean draft `PATCH`; a violated `@assert.*` rule appears there with HTTP 200 and only turns into a 400 on `draftActivate`.
- `DELETE` of a draft that does not exist answers 404.
- `DELETE /Entity(<id>)` (addressed as active, no `IsActiveEntity`) of a record that has an open draft answers 403 `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS`; discard the draft with `DELETE /Entity(ID=<id>,IsActiveEntity=false)` instead.
- OPA5 runs need a fresh `npm run watch` before every run: a leftover draft from a previous run changes the List Report row count and breaks `iCheckRows(15)`.
