# catalog-authorization: plan

Date: 2026-09-07, rewritten 2026-09-10 after the user's decisions. Status: approved by the user 2026-09-10 (`docs-keeper` sets it to `done` at the end). Gate mode: autonomous.

Context and research: `CONTEXT.md` in this folder (including the two "Verified by experiment" sections); decision: `docs/decisions/ADR-0013-catalog-authorization.md`. Branch `feature/catalog-authorization`. Prerequisite state re-checked on `main` at `fecb925`: 29 backend tests in three files (`test/catalog-service.test.js` 19, `test/metadata.test.js` 4, `test/hooks-protect-bash.test.js` 6 — the last one drives `scripts/hooks/protect-files-bash.mjs` through `spawnSync`, uses no `cds.test` and no HTTP), 23 `opaTest`s in five journeys, `srv/` without any `.js` file, `package.json` with `"cds": { "requires": {} }`, `srv/catalog-service.cds` exactly as quoted in "Details for the developers". Phases and commits follow the `feature` skill; agents report per protocol section 8.

## Decisions taken by the user (2026-09-10)

The nine questions of the 2026-09-07 draft were answered as follows. This section replaces the former "Decisions for the user".

| # | Question | Decision | Deviation from the architect's recommendation |
|---|---|---|---|
| 1 | Role model | A: a read-only role plus a full-CRUD role on `Products` | as recommended |
| 2 | Role names | **`CatalogViewer` / `CatalogEditor`** | **deviates**: the recommendation was the bare `Viewer`/`Editor`. Prefixed names are used everywhere: `@restrict`, mock users, tests, XSUAA notes, docs |
| 3 | Code lists and `$metadata` | readable by any authenticated user | as recommended |
| 4 | Development users | `alice`, `bob` = `CatalogEditor`; new `viewer` = `CatalogViewer`; no passwords; defaults and `"*": true` kept | as recommended |
| 5 | Placement of the authorization annotations | inline in `srv/catalog-service.cds`; `CONVENTIONS.md` section 2 wording corrected by `docs-keeper` | as recommended |
| 6 | Fiori UI for viewers | **hide all four standard actions for `CatalogViewer`** (Create in the List Report toolbar, Delete in the List Report on selection, Edit in the Object Page header, Delete in the Object Page header). **In scope for this feature**, not a follow-up | **deviates**: the recommendation was the role-agnostic FE default with a 403 dialog. This adds the permission singleton, the first handler of the project, three UI annotations, a contract change and a new OPA5 journey |
| 7 | OPA5 credentials | `app/products/ui5-test-runner.json` with `browserArgs` | as recommended |
| 8 | `xs-security.json` | untouched; roles documented in `ARCHITECTURE.md` | as recommended |
| 9 | Anonymous requests | 401 with the Basic challenge, including `$metadata` | as recommended |

## Key decisions of the plan

