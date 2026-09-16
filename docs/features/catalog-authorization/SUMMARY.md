# catalog-authorization: summary

Completion date: 2026-09-16. Commits: `3fdd195` (plan, context, ADR-0013) ... `94b5883` (review) on branch `feature/catalog-authorization`, not yet merged into `main`.

## What was done

- **Model/service** (`srv/catalog-service.cds`): `@requires: 'authenticated-user'` on `CatalogService`; `@restrict: [{ grant: 'READ', to: 'CatalogViewer' }, { grant: '*', to: 'CatalogEditor' }]` on the `Products` projection, next to `@odata.draft.enabled`. `Categories` stays `@readonly` without a `@restrict`, so code lists and `$metadata` remain readable by any authenticated user. A new read-only singleton `Permissions` (`@odata.singleton @cds.persistence.skip @readonly`, `key ID : String`, `isEditor : Boolean`) is the UI's permission signal.
- **Handler** (`srv/catalog-service.js`, new, the project's first handler): exactly one registration, `this.on('READ', 'Permissions', req => req.reply({ ID: 'me', isEditor: req.user.is('CatalogEditor') }))`. Enforcement stays fully declarative in `@restrict`; the handler produces a display signal only.
- **Mock users** (`package.json`): `alice` and `bob` gain `roles: ['CatalogEditor']`, a new user `viewer` gets `roles: ['CatalogViewer']`; defaults and `"*": true` unchanged.
- **UI** (`app/products/annotations/Products.cds`): `UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden`, each `{ $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } }`, hiding Create (List Report toolbar), Delete (List Report on selection and Object Page header) and Edit (Object Page header) from a `CatalogViewer`. New `app/products/ui5-test-runner.json` (`browserArgs: ["--basic-auth-username", "alice"]`) authenticates the headless OPA5 browser; new `app/products/webapp/localService/mockdata/Permissions.json` (array form) keeps mock mode showing the full action set.
- **Contract**: +50 EDMX lines, 0 removed against `main` (the `Permissions` singleton and `EntityType`, `Capabilities.Delete/UpdateRestrictions`, the three `Hidden` terms emitted twice each). `app/products/webapp/localService/metadata.xml` and `test/__snapshots__/metadata.test.js.snap` regenerated in the phase of each model change.
- **Tests**: `test/metadata.test.js` gains `test.defaults.auth = { username: 'alice' }` and two new contract `it`s (singleton, three `Hidden` terms); `test/catalog-service.test.js` gains `describe('CatalogService authorization')` with 7 `it`s (anonymous 401, viewer reads, viewer denied create/edit/delete/draftEdit, `carol` denied on `Products`, `Permissions` per role, `PATCH /Permissions` 405). Backend suite: **38 passed, 0 skipped**. New OPA5 journey `RoleAwareActionsJourney` (editor still sees Create/Delete/Edit, guards plan risk R6). UI suite: **25 opaTests, 0 skipped**.
- **Documentation**: ADR-0013 accepted and its consequences ticked; `PATTERNS.md` ("Authorization" extended, new row "Role-aware UI visibility"); `CONVENTIONS.md` section 2 (`restrict` moved out of the `srv/annotations/` list, permission-singleton layering sentence); `TESTING.md` rule 5 reworded; `ARCHITECTURE.md` (Basic-auth sentence, new "Roles" table, `Permissions` paragraph); `README.md` (Basic-auth sentence); `templates/service.test.js` (anonymous + denied-role tests); registry regenerated (`SERVICES.md`, `HANDLERS.md`).

## Deviations from the plan

- The plan's target of "37 backend tests" was stale arithmetic: the plan's own step-7 note prescribed two `it`s in `test/metadata.test.js` (the singleton test and the `UI.*Hidden` test), which makes 26 + 6 + 6 = **38**, not 37. Corrected in `PLAN.md` (`REVIEW.md` finding 3).
- Acceptance criterion "browser console free of errors mentioning ... `Permissions`, `Products` or `draft`" is **not met**, recorded honestly rather than ticked. A reproducible UI5 1.152.0 framework defect (`_Helper.aggregateExpandSelect` throws instead of guarding when the `UI.*Hidden` `$edmJson` `$Path` is evaluated as an OData V4 data-binding path) fires once per page load on :4004, identically for both roles, in both locales; `reviewer` traced the root cause in the UI5 sources and judged it non-blocking because the hide/show decision itself was correct in every one of five independent measurements. The same run also trips the criterion on a pre-existing, unrelated FE i18n assert naming `Products`. See `REVIEW.md` "Verdict on the `Permissions` console error" and `PLAN.md` line 77.
- The mock fixture for `Permissions.json` was committed in the wrong shape first (object form) on the strength of a plain `curl GET`, a request path FE never issues; `ui-verifier` found the defect (`$batch`/`$select` path returns 500), and the array form was committed as a fix in the same phase (`d3a4db0`).

## New items for the registry

- Entity: `Permissions` (singleton, `srv/catalog-service.cds`).
- Handler: `srv/catalog-service.js`, `on READ Permissions` - the project's first handler file.
- UI annotations: `UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden` on `CatalogService.Products` (`app/products/annotations/Products.cds`).

The registry is regenerated (`npm run docs:registry`); this is for the record.

## Lessons

Folded into `docs/LESSONS.md` (see there for the full text): the two pending entries from `test-backend` (EDMX pretty-printing needs whitespace-normalised contract assertions, now also in `TESTING.md` "cds 10 specifics"; `@requires` on a service also protects `$metadata`, now in `TESTING.md` rule 5 and `templates/service.test.js`), plus two new entries from this feature: verify a mock fixture on the path the application actually uses (`$batch`/`$select`, not a bare `curl GET`), and a silent-hiding mechanism can fail asymmetrically across pages (List Report kept Create/Delete while the Object Page lost Edit from the same unresolved expression).

## Open debt

- The UI5 1.152.0 console defect above: try the documented fallback short path `/Permissions/isEditor`, regenerate the contract, re-verify in a browser. Tracked in `docs/STATE.md`.
- The OPA5 suite authenticates as one user (`alice`) per run, so the hidden state for a `CatalogViewer` has no automated regression guard beyond the backend tests and `ui-verifier`'s blocking criterion. A second runner config (`ui5-test-runner-viewer.json`, `test:ui:viewer` script) is deferred until the hidden state actually regresses (user decision 2026-09-10).
- Deployment: `cds add xsuaa --for production` will generate the `CatalogViewer`/`CatalogEditor` role templates and scopes from these CDS role names; not started, separate ADR (`docs/STATE.md`).
- Feature branch not yet merged into `main`.
