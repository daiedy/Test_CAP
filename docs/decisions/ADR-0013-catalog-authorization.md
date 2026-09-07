# ADR-0013: Authorization of `CatalogService` with the roles `Viewer` and `Editor`

Date: 2026-09-07. Status: proposed (feature `catalog-authorization`; decision by the user pending).

## Context

`CatalogService` is open: no `@requires`, no `@restrict`, mocked authentication accepts anonymous requests, and every client may read and write `Products` (`docs/registry/SERVICES.md`). With ADR-0012 the service is draft-enabled, so users matter: draft locks are per user (`InProcessByUser`), `createdBy`/`modifiedBy` are audit fields, and the Fiori app is used by people with different responsibilities. `PATTERNS.md` has a row "Authorization" that fixes *how* to protect a service (`@requires: 'authenticated-user'` on the service, `@restrict` on the entity, mock users in `package.json` → `cds.requires.auth.users`) but not *which* roles exist, how they are named, what anonymous requests get, how the development users are mapped, how the browser-based tests and the verifier authenticate, and what happens with `xs-security.json`. `CONVENTIONS.md` section 2 lists "restrict" among the annotations that live in `srv/annotations/`, contradicting the pattern row, the rule `srv-services.md` and `templates/service.cds`.

Facts established for the decision (`docs/features/catalog-authorization/CONTEXT.md`, "Verified by experiment", cds 10.0.6):

- `@requires: 'authenticated-user'` makes `$metadata`, the service document and all entity sets answer 401 with `WWW-Authenticate: Basic realm="Users"` to anonymous requests; the mocked strategy allows anonymous access until an annotation demands a user (`lib/srv/middlewares/auth/basic-auth.js`).
- `@restrict` on the draft-enabled projection covers the draft events: a user with only `READ` gets 403 on `POST` (active and draft), `PATCH`, `DELETE` and `draftEdit`; a user with `*` runs `draftEdit`, `PATCH`, `draftPrepare`, `draftActivate`, discard; the lock between two writers still answers 409 `DRAFT_ALREADY_EXISTS`; a foreign draft answers 403 `DRAFT_LOCKED_BY_ANOTHER_USER` or 404 on read.
- `cds.requires.auth.users` in `package.json` deep-merges with the default mock users: the eight default users and `"*": true` stay, `roles` arrays are replaced per user. Users without `password` accept any password; `*` accepts any unknown name as an authenticated user without roles.
- The EDMX is identical before and after the annotations; CAP derives no `Capabilities` from `@restrict`, so Fiori elements cannot hide actions per role.
- `cds compile srv --to xsuaa` generates scopes `$XSAPPNAME.Viewer`, `$XSAPPNAME.Editor` and role templates `Viewer`, `Editor` from the model.
- `cds.test`: `{ auth: null }` sends an anonymous request (error `status: 401`, `code: 401`); a denied role gives `status: 403`, `code: '403'`; a test file without `defaults.auth` (today `test/metadata.test.js`) fails with 401 once `@requires` is set.
- `ui5-test-runner` 5.14.0 authenticates the headless browser with `--basic-auth-username`/`--basic-auth-password`, which are browser-script options placed after `--` or in `ui5-test-runner.json` under `browserArgs`.

## Decision