| Question | Decision | Rationale |
|---|---|---|
| Who may call the service | `@requires: 'authenticated-user'` on `CatalogService`; anonymous requests get 401 with a Basic challenge (CAP default) | PATTERNS "Authorization"; ADR-0013 part 1; verified in CONTEXT (also for `$metadata` and the service root) |
| Roles | `CatalogViewer`: `READ` on `Products`; `CatalogEditor`: `*` on `Products` (CRUD and the draft actions `draftEdit`, `draftPrepare`, `draftActivate`, discard). Code lists and `$metadata`: any authenticated user | ADR-0013 parts 2 and 3; verified: a Viewer gets 403 on every write path incl. `draftEdit` and a new draft; Editors keep the 409 lock between each other |
| Where the authorization annotations live | inline in `srv/catalog-service.cds`: `@requires` before `service`, `@restrict` on the `Products` projection next to `@odata.draft.enabled` | ADR-0013 part 4; rule `srv-services.md`; `templates/service.cds`; CONVENTIONS section 2 wording is corrected by `docs-keeper` |
| **How the UI learns whether the user may edit** | a **read-only singleton** `CatalogService.Permissions` (`@odata.singleton @cds.persistence.skip @readonly`, elements `key ID : String`, `isEditor : Boolean`) served by an `on('READ')` handler that returns `req.user.is('CatalogEditor')` | ADR-0013 part 8; CAP's documented recipe "Serving SAP Fiori UIs > Role-based Visibility"; verified 2026-09-10: `alice`/`bob` → `true`, `viewer`/`carol` → `false`, anonymous 401, `PATCH` 405, drafts unaffected, `cds lint` clean. A per-row virtual element cannot answer "may I create" in a List Report toolbar (no row context, and none at all on an empty list) |
| **Handlers** | **one new file `srv/catalog-service.js`**, the first handler of the project: only `this.on('READ', 'Permissions', ...)`, no `before`, no `after`, no `cds.log`, no `srv/lib/` | invariant 6 is satisfied by exception: no annotation can evaluate a role at runtime. Enforcement stays fully declarative (`@requires`/`@restrict`); the handler produces a UI signal only. Rule `srv-handlers.md`, `templates/handler.js`. `docs/registry/HANDLERS.md` stops saying "none, all logic is declarative" |
| **Which annotations hide the actions, and where** | `app/products/annotations/Products.cds` (presentation layer, ADR-0004): `UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden` on `CatalogService.Products`, each `{ $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } }`. The element they point at is service/model layer and lives in `srv/catalog-service.cds` | ADR-0013 part 8 settles the layering the 2026-09-07 draft left open. `UI.*Hidden` is pure presentation; the singleton is API surface. Verified: the compiler emits all three on both `CatalogService.Products` and `CatalogService.EntityContainer/Products` |
| **Contract** | **the contract changes**: +50 EDMX lines, 0 removed (measured). Every phase that touches `srv/**/*.cds` or `app/*/annotations/*.cds` runs `npx vitest -u` and `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` **in that same phase**; `test/metadata.test.js` must be green at that phase's gate | PATTERNS "OData contract", `templates/feature/PLAN.md` contract rule, lesson of `products-draft-edit`. This replaces the 2026-09-07 invariant "EDMX unchanged, `git diff --quiet` on `metadata.xml`", which decision 6 made false |
| Mock users | `package.json` → `cds.requires.auth.users`: `alice: { roles: ['CatalogEditor'] }`, `bob: { roles: ['CatalogEditor'] }`, `viewer: { roles: ['CatalogViewer'] }`; defaults and `"*": true` remain; no passwords | ADR-0013 part 5; merge behavior verified with `cds env requires.auth.users`; `bob` must stay an Editor for the draft lock test (ADR-0012) |
| Backend tests | `test/metadata.test.js`: `test.defaults.auth = { username: 'alice' };` plus one new contract `it` (5 total). `test/catalog-service.test.js`: new `describe('CatalogService authorization')` with 7 `it`s (26 total). `test/hooks-protect-bash.test.js`: untouched (6), it starts no server | verified: the `$metadata` HTTP test fails with 401 without `defaults.auth`; TESTING rule 5; ADR-0013 part 6. Target: **37 backend tests** |
| Mock mode | new `app/products/webapp/localService/mockdata/Permissions.json` with `isEditor: true` | `ui5-mock.yaml` has `generateMockData: true`; without a fixture the mock server invents the singleton and `npm run start-mock` may show a permanently viewer-like UI |
| OPA5 credentials | new file `app/products/ui5-test-runner.json` with `{ "browserArgs": ["--basic-auth-username", "alice"] }`; `scripts.test:ui` and `.github/workflows/ci.yml` unchanged | `ui5-test-runner` 5.14.0 reads `ui5-test-runner.json` from the cwd and appends `browserArgs` after `--`; `page.authenticate` answers every Basic challenge of the test page and the app iframe; CI keeps `npm run test:ui -- --report-dir ...` (ADR-0013 part 7) |
| Journeys | the five existing journeys run unchanged as `alice` (Editor); one new journey `RoleAwareActionsJourney.js` with 2 `opaTest`s (Editor still sees Create, Delete and Edit; teardown), registered last. Target: **25 `opaTest`s** | PATTERNS "User scenario"; rule `tests-ui.md` (teardown-only last case). The suite authenticates as one user per run, so the hidden state of a `CatalogViewer` is proven by the backend tests plus `ui-verifier`; see "Open questions for the user" |
| Verifier login | chrome-devtools MCP: first navigate to `http://alice:@localhost:4004/odata/v4/catalog/` (protected service document; Chrome answers the challenge from the URL credentials and caches them for realm "Users"), then open the sandbox; for the Viewer scenario use a fresh browser instance with `viewer:@` | not verifiable without a browser in phase 1; step 13 confirms; fallback: the user logs in once in a headed Chrome, or the verifier documents the limitation and the Viewer path relies on the backend tests |
| i18n | no new keys expected (`Permissions` is never rendered; 401 has no body; 403 uses CAP's generic message). `ux-designer` confirms in step 2; if a key is needed it is added in `en` and `ru` in the same phase | invariant 7 |
| `xs-security.json`, `mta.yaml` | untouched; `cds compile srv --to xsuaa` would generate `$XSAPPNAME.CatalogViewer`/`$XSAPPNAME.CatalogEditor`; roles documented in `ARCHITECTURE.md` | rule `deploy.md`; STATE debt "deployment not configured"; ADR-0013 part 9 |
| Registry | regenerated; `SERVICES.md` shows `@requires "authenticated-user"` and the `@restrict` of `Products`; `HANDLERS.md` lists `srv/catalog-service.js`; `DOMAIN-MODEL.md`/`SERVICES.md` list `Permissions` | `scripts/gen-registry.mjs` already renders all of it |

## Acceptance criteria

### Backend, verified by `npm test`; target **37 tests green** (29 today + 7 new in `test/catalog-service.test.js` + 1 new in `test/metadata.test.js`), full output in the `test-backend` report

- [x] All 19 existing `it`s of `test/catalog-service.test.js` green and unchanged, including "locks the active product while another user's draft exists" with `bob` (409 `DRAFT_ALREADY_EXISTS`) and "does not allow creating categories (@readonly)" (405 unchanged: `Categories` carries no `@restrict` and `alice` is authenticated; if the run reports 403 instead, `test-backend` records it and `architect` decides).
- [x] All 6 `it`s of `test/hooks-protect-bash.test.js` green and the file unchanged; it sets **no** `defaults.auth`, because it starts no CAP server (`spawnSync` over the hook script only).
- [x] New `describe('CatalogService authorization')` at the end of `test/catalog-service.test.js`, 7 `it`s:
  - [x] "rejects anonymous requests with 401": `GET /Products?$top=1` with `{ auth: null }` rejected, `err.status` 401; `GET /$metadata` with `{ auth: null }` rejected, `err.status` 401.
  - [x] "lets a CatalogViewer read products, categories, currencies and the metadata": with `{ auth: { username: 'viewer' } }`: `GET /Products?$top=1&$select=name` 200 with one row; `GET /Categories?$top=1&$select=code` 200; `GET /Currencies?$top=1&$select=code` 200; `GET /$metadata` 200. No count assertion.
  - [x] "forbids a CatalogViewer to create products, active or as a draft": `POST /Products` with `active(newProduct)` as `viewer` rejected with `/403/`, `code: '403'`; `POST /Products` with `newProduct` (no `IsActiveEntity`) as `viewer` likewise; afterwards, as `alice`, `GET /Products?$filter=name eq 'Test Lamp'` and the same filter with `and IsActiveEntity eq false` both return 0 rows.
  - [x] "forbids a CatalogViewer to edit, delete or start a draft on a product": seeded Yoga Mat ID via `alice`; as `viewer`: `PATCH activeKey(id) { stock: 3 }` 403, `DELETE activeKey(id)` 403, `POST activeKey(id)/CatalogService.draftEdit { PreserveChanges: true }` 403, each with `code: '403'`; afterwards `GET activeKey(id)?$select=stock,HasDraftEntity` as `alice` shows the seeded stock and `HasDraftEntity: false`.
  - [x] "forbids an authenticated user without a catalog role to read products": as `carol` (default mock user, role `admin`, unknown to the model): `GET /Products?$top=1` rejected with `/403/`, `code: '403'`; `GET /Categories?$top=1` 200.
  - [x] "reports the caller's edit permission on the Permissions singleton": `GET /Permissions` returns `isEditor: true` for `alice` and for `bob`, `false` for `viewer` and for `carol`; with `{ auth: null }` it is rejected with `err.status` 401.
  - [x] "does not allow writing the Permissions singleton": `PATCH /Permissions` as `alice` rejected with `/405/`.
- [x] `test/metadata.test.js`: `test.defaults.auth = { username: 'alice' };` set right after `cds.test(...)`; "serves $metadata over HTTP with English labels" green; "matches the EDMX snapshot" green **after** `npx vitest -u` in the same phase; "keeps app/products/webapp/localService/metadata.xml in sync with the model" green **after** the file was regenerated in the same phase.
- [ ] New contract `it` in `test/metadata.test.js`, "exposes the Permissions singleton and the role-aware Hidden annotations": the compiled EDMX contains `<Singleton Name="Permissions"` and, for each of `UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden`, a `<Not><Path>/CatalogService.EntityContainer/Permissions/isEditor</Path></Not>`. **Step 7 status:** the `<Singleton Name="Permissions"` half is implemented and green as `it('exposes the Permissions singleton')`; the `UI.*Hidden` half is written in the same file as a separate `it.skip(...)`, because the three annotations arrive in step 9. Step 9 removes the `.skip` after regenerating `metadata.xml` and the snapshot (verified on a scratchpad copy of the repo carrying the phase-3 annotation: the un-skipped test passes there, and the three terms occur 0 times today). `docs-keeper` ticks this box then.
- [ ] `cds compile '*' --to edmx-v4 -s CatalogService -l en | diff - app/products/webapp/localService/metadata.xml` is empty at the end of every phase that changed the model, and the committed `metadata.xml` differs from its state on `main` by **+20 lines, 0 removed after phase 2** (the `Permissions` singleton, its `EntityType` and the `Capabilities.Delete/UpdateRestrictions` block derived from `@readonly`) and by **+50 lines, 0 removed after phase 3** (the three `UI.*Hidden` blocks, emitted twice each). The 2026-09-07 architect measurement of +50 was taken on a scratchpad copy that already carried the phase-3 annotations; it is the end state of the feature, not the end state of phase 2. Measured 2026-09-11.
- [x] `npm run lint` (cds lint) clean; `npx prettier --check srv/ test/` clean; `npx eslint srv/catalog-service.js` clean; `git diff --quiet package-lock.json app/products/package-lock.json` exits 0.
- [x] `cds env requires.auth.users` (run by `cap-backend-dev`, output in the report) lists `alice` and `bob` with `roles: ["CatalogEditor"]`, `viewer` with `roles: ["CatalogViewer"]`, `carol` unchanged, `"*": true`; `cds env requires.auth.kind` prints `mocked`.
- [x] `srv/catalog-service.js` contains exactly one `this.on(...)` registration and no `req.user.is(...)` used for enforcement (grep in the review).

### UI, verified by OPA5 (step 11), `ui-verifier` (step 13, `VERIFICATION.md` with screenshots) and the linters

- [ ] `app/products/ui5-test-runner.json` exists with exactly `{ "browserArgs": ["--basic-auth-username", "alice"] }`. `npm run lint` (ui5lint) and `npm run lint:js` in `app/products` clean.
- [ ] Against `npx cds serve --in-memory --port 4004` in the root, `npm run test:ui` in `app/products` passes **25 `opaTest`s, 0 skipped**: the five existing journeys unchanged plus `RoleAwareActionsJourney`. `test-ui` additionally runs the suite once with `ui5-test-runner.json` renamed away and records the failure mode (expected: the app never loads, the first page assertion times out, the network trace shows 401 on `$metadata`); the file is restored before the report.
- [ ] `RoleAwareActionsJourney`, case 1 "an editor still sees the editing actions": started as `alice`, the List Report shows the Create button and (after selecting a row) the Delete button, and the Object Page of a product shows the Edit button. Case 2 is teardown only (`Given.iTearDownMyApp()`).
- [ ] `ui-verifier`, `alice`, `en`: login recipe works (or the fallback is documented); the List Report shows 15 rows; **Create, Delete and Edit are present**; the edit flow works by hand; the `$batch` network trace shows `Authorization: Basic` and 2xx; the Object Page "Administrative Data" facet shows `alice` in Changed By after a save; data restored afterwards. Screenshot: List Report and Object Page as an editor.
- [ ] `ui-verifier`, `viewer`, `en`, fresh browser instance: the List Report loads with 15 rows and **no Create button**; selecting a row shows **no Delete button**; the Object Page header shows **no Edit and no Delete button**; a `GET /odata/v4/catalog/Permissions` in the same session returns `isEditor: false`. Screenshots: List Report toolbar and Object Page header as a viewer.
- [ ] `ui-verifier`, `viewer`, `en`: no FE error dialog appears during normal browsing (the actions that would have produced 403 are gone); if a path into edit mode still exists (deep link, keyboard shortcut), it is recorded as an observation with the resulting dialog.
- [ ] `ui-verifier`, `ru` (`?sap-ui-language=ru`) as `viewer`: the toolbar and header render without untranslated keys and the four actions are absent there too.
- [ ] `ui-verifier`, anonymous: `http://localhost:4004/odata/v4/catalog/$metadata` in a browser without cached credentials shows the Basic prompt; the sandbox URL loads the shell and prompts on the first OData request; Escape leaves the app with an FE error and an empty list (documented behavior).
- [ ] `npm run start-mock` in `app/products` still starts and shows 15 products **with** the Create, Delete and Edit buttons (proof that `mockdata/Permissions.json` is served); no prompt.
- [ ] `npm start` in `app/products` (:8080, `fiori-tools-proxy`): the browser prompt appears once and `alice` works; if the proxy behaves differently, record it in STATE with the `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD` hint for a follow-up; not a blocker.
- [ ] Browser console (alice run and viewer run) free of errors mentioning `401`, `403`, `Authorization`, `Permissions`, `Products` or `draft`; the known sandbox 404s and the ushell deprecation warning are pre-existing (`categories-code-list/VERIFICATION.md`).
- [ ] `git diff --quiet app/products/webapp/manifest.json app/products/ui5-mock.yaml app/products/package.json .github/workflows/ci.yml` exits 0.

### Documentation

- [ ] `npm run docs:registry` executed, `node scripts/check-docs-fresh.mjs` green; `docs/registry/SERVICES.md` shows `Authorization: @requires "authenticated-user"`, the `@restrict` of `Products` and the `Permissions` singleton; `docs/registry/HANDLERS.md` lists `srv/catalog-service.js` with the event `READ` on `Permissions` and no longer claims "all logic is declarative".
- [ ] `docs/CHANGELOG.md`: lines for `srv` (`@requires`, `@restrict`, `Permissions` singleton, first handler, contract change), `srv` (mock users in `package.json`), `app` (three `UI.*Hidden` annotations, `mockdata/Permissions.json`, `ui5-test-runner.json`), `test` (metadata auth line, contract test, seven authorization tests, new OPA journey), `docs` (ADR-0013, PATTERNS, CONVENTIONS, TESTING, ARCHITECTURE, README, template).
- [ ] `docs/STATE.md`: test counts (37 backend, 25 OPA, 0 skipped); ADR-0013 in the accumulated decisions; a "What works" line about logging in as `alice`/`viewer` and about the four actions disappearing for a viewer; the deployment debt row mentions that `CatalogViewer`/`CatalogEditor` role templates will be generated by `cds add xsuaa`.
- [ ] `docs/architecture/PATTERNS.md`: row "Authorization" gains the example `srv/catalog-service.cds`, decision ADR-0013 and the note "entity grants cover the draft actions; UI tests authenticate via `app/<app>/ui5-test-runner.json`"; **new row "Role-aware UI visibility"**: singleton `Permissions` + `on READ` handler in `srv/`, `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` with `$edmJson` in `app/<app>/annotations`, decision ADR-0013.
- [ ] `docs/architecture/CONVENTIONS.md` section 2: "restrict" removed from the `srv/annotations/` list (the service-file sentence already covers `@requires`/`@restrict`); one sentence that the permission singleton is service API and lives in the service file while its `UI.*Hidden` consumers live in `app/<app>/annotations`.
- [ ] `docs/architecture/TESTING.md` rule 5 reworded: "`defaults.auth = { username: 'alice' }` in every test file **that starts a server with `cds.test`** (including the contract test); anonymous requests with `{ auth: null }` assert `status` 401 (numeric `code`); denied roles assert `code: '403'`; mock users without password accept any password and unknown names are authenticated without roles; test files that only spawn scripts need no auth."
- [ ] `docs/architecture/ARCHITECTURE.md`: "Authentication in development" sentence updated (Basic prompt, `alice`/`viewer`), a "Roles" table (`CatalogViewer`, `CatalogEditor`, what they may do, which mock users have them, the future XSUAA scope names), and a short paragraph on the `Permissions` singleton as the UI's permission signal. `README.md`, run modes: one sentence on the Basic prompt and the users.
- [ ] `templates/service.test.js`: "denies anonymous access" uses `{ auth: null }` and expects `/401/`; a second test "denies a user without the required role" with `code: '403'`.
- [ ] `docs/decisions/ADR-0013-catalog-authorization.md`: status accepted (user, 2026-09-10) — set by `architect` in phase 1; consequences ticked by `docs-keeper`.
- [ ] `docs/features/catalog-authorization/SUMMARY.md` and `VERIFICATION.md` written; this `PLAN.md` fully ticked; `docs/LESSONS.md` entries (see step 15).

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | 1 Research | `architect` | `CONTEXT.md`, `PLAN.md`, `docs/decisions/ADR-0013-catalog-authorization.md` | | done 2026-09-10: user decisions recorded, permission mechanism chosen and verified by experiment, ADR-0013 accepted, merged-suite counts re-derived (29 → 37) |
| 2 | 1 Design | `ux-designer` | `CONTEXT.md`, section "Screens" (that section only) | FE V4 standard actions and empty states | `mcp__fiori-mcp__search_docs` ("list report toolbar actions", "object page header actions", "UI.Hidden") — it answered normally on 2026-09-10; the five numbered items of the "Screens" scope are filled: empty-toolbar states, Object Page readability for a viewer, whether any `en`/`ru` key is needed, verifier scenarios, the login note. Hide-versus-disable is **not** open |
| 3 | 1 Gate | orchestrator | | | plan approved by the user; commit `docs(catalog-authorization): plan, context and ADR-0013` |
| 4 | 2 Backend: service, roles, permission singleton | `cap-backend-dev` | `srv/catalog-service.cds`, `package.json` (`cds.requires.auth.users` only) | Authorization (ADR-0013 parts 1–5) | `mcp__cds-mcp__search_model` for `CatalogService`/`CatalogService.Products` and `search_docs` for "@requires", "@restrict", "@odata.singleton role-based visibility" before the edit; `cds compile srv --to json` ok; `npm run lint` clean; `cds env requires.auth.users` and `cds env requires.auth.kind` output in the report |
| 5 | 2 Backend: permissions handler | `cap-backend-dev` | `srv/catalog-service.js` (**new, first handler**) | Role-aware UI visibility (ADR-0013 part 8); `templates/handler.js`; rule `srv-handlers.md` | `mcp__cds-mcp__search_docs` for "req.user.is", "srv.on READ singleton" before the edit; `npx prettier --write srv/catalog-service.js`; `npx eslint srv/catalog-service.js` clean; against a running `npx cds serve --in-memory --port 4004`: `curl -u alice: .../Permissions` shows `isEditor: true`, `curl -u viewer:` shows `false`, `curl` without credentials returns 401, `curl -X PATCH -u alice:` returns 405, `curl .../Products` without credentials returns 401 and `curl -u viewer: -X POST .../Products` returns 403 — six lines in the report |
| 6 | 2 Backend: contract | `cap-backend-dev` | `app/products/webapp/localService/metadata.xml` (regenerated), `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u`) | OData contract | `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml`; `npx vitest -u`; `git diff --numstat app/products/webapp/localService/metadata.xml` shows **50 added, 0 removed** at this point (the three `UI.*Hidden` blocks arrive in phase 3 and change the number again); diff pasted into the report |
| 7 | 2 Backend: tests | `test-backend` | `test/metadata.test.js`, `test/catalog-service.test.js` | Service test (ADR-0002, TESTING rule 5, ADR-0013 part 6) | `mcp__cds-mcp__search_docs` "cds.test defaults auth" before the edit; `npm test` green with **37 tests**, full output in the report; `npx prettier --write test/`; `test/hooks-protect-bash.test.js` untouched |
| 8 | 2 Gate | orchestrator | | | steps 4–7 are one phase (after step 4 alone `test/metadata.test.js` is red, after step 6 alone the new contract test does not exist); `npm run lint` and `npm test` green, `git diff --quiet` on the regenerated `metadata.xml` versus a fresh compile; STATE "active feature" line updated; commit `feat(srv): require authentication, CatalogViewer/CatalogEditor roles and a permission singleton` |
| 9 | 3 UI: role-aware actions | `fiori-app-dev` | `app/products/annotations/Products.cds`, `app/products/webapp/localService/metadata.xml` (regenerated again), `test/__snapshots__/metadata.test.js.snap` (`npx vitest -u` again) | Role-aware UI visibility (ADR-0013 part 8); ADR-0004 layering | `mcp__fiori-mcp__search_docs` for "UI.CreateHidden", "UI.Hidden edmJSON", "hide create button list report" before the edit; **no `manifest.json` change** (so no `execute_functionality`); `cds compile srv --to json` ok; `npm run lint` clean; regenerate `metadata.xml` and run `npx vitest -u` in this step; `npm test` green (37); `npm run lint` (ui5lint) in `app/products` clean |
| 10 | 3 UI: mock fixture and runner credentials | `test-ui` | `app/products/webapp/localService/mockdata/Permissions.json` (new), `app/products/ui5-test-runner.json` (new) | User scenario; rule `tests-ui.md` | read `node_modules/ui5-test-runner/src/defaults/puppeteer.js` and `src/job.js` (`buildArgs`) to confirm the key names; `npm run start-mock` in `app/products` shows 15 products **with** Create, Delete and Edit (if the singleton fixture shape is rejected by `sap-fe-mockserver`, try the array form `[{ "ID": "me", "isEditor": true }]` versus the object form and record which one works); `npm run lint` in `app/products` clean |
| 11 | 3 UI tests | `test-ui` | `app/products/webapp/test/integration/RoleAwareActionsJourney.js` (new), `app/products/webapp/test/integration/opaTests.qunit.js` (register last) | User scenario | skills `ui5-best-practices-opa5`, `mcp__fiori-mcp__search_docs` for the `sap.fe.test.ListReport` action assertions; `npx cds serve --in-memory --port 4004` in the root, then `npm run test:ui` in `app/products`: **25 passed, 0 skipped**; one run with `ui5-test-runner.json` renamed away to record the 401 failure mode, file restored; outputs in the report |
| 12 | 3 Gate | orchestrator | | | `npm run lint` in `app/products`; `npm test` in the root green (37); a fresh `cds compile '*' --to edmx-v4` equals the committed `metadata.xml`; STATE line updated; commit `feat(app): hide the editing actions from CatalogViewer and authenticate the OPA5 journeys` |
| 13 | 4 Verification | `ui-verifier` | `docs/features/catalog-authorization/VERIFICATION.md`, `screenshots/` | | `npx cds serve --in-memory --port 4004`; login recipe (credentials in a top-level URL to the protected service document, then the sandbox); all UI acceptance criteria for `alice`, `viewer` (fresh browser instance), anonymous and `ru`; mock mode and the :8080 proxy; network evidence from `$batch` and from `GET /Permissions` (`list_network_requests` with `resourceTypes: ["xhr","fetch"]`, `get_network_request` for headers and status); console; data restored; verdict. If the URL-credential login does not work with chrome-devtools MCP 1.8.0, try a headed browser where the user enters `alice` once, then document the limitation; the viewer criteria are **blocking** for this feature, so if no viewer session can be established the verifier says so explicitly instead of passing the feature |
| 14 | 5 Review | `reviewer` | | | zero blocking findings; check specifically: `@requires`/`@restrict` only in `srv/catalog-service.cds`; `srv/catalog-service.js` contains only the `READ Permissions` registration and no enforcement logic; `UI.*Hidden` only in `app/products/annotations/Products.cds`, never in `srv/`; no `Authorization` string outside `test/` and `app/products/ui5-test-runner.json`; `package.json` diff limited to `cds.requires.auth.users`; `package-lock.json`, `manifest.json`, `ui5-mock.yaml`, `ci.yml` unchanged; `metadata.xml` and the snapshot regenerated and consistent with a fresh compile; `bob` still a `CatalogEditor`; every `cds.test`-based test file sets `defaults.auth` and `test/hooks-protect-bash.test.js` correctly does not; anonymous tests use `{ auth: null }`; English-only docs; CHANGELOG lines present |
| 15 | 6 Documentation | `docs-keeper` | `docs/registry/*` (generated), `docs/CHANGELOG.md`, `docs/STATE.md`, `docs/architecture/PATTERNS.md`, `CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`, `README.md`, `templates/service.test.js`, `docs/features/catalog-authorization/SUMMARY.md`, `docs/LESSONS.md` | | `node scripts/check-docs-fresh.mjs` green; LESSONS candidates: (a) `@requires` on a service protects `$metadata`, so every `cds.test`-based file needs `defaults.auth`, including the contract test, while a file that only spawns scripts needs none; (b) mocked users without `password` accept any password and `"*": true` authenticates unknown names, so an "anonymous" test must send `{ auth: null }` and a named unknown user tests "no role" (403), not "not logged in" (401); (c) `ui5-test-runner` browser options go after `--` or into `ui5-test-runner.json` `browserArgs`, never before `--`; (d) role-aware Fiori actions need a singleton, not a per-row element, because the List Report toolbar has no row context; (e) `cds.resolve('*')` is the quick way to see whether `app/<app>/annotations.cds` is pulling the UI annotations into the model; commit `docs: catalog-authorization summary and registry` |

