# products-validations: summary

Completion date: 2026-11-12. Commits: `5f82fda` (plan re-approved), `9b73611`, `732fdcf`, `03ede92`, `f6eece4`, `50f740b`, then the documentation commit of step 10. Issue #10, ADR-0028 with amendment A.

## What was done
- Model (`db/`, `srv/annotations/`): `Products.namesakes` (self-association, `lower(trim())`), `SubcategoryAttributes.required`, `minValue`, `maxValue`, `DetailAttributes.atLeast` and its backlink `enabledBy`, `DetailListValues.enables`; seed: the seven required assignments, 20 bounded assignments, the four wireless values that enable Battery Life, `STORAGE` naming `RAM`. Rules R1-R6 on `Products` and R8, R10-R13 on `ProductDetails.numberValue` as `@assert.format(.message)`, `@assert.range(.message)` and `@assert: (case ...)` constraints, `error()` with two targets for R4 and R6 and with path arguments for R11. No `@assert.unique`, no handler for a rule an annotation expresses.
- Import (`srv/lib/products-import.js`, `srv/catalog-service.js`): per-row pre-checks `descriptionViolations` (R6) and `minorUnitViolations` (R4) through one `constraintViolations` with one `SELECT` on `sap.common.Currencies`; `rowInvalid` is the single builder of `PRODUCTS_IMPORT_ROW_INVALID`; a rule with `.message` reports the project text. Scope additions: `req.warn` and `req.info` pass `{ code, args }` (cds 10.2.2 localizes `sap-messages`), `PRODUCTS_IMPORT_UNKNOWN_COLUMN` lists `subcategory`.
- UI (`app/products`): `Common.FieldControl: (stock > 0 ? 7 : 3)` on `description`, `@CodeList.CurrencyCodes` and `Common.UnitSpecificScale: minorUnit`, mock data `localService/mockdata/Currencies.json`; the Details form marks required rows, shows the bounds of the assignment as placeholder, disables and clears Battery Life without a wireless connectivity (toast "Battery Life cleared: it depends on Connectivity."), counter without disabled rows; the pure row rules moved to `ext/fragment/DetailsRules.js`, re-exported by `DetailsForm.js`.
- Texts: 11 server message keys (`_i18n/messages*.properties`) and 5 app keys (`webapp/i18n`), `en` and `ru`.
- Tests: `npm test` 310 (was 281); `npm run test:ui` 97 of 97 (69 `opaTest` + 28 QUnit), OPA5 `ProductValidationsJourney` and one case in `RussianLocaleJourney`; `metadata.xml` 1674 to 1763 lines (step 3) and 1783 to 1781 (rework round 1).
- Verification: `VERIFICATION.md` V1-V25 in `en`, `ru` repeats, console clean; review approved with 0 blocking findings, three findings fixed.
- Documentation: 11 rule pages `planned` to `active`, BR-PRODUCTS-004 and the import pages updated, the ADR-0028 digest restated for amendment A; PATTERNS (new rows "Prevent before validate", "Conditionally required field", "Rule between two child rows", "Dependent field as a control plus guard"; "Format or range check", "Cross-field consistency check", "Monetary amount", "Bulk create from a file", "Success message of an action", "Custom section or column" rewritten), CONVENTIONS file layout, TESTING constraint timing, `templates/annotations-semantic.cds`.

## Deviations from the plan
- R3 is a closed bound `[0.01, 99999999.99]`, not the open `[(0), ...]` (user decision 2026-11-12, ADR-0028 amendment A): Fiori Elements 1.154 ignores `Validation.Exclusive`, so only a closed bound makes the client refuse 0. API values 0.001-0.009 are refused now.
- The row rules live in a sibling module `DetailsRules.js` (12 new functions plus the moved `isFilled`, `countFilled`, `counterStatus`, `numberTypeSettings`), not in `DetailsForm.js`; the `max-params`/`max-statements` directive is unchanged (71 statements, 14 parameters).
- Mock data `Currencies.json` added so mock mode gets the currency customizing (defect M1 of rework round 1); R12 texts `dependsOn` and `cleared` added.
- PLAN risk (line 107) and SCREENS UX risk (25), double announcement of the R12 clear: the V19 DOM check found the `MessageToast` as `div.sapMMessageToast` with `role="alert"` and the same text in the polite region of `InvisibleMessage`, so a screen reader read it twice. Resolution (review fix): the toast is kept, the `InvisibleMessage` call and its dependency are dropped. Nobody should re-add the announcement from the first sentence of SCREENS "Accessibility".
- Rules not taken: R7 (left out by the user), R9 (rejected, the free-text attribute is remodelled in a separate issue), R14 (rejected, `exists` cannot count).

## New items for the registry
- Services/model: navigation properties `Products/namesakes`, `DetailAttributes/atLeast`, `DetailAttributes/enabledBy`, `DetailListValues/enables`; properties `SubcategoryAttributes/required`, `minValue`, `maxValue`.
- `srv/lib/products-import.js`: `rowInvalid`, `descriptionViolations`, `minorUnitViolations`; `srv/catalog-service.js`: `constraintViolations`.
- `app/products/webapp/ext/fragment/DetailsRules.js`: `isRequired`, `assignmentOf`, `isEnabled`, `numberTypeSettings`, `countFilled`, `isFilled`, `counterStatus` and the row-clearing helpers; test files `ProductValidationsJourney.js`.

