# products-draft-edit: summary

Completion date: 2026-09-07. Commits: `6a95811` (plan approved, ADR-0012 accepted) ... `6367418` (screens for draft editing, `ux-designer`) ... `535c21b` (backend: `@odata.draft.enabled`, contract snapshot, 22 tests) ... `efb05bf` (next feature's specification and ADR-0013 proposal, committed on this branch, not part of this feature) ... `7c8ab1d` (UI: journey un-skipped, mock mode, metadata.xml) ... plus the documentation commit that follows this report. Review: zero blocking findings.

## What was done

- Model: unchanged. `db/schema.cds` (`my.catalog.Products`) is untouched, per ADR-0012 part 2 (drafts are service semantics, not persistence).
- Service: `srv/catalog-service.cds` gets `@odata.draft.enabled` on the `Products` projection (ADR-0012). The OData contract grows with the key part `IsActiveEntity`, properties `HasActiveEntity`, `HasDraftEntity`, `DraftMessages`, the contained navigation `DraftAdministrativeData` (no entity set) and `SiblingEntity`, bound actions `draftEdit`/`draftActivate`/`draftPrepare`, and `Common.DraftRoot` on `EntityContainer/Products`; `Categories` (`@readonly`) and the generated value list on `category_code` are unchanged. No handlers were added; validation stays declarative in `srv/annotations/Products.cds` and is enforced on `draftActivate`. No `cds.fiori` configuration was changed (cds 10 defaults: lean draft, bypass draft, lock 15 min, deletion 30 d).
- UI: `app/products/webapp/localService/metadata.xml` regenerated to match the new contract. `app/products/annotations/Products.cds` and `manifest.json` are unchanged (recommended option: standard FE draft UI, `editableHeaderContent: false` kept, no `hideDraft`, no `inlineEdit`). `mockdata/Products.json` unchanged; the mockserver (`sap-fe-mockserver` / `@sap-ux/fe-mockserver-core` 1.7.15) emulates `draftEdit`/`draftActivate` on its own.
- Tests: `test/catalog-service.test.js` adapted for the draft-enabled entity (helpers `active()`, `activeKey()`, `draftKey()`; every request to an active record is explicit about `IsActiveEntity`), plus a new `describe('CatalogService.Products drafts')` block with six tests (draft creation on a bare `POST`, edit through `draftEdit`/`PATCH`/`draftActivate`, `@assert.target` and `@mandatory` enforcement on activation, the lock between `alice` and `bob`, discard). 22 backend tests green. The contract snapshot `test/__snapshots__/metadata.test.js.snap` was updated once (`npx vitest -u`). `app/products/webapp/test/integration/EditCategoryOnObjectPageJourney.js` runs again (`opaTest`, not `.skip`); a new "Cancel discards the change" test was added. `npm run test:ui`: 17/17 passed, 0 skipped (before: 11 passed, 5 skipped).
- Documentation: ADR-0012 accepted with its consequences ticked; `docs/architecture/PATTERNS.md` (rows "Drafts", "Service test", "OData contract", "User scenario"), `docs/architecture/TESTING.md` ("cds 10 specifics"), `templates/service.test.js` updated; `docs/STATE.md` and `docs/CHANGELOG.md` updated; `docs/LESSONS.md` inbox entries added; registry regenerated.

## Decisions (ADR-0012)

1. Full draft on `CatalogService.Products` (Edit, Save, Cancel with discard confirmation, Create and Delete on the List Report, Editing Status filter); inline edit deferred as a follow-up.
2. The annotation lives inline on the projection in `srv/catalog-service.cds`, in the same style as `@readonly entity Categories`.
3. Non-Fiori clients and tests address active data explicitly: `POST { IsActiveEntity: true, ... }`, `(ID=<id>,IsActiveEntity=true)` keys; drafts use `IsActiveEntity=false` and the bound actions.
4. Runtime configuration stays at the cds 10.0.6 defaults; no `cds.fiori.*` entry in `package.json`.
5. No handlers; `@mandatory`/`@assert.*` are enforced by the framework on `draftActivate` and on direct active writes.
6. Standard draft UI kept (`hideDraft` not enabled, `editableHeaderContent` stays `false`); no `manifest.json` change.

## What was verified

- Backend (`test-backend`, `npm test`): 22/22 tests green, including the six new draft tests and the updated `$metadata` snapshot.
- UI tests (`test-ui`, `npm run test:ui` in `app/products`): 17/17 passed, 0 skipped, run twice in a row against a fresh `npm run watch`; `ui5lint` and `lint:js` clean.
- Browser/HTTP verification (`ui-verifier`, `VERIFICATION.md`, 12 screenshots): 10 scenarios plus a lock-by-`bob` check via curl, verdict "ready for review". Confirmed: Edit/Save/Cancel with discard confirmation, Create flow (client-side blocked with empty required fields, successful create and delete), the draft lock between two users (Object Page header "Locked" button and popover; List Report "Locked by Another User" filter), the `ru` locale (Edit/Save/Cancel, Editing Status and its six options, `Draft_*` administrative-data labels all translated), keyboard and accessibility (Edit reachable by Enter, Category announced as a required combobox, Esc discards, focus returns to Edit after Save and Cancel), and a clean browser console.
- Review (`reviewer`): zero blocking findings across all 12 checks (annotation location, no handler file, no hand-written `Common.Draft*`/`IsActiveEntity`, no manifest diff, `mockdata` unchanged, tests explicit about `IsActiveEntity`, snapshot diff limited to draft artifacts, journey un-skipped, English-only docs, CHANGELOG lines present); one Major and three Minor documentation-wording findings, all resolved in this step (11).

## What is left

- **List Report draft/lock marker.** `Products` has no `Common.SemanticKey`, so no draft or lock indicator text renders in the List Report row (verified 2026-09-07, `VERIFICATION.md` scenarios 4 and 6); the Editing Status filter and the Object Page lock popover work regardless. Recorded in `docs/STATE.md` "Open debt" as a follow-up decision for the user (`@Common.SemanticKey: [name]`).
- **Mock-mode browser check not run.** The `ui-verifier` session skipped the mock-mode extra scenario for turn budget; the HTTP-level mock verification by `fiori-app-dev` (PLAN.md step 6) stands as the only mock-mode evidence for this feature.
- **`ru` validation text not observed live.** The field-level `ASSERT_RANGE`/`ASSERT_MANDATORY` message text in `ru` was not independently re-confirmed on screen (time budget); nothing seen contradicts the expectation that `@sap/cds/_i18n` supplies it.
- **Cleared-name Save on the edit path.** Clearing the Product Name field and saving on the *edit* path was inconclusive in two attempts (likely a browser-automation quirk: the `change` event may not have fired before the button click); the same required-field check was proven correct via the Create-flow path (6 blocked fields, including an empty name). Not escalated as a defect; a repeat check with different automation is recommended if full confidence on the edit path specifically is wanted.

## Links

- `docs/features/products-draft-edit/CONTEXT.md`
- `docs/features/products-draft-edit/PLAN.md`
- `docs/features/products-draft-edit/VERIFICATION.md`
- `docs/decisions/ADR-0012-products-draft-editing.md`