### Details for the developers

Step 4, `srv/catalog-service.cds`. The file today is exactly:

```cds
using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
service CatalogService {
  @odata.draft.enabled entity Products as projection on catalog.Products;
  @readonly entity Categories as projection on catalog.Categories;
}

using from './annotations/Products';
using from './annotations/Categories';
```

It becomes:

```cds
using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
@requires: 'authenticated-user'
service CatalogService {
  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'CatalogViewer' },
    { grant: '*',    to: 'CatalogEditor' }
  ]
  entity Products as projection on catalog.Products;

  @readonly entity Categories as projection on catalog.Categories;

  /** Permission signal for the UI: read-only singleton, no table, filled by srv/catalog-service.js (ADR-0013). */
  @odata.singleton
  @cds.persistence.skip
  @readonly
  entity Permissions {
    key ID       : String;
        isEditor : Boolean;
  }
}

using from './annotations/Products';
using from './annotations/Categories';
```

The `key ID` is deliberate: a non-abstract OData V4 `EntityType` must declare a key. The keyless variant compiles and serves (measured, 11 EDMX lines cheaper) but produces non-conformant metadata; do not "simplify" it away.

`package.json`, the `cds` block (the only change in the file; keep `sapux` and the scripts as they are):

```json
"cds": {
  "requires": {
    "auth": {
      "users": {
        "alice": { "roles": ["CatalogEditor"] },
        "bob": { "roles": ["CatalogEditor"] },
        "viewer": { "roles": ["CatalogViewer"] }
      }
    }
  }
}
```

