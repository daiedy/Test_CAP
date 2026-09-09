---
paths:
  - "test/**"
---
# Backend tests (test/)

## Before editing
1. `mcp__cds-mcp__search_docs` for `cds.test`, `defaults.auth`, `containSubset`, if the API is not obvious.
2. `mcp__cds-mcp__search_model`: exact names of entities, actions, fields.
3. Read `docs/architecture/TESTING.md`, sections "Rules" and "cds 10 specifics".

## Rules
- One file per service: `test/<service>.test.js`. Contract: `test/metadata.test.js`.
- The first line after the cds import: `const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..')`. No imports of cds submodules before that.
- `defaults.auth = { username: 'alice' }`, access denial is checked in a separate `it` with a different user.
- Data from `db/data/*.csv`; check a subset: `to.containSubset`, not `deep.equal` of the whole response.
- Decimal and Int64 arrive as strings: `expect(price).to.equal('1299.99')`.
- Test names describe behavior: `rejects negative stock`.
- Negative tests assert the annotation, not just the status: the `cds.test` error carries `code` and `target` of the OData error (`ASSERT_MANDATORY`, `ASSERT_TARGET`, `ENTITY_IS_READ_ONLY`): `const err = await expect(POST(...)).to.be.rejectedWith(/400/); expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'category_code' })`.
- Draft-enabled entities (ADR-0012): address active data explicitly. `POST` payloads carry `IsActiveEntity: true`, active keys are `(ID=<id>,IsActiveEntity=true)`, drafts `IsActiveEntity=false`; a `POST` without `IsActiveEntity` creates a draft and skips `@mandatory`. Reference: `describe('CatalogService.Products drafts')` in `test/catalog-service.test.js` and TESTING.md "cds 10 specifics".
- The metadata snapshot is updated only with `npx vitest -u`, with the reason recorded in `docs/CHANGELOG.md`.
- Templates: `templates/service.test.js`, `templates/metadata.test.js`.

## After editing
- `npm test`, full output goes into the report. Claiming "tests pass" without running them is forbidden.
- `npx prettier --write test/`.

## Forbidden
- Runner-specific functions (`vi.mock`, fake timers) inside cds.test tests.
- `process.chdir`, starting a second server, real external systems.
