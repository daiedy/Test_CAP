# products-subcategory-cascade: summary

Completion date: 2026-10-10. Commits: `4c69908` ... `f6ce433` (plan and ADR-0025, backend, UI, verification, review fixes; the documentation commit follows). No GitHub issue (plain description).

## What was done
- Service: `@mandatory` on `Products.subcategory` in `srv/annotations/Products.cds` (an active create or update, and a `draftActivate`, without a subcategory answer 400 `ASSERT_MANDATORY`); Category and Subcategory are both mandatory (user requirement).
- Import (D7 = A, D8): the workbook gets a mandatory `subcategory` column (`srv/lib/products-import.js`, `README.md`, both `.xlsx` fixtures); `subcategoryMismatches` in `srv/catalog-service.js` reports a subcategory of another category per row before the inserts (ADR-0021 amendment 4 E), because the ADR-0024 `@assert` constraint is checked at commit and cannot name a row; the constraint stays as the guard.
- UI: `Common.FieldControl: (category.code is null ? 0 : 7)` on `subcategory` in `app/products/annotations/Products.cds` (ADR-0025): Subcategory is disabled and unmarked while the category is empty, enabled and required once a category is set; a category change empties it through the existing `resetStaleSubcategory` and `Common.SideEffects #CategoryChanged`; no handler, no i18n key, no `manifest.json` change. `metadata.xml` 874 to 884 lines.
- Tests: `npm test` 163 to 173 (`test/catalog-service.test.js` 66 to 75, `test/metadata.test.js` 11 to 12, `test/products-import.test.js` 20); `npm run test:ui` 49 to 52 (`SubcategoryDependsOnCategoryJourney` +3, `{ required: true }` in the two edit-mode cases, `EditCategoryOnObjectPageJourney` saves Furniture with a Furniture subcategory); the dynamic field control is asserted with `onForm().iCheckField(field, undefined, { editMode, required })` and proved by 5 mutations.
- Documentation: ADR-0025 (accepted), ADR-0021 amendment 4, ADR-0024 amendment; PATTERNS row "Field editable only when another field is filled", the pairing in "Dependent value help", the commit-time note in "Bulk create from a file", the corrected "Cross-field consistency check"; `templates/annotations-ui.cds` comment line; TESTING line; registry, STATE, CHANGELOG, LESSONS.
- Decisions D1-D8 (user, 2026-10-10): D1 = A the subcategory is cleared on a category change and disabled only while the category is empty; D2 = A disabled, no hint text; both fields mandatory; D7 = A import column; D8 per-row pre-check.
- Acceptance criteria: all 27 ticked in `PLAN.md` (service, import and contract criteria by tests, browser criteria by `VERIFICATION.md` in `en` and `ru`, zero blocking findings in `REVIEW.md`).

## Deviations from the plan
- SCREENS S2, S5 and V7 (optional Subcategory, one Save message on Category) are superseded by the mandatory requirement added at the plan gate; SCREENS was not reconciled in step 1b and is pruned with the folder.
- F1 (VERIFICATION, accepted known behaviour): Save with an empty Category lists `Provide the missing value.` for Category and also for the disabled Subcategory (both are `@mandatory` and empty; the entry has no red state and cannot be acted on until a category is chosen). With a category chosen and no subcategory the popover shows exactly one entry on the enabled, required, red field. A subcategory message raised earlier stays in the footer count until the next validation (standard Fiori Elements draft behaviour). `@mandatory` cannot be conditional, and a single Category message needs a handler (invariant 6, ADR-0025 point 3) or an `@assert` in place of `@mandatory`; a change is a follow-up through `/backlog` plus an ADR, not part of this feature.
- Import double message (accepted): a row with an unknown category and a valid subcategory gets two messages (`category` "Target with this key doesn't exist." and `subcategory` "The subcategory does not belong to the category of the product."), as ADR-0021 amendment 4 E is written; pinned by the invalid fixture and its test.
- The PLAN risk that emptying the mandatory Category might not reach the server did not occur: one `$batch` carries the category `PATCH` and the `#CategoryChanged` read, so the UI gate stayed at 52.
- Review Minor items fixed in `f6ce433`: two tests for the skip branches of `subcategoryMismatches` (unknown subcategory code, empty category) and the `FieldControl` comment in `test/metadata.test.js` (0 is `Inapplicable`, not `ReadOnly`).
- The Tab-skip of the disabled field is evidenced through scenario V4 only (focus went to Rating after typing a category and Tab); the MCP cannot click a disabled element, so V2 was checked by keyboard only.