Do not set `kind`, `password`, `tenant` or a `[development]` profile; do not remove the defaults. Sanity: `npx cds env requires.auth.users` shows `alice`, `bob` with `CatalogEditor`, `viewer` with `CatalogViewer`, `carol` untouched and `"*": true`; `npx cds env requires.auth.kind` prints `mocked`.

Step 5, `srv/catalog-service.js` (new; ESM, the project is `"type": "module"`):

```js
import cds from '@sap/cds';

/**
 * Only job of this handler: tell the Fiori UI whether the caller may edit.
 * Enforcement is declarative (@requires / @restrict in catalog-service.cds); this is the
 * signal behind UI.CreateHidden / UI.UpdateHidden / UI.DeleteHidden (ADR-0013).
 */
export default class CatalogService extends cds.ApplicationService {
  init() {
    this.on('READ', 'Permissions', (req) =>
      req.reply({ ID: 'me', isEditor: req.user.is('CatalogEditor') })
    );
    return super.init();
  }
}
```

No `before`, no `after`, no `cds.log`, no message key, no `srv/lib/`. The file name must stay `catalog-service.js` so cds picks it up as the implementation of `catalog-service.cds` (verified: the startup log prints `impl: 'srv/catalog-service.js'`).

Step 7, `test/metadata.test.js`: after `const test = cds.test(import.meta.dirname + '/..');` add

