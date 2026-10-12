# products-details-section: summary

Completion date: 2026-10-12. Commits (`git log --oneline main..HEAD`, oldest first): `54bb1a9` ... `c7e67a2` (revision 1: plan review `54bb1a9`, backend `59b51fc`, table UI `001f961`, verification round 1 `cc23ef0`; revision 2: plan `dac5304`, approval `9b4d496`, backend `cafaa26`, skeleton `632d783`, UI `19d7f2d`, verification round 2 `694ae14` ... `2088b7c`, review `f80e1b9`, review fixes `f2e46c5`, re-review `7d804b4`; documentation `031ae7e`, final screenshots `8cd98c7`; counter amendment: code `c2673cb`, review and screenshots `c7e67a2`). Issue #9.

## What was done
- Model (`db/schema.cds`): composition `Products.details` (`ProductDetails`) with a second level `ProductDetails.selections` (`ProductDetailSelections`); attributes as code-list-like entities `DetailAttributes` (value type, unit, `minValue`, `maxValue`, `scale`), `DetailListValues` (localized values of a LIST or MULTI_LIST attribute, one list per attribute), `DetailValueTypes` (`TEXT`, `INTEGER`, `DECIMAL`, `LIST`, `MULTI_LIST`) and the assignment entity `SubcategoryAttributes` (`@assert.unique.pair`, `position`); CSV seed data.
- Service: projections with the root's `@restrict` on every level (viewer read-only), `@readonly` attributes, assignments, list values and value types; typed rules as `@assert` constraints in `srv/annotations/ProductDetails.cds` (column filled only for its type, range, whole number, list value belongs to the attribute, no duplicate selection) plus the ADR-0026 guards (`NOT_ASSIGNED`, `DUPLICATE`, root `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS`). No handler checks values.
- Handler (`srv/catalog-service.js`): the existing `before('PATCH', Products.drafts)` registration reconciles the rows after `resetStaleSubcategory` (common rows kept with their values, the others deleted, one empty row per missing attribute, warning `PRODUCTS_DETAILS_VALUES_REMOVED` when filled values go), and one `after('EDIT', Products)` fills the missing rows of the new draft.
- UI: one generic custom section `Details` (`app/products/webapp/ext/fragment/DetailsForm.fragment.xml` + `DetailsForm.js`, added through Fiori MCP after "Pricing & Stock"): a `sap.ui.layout.form.Form` generated from the rows, `sap.m.Input` for TEXT, INTEGER and DECIMAL (UI5 `Decimal` type, locale-aware, bounds from the attribute), `sap.m.ComboBox` for LIST, `sap.m.MultiComboBox` for MULTI_LIST, display controls with the empty indicator and units, counter "Filled N of M" as an inverted `sap.m.ObjectStatus` badge (pure function `counterStatus(filled, total)` in `DetailsForm.js`: Success with `sap-icon://sys-enter-2` when every field is filled, Warning with `sap-icon://alert` otherwise, 0 of M included; the default UI5 state announcement is kept, SCREENS UX risk 12), `Common.SideEffects #SubcategoryChanged`; 8 `ProductsObjectPage.details.*` keys in `en` and `ru`.
- Tests: `npm test` 209 (`test/catalog-service.test.js` 109, `test/metadata.test.js` 14 with the `$metadata` snapshot); `npm run test:ui` 82 (58 `opaTest` including `ProductDetailsFormJourney`, 24 QUnit of them 22 in `test/unit/DetailsForm.qunit.js`).
- Screenshots (`screenshots/`): final-1 display Laptop (en), final-2 display Mouse (ru), final-3 edit Office Chair (en), final-4 and final-4b edit errors (en), final-5 subcategory warning (en), final-6 viewer (en), final-7 display Backpack (en, `final-7-display-backpack-en.png`, the 0 of M Warning badge).
- Documentation: ADR-0027 (accepted, with the amendments "browser proof of the fragment" and "Rows binding"), ADR-0026 amendment (decisions 3, 4, 6, 7 replaced); PATTERNS rows "Typed attribute values", "Rows generated from an assignment on a draft", and the extended "Parent-child relationship (document)", "Custom section or column", "Cross-field consistency check", "Authorization", "New entity"; TESTING facts; ARCHITECTURE "Current model"; registry, STATE, CHANGELOG, LESSONS.
- User decisions: after phase 4 round 1 the user rejected the table UI (D-1) and chose the generated typed form, ComboBox lists, and MULTI_LIST for Connectivity and Material (`CONTEXT.md` U1-U7); plan revision 2 was approved on 2026-10-12 with D10-D23 at their defaults.
- Acceptance criteria: 40 in `PLAN.md`, 40 ticked. The browser criterion as `alice` is evidenced for every value type: TEXT (Monitor Stand "Dimensions", "30 x 20 x 10" plus Tab gave one PATCH and one DraftMessages GET, Save showed "30 x 20 x 10 cm") was driven in `en` in the round 2 re-check; `ru` TEXT was not driven separately (locale-neutral), `ru` covered display, the decimal comma and the Colour list.
- User decision 2026-10-12 after the final screenshots (D20 amended; options page v2, variant A): the counter is an inverted `sap.m.ObjectStatus` badge, Success + check when complete, Warning (orange) + alert otherwise, with an icon in the incomplete state too at the user's request. Review of the amendment: no finding.

