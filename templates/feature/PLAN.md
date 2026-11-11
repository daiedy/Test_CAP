# <Feature name>: plan

Date: YYYY-MM-DD. Status: draft | approved | done. Gate mode: semi-autonomous | autonomous | manual.

Shape (ADR-0018, ADR-0031): one criterion per line under a `### Phase <N>: <label>` (N the `/feature` phase 2-6 that implements and checks it; the heading needs a step row of phase N) or `### Every phase` subsection of "Acceptance criteria"; table rows only under "Steps", each `Phase` cell starting with `<N>: `, agent types in backticks; explanations belong in `CONTEXT.md` or `research/`. Each implementer, tester, `ui-verifier` and `docs-keeper` receives its rows and the criteria of its phase as a brief (`scripts/feature-brief.mjs`). `node scripts/check-feature-docs.mjs <name>` verifies the shape at the phase 1 gate.

Contract rule: a step that changes the OData model (`db/*.cds`, `srv/**/*.cds`, `app/*/annotations/*.cds`) schedules `npx vitest -u` and `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` in the same phase, never in a later one; the sync test in `test/metadata.test.js` turns red at that phase's gate otherwise (PATTERNS "OData contract").

## Acceptance criteria

### Phase 2: backend
- [ ] Behavior 1, verified by test `test/<service>.test.js` "..."

### Phase 3: UI
- [ ] Behavior 2, verified by OPA5 scenario "..."

### Phase 6: documentation
- [ ] Documentation updated: registry, STATE, CHANGELOG

### Every phase
- [ ] `npm test` and `npm run lint` are green at every gate

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | 2: model | `cap-backend-dev` | `db/schema.cds`, `db/data/...csv` | New entity | `cds compile`, `npm run lint` |
| 2 | 2: service and contract | `cap-backend-dev`, then `test-backend` | `srv/catalog-service.cds`, `srv/annotations/<Entity>.cds`, `_i18n/*`; `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u`) and `app/products/webapp/localService/metadata.xml` (regenerated) in the same phase | Mandatory field; OData contract | `npm test` green at this phase's gate, including the `metadata.xml` sync test |
| 3 | 2: logic | `cap-backend-dev` | `srv/catalog-service.js` | Action on a single record | `npm test` |
| 4 | 3: UI | `fiori-app-dev` | `app/products/annotations/<Entity>.cds`, `webapp/i18n/*` | Table columns | `ui5lint`, metadata snapshot |
| 5 | 3: UI tests | `test-ui` | `webapp/test/...` | User scenario | `ui5-test-runner` |
| 6 | 4: verification | `ui-verifier` | `VERIFICATION.md` | | screenshots; console: no message that is new against the console section of the latest `VERIFICATION.md` on `main` (name the known noise, do not forbid substrings) |
| 7 | 5: review | `reviewer` | | | zero blocking findings |
| 8 | 6: documentation | `docs-keeper` | `docs/registry`, `STATE.md`, `CHANGELOG.md`, `SUMMARY.md` | | `check-docs-fresh` |

## Decisions that require an ADR
List or "none".

## Risks
What can go wrong and how it will be detected.

## Open questions
What the user has to decide, or "none".