```js
test.defaults.auth = { username: 'alice' }; // @requires on the service also protects $metadata (ADR-0013)
```

`test/catalog-service.test.js`: reuse `newProduct`, `active`, `activeKey`, `GET`/`POST`/`PATCH`/`DELETE`; add two request-option helpers next to the draft helpers:

```js
// Authorization (ADR-0013): alice and bob are CatalogEditors, viewer is a CatalogViewer, carol has no catalog role.
const as = (username) => ({ auth: { username } });
const anonymous = { auth: null }; // overrides defaults.auth, no Authorization header
```

Assertion shapes (verified): anonymous `const err = await expect(GET(url, anonymous)).to.be.rejectedWith(/401/); expect(err.status).to.equal(401);` (the `code` is the number 401, do not `containSubset({ code: '401' })`); denied role `const err = await expect(POST(url, body, as('viewer'))).to.be.rejectedWith(/403/); expect(err).to.containSubset({ code: '403' });`. The singleton is read with `GET('/odata/v4/catalog/Permissions', as('viewer'))` and asserted on `data.isEditor`. The Viewer read test must not assert the product count. The new `describe` goes last; it creates nothing, but the "cannot create" test verifies as `alice` that no `Test Lamp` exists afterwards, active or draft.

Step 9, `app/products/annotations/Products.cds`, appended after the existing `annotate CatalogService.Products with { ... }` block:

