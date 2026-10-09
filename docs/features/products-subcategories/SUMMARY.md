# products-subcategories: summary

Completion date: 2026-10-09. Commits: `2bd5aee` ... `2245e97` (plan and ADR-0024, backend, UI, verification, review fixes; the documentation commit follows). Issue #8.

## What was done
- Model: `Subcategories : CodeList { key code : String(20); category : Association to Categories; }` and the optional `Products.subcategory : Association to Subcategories` (`db/schema.cds`); 15 subcategories (D1 list) with 15 `ru` names, every seeded product has one (D1 seed).
- Service: read-only `CatalogService.Subcategories`; on `Products.subcategory` `@assert.target` and the declarative constraint `@assert: (case when subcategory.code is not null and category.code is not null and subcategory.category.code != category.code then 'PRODUCTS_SUBCATEGORY_MISMATCH' end)` in `srv/annotations/Products.cds` (400 on active writes, draft message on a draft, 400 `in/subcategory_code` on `draftActivate`); `before('PATCH', Products.drafts)` `resetStaleSubcategory` in `srv/catalog-service.js` empties a subcategory that does not belong to the category a draft receives; texts in `en` and `ru`.
- UI: Subcategory column after Category (`UI.Importance: #Low`) and field in `UI.FieldGroup #GeneralInfo`; hand-written `Common.ValueList` with the `category_code` In parameter, dropdown kept (`ValueListWithFixedValues`); `Common.SideEffects #CategoryChanged` re-reads the field and its text; mock data for `Subcategories`; `metadata.xml` 874 lines.
- Tests: backend 145 to 163 (17 in `test/catalog-service.test.js`, 1 contract test in `test/metadata.test.js`); OPA5 42 to 49 (new `SubcategoryDependsOnCategoryJourney` with 6 `opaTest`, +1 in `RussianLocaleJourney`; `EditCategoryOnObjectPageJourney` and `RatingShownAsStarsJourney` adjusted); new page object `pages/ObjectPageForm.js` (`iSeeFormFieldEmpty`, `iSeeFormFieldLabel`).
- Documentation: ADR-0024 (accepted); PATTERNS rows "Dependent value help", "Cross-field consistency check", "Dependent field reset on a draft"; `templates/annotations-ui.cds` dependent block; TESTING lines (draft message timing, `iCheckField(field, '')` false pass, `iCheckRows` and pop-in); registry, STATE, CHANGELOG.
- Decisions D1-D9 (approved 2026-10-09): D1 15 subcategories with seed; D2 optional field; D3 list column, no filter field, header unchanged; D4 automatic reset on a category change; D5 draft unchanged; D6 ADR-0024 accepted; D7 the constraint guards an empty category; D8 the reset is silent; D9 Subcategory stays offered in "Adapt Filters".
- Verification (`VERIFICATION.md`, `en` and `ru`): narrowed dropdown, reset, `$batch` value help with `$filter=category_code eq '...'`, read-only field for `viewer`; defects none.

## Deviations from the plan
- The issue proposed a `before` handler for the pair check; the plan replaced it with the declarative `@assert` constraint (ADR-0024 decision 2). The only handler is the draft reset.
- Review Important 1: Subcategory without `UI.Importance` stayed visible while Stock Quantity and Price popped in (SCREENS had predicted Rating, then Subcategory); fixed with `UI.Importance: #Low` (+1 EDMX line, 874). Review Minor 1 and 2: Prettier on two OPA files, form assertions moved from `CategoryDropdown.js` to `ObjectPageForm.js`.
- `RatingShownAsStarsJourney` was not in the plan: the sixth column hides Rating behind Show Details in the OPA frame, so the journey presses Show Details first.
- `draftActivate` answers 201 for a POST-created draft (the plan text said 200) and 200 for a `draftEdit` draft; the constraint's draft message is absent from the PATCH response and shows on the next `GET`.
- `cds add data` (cds-dk 10.1.0) silently edited `mta.yaml`; the change was reverted.
- Two rule files contradict ADR-0024 until a user-started `PIPELINE_ALLOW_PROTECTED=1` session edits them (STATE `Open debt`).

