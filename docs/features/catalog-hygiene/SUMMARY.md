# catalog-hygiene: summary

Completion date: 2026-10-09. Commits: `d1824ff` ... `c47e8ed` (phase 6 documentation commit follows). Issue #20.

## What was done
- Model: `Products.price` is `Decimal(15, 2)` (`db/schema.cds`); the `@assert.range: [0, 99999999.99]` stays as a business bound. ADR-0003 carries a dated amendment (exception withdrawn, no data migration in development), its `Status:` sentence untouched.
- Service: `@assert.target` on `Products.currency` in `srv/annotations/Products.cds`. An unknown code is rejected on an active `POST` (`ASSERT_TARGET`), on `draftActivate` and per row of `importProducts` (`Row 2, column "currency": Target with this key doesn't exist.`). No handler, 0 EDMX lines. Contract `1 1` against `main`.
- UI: the four `$Path` values of `app/products/annotations/Products.cds` (`UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden`, `importProducts` `UI.Hidden`) read `/Permissions/isEditor`. Measured in one harness: the container-qualified path logs 1 UI5 `TypeError` (`_Helper.aggregateExpandSelect`) when the Object Page opens, the short path 0 for `alice` and `viewer`; the hidden state holds on both pages. Contract `7 7` against `bcffde0`, `8 8` against `main`, 697 lines.
- Tests: `test/catalog-service.test.js` 45 to 49 (currency on `POST`, draft and import; price above the range), `test/metadata.test.js` 9 to 10 (price precision), two path assertions updated, snapshot regenerated. Suite 144 tests in 11 files, `npm run test:ui` 42 passed, lint 0 errors, ui5lint clean.
- Documentation: registry, STATE (three open-debt rows removed, counts), PATTERNS (three rows), CONVENTIONS section 3, CLAUDE.md "Known debt", ADR-0013 amendment, ADR-0021 amendment 3, `catalog-authorization` SUMMARY, LESSONS, CHANGELOG.

## Deviations from the plan
- Step 8b (fallback to the container-qualified path) was not needed: the short path removed the `TypeError` and kept the hidden state.
- c47e8ed also rewrote the header comment of `RoleAwareActionsJourney.js` to the short path, which the plan listed as unchanged; comment only, named in the CHANGELOG `app` line.
- The step 10 check "`grep -rn "Decimal(10" docs CLAUDE.md` finds only CHANGELOG and this folder" has three named exceptions: `ADR-0003` lines 14 and 39 (amended in place) and `docs/features/products-excel-upload/SUMMARY.md` line 26 (a verbatim framework message).
- The architect's list of documents carrying old facts (`research/contract-delta.md` section 4) missed `ADR-0021` decision 6; the reviewer found it, and the ADR-0013 amendment now names all four consumers.
- Acceptance criterion 28 (needs the cost card) stays unticked until phase 7.

## New items for the registry
None: no entity, action, handler or fragment added; `DOMAIN-MODEL.md` shows `Decimal(15, 2)` and `@assert.target` on `currency`.

## Cost
Filled in phase 7: `node scripts/metrics.mjs record catalog-hygiene`, then the output of `node scripts/metrics.mjs feature catalog-hygiene` pasted here.

## Lessons
- Entered in `docs/LESSONS.md` (`Pending /retro`): the Stop hook blocking the orchestrator mid-phase while a background agent works; a cds 10 Decimal above the declared precision fails together with `@assert.range` as "Multiple errors occurred".
- The 2026-09-16 entry (UI5 `$select` TypeError) is closed by the short path and removed.
- Kept here only: a negative control on the previous commit (`git archive` to a scratch directory, another port, the same harness) turned "0 errors" into a measured 1 versus 0 for about 8 tool calls; the FE draft Price field sends no `PATCH` after fill and Tab, only after a real blur of the amount/unit pair; a PLAN check of the form "grep finds only X" must name the exceptions when an ADR is amended in place, and an architect's list of documents should be re-grepped; `mcp__fiori-mcp__search_docs` 1.12.2 has no page on absolute singleton paths in `$edmJson` (capire "Role-based Visibility" via `cds-mcp` is the source); the Bash guard blocks a heredoc that only writes doc text when it names a protected path (use Edit; already covered by the 2026-10-07 retro).

## Open debt
- Mock mode (`npm run start-mock`) was not checked for the short path; not part of any gate.
- The UI5 `TypeError` for the container-qualified form remains a UI5 defect; no local debt.