```cds
// Role-aware standard actions (ADR-0013): hidden for anyone who is not a CatalogEditor.
// The flag comes from the CatalogService.Permissions singleton, filled in srv/catalog-service.js.
annotate CatalogService.Products with @(
  UI.CreateHidden: { $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } },
  UI.UpdateHidden: { $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } },
  UI.DeleteHidden: { $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } }
);
```

Verified rendering: each becomes `<Annotation Term="UI.CreateHidden"><Not><Path>/CatalogService.EntityContainer/Permissions/isEditor</Path></Not></Annotation>`, emitted on both `CatalogService.Products` and `CatalogService.EntityContainer/Products`. If the browser check in step 13 shows that FE does not resolve the long path, the documented fallback is the short form `/Permissions/isEditor`; change it in this one place, regenerate `metadata.xml`, run `npx vitest -u` and re-run the verification — do not add a manifest setting or a controller extension.

Step 10, `app/products/ui5-test-runner.json`:

```json
{
  "browserArgs": ["--basic-auth-username", "alice"]
}
```

`browserArgs` is consumed by `buildArgs` in `src/job.js` and appended after `--` to the puppeteer script, which calls `page.authenticate({ username: 'alice', password: '' })` (`src/defaults/puppeteer.js`). Do not add `--basic-auth-username` to `scripts.test:ui` before `--` (the runner rejects unknown options) and do not add `--` to the script (CI appends `--report-dir` with `npm run test:ui -- ...`). No dependency change.

