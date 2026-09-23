# catalog-authorization: context

Date: 2026-09-07, rewritten 2026-09-10 after the user's decisions. Author: `architect`. Branch: `feature/catalog-authorization`.

Prerequisite state (re-checked on `main` at `fecb925`, 2026-09-10): `CatalogService.Products` is `@odata.draft.enabled` (ADR-0012) with `Common.SemanticKey: [ name ]` on the presentation layer (ADR-0015), `Categories` is `@readonly`, `srv/` has no `.js` file, `package.json` has `"cds": { "requires": {} }`. Backend suite: 29 tests in three files (`test/catalog-service.test.js` 19, `test/metadata.test.js` 4, `test/hooks-protect-bash.test.js` 6). OPA5 suite: 23 `opaTest`s in five journeys.

## Request

Add authorization to `CatalogService`. Today the service has no `@requires` and no `@restrict`: every request, including anonymous ones, may read and write products (`docs/registry/SERVICES.md`: "Authorization: not set (open by default with mocked auth)"). With drafts in place (ADR-0012) users become meaningful: a draft lock belongs to a user, `createdBy`/`modifiedBy` are filled with `anonymous` for anonymous requests, and the Fiori app should be used by named people. The feature introduces the role model (who may read, who may edit), makes anonymous requests fail with 401, gives the mocked development users roles, **hides the four standard editing actions from a read-only user in the Fiori app** (user decision 6 of 2026-09-10), and keeps the backend tests, the OPA5 journeys, the UI verifier and the mock server working.

## User decisions of 2026-09-10 that shape this context

1. Role model A: a read role plus a full-CRUD role. 2. Names **`CatalogViewer` / `CatalogEditor`** (prefixed, not the bare `Viewer`/`Editor` the architect recommended). 3. Code lists and `$metadata`: readable by any authenticated user. 4. Development users `alice`/`bob` = `CatalogEditor`, new `viewer` = `CatalogViewer`, no passwords, defaults and `"*": true` kept. 5. Authorization annotations inline in `srv/catalog-service.cds`. 6. **Role-aware UI is in scope**: Create (List Report toolbar), Delete (List Report, on selection), Edit (Object Page header) and Delete (Object Page header) are hidden for a `CatalogViewer`, not merely rejected by the backend. 7. OPA5 credentials via `app/products/ui5-test-runner.json`. 8. `xs-security.json` untouched. 9. Anonymous requests answer 401 including `$metadata`.

## Affected entities and services

Result of `mcp__cds-mcp__search_model` (`CatalogService`, `CatalogService.Products`, `CatalogService.Currencies`), `docs/registry/SERVICES.md`, `DOMAIN-MODEL.md`, `HANDLERS.md`, `UI-ARTIFACTS.md`, `cds env requires.auth`, and the two experiments described below:

| Object | Exists now (`main`, 2026-09-10) | What changes |
|---|---|---|
| `CatalogService` (`srv/catalog-service.cds`) | `service CatalogService { ... }`, no `@requires`; path `/odata/v4/catalog` | `@requires: 'authenticated-user'` on the service. Verified: `$metadata`, the service document and every entity set answer 401 with `WWW-Authenticate: Basic realm="Users"` to requests without credentials |
| `CatalogService.Products` | `@odata.draft.enabled` projection with `draftEdit`, `draftActivate`, `draftPrepare`, `Common.DraftRoot` | `@restrict: [{ grant: 'READ', to: 'CatalogViewer' }, { grant: '*', to: 'CatalogEditor' }]`. Verified: the grants cover the draft choreography (`NEW`, `EDIT`, `PATCH`, `SAVE`, `DISCARD`): a `CatalogViewer` gets 403 on `POST` (active and draft), `PATCH`, `DELETE`, `draftEdit`; a `CatalogEditor` runs the full cycle; the draft lock between two Editors still answers 409 `DRAFT_ALREADY_EXISTS` |
| `CatalogService.Permissions` | does not exist | **new**: `@odata.singleton @cds.persistence.skip @readonly entity Permissions { key ID : String; isEditor : Boolean; }` in `srv/catalog-service.cds`. The one place the UI can ask "may this user edit" without a row context. Readable by any authenticated user through the service-level `@requires`; not writable (405) |
| `srv/catalog-service.js` | does not exist (`HANDLERS.md`: "none, all logic is declarative") | **new, the first handler of the project**: `on('READ', 'Permissions')` replying `{ ID: 'me', isEditor: req.user.is('CatalogEditor') }`. No annotation can compute a role check, so invariant 6 ("declarative before imperative") is satisfied by exception, recorded in ADR-0013 part 8 |
| `CatalogService.Categories` | `@readonly` projection, `Capabilities.*Restrictions` | nothing. Readable by any authenticated user through the service-level `@requires` (value help for both roles). Verified: an authenticated user without a catalog role reads `Categories` (200) but not `Products` (403) |
| `CatalogService.Currencies`, `Currencies.texts`, `Categories.texts` (autoexposed) | no annotations | nothing; readable by any authenticated user. An autoexposed entity cannot carry `@restrict` without an explicit projection, so restricting the code lists would need two new projections; not done (user decision 3) |
| `CatalogService.DraftAdministrativeData` (contained) | generated by the draft support | nothing; reachable only through `Products` and therefore under the `Products` grants. Verified: a `CatalogViewer` gets 404 for another user's draft |
| `srv/annotations/Products.cds`, `Categories.cds` | `@title`, `@mandatory`, `@assert.*` | nothing. `@requires`/`@restrict` do not belong here (rule `srv-services.md`, PATTERNS "Authorization", user decision 5); see the CONVENTIONS wording issue below |
| `app/products/annotations/Products.cds` | `Common.SemanticKey`, `UI.HeaderInfo`, `UI.SelectionFields`, `UI.LineItem`, `UI.Facets`, three `UI.FieldGroup`s, `Common.Text`/`ValueListWithFixedValues` on `category` | **new** `UI.CreateHidden`, `UI.UpdateHidden`, `UI.DeleteHidden` on `CatalogService.Products`, each `{ $edmJson: { $Not: { $Path: '/CatalogService.EntityContainer/Permissions/isEditor' } } }`. Presentation layer per ADR-0004 (the element they point at is service/model layer) |
| `package.json` → `cds.requires` | `{}`; effective auth: `kind: 'mocked'`, default users `alice`, `bob`, `carol`, `dave`, `erin`, `fred`, `me`, `yves`, `*: true`, `restrict_all_services: false` | `cds.requires.auth.users`: `alice` and `bob` get `roles: ['CatalogEditor']`, new user `viewer` gets `roles: ['CatalogViewer']`. Verified: the block deep-merges with the defaults (the other default users and `*: true` stay; `alice`'s `roles` array is replaced, her `tenant: 't1'` stays and is dropped at runtime because multitenancy is off). No `[development]` profile block: the pattern row names the top-level key, and mocked auth is the default profile anyway; in `production` the kind is `jwt` and `users` is ignored |
| `test/catalog-service.test.js` | 19 `it`s (13 CRUD/validation, 6 draft), `defaults.auth = { username: 'alice' }`, helpers `newProduct`, `without`, `active`, `activeKey`, `draftKey`; the lock test uses `bob` | new `describe('CatalogService authorization')` with 7 `it`s (anonymous 401, Viewer reads, Viewer cannot create, Viewer cannot edit/delete/draftEdit, user without a catalog role cannot read, `Permissions` reports the role, `Permissions` is not writable) → 26 `it`s. Existing tests unchanged: `alice` is a `CatalogEditor`, `bob` stays a `CatalogEditor` so the 409 lock test holds |
| `test/metadata.test.js` | 4 `it`s; `const test = cds.test(...)` without `defaults.auth`; "serves $metadata over HTTP with English labels" calls `test.get('/odata/v4/catalog/$metadata')` | `test.defaults.auth = { username: 'alice' };` (verified: without it the HTTP test fails with 401 once `@requires` is set) plus one new contract `it` asserting the `Permissions` singleton and the three `Hidden` annotations in the EDMX → 5 `it`s. The snapshot test needs `npx vitest -u` in the same phase as the model change |
| `test/hooks-protect-bash.test.js` | 6 `it`s; pure `spawnSync` over `scripts/hooks/protect-files-bash.mjs`, **no `cds.test`, no HTTP, no server** | nothing. It never authenticates, so it must not and cannot set `defaults.auth`; TESTING rule 5 is worded for files that start a server with `cds.test` |
| `test/__snapshots__/metadata.test.js.snap`, `app/products/webapp/localService/metadata.xml` | draft + semantic-key contract | **both change**: +50 lines, 0 removed (measured). `npx vitest -u` and `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` in the same phase as each model change (backend phase for the singleton, UI phase for the `Hidden` annotations) |
| `app/products/webapp/localService/mockdata/` | `Products.json`, `Categories.json`, `Categories_texts.json`; `ui5-mock.yaml` has `generateMockData: true` | **new** `Permissions.json` with `isEditor: true`, otherwise `sap-fe-mockserver` generates the singleton itself and `npm run start-mock` may show a viewer-like UI with no Create/Edit/Delete |
| `app/products/package.json` → `scripts.test:ui` | `ui5-test-runner --split-opa --page-timeout 150000 --global-timeout 900000 --url http://localhost:4004/products/webapp/test/testsuite.qunit.html` | unchanged. Credentials for the headless browser come from a new file `app/products/ui5-test-runner.json` (`{ "browserArgs": ["--basic-auth-username", "alice"] }`), which `ui5-test-runner` 5.14.0 reads from the cwd by default and appends after `--` to the browser script; `src/defaults/puppeteer.js` then calls `page.authenticate({ username, password })`, so every request of the test page and of the app iframe answers the Basic challenge. The options are browser-specific and not accepted before `--`, and `npm run test:ui -- --report-dir ...` (CI) must keep appending runner options, hence the config file instead of a script change |
| `app/products/webapp/test/integration/` | 5 journeys, 23 `opaTest`s | **new** `RoleAwareActionsJourney.js` with 2 `opaTest`s (Editor still sees Create/Delete/Edit; teardown), registered last in `opaTests.qunit.js` → 25. The whole suite runs as `alice`; the hidden state for a `CatalogViewer` is covered by the backend tests and by `ui-verifier` in a second browser session (see "Open questions") |
| `.github/workflows/ci.yml` (`ui-tests` job) | `cds serve --in-memory --port 4004`, then `npm run test:ui -- --report-dir ../../ui-test-report` in `app/products` | nothing. `cds serve` reads the same `package.json` users; the runner picks up `ui5-test-runner.json` from `app/products` |
| `app/products/webapp/test/flpSandbox.html`, `flpSandboxConfig.js`, `appconfig/fioriSandboxConfig.json` | sandbox runs as the ushell "Default User"; no authentication logic | nothing. The ushell sandbox does not authenticate; the first OData request (`$metadata`) triggers the browser's Basic prompt once per browser session. Developers type `alice` (Editor) or `viewer`; mocked users have no password, so the password field may stay empty (verified: any password is accepted for users without one) |
| `app/products/webapp/manifest.json`, `Component.js` | FE V4 List Report + Object Page | nothing. The role-aware behavior is annotation-driven; no manifest change, so no Fiori MCP `execute_functionality` run is needed |
| `xs-security.json` (protected, draft) | one role template `Token_Exchange`, no application scopes | nothing in this feature (rule `deploy.md`; user decision 8). For the record, `cds compile srv --to xsuaa` on the new model generates scopes `$XSAPPNAME.CatalogViewer`, `$XSAPPNAME.CatalogEditor` and role templates `CatalogViewer`, `CatalogEditor`; `cds add xsuaa --for production` will write them when deployment is set up. The roles are documented in `docs/architecture/ARCHITECTURE.md` now, as `deploy.md` demands before any `xs-security.json` change |
| `_i18n/*`, `app/products/webapp/i18n/*` | labels en/ru | no new keys expected: `Permissions` is never rendered, 401 has no body, 403 uses CAP's generic "Forbidden" message. `ux-designer` confirms whether the empty-toolbar states need a text |
| `docs/architecture/CONVENTIONS.md` section 2 | "Annotation split rule: ... (labels, mandatory, assert, readonly, restrict) lives in `srv/annotations/`" | wording conflict with PATTERNS "Authorization", rule `srv-services.md` and `templates/service.cds`, which all put `@requires`/`@restrict` into the service file. Resolved by ADR-0013 in favor of the service file (user decision 5); `docs-keeper` fixes the sentence |
| `docs/registry/HANDLERS.md` | "_none_ ... Handler files: none, all logic is declarative" | regenerated: one handler, `srv/catalog-service.js`, event `READ` on `Permissions`. The sentence "all logic is declarative" disappears; PATTERNS gains a row "Role-aware UI visibility" |
| `templates/service.test.js` | `describe('authorization')` "denies anonymous access" sends `{ auth: { username: 'nobody', password: '' } }` and expects `/40[13]/` | flawed: with `*: true` the user `nobody` is authenticated and gets 403, not 401; an anonymous request needs `{ auth: null }` (verified). `docs-keeper` corrects the template after the feature |

Consumers of the service: `app/products` (FE V4), the OPA5 journeys, the UI verifier (chrome-devtools MCP), `cds.test` in `test/`, CI. None of them sends credentials today.

## What already exists and is reused

From `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md`, `search_model`, `cds env`, and the sources of the installed packages:

- CAP generic authorization: `@requires` and `@restrict` are enforced by the runtime for CRUD and for the draft events; no `before` handler, no middleware, no `req.user.is()` for enforcement. The one `req.user.is()` call in this feature serves the UI signal, not the enforcement.
- CAP mocked authentication (`@sap/cds` 10.0.6, `lib/srv/middlewares/auth/basic-auth.js`, `mocked-users.js`): anonymous access is allowed until an annotation requires a user, then `req._login()` answers 401 with `WWW-Authenticate: Basic realm="Users"`; users without `password` accept any password; `*: true` accepts any user name without roles; `login_required` is only set for `credentials` in production or multitenancy. The default user list is kept and extended, not replaced.
- CAP's documented recipe "Serving SAP Fiori UIs > Role-based Visibility" (`mcp__cds-mcp__search_docs`, 2026-09-10): `@odata.singleton @cds.persistence.skip` entity + `on READ` handler with `req.user.is(...)` + `UI.CreateHidden`/`UI.UpdateHidden` as `$edmJson` `$Not`/`$Path` over `/<Service>.EntityContainer/<Singleton>/<flag>`. Copied verbatim in shape; only the names differ.
- Draft lock semantics from ADR-0012: `DRAFT_ALREADY_EXISTS` (409) between Editors, `DRAFT_LOCKED_BY_ANOTHER_USER` (403) for anyone touching a foreign draft; nothing to add.
- `templates/handler.js`: the shape of the first handler (ESM, `export default class ... extends cds.ApplicationService`, registration in `init()`, `return super.init()`). This feature uses only the `on` part and needs no `cds.log`, no `srv/lib/`, no message key.
- Test scaffolding: `defaults.auth = { username: 'alice' }`, the `rejectedWith(/4xx/)` + `containSubset({ code })` idiom, the helpers `active`, `activeKey`, `draftKey`, the seeded Yoga Mat lookup, the `bob` request option `{ auth: { username: 'bob' } }`.
- `cds.test` (`@cap-js/cds-test` 1.0.2, `lib/naxios.js`): per-request `{ auth: null }` overrides `defaults.auth` and sends no `Authorization` header; a 401 without OData body yields an error with numeric `code: 401`, `status: 401`; a 403 yields `code: '403'`, `status: 403`.
- `ui5-test-runner` 5.14.0: `--basic-auth-username`/`--basic-auth-password` in `src/defaults/puppeteer.js` (`page.authenticate`), config file `ui5-test-runner.json` with `browserArgs` (`src/job.js`, `buildArgs`).
- OPA5: `sap.fe.test.ListReport` page objects and `JourneyRunner` already exist (`pages/ProductsList.gen.js`, `pages/JourneyRunner.js`); the new journey reuses them, nothing new is generated.
- Registry generator: `scripts/gen-registry.mjs` already renders `@requires` (line 195), `@restrict` (line 231) and handler files; `docs-keeper` only regenerates.
- `templates/service.cds`: the authorization block (`@requires` on the service, `@restrict` with `grant`/`to` on the projection) is the shape to copy.

It would be a mistake to write anew: a custom auth middleware or `server.js`; a `before` handler checking `req.user.is('CatalogEditor')` for enforcement; hand-written `Capabilities.*Restrictions` per role; a virtual/computed `canEdit` element on `Products` (see the rejected alternatives below); an `Authorization` header in `manifest.json` or in the sandbox; a second user list in the tests; a `dummy` auth profile for the UI; a second set of `sap.fe.test` page objects.

## Applicable patterns

| Task in this feature | PATTERNS row | Fit |
|---|---|---|
| Protect the service and the projection | Service and logic > "Authorization": `@requires: 'authenticated-user'` on the service, `@restrict` on the entity; mock users in `package.json` → `cds.requires.auth.users`; example `srv/catalog-service.cds`; no decision column | fits; first real application. The row gets the example and decision ADR-0013 plus a note that the entity grants cover the draft actions and that UI tests authenticate through `app/<app>/ui5-test-runner.json` (docs-keeper) |
| Hide the standard actions from a read-only user | **no row** | ADR-0013 part 8 decides it and `docs-keeper` adds a new PATTERNS row "Role-aware UI visibility": permission singleton in the service file, `on READ` handler, `UI.*Hidden` with `$edmJson` in `app/<app>/annotations` |
| First handler in the project | Service and logic > "Declarative before imperative" (invariant 6) | exception justified in ADR-0013 part 8: a role check cannot be expressed by an annotation; rule `srv-handlers.md` and `templates/handler.js` govern the file |
| Keep the code list read-only | "Read-only": `@readonly` on the projection | already applied; unchanged |
| Draft actions under authorization | "Drafts" (ADR-0012) | unchanged; verified interaction recorded below |
| Backend tests | Tests > "Service test" (ADR-0002), TESTING rule 5 | fits; TESTING rule 5 is extended with the anonymous idiom and scoped to files that start a server with `cds.test` |
| Contract | Tests > "OData contract" | **the contract changes** (+50 EDMX lines); `npx vitest -u` and the `metadata.xml` regeneration belong to the same phase as each model change |
| UI scenarios | Tests > "User scenario" (OPA5 on `sap.fe.test`, `npm run test:ui` against `npx cds serve --in-memory --port 4004`) | fits; the runner needs credentials, solved by its config file |
| Deployment / `xs-security.json` | Infrastructure > "Deployment": not configured, any deployment work starts with an ADR | out of scope; roles documented for that ADR |

## Verified by experiment (2026-09-07): authorization

Scratchpad copy of `db/`, `srv/`, `_i18n/`, `app/products/annotations*`, `package.json`; the project was not changed. Setup: cds 10.0.6, SQLite in-memory, `cds serve --in-memory --port 4999`. Role names in that run were the unprefixed `Viewer`/`Editor`; the run of 2026-09-10 below repeated the decisive checks with `CatalogViewer`/`CatalogEditor` and reproduced every status code, so the matrix holds with the prefixed names.

Compile and configuration:

| Check | Result |
|---|---|
| `cds compile srv --to json` | ok |
| EDMX before vs after the authorization annotations alone | 0 differing lines: `@requires`/`@restrict` are not part of the EDMX and CAP derives no `Capabilities` from them |
| `cds env requires.auth.users` | defaults merged: `alice` `{ tenant: 't1', roles: [Editor] }`, `bob` likewise, `carol`, `dave`, `erin`, `fred`, `me`, `yves` unchanged, `"*": true`, `viewer` `{ roles: [Viewer] }` |
| `cds compile srv --to xsuaa` | scopes and role templates generated from the CDS role names |

Runtime (HTTP status, `code` of the OData error):

| Request | anonymous | `nobody` (any name, `*`) | `carol` (default `admin`) | Viewer role | Editor `alice` | Editor `bob` |
|---|---|---|---|---|---|---|
| `GET /Products` | 401, `WWW-Authenticate: Basic realm="Users"` | 403 `'403'` | 403 | 200 (count 15) | 200 | 200 |
| `GET /$metadata`, service root | 401 | 200 | | 200 | 200 | |
| `GET /Categories`, `/Currencies` | 401 | 200 | | 200 | 200 | |
| `POST /Products { IsActiveEntity: true, ... }` | | | | 403 | 201, `DELETE ...IsActiveEntity=true` 204 | |
| `POST /Products { name }` (new draft) | | | | 403 | 201; `draftActivate` of the incomplete draft 400 `MULTIPLE_ERRORS`/`ASSERT_MANDATORY`; `DELETE ...IsActiveEntity=false` 204 | |
| `PATCH`/`DELETE /Products(ID,IsActiveEntity=true)` | | | | 403 / 403 | 200 / 204 | 409 `DRAFT_ALREADY_EXISTS` while alice's draft exists |
| `POST .../draftEdit` | | | | 403 `'403'` | 201 | 409 `DRAFT_ALREADY_EXISTS` while alice's draft exists |
| `GET /Products(ID,IsActiveEntity=false)` (alice's draft) | | | | 404 | 200 | |
| `PATCH`, `draftPrepare`, `draftActivate`, `DELETE` on alice's draft | | | | 403 `DRAFT_LOCKED_BY_ANOTHER_USER` | 200 / 200 / 200 / 204 | 403 `DRAFT_LOCKED_BY_ANOTHER_USER` |
| `alice` with a wrong password | | | | | 200 (no password configured, any accepted) | |

Observations: the authorization check for a read-only role fires before the draft lock (plain 403 "Forbidden" on `draftEdit`, `POST`, `PATCH` of active data), whereas requests against a foreign draft fail with the lock error first; `modifiedBy` after activation is `alice`; the seeded rows carry `createdBy: 'anonymous'` from the CSV load. Three `[odata] - 403 - Error: Forbidden` lines appear in the server log per denied request; no other warnings.

`cds.test` (scratchpad `test/auth.test.js`, `test/metadata-noauth.test.js`, 8 tests green): `GET(url, { auth: null })` sends no `Authorization` header and is rejected with `status: 401`, `code: 401` (number), `message: '401 - Unauthorized'`; `POST(..., { auth: { username: 'viewer' } })` is rejected with `status: 403`, `code: '403'` (string), `message: '403 - Forbidden'`, no `target`; `{ auth: { username: 'nobody', password: 'x' } }` is authenticated and gets 403; a `test.get('/odata/v4/catalog/$metadata')` in a file without `defaults.auth` fails with 401 (this is exactly `test/metadata.test.js` today); with a Viewer it answers 200.

## Verified by experiment (2026-09-10): the permission signal for the UI

Same method, fresh scratchpad copy of `db/`, `srv/`, `_i18n/`, `app/products/annotations.cds`, `app/products/annotations/`, `app/products/package.json`, root `package.json`; `node_modules` symlinked; `cds serve --in-memory --port 4999`. The model under test carried the prefixed roles, the `Permissions` singleton, `srv/catalog-service.js` and the three `Hidden` annotations exactly as the plan specifies them. Note on method: `cds.resolve('*')` proved that `app/products/annotations.cds` is the entry that pulls the UI annotations into the model; a copy without that file silently compiles the service without any `@UI.*`.

| Check | Command | Result |
|---|---|---|
| Model compiles with the singleton and the `$edmJson` annotations | `cds compile srv --to json` | ok |
| CDS linter accepts the singleton and the handler | `cds lint .` | no findings |
| Handler is picked up | `cds serve` startup log | `impl: 'srv/catalog-service.js'` |
| Contract delta | `cds compile '*' --to edmx-v4 -s CatalogService -l en` vs the committed `app/products/webapp/localService/metadata.xml` | **+50 lines, 0 removed**: `<Singleton Name="Permissions" .../>` in the container, `<EntityType Name="Permissions">` with `ID` and `isEditor`, the three `Hidden` annotations **twice** (on `CatalogService.Products` and on `CatalogService.EntityContainer/Products`), and `Capabilities.Delete/UpdateRestrictions: false` on the singleton from `@readonly` |
| Rendered annotation | EDMX | `<Annotation Term="UI.CreateHidden"><Not><Path>/CatalogService.EntityContainer/Permissions/isEditor</Path></Not></Annotation>`, likewise `UI.UpdateHidden` and `UI.DeleteHidden` |
| Singleton is served | `GET /odata/v4/catalog/` as a Viewer | `{"name":"Permissions","url":"Permissions","kind":"Singleton"}` in the service document |
| Signal per role | `GET /odata/v4/catalog/Permissions` | `alice` → `{"ID":"me","isEditor":true}`; `bob` → `true`; `viewer` → `false`; `carol` (no catalog role) → `false`; anonymous → **401** |
| Singleton is not writable | `PATCH /Permissions` as `alice` | **405** |
| Drafts unaffected | `draftEdit` on a seeded product | `alice` 201, `viewer` 403, discard `DELETE ...IsActiveEntity=false` 204 |
| Keyless variant | singleton declared as `entity Permissions { isEditor : Boolean; }` | compiles, serves and answers identically, contract delta only +39 lines — but the EDMX then contains a non-abstract `EntityType` without `<Key>`, which OData V4 CSDL does not allow. Rejected in favour of the documented keyed form |

Not verified in this session (no browser tool available to the architect): that SAPUI5/FE V4 actually resolves `/CatalogService.EntityContainer/Permissions/isEditor` and hides the four buttons; how `sap-fe-mockserver` serves a singleton from `mockdata/Permissions.json`; whether Chrome reuses credentials cached from a top-level navigation to `http://alice:@localhost:4004/odata/v4/catalog/` for the XHR challenges of the sandbox page (the `ui-verifier` login recipe in PLAN); whether the Fiori tools proxy on :8080 passes the Basic challenge through (its bundle references `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD`). Each of these is a numbered check in PLAN with a fallback.

`mcp__fiori-mcp__search_docs` answered normally on 2026-09-10 (it was down on 2026-09-07); the CAP recipe itself came from `mcp__cds-mcp__search_docs`.

## Framework facts (from `mcp__cds-mcp__search_docs`, `mcp__fiori-mcp__search_docs` and sources)

- `@requires` "defines which (pseudo-)roles a user must have to access the resource"; "metadata endpoints (`/$metadata` and service root) are restricted by `@requires` by default". Pseudo-roles: `authenticated-user`, `any`, `system-user`, `internal-user`.
- `@restrict`: privileges with `grant` (events: `READ`, `CREATE`, `UPDATE`, `DELETE`, `WRITE`, `*`, action names), `to` (roles), `where` (instance filter); "a request is allowed if at least one privilege is fulfilled". "Combined Restrictions": service-level `@requires` and entity-level `@restrict` must both pass.
- CAP, "Serving SAP Fiori UIs > Role-based Visibility": define an `@odata.singleton @cds.persistence.skip` entity, serve it with `srv.on('READ', ...)` returning `req.user.is(<role>)`, and reference it from `UI.CreateHidden`/`UI.UpdateHidden` with `{ $edmJson: { $Not: { $Path: '/<Service>.EntityContainer/<Singleton>/<flag>' } } }`. The doc also notes a shorter path form `/<Singleton>/<flag>` that "some Fiori clients accept" — the fallback if the long form fails in the browser.
- Fiori elements, "Hiding UI Elements with the UI.Hidden Annotation": `UI.Hidden` with `Path` "must reference a Boolean property"; conditional expression trees need `edmJSON` and "SAPUI5 expression binding is not supported"; "conditional edmJSON expressions apply only to SAP Fiori elements for OData V4". This is why a per-row Boolean cannot answer a toolbar-level question and why the `$edmJson` form is used.
- Fiori elements, "Generic Action Buttons in Object Page Tables": `creatable-path`/`Capabilities.InsertRestrictions` bind Create to "a Boolean property on the root entity", i.e. they always need a bound context — the reason they are not usable for the List Report toolbar.
- Mocked authentication: `cds.requires.auth.kind: 'mocked'` with `users` (`password`, `roles`, `attr`, `tenant`, `features`); "the `*` entry allows all other logins by default".
- `cds add xsuaa` / `cds compile srv --to xsuaa` generate `xs-security.json` scopes and role templates from the CDS roles; re-generate after model changes.
- Draft events in Node.js: `NEW` (`Foo.drafts`), `EDIT` (`Foo`), `PATCH`, `SAVE`, `DISCARD`; the generic authorization maps them onto the entity grants (verified above).

## Rejected mechanisms for the permission signal (with the reason)

- **Virtual / computed element on `Products` filled in an `after READ` handler** (the sketch in the 2026-09-07 plan). Rejected: `UI.CreateHidden` on the List Report is evaluated for the toolbar, where there is no row context, so a per-row Boolean cannot answer "may I create" — and on an empty result set there is no row at all. It would also need the handler to run for the active set, the draft set and every `$expand`, and it would add a property to every row of every response.
- **`Capabilities.InsertRestrictions.Insertable` / `UpdateRestrictions` / `DeleteRestrictions` with a path.** Same context problem (the Fiori doc: "a Boolean property on the root entity"), and CAP already generates `Capabilities` blocks for `@readonly`/drafts, so hand-written ones would collide.
- **Static `UI.*Hidden: true` plus a second app or a manifest variant per role.** Two UIs to maintain, a manifest change, and the role would have to be known at build time.
- **Reading the role in `Component.js` and toggling controls.** Freestyle code inside an FE app, forbidden by ADR-0007/ADR-0005 practice and invisible to the annotation-driven templates.

## Relevant lessons

- Transferred lesson "`cds.test` errors carry `code` and `target`" (rule `tests-backend.md`): for 401 the `code` is the number 401 and there is no `target`; for 403 the `code` is the string `'403'`. Assertions must match these shapes.
- Transferred lesson "OPA5: teardown as the last test; journeys against `cds serve` on :4004, never `cds watch`" (rule `tests-ui.md`, measured 2026-09-10): the new journey ends with a teardown-only case and the run uses `npx cds serve --in-memory --port 4004`.
- Lesson of `products-draft-edit` (PATTERNS "OData contract"): a model change and its `npx vitest -u` plus `metadata.xml` regeneration belong to the same phase, otherwise the sync test in `test/metadata.test.js` is red at the gate.
- Architect memory `cds10-draft-behavior` and ADR-0012: active data is addressed with `IsActiveEntity=true`; the lock test uses `bob`, who must remain an Editor.
- Architect memory `fe-v4-semantic-key-marker`: measured EDMX deltas belong in the plan, and browser-level claims that the architect cannot measure are predictions, to be corrected at their source by `docs-keeper` if the verifier measures otherwise.

## Screens (if there is a UI)

Author: `ux-designer`, 2026-09-10 (phase 1, step 2). Answers the five numbered items of the architect's scope brief, which were: (1) the resulting empty states of the List Report toolbar and the Object Page header, (2) whether the Object Page still reads sensibly for a viewer, (3) whether any `en`/`ru` key is needed, (4) verifier scenarios, (5) the development login note.

**Not reopened here:** hide versus disable. The user decided **hide** on 2026-09-10 (decision 6), the signal is the `Permissions` singleton, and this section takes that as given.

### 0. Floorplan and duplication check

`docs/registry/UI-ARTIFACTS.md` lists exactly two pages in `app/products`: `ProductsList` (`sap.fe.templates.ListReport`, `variantManagement: "Page"`, `initialLoad: true`) and `ProductsObjectPage` (`sap.fe.templates.ObjectPage`, `editableHeaderContent: false`); "Extensions and fragments: _none_". This feature adds **no screen**. It changes the *visible action set* of the two existing ones, so there is nothing to duplicate.

The floorplan stays List Report + Object Page. A read-only role is not a reason for a second page, a Worklist or a freestyle display app: the user task ("find a product, read its data") is identical for both roles, only the affordances differ. One screen, one task, held.

### 1. What the viewer's List Report actually looks like

Baseline as measured in this repository (not assumed):

| Region | Content today | Source |
|---|---|---|
| Page header | app/page title, variant management (page-level, `variantManagement: "Page"`), Share, FLP shell items | `app/products/webapp/manifest.json`, `docs/registry/UI-ARTIFACTS.md` |
| Filter bar | `Product Name`, `Category`, `Price` (from `UI.SelectionFields`), the framework's **Editing Status** filter with exactly 6 options (All, All (Hiding Drafts), Unchanged, Own Draft, Locked by Another User, Unsaved Changes by Another User), Adapt Filters, **Go** (`initialLoad: true`; the Go button is recorded debt in STATE) | `app/products/annotations/Products.cds`; `docs/features/products-draft-edit/VERIFICATION.md` scenario 4 |
| Table | grid header `Selection, Product Name, Category, Price, Stock Quantity, Row Actions` — 4 `UI.LineItem` columns plus the two framework columns; count badge `Products (15)`; draft/lock `ObjectMarker` inside the `Product Name` cell | `docs/features/products-draft-marker/VERIFICATION.md` scenario 1 |
| Table toolbar | table title with count on the left; on the right the FE-generic action group (Create, Delete) plus the framework's own personalization/settings, and export if this FE version renders it by default | Create/Delete: PLAN steps 9/11 and `products-draft-edit/VERIFICATION.md` scenario 5. The full right-hand inventory is **not recorded in any `VERIFICATION.md`** — see the verifier item V1 |

`app/products/annotations/Products.cds` contains **no `UI.DataFieldForAction` and no `UI.Identification`**, so the whole action group of the toolbar is FE-generic. Hiding Create and Delete therefore removes the entire *application* action set — there is no app-specific button left behind and none missing.

**Verdict: acceptable as a deliberate design, no compensation needed.** The toolbar does not become empty. The left side keeps the table title with the row count (`Products (15)`), which is what makes the strip read as a table header rather than as a stripped-down editor; the right side keeps the framework's personalization (columns, sort, group, filter — `flexEnabled: true`) and export if present. Above it, the filter bar, variant management and Go are untouched: a viewer's List Report is a complete "find and inspect" screen, which is exactly the read-only List Report pattern.

Two things must be *measured*, because they are the only ways this could still read as broken; both become verifier items rather than design changes:

- **An empty right-hand action group.** If FE renders a toolbar separator or a zero-width action container where Create/Delete used to be, the strip looks truncated. V1.
- **The row-selection column with nothing to apply.** Delete is the only action in this app that needs a selection. If FE keeps the `Selection` checkbox column and the "n selected" state for a viewer, the user is offered a gesture that leads nowhere. FE derives the table's `selectionMode` from the actions that require a context, so the column may well disappear on its own; that is a prediction, not a fact. V3. If the column survives and does nothing, record it as an observation — `selectionMode` is not expressible per role declaratively, so there is no fix inside this feature and it must not be forced with a manifest setting or an extension.

**The Editing Status filter stays, and that is the right call.** It comes from `@odata.draft.enabled`, not from any `UI.*Hidden`, and there is no annotation or role-scoped manifest setting that could remove it. Item 1 of the brief asks whether "Own Draft" promises editing and then fails: it does not fail — it filters and returns an empty table with the standard illustrated no-data message, which is honest behaviour for a filter, not an error. Two of its options are genuinely useful to a viewer (`Locked by Another User`, `Unsaved Changes by Another User` explain why a row's data may be mid-change and who is changing it), one (`Own Draft`) can only ever return zero rows for them. Net: keep, do not attempt to hide, and record it as a known cosmetic imperfection with a verifier check (V4).

**Empty state.** With no filter set the table shows 15 rows, so the empty state is only reachable through a filter. The standard FE illustrated message applies. One concrete risk: some FE versions phrase the no-data text of a *creatable* table as an invitation to create an object. A viewer seeing "…create a new object" with no Create button would be the one genuinely broken-looking state in this feature. `UI.CreateHidden` may or may not switch that text. Measure the exact string in V4; if it does invite creating, that is an FE-behaviour finding for `architect`, not a text the designer overrides here.

**Error state.** After the four actions are gone, no visible affordance on the List Report can produce a 403 any more: read paths are all allowed for `CatalogViewer` (CONTEXT experiment matrix), and every write path lost its button. The remaining routes into a 403/404 are non-UI ones (deep links, a hand-built URL) — covered by V9.

### 2. The Object Page as a pure display page

Baseline: header from `UI.HeaderInfo` (Title `name`, Description `category_code` rendered as the category *name* via `Common.Text` + `#TextOnly`, ImageUrl `imageUrl`), `editableHeaderContent: false`, three facets `General Information` / `Pricing & Stock` / `Administrative Data`. Header actions in display mode today: **Edit, Delete, Share**, plus the framework's `Draft` / `Locked` state button when a draft exists (`products-draft-edit/VERIFICATION.md` scenarios 1 and 6). Note that `categories-code-list/VERIFICATION.md` line 36 says "no Edit button, only Delete and Share" — that is the pre-draft state from 2026-09-07 and is **obsolete** since ADR-0012; do not reuse it as current state.

**Verdict: yes, it still reads sensibly, and it needs no change.** After hiding Update and Delete, the header keeps the object title, the image, the description and Share, plus the draft/lock state button when relevant. Title + image + three field-group tabs is the textbook display-only Object Page.

Point by point:

- **Header.** Not empty (Share survives, and `Share` is the only action a viewer legitimately has). `editableHeaderContent: false` means the header was never editable, so nothing in it loses a function. The breadcrumb region renders without links — pre-existing and unrelated (`products-draft-marker/VERIFICATION.md` scenario 2).
- **Facets.** All three are `UI.ReferenceFacet` → `UI.FieldGroup`; none of them contains an action, so no facet becomes empty or orphaned. In display mode the `@mandatory` markers of `name`, `category`, `price`, `currency`, `stock` are not rendered at all (they appeared only in edit/create mode: 5 required markers, `products-draft-edit/VERIFICATION.md` scenario 5), so nothing implies input the viewer cannot give.
- **Administrative Data.** Keep it, and keep it visible to viewers — it is the most valuable facet in this feature. `createdBy` / `modifiedBy` name the people who maintain the catalog and thereby give the viewer the only in-app answer to "who *can* change this". Two caveats to record, both out of scope: the seeded rows carry `createdBy: 'anonymous'` from the CSV load (CONTEXT), which reads oddly next to real names, and the values are raw user IDs with no `TextArrangement` target to expand into a display name (there is no user entity in the model — nothing to point `Common.Text` at, so a UUID/ID-to-name substitution is impossible here and must not be faked).
- **What now looks orphaned or implies an unavailable action.** Only one thing, and it is informative rather than actionable: the `Locked` state button and its popover ("This object is being edited by bob. Last changed on …") remain visible to a viewer. It correctly explains the object's state and invites the wrong inference ("so when bob is done, can I edit?"). It cannot be role-scoped declaratively. Keep it; recorded as risk R1's smaller sibling.
- **Footer.** Save / Discard exist only in edit mode, which a viewer cannot enter, so the footer should not render at all. This must be checked rather than assumed: the Fiori documentation for `UI.Hidden` states explicitly that "hiding actions in footer does not remove footer if backend-bound messages must be shown" ("Hiding UI Elements with the UI.Hidden Annotation", step 8). An empty footer toolbar on a display-only page would be the visible defect. V5.
- **Navigation is unaffected.** `UI.CreateHidden` / `UpdateHidden` / `DeleteHidden` govern Create, Update and Delete only, so the `Row Actions` navigation column and row click keep working for a viewer, which is the whole point of the page.

### 3. Texts: no new i18n key — confirmed

The plan's expectation holds. **No `en`/`ru` key is added by this feature, and that is a deliberate confirmation, not an omission.** Reasons, each traceable:

1. A hidden button renders nothing, so it needs no label. `UI.CreateHidden` / `UpdateHidden` / `DeleteHidden` remove FE's own generic buttons, whose labels ship in `sap/fe/**/messagebundle*.properties` anyway.
2. `CatalogService.Permissions` appears in no `UI.*` annotation, in no `LineItem`, `SelectionFields`, `Facets` or `HeaderInfo`. It is never rendered, so it needs no `@title` and no label. The plan already keeps its `@title` out of `srv/annotations/`.
3. Everything a viewer still sees is either an existing project key (`_i18n/i18n*.properties`, `Products.*` labels and the three facet titles) or a framework text that ships translated. Rule `.claude/rules/i18n.md` states this, and it is proven for `ru` in this app: the Editing Status option labels, the column headers, the `sap.m.ObjectMarker` texts behind the keys `OM_DRAFT` and `OM_LOCKED_BY`, and the Object Page header actions all rendered in translated Russian with **no `[key]` placeholders** (measured in `products-draft-marker/VERIFICATION.md` scenario 4 and in the `ru` section of `products-draft-edit/VERIFICATION.md`, where the actual strings are quoted). The illustrated no-data message is likewise an FE framework text.
4. The failure texts need nothing: 401 has no body (the browser owns the Basic dialog UI), 403 uses CAP's generic "Forbidden" plus FE's own error dialog, and after the hiding no visible affordance produces either.

So invariant 7 is satisfied by adding zero keys in both languages.

**What would refute this** (hand these two triggers to `ui-verifier` and `docs-keeper`): (a) V4 finds an FE no-data text that invites creating an object — then the fix is an FE-behaviour question for `architect`, still not a new project key; (b) the user approves the read-only hint of R1 — then a key *is* needed. In that single case, do not invent it later, use:

The two bundle lines below are quoted verbatim as they would be written; the Russian one is an `i18n_ru.properties` value, which is the one place invariant 10 permits non-English text (rule `.claude/rules/i18n.md`), and it is quoted here only because item 3 of the design scope asks for both languages in the same change.

```properties
# app/products/webapp/i18n/i18n.properties and i18n_en.properties
#XMSG: shown to a user who may only read the catalog
products.list.readOnlyHint=You have display-only access to the catalog.

# app/products/webapp/i18n/i18n_ru.properties
products.list.readOnlyHint=У вас доступ к каталогу только для просмотра.
```

and add it to all three bundles that exist in this app (`app/products/webapp/i18n/i18n.properties`, `i18n_en.properties`, `i18n_ru.properties`) — the UI5 guidelines require every new key in all relevant locales. This is written down for completeness only; the recommendation in R1 is **not** to add it in this feature, because FE V4 offers no annotation-driven place for a page-level hint and it would require the project's first controller extension or custom fragment plus a manifest change, i.e. its own ADR.

### 4. Verifier scenarios (design-level, in addition to the PLAN criteria)

Rules for the whole set: take each A/B pair (V1/V2, V5/V6) at the **same viewport and the same crop**, so the only difference in the two images is the buttons. Do the editor run and the viewer run in the same session where possible, because the editor images are also the evidence for risk R6 (the `$edmJson` path failing and hiding the actions for everyone).

| # | Screen region to screenshot | Correct for `viewer` | Correct for `alice` (Editor) |
|---|---|---|---|
| V1 | List Report **table toolbar**, full strip, no row selected. Also enumerate every button in the strip in text (a11y snapshot), not only the image | `Products (15)` title with the count on the left; on the right only framework personalization/settings (and export if this version renders it); **no Create**; no toolbar separator followed by nothing; no zero-width action container | identical plus **Create** |
| V2 | Same crop as V1 | — | Create present; used as the A/B counterpart and as the R6 evidence |
| V3 | List Report table toolbar **with one row selected, then two rows** | **No Delete appears** at either selection count. Record whether the `Selection` checkbox column is rendered at all and whether an "n selected" indicator appears with no action to apply (observation, not a pass/fail) | Delete appears on selection |
| V4 | Filter bar with **Editing Status = Own Draft**, then Go | 0 rows, the standard illustrated no-data message, **no error dialog, no console error**. Record the **exact no-data text** and confirm it does not invite creating an object | 0 or 1 rows depending on drafts; text irrelevant |
| V5 | Object Page **header area** of a product without a draft, plus the **bottom of the page** | Title, image, description; Share present; **no Edit, no Delete**; **no empty footer toolbar** at the bottom | Edit and Delete present |
| V6 | Same crop as V5 | — | Edit and Delete present (A/B counterpart, R6 evidence) |
| V7 | Object Page, all three facets opened | Three tabs render; every field display-only; **no required-field asterisks**; Administrative Data shows `createdAt/createdBy/modifiedAt/modifiedBy` (record the values — seeded rows show `anonymous`) | same, plus Edit reachable |
| V8 | Object Page of a product locked by `bob` (create the lock with `curl -u bob:` as in the earlier verifications) | The `Locked` state button and its popover **still appear** (informative), and there is **still no Edit** — hiding wins over the lock indicator, so no dead Edit that then errors | Edit present and pressing it yields the clean "locked by bob" dialog (already verified in `products-draft-edit`) |
| V9 | Deep link as a viewer straight into a draft/edit route, e.g. `#/Products(ID=<id>,IsActiveEntity=false)` | FE shows a clean error or not-found; **no unhandled console exception**; record the exact dialog text. This is the "can a 403 still be reached" half of brief item 3 | n/a |
| V10 | Keyboard only, viewer: Tab from the filter bar through the toolbar into the table; on the Object Page Tab through the header | **No invisible or disabled tab stop where Create/Edit/Delete used to be**; focus order reads filter bar → variant/settings → table; on the Object Page focus lands on Share and the section tabs, never on a hidden action | n/a |
| V11 | `?sap-ui-language=ru` as viewer: List Report toolbar and Object Page header | **No `[key]` placeholders anywhere**; the four actions absent here too; Editing Status options and column headers translated | n/a |
| V12 | `npm run start-mock` (mock mode, no backend, no roles) | n/a | Create, Delete and Edit **present** — this is what proves `mockdata/Permissions.json` is served |
| V13 | Anonymous / Escape, see item 5 below | Shell renders, FE error dialog, empty list; record the exact dialog text and whether a reload with credentials recovers the app | n/a |

Suggested screenshot names, so the file set is self-explanatory in `VERIFICATION.md`: `viewer-lr-toolbar.png`, `editor-lr-toolbar.png`, `viewer-lr-row-selected.png`, `viewer-lr-nodata-owndraft.png`, `viewer-op-header.png`, `editor-op-header.png`, `viewer-op-locked.png`, `viewer-lr-toolbar-ru.png`.

### 5. The development login note

**No login screen is built, and none should be built.** Development authentication is the browser's own Basic dialog, raised by the CAP server on :4004 at the first OData request; the FLP sandbox itself does not authenticate.

How it reads to a developer opening the app: the shell paints first (it needs no authentication), then the first `$metadata` / `$batch` request triggers a **native browser dialog** titled by origin (`localhost:4004`), realm "Users". It carries no product branding, no i18n (the browser owns that UI, nothing in the app can style or translate it) and, crucially, **no hint of which user names exist**. Nothing on screen says `alice` or `viewer`.

The design consequence is therefore a documentation one, and it is already assigned: `README.md` (run modes) and `docs/architecture/ARCHITECTURE.md` ("Authentication in development" plus the Roles table) are the only places a developer can learn the credentials, per PLAN step 15. Recommended wording to include there: the user names `alice` / `bob` (`CatalogEditor`) and `viewer` (`CatalogViewer`), and the explicit sentence that **the password field may be left empty** — mocked users without a configured password accept any password (verified in CONTEXT), which is not guessable from the dialog.

**The anonymous / Escape state should be named in this design section, precisely so that no later agent "fixes" it.** Pressing Escape or Cancel dismisses the challenge after the shell has already rendered, leaving the developer inside the app with an FE error dialog and an empty table (the plan documents this). It is a poor state and it is **accepted as-is for development**: FE V4 has no annotation and no manifest setting for an unauthenticated session, the sandbox performs no authentication, and building a custom 401 handler would mean the project's first controller extension for a developer-only situation. Do not add one. Document it, and let V13 record the exact dialog text plus whether a plain reload with credentials recovers the app or whether the browser caches the refusal and needs a fresh instance.

One further developer trap belongs in the same README sentence, because it produces a *different and more confusing* screen than `viewer`: with `"*": true` still in place, a typo in the user name authenticates a role-less user, who then gets 403 on `Products` while `Categories` succeeds — i.e. the viewer-like UI **plus** an error on the product request. It is already a PLAN risk row; V13 should note it if it occurs.

### UX risks of the chosen approach

The decision itself is not reopened; these are recorded so the reviewer, `docs-keeper` and the user see them.

| # | Risk | Detection | Position / smallest mitigation |
|---|---|---|---|
| R1 | **A viewer gets no explanation for the absent actions.** Nothing on screen distinguishes "the catalog is read-only for everyone", "I personally lack the role" and "the app is broken". The rejected alternatives trade this for a different confusion (a disabled button with no reason, or a 403 dialog after the user has already invested effort), so hiding is not the wrong call — but the gap is real and is invisible to every in-app signal | Not detectable in the app; only by asking a user | **Documentation only, and it is already planned**: the `ARCHITECTURE.md` Roles table plus one README sentence naming which mock user sees which action set. Cost: zero code, zero keys, and the audience of this app today is developers, who read that file. **Recommended.** Explicitly rejected as disproportionate: a read-only message strip on the List Report — FE V4 has no annotation for a page-level hint, so it needs the project's first controller extension or custom fragment, a manifest change and a new i18n key, hence its own ADR. If the user wants an in-app signal anyway, that is a separate feature, not a line in this one |
| R2 | The `Editing Status` filter offers `Own Draft` to someone who can never own a draft: always 0 rows | V4 | Accepted. No annotation can scope that filter by role; the behaviour is honest (filter → empty result), not an error |
| R3 | Orphaned row selection: a `Selection` checkbox column and an "n selected" state with no action to apply | V3 | Measure. If it survives, record as an observation; `selectionMode` is not role-scopable declaratively and must not be forced through a manifest setting or an extension in this feature |
| R4 | An FE no-data text that invites creating an object while Create is hidden | V4, exact string recorded | If it happens it is an FE-behaviour finding for `architect`, not a text this app overrides |
| R5 | An empty footer toolbar renders on the viewer's Object Page — the `UI.Hidden` documentation warns that hiding actions does not necessarily remove a footer | V5 | Measure. A visible empty footer would be the one real defect of the hiding approach |
| R6 | The `$edmJson` path fails to resolve and the four actions disappear for **editors** too, so the app silently looks read-only to everybody with no error anywhere | V2 and V6 (the editor A/B screenshots) plus the OPA journey case 1 | Already a PLAN risk with a documented fallback path. Design consequence: the editor screenshots are primary evidence, not a nice-to-have, and must be taken in the same session as the viewer ones |
| R7 | Consistency: the same app shows different action sets to different people | — | Not an accessibility violation. WCAG 3.2.3 Consistent Navigation applies within a set of pages for one user, not across permission levels. Designer judgement, no documentation source cited |

### Accessibility

Checked against the `ui5-best-practices-accessibility` skill (plugin `ui5` 0.1.8), all eight topics. That skill reviews `*.view.xml`, `*.fragment.xml` and `*.controller.js`; this app owns none of those (`docs/registry/UI-ARTIFACTS.md`: "Extensions and fragments: _none_") and this feature authors no control, so topics 1 (landmarks), 2 (labeling), 3 (heading levels), 5 (keyboard shortcuts), 6 (invisible messaging), 7 (reading order) and 8 (target size) have no application-owned surface here — everything visible is framework-rendered from annotations.

Topic 4 (focus and keyboard) has the one feature-specific consequence: a hidden action must not leave a tab stop behind, and the reading order of the toolbar and of the Object Page header must stay continuous once buttons are removed. That is verifier item **V10**, for both screens. Nothing this feature does adds an `InvisibleMessage`-worthy dynamic state change: the permission is evaluated once at load, it never changes during a session, so there is nothing to announce.

Note the permanent gap in the pinned `fiori-mcp` documentation set: it contains **no accessibility document for the List Report or the Object Page** (queries return grouping, ALP table-type or OData V2 adaptation documents instead), so there is no Fiori-docs URL to cite for this verdict. It rests on the skill checklist plus measurement in V10.

### Theme and tokens

Standard controls and `sap_horizon` only. `manifest.json` keeps `"resources": { "css": [] }` — nothing in this feature needs a custom colour, a custom class or a control. `mcp__ui5-mcp-server__get_guidelines` was consulted and its relevant rules are already satisfied (data binding for everything, no inline script, no global `sap.*`, every new key in all locales — and there are no new keys). No `@Common.Criticality` is introduced: the caller's permission is not a data status of a product and must not be rendered as a coloured state on a row or in a header.

### Explicitly not part of this design

No new screen, page, facet, section, column, filter field, criticality annotation, i18n key, `manifest.json` change, controller extension or fragment. The whole UI change is the three `UI.*Hidden` annotations of ADR-0013 part 8, plus documentation.

### Guidelines and sources actually used

| Source | What it supported | Gap |
|---|---|---|
| `mcp__fiori-mcp__search_docs` "list report toolbar actions" → "Actions in the List Report (Fiori Elements)" (`adding-actions-to-tables-b623e0b.md`, `adding-custom-actions-using-extension-points-7619517.md`) | Toolbar actions serve the whole report or the selected rows; generic Create/Delete come from the entity set, app-specific ones must be annotated — confirms this app's action group is entirely FE-generic | The snapshot has **no inventory of what remains in the toolbar** and **no empty-state guidance**. The toolbar residue is therefore a measurement (V1), not a quotation |
| `search_docs` "UI.Hidden hiding UI elements annotation" → "Hiding UI Elements with the UI.Hidden Annotation" | `Path` must reference a Boolean property; expression trees need `edmJSON`; conditional `edmJSON` is OData V4 only. Step 8: **"Hiding actions in footer does not remove footer if backend-bound messages must be shown"** → risk R5 and item V5 | — |
| `search_docs` "object page header actions edit delete" → "Action Control for Context-Dependent Actions" | The framework's own precedent for header-level actions: when the availability condition is false the action is **hidden** at page-header level and only *disabled* for a header button inside a table. This is consistent with the user's hide decision. The same document warns "do not rely on `UI.Hidden` for `DataFieldForAction` in page headers" — my reading is that this concerns *custom* actions that already have an applicable path, not `UI.UpdateHidden`/`DeleteHidden` on the entity, so it does not contradict ADR-0013; flagged as my reading, not a quotation | — |
| `search_docs` "object page header actions edit delete" → "Defining Determining Actions for Object Page Footer" | Footer actions exist only in edit mode, so a display-only page should have no footer → item V5 | — |
| `search_docs` "role based visibility hiding actions read-only user" | **Nothing useful**: returned OVP key-user adaptation, the MessageButton building block, `requireAppAuthorization` for OVP cards and OData V2 feature toggles. Recorded as an unproductive query rather than paraphrased | |
| `search_docs` "CreateHidden DeleteHidden UpdateHidden standard action visibility" | **No document for `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` themselves** in the snapshot; returned the `creatable-path`/`deletable-path` document ("a Boolean property on the root entity" — the same context limitation already recorded above in "Rejected mechanisms"), the `UI.Hidden` document again and the `onBefore*` extension guide. The authority for the mechanism therefore remains the CAP recipe "Serving SAP Fiori UIs > Role-based Visibility" that `architect` retrieved through `mcp__cds-mcp__search_docs` | |
| `mcp__ui5-mcp-server__get_guidelines` | No custom CSS, no globals, data binding, every key in all locales, CAP integration rules | It is a **coding** guidelines document: it says nothing about removing versus disabling actions or about read-only floorplans. Together with the row above this means **no `search_docs` URL states "hide instead of disable" as a design rule**; the only supporting framework precedent is the Action Control document, and the decision itself rests on user decision 6 and ADR-0013 |
| `ui5-best-practices-accessibility` skill (plugin `ui5` 0.1.8), eight topics | The accessibility verdict above; only topic 4 applies | `fiori-mcp` has no List Report / Object Page accessibility document, so no URL can be cited |
| Repository measurements: `docs/features/products-draft-marker/VERIFICATION.md` (grid columns, `ru` texts), `docs/features/products-draft-edit/VERIFICATION.md` (Object Page header Edit/Delete/Share, the six Editing Status options, create mode required markers, lock popover), `app/products/webapp/manifest.json`, `app/products/annotations/Products.cds`, `docs/registry/UI-ARTIFACTS.md`, `docs/STATE.md` | The whole "baseline" table of item 1 and the header inventory of item 2 | `docs/features/categories-code-list/VERIFICATION.md` was checked as instructed, and its line "no Edit button, only Delete and Share" is the **pre-draft state of 2026-09-07 and obsolete since ADR-0012** — it must not be reused as the current baseline |

`mcp__fiori-mcp__search_docs` answered every query in this session (no outage, unlike 2026-09-07).

### Design open questions for the user

1. **The unexplained absence (R1).** Accept the documentation-only mitigation (Roles table in `ARCHITECTURE.md` + one README sentence, already in PLAN step 15), or should an in-app read-only hint be scoped as a separate follow-up feature? The hint cannot be built declaratively — it needs the project's first FE controller extension or custom fragment, a manifest change and one new key in three bundles, so it wants its own ADR. Recommendation: documentation only now.
2. **Nothing else requires a decision from the user in this section.** The remaining uncertainties (toolbar residue, selection column, no-data text, footer) are measurements assigned to `ui-verifier` as V1, V3, V4 and V5, with a defined "correct" for each; only R5 (an empty footer) would be a defect, and it has a fallback owner in `architect` per the PLAN risk table.

## Open questions

None are open. The nine questions of the 2026-09-07 draft were decided by the user on 2026-09-10 (PLAN, "Decisions taken by the user"). The two the plan carried into the approval gate were answered the same day and are recorded in PLAN, "Open questions for the user": the OPA5 suite runs once as `alice` and the viewer's hidden state is proven by the backend tests plus blocking `ui-verifier` criteria; the role names `CatalogViewer`/`CatalogEditor` are final, with no subaccount prefix to honour.

The one item still addressed to the user is design question R1 above (the unexplained absence of the actions for a viewer). Its recommended answer — documentation only, via the `ARCHITECTURE.md` Roles table and one README sentence — is already what PLAN step 15 does, so it blocks nothing; an in-app read-only hint would be a separate feature with its own ADR.