## Cost
Sessions 1 (2026-11-12 .. 2026-11-12), lead 13h 57m, active 3h 30m, waiting 10h 27m, agent-minutes 5h 22m (parallelism 1.5); idle cap 5 min, tool cap 10 min; phases: markers; rework: home-phase fallback; pricing 2026-09-29; Claude Code 2.1.322

Cost $57.41 (no cost-state record); tokens in 2.3K / cache write 3.5M / cache read 124M / out 869K; cache hit 97%; context avg 114K, peak 302K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 1m | 0m | 8 | $0.55 | $0.00 |
| 1 | 1 | 16m | 0m | 63 | $4.47 | $0.00 |
| 2 | 1 | 32m | 0m | 103 | $8.77 | $0.00 |
| 3 | 1 | 1h 39m | 10h 27m | 367 | $25.38 | $4.31 |
| 4 | 1 | 42m | 0m | 401 | $9.78 | $0.00 |
| 5 | 1 | 12m | 0m | 114 | $6.17 | $1.74 |
| 6 | 1 | 8m | 0m | 64 | $2.29 | $2.21 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 1h 56m | 95 / - | $7.59 | 0 |
| architect | 3 | 0 | 20m | 83 / 60 | $5.82 | 1 ($1.88) |
| cap-backend-dev | 3 | 0 | 23m | 81 / 60 | $5.87 | 2 ($1.82) |
| test-backend | 3 | 0 | 20m | 76 / 60 | $5.68 | 2 ($1.46) |
| fiori-app-dev | 5 | 0 | 40m | 174 / 60 | $12.05 | 1 ($0.90) |
| test-ui | 2 | 0 | 48m | 105 / 80 | $6.61 | 0 |
| ui-verifier | 6 | 0 | 39m | 379 / 80 | $8.24 | 0 |
| reviewer | 2 | 0 | 8m | 64 / 50 | $3.35 | 0 |
| docs-keeper | 1 | 0 | 8m | 63 / 80 | $2.21 | 1 ($2.21) |

Context per agent type (characters; node scripts/metrics.mjs context for each launch):
- architect: launches 3, resumes 0, compactions 0; startup max 26.8K, peak max 166.1K tokens; tool results 436.8K, brief 0, repeat reads 0
- cap-backend-dev: launches 3, resumes 0, compactions 0; startup max 23.2K, peak max 222.0K tokens; tool results 483.3K, brief 148.1K, repeat reads 0
- test-backend: launches 3, resumes 0, compactions 0; startup max 23.8K, peak max 239.5K tokens; tool results 461.7K, brief 144.8K, repeat reads 0
- fiori-app-dev: launches 5, resumes 0, compactions 0; startup max 32.3K, peak max 301.7K tokens; tool results 963.4K, brief 234.7K, repeat reads 0
- test-ui: launches 2, resumes 0, compactions 0; startup max 26.6K, peak max 247.5K tokens; tool results 391.7K, brief 91.5K, repeat reads 0
- ui-verifier: launches 6, resumes 0, compactions 0; startup max 36.1K, peak max 110.4K tokens; tool results 393.2K, brief 50.1K, repeat reads 0
- reviewer: launches 2, resumes 0, compactions 0; startup max 23.2K, peak max 164.5K tokens; tool results 334.6K, brief 0, repeat reads 0
- docs-keeper: launches 1, resumes 0, compactions 0; startup max 23.1K, peak max 166.6K tokens; tool results 246.6K, brief 18.1K, repeat reads 0
- main: compactions 0, peak 270.3K tokens
Resumes after a report (0): none

Gates: 0 blocks; review 0 blocking / 3 findings; criteria 46/46; MCP 566 queries, 0 unjustified, 3 failed; rule-covered edits with a query 33/33; prompts 1, hand-backs 19, notifications 24; lines +6445 / -1343

## Lessons
`docs/LESSONS.md` (2026-11-12): the active-rows rule of a draft child (transferred to PATTERNS "Rule between two child rows" and TESTING), the registry generator and a private JSDoc helper before an export, brief growth against the docs-keeper ceiling, OPA `autoWait` with disabled controls and the 150 s split page timeout. Already recorded elsewhere and not repeated: FE ignores `Validation.Exclusive` (PATTERNS, TESTING, ADR-0028 amendment A), the `Currencies.json` mock (PATTERNS "Monetary amount"), the composite field sends its `PATCH` on the second Tab (TESTING).

## Open debt
- O1: under `JPY` a stored price `10.5` displays as "11" (client scale of the currency); needs a custom price field fragment or FE support, separate issue (STATE).
- `DetailsForm.js` still carries the `eslint-disable` for `max-params` and `max-statements` (71 against 40, 14 parameters) (STATE).
- The `ru` wording of R11 (`PRODUCTS_DETAIL_VALUE_BELOW_OTHER`) reads stiff, a wording remark of the verifier (VERIFICATION.md).
- `coalesce()` in a constraint on HANA stays an accepted plan risk (not verified on HANA).

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, SCREENS.md, VERIFICATION.md, research, screenshots of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/263b989f0897b6bd82a45b7779bf262152041620/docs/features/products-validations (commit `263b989`).