## Deviations from the plan
- The custom JavaScript grew beyond "the selection sync" the user was told about: the LIST write and its validation message (B6: `selectedKey` `OneWay`, write in `change`, a `validation: true` message for a non-item text), the row sync (`syncFormElements`, `clearFormElements`), the own-request `selections` binding (B7), and the Edit re-read (B2, `refreshRowsOfNewDraft`). The browser proof refuted the plan's first mechanisms (ADR-0027 amendments).
- The `sap.m.ComboBox` stayed as the user required; the plan's `sap.m.Select` fallback was not used.
- The rows are bound in the FormContainer's non-rendered `dependents` with `$$ownRequest: true` (one own `GET` per page load and Edit) instead of `formElements` bound with a factory: V4 `refreshDependentListBindingsWithoutCache` rebuilt the rows on every side effect (R2-D2 focus, R2-D5 validation message, R2-D6 tokens). The list items are built once from the expanded data.
- `labelFor` is set to the edit control in edit mode only, against the SCREENS line "do not set `labelFor` by hand" (the display `Text` comes first); the rule is in PATTERNS "Custom section or column".
- Revision 1's table UI, its attribute value help and its Save-time rejection on a subcategory change (ADR-0026 decisions 3, 4, 6, 7) were built, verified and replaced.
- The `/Productsundefined/...` message target duplicate (CAP 10.1.1 `draftPrepare?$select=DraftMessages` without the key) was observed once with the step 7 skeleton and not reproduced in round 2; recorded in CHANGELOG as an observation, details in `research/ui-proof.md`. No debt row, nothing for `docs/upstream/UPDATES.md`.

## Verification and review
- Round 1: the table was clumsy (D-1) and was rejected by the user. Round 2: R2-D1 to R2-D6 found and fixed (R2-D4 was a stale browser module cache, not a defect); the final re-check and the review-fix check: ready for review, no open finding.
- Review (`REVIEW.md`): 0 blocking; Important 1 and 3 fixed in code (`f2e46c5`), Important 2, 4 and 5 closed in phase 6 (ADR-0027 amendment, `app/products/bin/` ignored, the `@assert.unique` sentence in PATTERNS), Minors 4 and 5 closed in docs, Minors 1 and 3 fixed; Minor 2 stays as debt.

## New items for the registry
Entities `DetailAttributes`, `DetailListValues`, `DetailValueTypes`, `SubcategoryAttributes`, `ProductDetails`, `ProductDetailSelections` and their service projections; handler functions `reconcileDetailRows` and `fillDetailRows` in `srv/catalog-service.js`; fragment `DetailsForm` with its exported pure functions; value-type, constraint and warning keys in `_i18n`; 8 `ProductsObjectPage.details.*` keys in `webapp/i18n`; QUnit module `DetailsForm.qunit.js`.

## Cost
Sessions 1 (2026-10-11 .. 2026-10-12), lead 10h 28m, active 8h 2m, waiting 2h 27m, agent-minutes 13h 58m (parallelism 1.7); idle cap 5 min, tool cap 10 min; phases: markers; rework: plan; pricing 2026-09-29; Claude Code 2.1.295; spec: not attributed