`app/products/webapp/localService/mockdata/Permissions.json`: the sibling files (`Products.json`, `Categories.json`) are JSON arrays; start with

```json
[{ "ID": "me", "isEditor": true }]
```

and if `sap-fe-mockserver` does not serve the singleton from it, try the bare object form. The success criterion is that `npm run start-mock` shows the Create button.

Step 11, `RoleAwareActionsJourney.js`: copy the structure of `DraftMarkerInListReportJourney.js` (same `JourneyRunner`, same `sap.fe.test.ListReport`/`ObjectPage` page objects, `iStartMyApp('products-display')`). Case 1 asserts that the editor's Create, Delete (after selecting a row) and Edit (on the Object Page) actions exist; case 2 is `Given.iTearDownMyApp()` only. Register the journey **last** in `opaTests.qunit.js`.

Step 13, verifier login: navigate to `http://alice:@localhost:4004/odata/v4/catalog/` first (the service document is protected, Chrome answers the challenge with the URL credentials and caches them for `localhost:4004`, realm "Users"), then to `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`; XHR challenges reuse the cached credentials. For `viewer`, start a new browser instance and use `http://viewer:@localhost:4004/odata/v4/catalog/`. Restore data after the alice run: category of Laptop Pro 15 back to Electronics, drafts discarded, created products deleted (`DELETE ...IsActiveEntity=true` as `alice`).

Step 15, `templates/service.test.js`, `describe('authorization')`:

```js
it('denies anonymous access', async () => {
  const err = await expect(GET(`${base}/Products`, { auth: null })).to.be.rejectedWith(/401/);
  expect(err.status).to.equal(401);
});
it('denies a user without the required role', async () => {
  const err = await expect(GET(`${base}/Products`, { auth: { username: 'carol' } })).to.be.rejectedWith(/403/);
  expect(err).to.containSubset({ code: '403' });
});
```

## Decisions that require an ADR

