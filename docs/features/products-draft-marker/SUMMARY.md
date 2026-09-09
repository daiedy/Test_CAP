# products-draft-marker: summary

Completion date: 2026-09-09. Commits: `1da73ab` (CONTEXT, PLAN approved by the user, ADR-0015 accepted) ... `1287c3c` (annotation, contract snapshot, contract test, OPA5 journey, 23 backend tests, 23 OPA5 cases) ... plus the documentation commit that follows this report. Review: three independent lens runs, zero confirmed blocking findings.

## What was done

- Model: unchanged. `db/schema.cds` and `srv/**` are untouched (ADR-0015 decision 1: the marker is produced entirely on the presentation layer).
- Service/contract: `app/products/annotations/Products.cds` gains `Common.SemanticKey: [ name ]` as the first entry of the existing `annotate CatalogService.Products with @( ... )` block, with a comment naming ADR-0015. `name` was already the first `UI.LineItem` `DataField` and `UI.HeaderInfo.Title`, so no other annotation changed. The OData contract gains exactly one `<Annotation Term="Common.SemanticKey"><Collection><PropertyPath>name</PropertyPath></Collection></Annotation>` on `CatalogService.Products`, plus a positional move of the pre-existing `Common.SideEffects#alwaysFetchMessages` and `Common.Messages` annotations within the same block; `app/products/webapp/localService/metadata.xml` and `test/__snapshots__/metadata.test.js.snap` were regenerated in the same phase. `manifest.json` is byte-unchanged (no `tableSettings.type`, no `controlConfiguration`): the responsive table is already the FE default and already puts the marker in the key column.
- UI effect: the List Report `Product Name` cell renders as `sap.m.ObjectIdentifier` (bold, single line, no second line — `name` carries no associated text) with a `sap.m.ObjectMarker` after the name for own-draft, locked-by-another-user and unsaved-changes-by-another-user rows. No custom column, fragment, formatter, controller extension or i18n key was added; every marker text (`OM_DRAFT`, `OM_LOCKED_BY`, `OM_LOCKED_BY_ANOTHER_USER`) ships translated in `sap.m` for `en` and `ru`.
- Tests: one new backend test `test/metadata.test.js` → `it('exposes the semantic key of Products in the contract')`, bringing the backend suite to **23** tests (19 service + 4 contract). One new OPA5 journey `app/products/webapp/test/integration/DraftMarkerInListReportJourney.js`, registered last in `opaTests.qunit.js`, bringing the UI suite to **23** `opaTest` cases, 0 skipped. All four pre-existing journeys and their page objects are unchanged on disk, confirming the prediction that `sap.fe.test`'s `MacroFieldBuilder` keeps matching the `name` cell (now an `ObjectIdentifier`) on its `title` property.
- Documentation: ADR-0015 accepted, consequences ticked; `docs/architecture/PATTERNS.md` (new "UI Fiori Elements" row, the "Drafts" and "Tests" rows amended); `docs/STATE.md` and `docs/CHANGELOG.md` updated; `docs/LESSONS.md` inbox gains 6 entries; `docs/features/products-draft-edit/CONTEXT.md` design-decision #6 corrected (the marker now exists); registry regenerated.

## Decisions (ADR-0015)