## New items for the registry
`Subcategories` (`my.catalog.Subcategories`, `CatalogService.Subcategories`, `Subcategories.texts`), `Products.subcategory`, handler `resetStaleSubcategory` (`before('PATCH', Products.drafts)`), message `PRODUCTS_SUBCATEGORY_MISMATCH`, `Common.SideEffects #CategoryChanged`, test page object `ObjectPageForm`, journey `SubcategoryDependsOnCategoryJourney`.

## Cost
Sessions 1 (2026-10-09 .. 2026-10-09), lead 2h 56m, active 2h 36m, waiting 20m, agent-minutes 4h 14m (parallelism 1.6); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.295; spec: not attributed

Cost $40.16 (no cost-state record); tokens in 1.6K / cache write 3.2M / cache read 102M / out 227K; cache hit 97%; context avg 134K, peak 293K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 0m | 0m | 2 | $0.07 | $0.00 |
| 1 | 1 | 39m | 20m | 127 | $9.95 | $0.00 |
| 2 | 1 | 21m | 0m | 88 | $4.24 | $0.00 |
| 3 | 1 | 54m | 0m | 211 | $12.28 | $0.00 |
| 4 | 1 | 10m | 0m | 163 | $5.16 | $0.00 |
| 5 | 1 | 29m | 0m | 170 | $7.73 | $2.36 |
| 6 | 1 | 2m | 0m | 24 | $0.73 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 1h 38m | 78 / - | $4.23 | 0 |
| architect | 1 | 2 | 24m | 80 / 60 | $6.36 | 0 |
| ux-designer | 1 | 0 | 8m | 26 / 30 | $2.65 | 0 |
| cap-backend-dev | 1 | 0 | 7m | 39 / 60 | $1.51 | 0 |
| test-backend | 2 | 0 | 19m | 70 / 60 | $3.35 | 0 |
| fiori-app-dev | 2 | 0 | 10m | 71 / 60 | $2.69 | 1 ($0.87) |
| test-ui | 2 | 1 | 57m | 152 / 80 | $9.96 | 1 ($1.49) |
| ui-verifier | 2 | 1 | 11m | 172 / 80 | $4.92 | 0 |
| reviewer | 1 | 2 | 19m | 75 / 50 | $3.92 | 0 |
| docs-keeper | 1 | 0 | 2m | 22 / 80 | $0.55 | 0 |

Gates: 1 blocks (protected 1); review 0 blocking / 6 findings; criteria 29/29; MCP 280 queries, 0 unjustified, 3 failed; rule-covered edits with a query 25/25; prompts 1, hand-backs 14, notifications 19; lines +2444 / -259

## Lessons
Three entries in `docs/LESSONS.md` (pending): measure a pop-in claim before the plan gate; the worktree Bash guard and compound commands; `cds add data` edits `mta.yaml`. The null-guard rule for a cross-field `@assert` and the unqualified hand-written ValueList are now in PATTERNS (ADR-0024 rows), not in LESSONS.

## Open debt
- `.claude/rules/ui-annotations.md:19` and `.claude/rules/srv-services.md:24` need one sentence each for ADR-0024 (STATE `Open debt`, user, `PIPELINE_ALLOW_PROTECTED=1`).
- A future Excel import column `subcategory` would turn `PRODUCTS_SUBCATEGORY_MISMATCH` into a whole-file 400: `validationErrors` maps only `ASSERT_*` codes.
- A mismatch message written on a draft stays until the same field is PATCHed again (reachable only through the API; activation still succeeds once the pair is fixed).
- Follow-up candidates, not created as issues (they go through `/backlog` by the user): a dependent Subcategory filter field on the List Report (D3); Subcategory offered unnarrowed in "Adapt Filters" (D9, V9).
- The table pop-in order inside one `UI.Importance` group is right to left (`sap.m.Table` source, not in the MCP docs); recorded in VERIFICATION V8.