`docs/decisions/ADR-0013-catalog-authorization.md` — accepted by the user on 2026-09-10. It covers: authentication for the whole service and the anonymous behavior; the two prefixed roles; code lists readable by any authenticated user; the placement of the authorization annotations and the `CONVENTIONS.md` correction; the development users and the `*` default; the test idioms; the UI credential mechanism; **the role-aware UI with the permission singleton, the first handler and the `UI.*Hidden` layering (part 8)**; the deferral of `xs-security.json`. Consequences for `PATTERNS.md` (including the new row), `CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`, `README.md` and `templates/service.test.js` are executed by `docs-keeper` in step 15. No further ADR is needed for this feature.

## Risks

| Risk | How it is detected | What to do |
|---|---|---|
| FE V4 does not resolve `/CatalogService.EntityContainer/Permissions/isEditor` and the buttons stay visible (or vanish for everyone) | step 13, viewer and editor screenshots; step 11 case 1 fails for the editor | documented fallback: the short path `/Permissions/isEditor` (CAP notes "some Fiori clients accept it"); if neither resolves, `architect` reopens ADR-0013 part 8 before the feature is merged — the backend enforcement is already complete and correct, so the fallback of last resort is to drop the three annotations and reopen decision 6 with the user |
| The three `Hidden` annotations hide the actions for **editors** too (wrong `$Not`, singleton not loaded, `isEditor` null) | step 11 case 1 fails; step 13 alice screenshots | the OPA journey exists exactly for this; fix the annotation or the handler, regenerate the contract, re-run |
| `sap-fe-mockserver` does not serve the singleton, so `npm run start-mock` shows a viewer-like UI with no actions | step 10 acceptance check | try both fixture shapes; if the mock server cannot serve a singleton at all, record it in STATE as a known mock-mode limitation and in `README.md`, and do not block the feature (mock mode has no backend and no roles) |
| The contract is regenerated in one phase and not the other, so `test/metadata.test.js` is red at a gate | steps 6, 9 and the phase gates; the Stop hook blocks | both model-changing phases regenerate `metadata.xml` and run `npx vitest -u` inside the phase (contract rule of `templates/feature/PLAN.md`) |
| `test/metadata.test.js` goes red between steps 4 and 7 (no `defaults.auth` yet) | `npm test` inside phase 2 | steps 4–7 form one phase; the one-line fix is part of the plan |
| The first `srv/*.js` file drifts into enforcement logic ("just one `before` check") | step 14 review, grep for `req.user.is` | the handler is one `on` registration; enforcement stays in `@restrict`. ADR-0013 part 8 states the boundary |
| OPA5 journeys locked out: the headless browser cannot answer the Basic prompt | step 11: the first page assertion times out; runner network trace shows 401 on `$metadata` | `ui5-test-runner.json` with `browserArgs` (step 10); the deliberate run without the file documents the symptom; CI uses the same cwd |
| The OPA5 suite proves only the editor case; the hidden state is browser-verified but not regression-tested | visible in the criteria | accepted for this feature; a second runner config as a `test:ui:viewer` script is offered to the user in "Open questions" |
| `ui-verifier` cannot log in through chrome-devtools MCP (URL credentials not honored or not cached for XHR) | step 13: sandbox shows an FE error and an empty list; `get_network_request` shows 401 | headed browser with a one-time manual login; if no viewer session can be established at all, the verifier reports it as blocking rather than passing the feature, because the viewer criteria are the point of decision 6 |
| `bob` loses the Editor role by a later change | draft lock test answers 403 instead of 409 | criterion in step 7 and a reviewer check in step 14 |
| `@readonly` versus `@restrict` order: "does not allow creating categories" could report 403 instead of 405 | step 7 | not expected (`Categories` has no `@restrict`); if it changes, `test-backend` records it and `architect` decides |
| Users type an unknown name in the browser prompt and get an empty list with an error | manual use | `"*": true` keeps the CAP default; `README.md` explains `alice`/`viewer` |
| `npm start` on :8080: the Fiori tools proxy handles the 401 differently from a direct call | step 13 | observation in STATE with the `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD` hint; not a blocker, the sandbox on :4004 is the documented entry point |
| Registry renders the `@restrict` array as raw JSON in the table | step 15 | acceptable; generator changes would be a separate user request |
| Hooks: PostToolUse marks the registry stale after each edit; the Stop hook requires `npm test` green and STATE/CHANGELOG updated between phases | hook messages | the orchestrator updates the STATE "active feature" line after every phase; `docs-keeper` regenerates the registry in step 15 |

## Open questions for the user

Both were answered by the user on 2026-09-10 at the phase-1 approval gate. Nothing here is open any more.

1. **OPA5 coverage of the viewer role.** *Answered: one run as `alice`, as recommended.* The suite authenticates as one user per run (`page.authenticate`), so all 25 `opaTest`s run as `alice` and the hidden state of a `CatalogViewer` is proven by the backend tests plus the `ui-verifier` browser session, whose viewer criteria are blocking. A second runner config `app/products/ui5-test-runner-viewer.json` with a `test:ui:viewer` script and a second CI step is **not** built now; add it only if the hidden state ever regresses. `scripts.test:ui` and `.github/workflows/ci.yml` therefore stay unchanged (step 10).
2. **Role naming and the future XSUAA role collections.** *Answered: no external convention applies, the names are final.* `CatalogViewer`/`CatalogEditor` are used as decided and will become the scope and role-template names generated by `cds add xsuaa --for production` in the deployment ADR. No subaccount prefix has to be honoured.