1. One annotation, `Common.SemanticKey: [ name ]`, on the presentation layer only (`app/products/annotations/Products.cds`) — no custom column, fragment, controller extension or manifest change.
2. `name` is the semantic key: it is `UI.HeaderInfo.Title`, the first `UI.LineItem` `DataField`, `@mandatory` and human-readable.
3. `name` deliberately stays non-unique: no `@assert.unique`, no `db/` change. FE never dereferences a semantic key for identity, navigation, delete or the draft protocol (those run on `ID` + `IsActiveEntity`); a uniqueness constraint would be a separate domain-rule feature.
4. The row marker is asserted in OPA5 with `iCheckRows(values, N, { isDraft: true })`; the locked-by-another-user case stays a `ui-verifier` scenario with `curl -u bob:` (one OPA5 session cannot create a second user's draft).
5. The contract snapshot and `metadata.xml` are regenerated in the same phase as the annotation.

## What was verified

- Backend (`fiori-app-dev`/`test-backend`, `npm test`): 23/23 tests green, `cds lint` clean, `metadata.xml` byte-identical to a fresh `cds compile '*' --to edmx-v4 -s CatalogService -l en`.
- UI tests (`test-ui`, `npm run test:ui` in `app/products`): 23/23 passed, 0 skipped, run against a fresh `npm run watch`; `ui5lint` "No findings detected"; `npm run lint:js` 0 errors; after the run 0 drafts remain and `Laptop Pro 15` is back to `category_code: "ELECTRONICS"`.
- Browser verification (`ui-verifier`, `VERIFICATION.md`, 7 screenshots): all 7 mandatory scenarios passed (the optional nameless-draft scenario 8 was skipped to conserve turns, by design), verdict "ready for review". Confirmed: no marker on unchanged rows and exactly 4 table columns (scenario 1); the own-draft `Draft` marker, text-only, in the `Product Name` cell, with the Editing Status `Own Draft` filter narrowing to 1 row (scenario 2); the `LockedBy` marker for `bob`'s draft, with popover content, keyboard round-trip and a measured target-size box of 110.97×25 CSS px (scenario 3); both marker states translated in `ru` with no `[key]` placeholder (scenario 4); no regression to navigation, category display, filtering or the Object Page, including the "Product Name" form field staying plain and labelled (scenario 5); no new console error/warning and an unchanged `$batch` `$select` list (scenario 6); data hygiene proven, server stopped (scenario 7).
- Review (`reviewer`, three independent lens runs: plan conformance/patterns/layers, documentation truth/language, refutation of one finding): zero confirmed blocking findings.

## Deviations from the plan

- **OPA5 journey case list.** The plan enumerated 6 cases; the delivered journey has 6 cases but not the same 6: the plan's separate "the own draft row opens in edit mode and can be discarded" and "the marker disappears with the draft" cases were merged into one ("Discarding the draft removes the marker"), and one case not in the plan was added ("The Editing Status filter Own Draft narrows the list to that row", using `sap/fe/test/api/EditState`). Every assertion the plan originally listed is still present; the merge and the addition only add coverage. In scope per the orchestrator's phase-6 decision, since `CONTEXT.md` already listed the Editing Status filter as a verifier scenario. `PLAN.md` criterion lines amended to the 6 cases as delivered; test code itself was not changed in this documentation phase.
- **Breadcrumb navigation fallback used inside the journey itself, not just as a documented risk.** `onHeader().iNavigateByBreadcrumb('Products')` passes without navigating when the Breadcrumbs macro carries no links (measured: the region existed but had no link content while the object page was in edit mode). The journey uses the plan's documented fallback (`Given.iTearDownMyApp()` + `Given.iStartMyApp('products-display')`) between the edit case and the next one, rather than the breadcrumb call.
- **Two framework predictions in `CONTEXT.md`/`PLAN.md`/ADR-0015 were measured wrong in the browser and corrected at the source (not carried forward as fact):** (1) the `Draft` marker IS a real, interactive tab stop with a working press handler and a "Last changed on …" popover — the "no tab stop" claim described the neighbouring `ObjectIdentifier` title, not the marker; (2) inside this FE V4 responsive table cell the lock marker did NOT fall back to icon-only below a 600 px window width (measured at 500 px, live resize and full reload) — the responsive table pops the other columns first, so the standalone-control API doc's breakpoint does not describe this placement. Two further criteria also measured differently: (3) the marker's accessible name is not strictly equal to its own text (FE's own `aria-labelledby` also references the doubled column-header label); (4) the measured target-size box (110.97×25 CSS px) passed the WCAG 2.5.8 24×24 px minimum, so the "accepted gap" framing in the original ADR text was too strong — the gap is conditional on label length, not a certainty. None of the four is a defect and none is reachable from the annotation; all four are corrected in `CONTEXT.md`, `PLAN.md` and ADR-0015 "Consequences".

## New items for the registry

None visible: `scripts/gen-registry.mjs` does not render entity-level `@Common.*` annotations (deliberately out of scope, "Decisions for the user" item 5 of `PLAN.md`), so the only registry change is the `sources:`/date header line of the five files touched by `npm run docs:registry`.

## Lessons

Added to `docs/LESSONS.md` "Pending": the OData V2-only `UI.HeaderInfo` fallback for editing status; `sap.fe.test` matching `ObjectIdentifier` on `title`; the `iCheckRows(..., { isDraft: true })` idiom and translated `sap.m` marker texts; `iNavigateByBreadcrumb` passing without navigating when the Breadcrumbs macro has no links; Bash-written files bypassing PreToolUse/PostToolUse/SubagentStop hooks (needs a rule or hook change, user's call); one unreproduced OPA page hang in `RussianLocaleJourney`. A stale pointer in the "Transferred on 2026-09-07" table (to the now-closed STATE open-debt row) was also fixed.

## Open debt

None added by this feature. The STATE.md "Open debt" row this feature closed (missing List Report draft/lock marker) is removed; its resolution is recorded in "What works".

## Links

- `docs/features/products-draft-marker/CONTEXT.md`
- `docs/features/products-draft-marker/PLAN.md`
- `docs/features/products-draft-marker/VERIFICATION.md`
- `docs/decisions/ADR-0015-list-report-draft-marker.md`
