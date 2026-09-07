# <Feature name>: plan

Date: YYYY-MM-DD. Status: draft | approved | done. Gate mode: semi-autonomous | autonomous | manual.

## Acceptance criteria
- [ ] Behavior 1, verified by test `test/<service>.test.js` "..."
- [ ] Behavior 2, verified by OPA5 scenario "..."
- [ ] Documentation updated: registry, STATE, CHANGELOG

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | Backend: model | `cap-backend-dev` | `db/schema.cds`, `db/data/...csv` | New entity | `cds compile`, `npm run lint` |
| 2 | Backend: service and contract | `cap-backend-dev`, then `test-backend` | `srv/catalog-service.cds`, `srv/annotations/<Entity>.cds`, `_i18n/*`; `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u`) and `app/products/webapp/localService/metadata.xml` (regenerated) in the same phase | Mandatory field; OData contract | `npm test` green at this phase's gate, including the `metadata.xml` sync test |
| 3 | Backend: logic | `cap-backend-dev` | `srv/catalog-service.js` | Action on a single record | `npm test` |
| 4 | UI | `fiori-app-dev` | `app/products/annotations/<Entity>.cds`, `webapp/i18n/*` | Table columns | `ui5lint`, metadata snapshot |
| 5 | UI tests | `test-ui` | `webapp/test/...` | User scenario | `ui5-test-runner` |
| 6 | Verification | `ui-verifier` | `VERIFICATION.md` | | screenshots, console without errors |
| 7 | Review | `reviewer` | | | zero blocking findings |
| 8 | Documentation | `docs-keeper` | `docs/registry`, `STATE.md`, `CHANGELOG.md`, `SUMMARY.md` | | `check-docs-fresh` |

Contract rule: a step that changes the OData model (`db/*.cds`, `srv/**/*.cds`, `app/*/annotations/*.cds`) schedules `npx vitest -u` and `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` in the same phase, never in a later one; the sync test in `test/metadata.test.js` turns red at that phase's gate otherwise (PATTERNS "OData contract", lesson of `products-draft-edit`).

## Decisions that require an ADR
List or "none".

## Risks
What can go wrong and how it will be detected.