Cost $186.32 (no cost-state record); tokens in 5.7K / cache write 13.4M / cache read 527M / out 885K; cache hit 98%; context avg 209K, peak 519K

| Phase | Rounds | Active | Waiting | Calls | Cost | Rework cost |
|---|---|---|---|---|---|---|
| 0 | - | 1m | 0m | 4 | $0.58 | $0.00 |
| 1 | 2 | 43m | 8m | 175 | $15.72 | $0.00 |
| 2 | 2 | 1h 17m | 0m | 378 | $24.98 | $4.29 |
| 3 | 3 | 3h 7m | 0m | 934 | $62.12 | $12.87 |
| 4 | 2 | 2h 0m | 17m | 774 | $53.97 | $1.27 |
| 5 | 1 | 28m | 0m | 192 | $16.46 | $1.50 |
| 6 | 1 | 26m | 2h 2m | 129 | $12.38 | $0.00 |
| 7 | 1 | 0m | 0m | 1 | $0.10 | $0.00 |

| Agent | Launches | Resumes | Active | Calls / maxTurns | Cost | Rework |
|---|---|---|---|---|---|---|
| main | - | - | 5h 26m | 310 / - | $29.27 | 0 |
| architect | 7 | 4 | 56m | 210 / 60 | $11.96 | 4 ($5.84) |
| cap-backend-dev | 2 | 1 | 22m | 122 / 60 | $6.73 | 0 |
| test-backend | 3 | 2 | 45m | 158 / 60 | $13.30 | 0 |
| fiori-app-dev | 5 | 8 | 2h 2m | 354 / 60 | $35.27 | 1 ($1.96) |
| test-ui | 4 | 2 | 1h 36m | 316 / 80 | $21.83 | 1 ($1.50) |
| ui-verifier | 3 | 13 | 1h 42m | 877 / 80 | $50.79 | 1 ($7.72) |
| general-purpose | 1 | 0 | 3m | 17 / - | $0.64 | 0 |
| ux-designer | 4 | 3 | 39m | 88 / 30 | $9.11 | 2 ($2.75) |
| reviewer | 1 | 3 | 21m | 72 / 50 | $5.94 | 0 |
| docs-keeper | 2 | 1 | 8m | 63 / 80 | $1.48 | 1 ($0.16) |

Gates: 7 blocks (protected 5, docs 1, mcp 1); review 0 blocking / 10 findings; criteria 40/40; MCP 1194 queries, 0 unjustified, 34 failed; rule-covered edits with a query 48/49; prompts 11, hand-backs 49, notifications 68; lines +12138 / -2097

## Lessons
Eight entries in `docs/LESSONS.md` (2026-10-12): a UI rejected after phase 4, the fiori-mcp `search_docs` outage, V4 `refreshDependentListBindingsWithoutCache`, the mechanisms of a data-writing custom fragment decided at plan time, measuring every verb a criterion names, the stale browser module cache, `cds-mcp search_model` in a worktree, agent turn limits. Candidate for a rule: the plan gate shows the user a mockup and alternatives for any new screen shape.

## Open debt
- The Stop hook backstop flags a `manifest.json` change made through Fiori MCP although the audit log is ok (stop gate script, user).
- The db-model rule file lacks the `@assert.unique` exception (one line proposed, user).
- `refreshRowsOfNewDraft` is probably redundant since `$$ownRequest`; remove after a browser proof on an API-created product (fiori-app-dev).
- `eslint-disable` for `max-params` and `max-statements` on `DetailsForm.js`; move the pure functions into a sibling module (fiori-app-dev).
- Follow-ups, each its own issue: filtering products by a detail value, an Excel import column for details, a maintenance screen for attributes and lists, per-subcategory narrowing of a list.

## Full record

Pruned to this file (ADR-0019). CONTEXT.md, PLAN.md, REVIEW.md, SCREENS.md, VERIFICATION.md, research, screenshots of this feature stay in git history at https://github.com/daiedy/Test_CAP/tree/348a1b961a8a98b7993797d4ee1796b6d5337f31/docs/features/products-details-section (commit `348a1b9`).