1. **Authentication is required for the whole service.** `@requires: 'authenticated-user'` on `CatalogService`. Anonymous requests get CAP's default 401 with a Basic challenge; no `@requires: 'any'` public read, no custom middleware, no change to `cds.requires.auth.restrict_all_services`.
2. **Two business roles.** `Viewer` may read `Products`; `Editor` may do everything on `Products`, including the draft actions: `@restrict: [{ grant: 'READ', to: 'Viewer' }, { grant: '*', to: 'Editor' }]`. Code lists (`Categories`, autoexposed `Currencies` and text tables) and `$metadata` are readable by any authenticated user, because both roles need them as value help and they hold no sensitive data. No instance-based `where` rules; no `admin` role: the code lists are maintained via CSV (ADR-0010).
3. **Role names.** Roles are PascalCase singular nouns that name a capability (`Viewer`, `Editor`), like `OrdersAdmin` in `templates/service.cds` and `Vendor`/`Admin` in the CAP documentation. They become the XSUAA scope and role-template names, so they are unique per application; a prefix (`CatalogViewer`) is introduced only when a second service with its own audience appears.
4. **Placement.** `@requires` on the service and `@restrict` inline on the projection in `srv/catalog-service.cds`, in the same style as `@readonly` and `@odata.draft.enabled` (PATTERNS "Authorization", rule `srv-services.md`, `templates/service.cds`). Authorization is service semantics shared by all clients but tied to the service, not to the data model; `srv/annotations/<Entity>.cds` stays for `@title`, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.*`. `CONVENTIONS.md` section 2 is corrected accordingly. A separate `srv/catalog-service-auth.cds` (CAP "Separation of Concerns") is not introduced while the service has one file and two projections.
5. **Development users.** Top-level `cds.requires.auth.users` in `package.json`: `alice` and `bob` with `roles: ['Editor']`, a new user `viewer` with `roles: ['Viewer']`, all without password. The default users and `"*": true` remain (a user with an unknown name is authenticated without roles and gets 403 on `Products`); no `[development]` profile block, because mocked auth is already the non-production default and `production` uses `jwt`. `alice` stays the default test user, `bob` the second Editor of the draft lock test, `viewer` and the default `carol` (role `admin`, unknown to the model) serve the negative tests.
6. **Tests.** Every backend test file sets `defaults.auth = { username: 'alice' }` (including `test/metadata.test.js`). Anonymous requests are sent with `{ auth: null }` and asserted with `status` 401 (numeric `code`); denied roles with `rejectedWith(/403/)` and `code: '403'`; each role case is its own `it`. No `Authorization` header is built by hand.
7. **Browser clients in development.** The Fiori app is served by CAP and authenticates through the browser's Basic prompt (user `alice` or `viewer`, empty password). The OPA5 journeys authenticate through `app/products/ui5-test-runner.json` (`browserArgs: ["--basic-auth-username", "alice"]`); `scripts.test:ui` and the CI job are unchanged. The mock server (`npm run start-mock`) stays without authentication. No `Authorization` header in `manifest.json`, the sandbox or a `server.js`, and no `dummy` auth profile.
8. **Fiori elements stays role-agnostic in this feature.** A Viewer sees Create, Edit and Delete and receives FE's standard error message on 403. Role-aware hiding needs a computed element filled from `req.user` plus `UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` and is a follow-up feature with its own plan (imperative, ADR-0004 layering to be decided).
9. **`xs-security.json` is not touched.** The roles are documented in `docs/architecture/ARCHITECTURE.md` now (rule `deploy.md`); the descriptor is regenerated with `cds add xsuaa --for production` in the deployment ADR, which also defines role collections in `mta.yaml`.

## Alternatives

| Option | Why rejected |
|---|---|
| `authenticated-user` may read, `Editor` may write (one business role) | Simpler, but every authenticated identity would read the catalog; with XSUAA that means anyone with the app's token, which makes "read access" impossible to assign or revoke. `Viewer` costs one word and one mock user |
| One `Admin` role for everything, no `Viewer` | Same objection; the requirement is read-only consumers plus maintainers |
| `@requires: 'any'` on the service with `@restrict` only for writes (public read) | Contradicts the request (anonymous must fail); public metadata and data on a catalog that will be deployed behind XSUAA is not wanted |
| `@restrict` in `srv/annotations/Products.cds` (CONVENTIONS wording) | `@requires` is a service annotation and cannot live in an entity file; two of three sources and the template say service file; the authorization would be split over files. The wording in CONVENTIONS is fixed instead |
| Separate `srv/catalog-service-auth.cds` (CAP best practice) | Justified when security has a different owner or lifecycle; here one architect and two projections. Revisit when the service grows |
| Prefixed role names `CatalogViewer`/`CatalogEditor` | Future-proof for several services, but longer and not needed for one service; renaming before deployment costs nothing, after role collections exist it costs a migration. Offered to the user as an option |
| Restrict `Categories` (and new explicit projections of `Currencies`) to `Viewer`/`Editor` | Two extra projections for autoexposed code lists, no protection gain (public ISO codes and six category names); FE value helps of both roles need them |
| `"*": false` (only listed mock users may log in) | Tighter, but deviates from the documented default without gain: unknown users have no roles and get 403 on `Products`; developers can type any name in the prompt to test "no role". Offered as an option |
| Mock users under `"[development]": { "kind": "mocked", ... }` | Documented form, but the pattern row names the top-level key, `cds env` already resolves `mocked` in development, and `users` is ignored under `jwt` |
| Passwords for mock users | Nothing to protect in development; every test option and the browser prompt would need the password |
| `--basic-auth-username alice` appended to `scripts.test:ui` after `--` | Works locally, but CI appends `--report-dir` with `npm run test:ui -- ...`, which would land after `--` as a browser argument and break the run; the config file keeps runner and browser options apart |
| `Authorization` header in `manifest.json` model settings or in the sandbox | Credentials in shipped UI code; breaks with real authentication; hides the 401 from developers |
| `dummy` auth in a UI profile | All users privileged, no roles: the feature could not be seen in the UI |
| A dev-only `server.js` injecting `Authorization` for missing headers | Custom code in `srv/` outside every pattern; defeats the anonymous test; would run under `cds.test` too |
| Role-aware UI now (`UI.*Hidden` bound to a computed `canEdit` filled in an `after READ` handler, or a singleton) | Needs the first handler of the project and a UX decision on hidden versus disabled actions; the backend enforcement is independent of it. Follow-up |
| Instance-based rules (`where: (createdBy = $user)`) | No requirement; catalog data is shared |
| `cds add xsuaa` now | Protected file, deployment not configured (STATE debt, separate ADR); the generated content is recorded in CONTEXT |

## Consequences

- `srv/catalog-service.cds` gets the two annotations; no handler, no `srv/*.js`, no change in `db/`, `srv/annotations/`, `app/products/annotations/`, `manifest.json`, `mockdata`, `metadata.xml` or the contract snapshot (EDMX unchanged).
- `package.json` gets `cds.requires.auth.users` for `alice`, `bob`, `viewer`; `package-lock.json` is untouched.
- Tests: `test/metadata.test.js` sets `defaults.auth`; `test/catalog-service.test.js` gains `describe('CatalogService authorization')` with five tests; the draft lock test keeps `bob` as an Editor.
- UI: `app/products/ui5-test-runner.json` is added; developers log in through the browser prompt; `README.md` (run modes) and `ARCHITECTURE.md` ("Authentication in development", new "Roles" table) say so.
- `PATTERNS.md` row "Authorization": example `srv/catalog-service.cds`, decision ADR-0013, note "entity grants cover the draft actions; UI tests authenticate via `app/<app>/ui5-test-runner.json`". `CONVENTIONS.md` section 2: `restrict` moves from the `srv/annotations/` list to the service file sentence. `TESTING.md` rule 5: `defaults.auth` in every file, `{ auth: null }` for anonymous, error shapes 401/403. `templates/service.test.js`: the anonymous test uses `{ auth: null }` and expects 401; a role test with `code: '403'` is added.
- Registry: `SERVICES.md` shows `Authorization: @requires "authenticated-user"` and the `@restrict` in the "Restrictions" column (generator already supports both).
- Reviewer checks: annotations only in `srv/catalog-service.cds`; no handler; no `Authorization` string outside `test/` and `ui5-test-runner.json`; snapshot diff empty; `bob` still an Editor; every test file has `defaults.auth`; English-only docs.
- Deployment ADR (future): `cds add xsuaa --for production` regenerates `xs-security.json` with `Viewer`/`Editor`; role collections in `mta.yaml`; `@sap/xssec` and the `[production]` profile.
- Follow-ups enabled: role-aware UI, instance-based rules, an `Admin` role if code lists get a maintenance screen, prefixing role names when a second service appears.

## Sources

- CAP, "CAP-level Authorization > Role-Based Access Control > `@requires`, `@restrict`, Combined Restrictions, Propagation of Restrictions", "Best Practices > Separation of Concerns", "Instance-Based Access Control > Filter Conditions", via `mcp__cds-mcp__search_docs`; https://cap.cloud.sap/docs/guides/security/authorization
- CAP, "CAP-level Users & Roles > Pseudo Roles, Roles, Role Assignment with XSUAA > Generate Security Descriptor", via `mcp__cds-mcp__search_docs`
- CAP, "Authentication > Mocked Authentication > Pre-defined Mock Users, Customization", "Custom Authentication > Automatic Authentication" (`any`), "Mock User Authentication" (401 for anonymous, `curl http://alice:@...`), via `mcp__cds-mcp__search_docs`
- CAP, "Testing with `cds.test` > `.defaults`, HTTP shorthand + Authentication", via `mcp__cds-mcp__search_docs`
- `@sap/cds` 10.0.6: `lib/srv/middlewares/auth/index.js`, `basic-auth.js`, `mocked-users.js`; `cds env requires.auth`
- `@cap-js/cds-test` 1.0.2: `lib/naxios.js` (`options4`, `auth` → `Authorization`, error shape)
- `ui5-test-runner` 5.14.0: `src/defaults/puppeteer.js` (`--basic-auth-username`, `page.authenticate`), `src/job.js` (`--config`, `buildArgs`, `browserArgs`)
- `scripts/gen-registry.mjs` lines 195 and 231 (`@requires`, `@restrict` rendering)
- Experiment log and results: `docs/features/catalog-authorization/CONTEXT.md`, "Verified by experiment"
- ADR-0002, ADR-0004, ADR-0010, ADR-0012; rules `srv-services.md`, `tests-backend.md`, `tests-ui.md`, `deploy.md`
