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
| 2 | Backend: service | `cap-backend-dev` | `srv/catalog-service.cds`, `srv/annotations/<Entity>.cds`, `_i18n/*` | Mandatory field | `npm test` |
| 3 | Backend: logic | `cap-backend-dev` | `srv/catalog-service.js` | Action on a single record | `npm test` |
| 4 | UI | `fiori-app-dev` | `app/products/annotations/<Entity>.cds`, `webapp/i18n/*` | Table columns | `ui5lint`, metadata snapshot |
| 5 | UI tests | `test-ui` | `webapp/test/...` | User scenario | `ui5-test-runner` |
| 6 | Verification | `ui-verifier` | `VERIFICATION.md` | | screenshots, console without errors |
| 7 | Review | `reviewer` | | | zero blocking findings |
| 8 | Documentation | `docs-keeper` | `docs/registry`, `STATE.md`, `CHANGELOG.md`, `SUMMARY.md` | | `check-docs-fresh` |

## Decisions that require an ADR
List or "none".

## Risks
What can go wrong and how it will be detected.