## New items for the registry
Function `subcategoryMismatches` (`srv/catalog-service.js`, module-level, next to `duplicateNames`); import column `subcategory` in `IMPORT_COLUMNS` and `MANDATORY_COLUMNS`; the dynamic `Common.FieldControl` on `CatalogService.Products/subcategory_code`; no new entity, action, fragment or i18n key.

## Cost
Sessions 1 (2026-10-10 .. 2026-10-10), lead 17h 31m, active 1h 56m, waiting 15h 35m, agent-minutes 3h 29m (parallelism 1.8); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.295; spec: not attributed

Cost $36.35 (no cost-state record); tokens in 1.3K / cache write 3.1M / cache read 88.7M / out 191K; cache hit 97%; context avg 149K, peak 347K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 1m | 0m | 6 | $0.17 | $0.00 |
| 1 | 1 | 44m | 15h 12m | 122 | $12.48 | $0.00 |
| 2 | 1 | 26m | 23m | 111 | $7.55 | $0.00 |
| 3 | 1 | 18m | 0m | 85 | $3.79 | $0.88 |
| 4 | 1 | 14m | 0m | 191 | $7.62 | $0.00 |
| 5 | 1 | 11m | 0m | 78 | $4.14 | $2.39 |
| 6 | 1 | 2m | 0m | 22 | $0.62 | $0.55 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 1h 24m | 70 / - | $4.56 | 0 |
| architect | 1 | 4 | 42m | 97 / 60 | $11.56 | 0 |
| ux-designer | 1 | 0 | 6m | 13 / 30 | $1.64 | 0 |
| cap-backend-dev | 1 | 1 | 14m | 55 / 60 | $2.63 | 0 |
| test-backend | 1 | 2 | 20m | 52 / 60 | $3.11 | 0 |
| fiori-app-dev | 1 | 0 | 3m | 22 / 60 | $0.88 | 1 ($0.88) |
| test-ui | 1 | 0 | 14m | 48 / 80 | $2.13 | 0 |
| ui-verifier | 1 | 2 | 14m | 179 / 80 | $6.91 | 0 |
| reviewer | 1 | 1 | 10m | 58 / 50 | $2.39 | 1 ($2.39) |
| docs-keeper | 1 | 0 | 2m | 21 / 80 | $0.55 | 1 ($0.55) |

Gates: 0 blocks; review 0 blocking / 6 findings; criteria 27/27; MCP 258 queries, 0 unjustified, 9 failed; rule-covered edits with a query 11/11; prompts 0, hand-backs 15, notifications 18; lines +1140 / -116

## Lessons
Entries in `docs/LESSONS.md` (pending): an `@assert` constraint is checked at commit, not per row (the PATTERNS note is written, the `architect` prompt line is not); making a field `@mandatory` breaks the import until the workbook has the column; reconcile SCREENS in step 1b after a plan-gate change; the chrome-devtools MCP roots do not cover worktrees; a missing `@mandatory` value hides another field's `@assert.target`.

## Open debt
- `.claude/rules/ui-annotations.md` needs one word for `Common.FieldControl` (ADR-0025), in the STATE `Open debt` row of the protected rule files (user, `PIPELINE_ALLOW_PROTECTED=1`).
- Closed from #8: the per-row mismatch in the import (`subcategoryMismatches`); the `validationErrors` mapping is not needed.
- Follow-up candidates, not created as issues (through `/backlog` by the user): a single Category message when both fields are empty (F1); skipping the second import message for an unknown category (needs an ADR-0021 amendment wording and a second `SELECT`).
