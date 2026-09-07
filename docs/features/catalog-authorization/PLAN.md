# catalog-authorization: plan

Date: 2026-09-07. Status: draft. Gate mode: semi-autonomous.

Context and research: `CONTEXT.md` in this folder (including "Verified by experiment"); decision draft: `docs/decisions/ADR-0013-catalog-authorization.md` (proposed). Feature name `catalog-authorization`, branch `feature/catalog-authorization` (created by `/feature`, not by this spec). Prerequisite: `feature/products-draft-edit` merged into `main`; the plan assumes `@odata.draft.enabled` on `CatalogService.Products`, the helpers `active`/`activeKey`/`draftKey` and the `describe('CatalogService.Products drafts')` block in `test/catalog-service.test.js`, and 22 green backend tests. If the merged suite differs, `architect` re-checks the file names and counts before phase 2. Phases and commits follow the `feature` skill; agents report per protocol section 8. The plan is written for the recommended answers in "Decisions for the user"; if the user picks another option the architect rewrites the affected rows before phase 2 starts.

## Key decisions of the plan

| Question | Decision | Rationale |
|---|---|---|
| Who may call the service | `@requires: 'authenticated-user'` on `CatalogService`; anonymous requests get 401 with a Basic challenge (CAP default) | PATTERNS "Authorization"; ADR-0013 part 1; verified in CONTEXT (also for `$metadata` and the service root) |
| Roles | `Viewer`: `READ` on `Products`; `Editor`: `*` on `Products` (CRUD and the draft actions `draftEdit`, `draftPrepare`, `draftActivate`, discard). Code lists and `$metadata`: any authenticated user | ADR-0013 parts 2 and 3; verified: Viewer 403 on every write path incl. `draftEdit` and a new draft; Editors keep the 409 lock between each other |
| Where the annotations live | inline in `srv/catalog-service.cds`: `@requires` before `service`, `@restrict` on the `Products` projection next to `@odata.draft.enabled` | ADR-0013 part 4; rule `srv-services.md`; `templates/service.cds`; CONVENTIONS section 2 wording is corrected by `docs-keeper` |
| Mock users | `package.json` → `cds.requires.auth.users`: `alice: { roles: ['Editor'] }`, `bob: { roles: ['Editor'] }`, `viewer: { roles: ['Viewer'] }`; defaults and `"*": true` remain; no passwords | ADR-0013 part 5; merge behavior verified with `cds env requires.auth.users`; `bob` must stay an Editor for the draft lock test (ADR-0012 plan) |
| Handlers | none; `srv/catalog-service.js` is not created | generic authorization handler enforces the annotations (verified); PATTERNS "Declarative before imperative" |
| Contract | unchanged; the snapshot test is the proof (`git diff --quiet test/__snapshots__ app/products/webapp/localService/metadata.xml`) | EDMX diff 0 lines (CONTEXT); no `npx vitest -u` |
| Backend tests | `test/metadata.test.js`: `test.defaults.auth = { username: 'alice' };` after `cds.test(...)`. `test/catalog-service.test.js`: new `describe('CatalogService authorization')`, 5 tests; existing tests untouched | verified: the `$metadata` HTTP test fails with 401 without `defaults.auth`; TESTING rule 5; ADR-0013 part 6 |
| OPA5 credentials | new file `app/products/ui5-test-runner.json` with `{ "browserArgs": ["--basic-auth-username", "alice"] }`; `scripts.test:ui` and `.github/workflows/ci.yml` unchanged | `ui5-test-runner` 5.14.0 reads `ui5-test-runner.json` from the cwd and appends `browserArgs` after `--`; `page.authenticate` answers every Basic challenge of the test page and the app iframe; CI keeps `npm run test:ui -- --report-dir ...` (ADR-0013 part 7) |
| Journeys and page objects | unchanged; they run as `alice` (Editor) | PATTERNS "User scenario"; no journey asserts a user name |
| Verifier login | chrome-devtools MCP: first navigate to `http://alice:@localhost:4004/odata/v4/catalog/` (protected service document; Chrome answers the challenge from the URL credentials and caches them for realm "Users"), then open the sandbox; for the Viewer scenario use a fresh browser instance with `viewer:@` | not verifiable without a browser in `/spec`; step 9 confirms; fallback: the user logs in once in a headed Chrome, or the verifier documents the limitation and covers the Viewer path by the backend tests |
| Fiori UI for a Viewer | unchanged: Create/Edit/Delete visible, backend 403 shown by FE's standard error dialog | ADR-0013 part 8; CAP derives no `Capabilities` from `@restrict`; role-aware hiding is a follow-up feature (Decision 6) |
| Mock server | unchanged (`ui5-mock.yaml`, `mockdata`) | no backend, no `@requires` |
| `xs-security.json`, `mta.yaml` | untouched; `cds compile srv --to xsuaa` output recorded in CONTEXT; roles documented in `ARCHITECTURE.md` | rule `deploy.md`; STATE debt "deployment not configured"; ADR-0013 part 9 |
| i18n | no new keys | 401 has no body; 403 uses CAP's generic message; FE error dialog texts come from `sap.fe` |
| Registry | regenerated; `SERVICES.md` shows `Authorization: @requires "authenticated-user"` and the `@restrict` JSON in the "Restrictions" column | `scripts/gen-registry.mjs` lines 195 and 231 already render both |

## Acceptance criteria

Backend, verified by `npm test`; target 27 tests green (22 after `products-draft-edit` plus 5 new), full output in the `test-backend` report:

- [ ] `test/metadata.test.js`: "matches the EDMX snapshot" green without `-u`; "keeps app/products/webapp/localService/metadata.xml in sync with the model" green without regenerating the file; "serves $metadata over HTTP with English labels" green with `test.defaults.auth = { username: 'alice' }` set right after `cds.test(...)`; `git diff --quiet test/__snapshots__/metadata.test.js.snap app/products/webapp/localService/metadata.xml` exits 0.
- [ ] All 19 existing tests of `test/catalog-service.test.js` (13 CRUD/validation, 6 draft) green and unchanged, including "locks the active product while another user's draft exists" with `bob` (409 `DRAFT_ALREADY_EXISTS`) and "does not allow creating categories (@readonly)" (405, unchanged: `@readonly` fires before `@restrict`; if the merged suite reports 403 instead, `test-backend` records it and `architect` decides).
- [ ] New `describe('CatalogService authorization')` at the end of `test/catalog-service.test.js`:
  - [ ] "rejects anonymous requests with 401": `GET /Products?$top=1` with `{ auth: null }` rejected, `err.status` 401; `GET /$metadata` with `{ auth: null }` rejected, `err.status` 401. Optional if `err.response.headers` is available: `www-authenticate` starts with `Basic`.
  - [ ] "lets a Viewer read products, categories, currencies and the metadata": with `{ auth: { username: 'viewer' } }`: `GET /Products?$top=1&$select=name` 200 with one row; `GET /Categories?$top=1&$select=code` 200; `GET /Currencies?$top=1&$select=code` 200; `GET /$metadata` 200. No count assertion (the draft `describe` may leave the count at 15 or 16 depending on order).
  - [ ] "forbids a Viewer to create products, active or as a draft": `POST /Products` with `active(newProduct)` as `viewer` rejected with `/403/`, `code: '403'`; `POST /Products` with `newProduct` (no `IsActiveEntity`, would be a new draft) as `viewer` rejected with `/403/`, `code: '403'`; afterwards `GET /Products?$filter=name eq 'Test Lamp'` as `alice` returns 0 rows (active and drafts: `?$filter=name eq 'Test Lamp' and IsActiveEntity eq false` also 0).
  - [ ] "forbids a Viewer to edit, delete or start a draft on a product": seeded Yoga Mat ID via `alice`; as `viewer`: `PATCH activeKey(id) { stock: 3 }` 403, `DELETE activeKey(id)` 403, `POST activeKey(id)/CatalogService.draftEdit { PreserveChanges: true }` 403, each with `code: '403'`; afterwards `GET activeKey(id)?$select=stock,HasDraftEntity` as `alice` shows the seeded stock and `HasDraftEntity: false`.
  - [ ] "forbids an authenticated user without Viewer or Editor to read products": as `carol` (default mock user, role `admin` unknown to the model): `GET /Products?$top=1` rejected with `/403/`, `code: '403'`; `GET /Categories?$top=1` 200.
- [ ] `npm run lint` (cds lint) clean; `npx prettier --check test/` clean; no `srv/**/*.js` file exists (`HANDLERS.md` still "none"); `git diff --quiet package-lock.json` exits 0.
- [ ] `cds env requires.auth.users` (run by `cap-backend-dev`, output in the report) lists `alice` and `bob` with `roles: ["Editor"]`, `viewer` with `roles: ["Viewer"]`, `carol` unchanged, `"*": true`.
- [ ] `cds compile '*' --to edmx-v4 -s CatalogService -l en | diff - app/products/webapp/localService/metadata.xml` is empty (no contract change).

UI, verified by OPA5 (`test-ui`, step 7), `ui-verifier` (step 9, `VERIFICATION.md` with screenshots) and linters:

- [ ] `app/products/ui5-test-runner.json` exists with exactly `{ "browserArgs": ["--basic-auth-username", "alice"] }` (plus a `$schema`-free one-line comment is not possible in JSON; the explanation goes into `README.md` and the `test-ui` report). `npm run lint` in `app/products` (ui5lint) and `npm run lint:js` unchanged and clean.
- [ ] With a fresh `npm run watch`, `npm run test:ui` in `app/products` passes all journeys (`FilterProductsByCategoryJourney`, `CategoryShownAsNameJourney`, `EditCategoryOnObjectPageJourney` incl. Cancel and restore, `RussianLocaleJourney`), 0 skipped; the runner output is attached. `test-ui` additionally runs the suite once with the config file renamed away and records the failure mode (expected: the app never loads, `iSeeThisPage` times out, the runner's network trace shows 401 on `$metadata`) as evidence for LESSONS; the file is restored before the report.
- [ ] `ui-verifier`, `alice`, `en`: login recipe from "Key decisions" works (or the fallback is documented); the List Report shows 15 rows; the edit flow of `EditCategoryOnObjectPageJourney` works by hand; the network trace of `$batch` shows `Authorization: Basic` on the requests (`get_network_request`) and 2xx statuses; the Object Page "Administrative Data" section shows `alice` in Changed By after a save; data restored afterwards.
- [ ] `ui-verifier`, `viewer`, `en`, fresh browser instance: the List Report loads (15 rows); Create, Edit and Delete are visible (FE default); pressing Edit on Laptop Pro 15 produces FE's error dialog with the backend message ("Forbidden" or the localized CAP text), the page stays in display mode, `HasDraftEntity` of the record stays `false` (checked via `GET ...IsActiveEntity=true` as `alice` in a terminal); Create followed by Save or Cancel leaves the row count at 15. Screenshots: alice edit mode, viewer error dialog.
- [ ] `ui-verifier`, `ru` (`?sap-ui-language=ru`) as `viewer`: the error dialog shows no untranslated key; if CAP's generic 403 text is English under `ru`, record it as an observation (not a defect of this feature).
- [ ] `ui-verifier`, anonymous: opening `http://localhost:4004/odata/v4/catalog/$metadata` in a browser without cached credentials shows the Basic prompt; `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display` loads the shell and prompts on the first OData request; Escape leaves the app with an FE error and an empty list (documented behavior).
- [ ] `npm run start-mock` still starts and shows 15 products without any prompt (`ui5-mock.yaml` unchanged).
- [ ] `npm start` in `app/products` (:8080, `fiori-tools-proxy`): the browser prompt appears once and `alice` works; if the proxy answers differently (for example swallows the challenge), record it in STATE as a proxy observation with the `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD` hint from its bundle for a follow-up; not a blocker.
- [ ] Browser console (alice run) free of errors mentioning `401`, `403`, `Authorization`, `Products` or `draft`; the known sandbox 404s and the ushell deprecation warning are pre-existing (`categories-code-list/VERIFICATION.md`).
- [ ] `git diff --quiet app/products/webapp/manifest.json app/products/ui5-mock.yaml app/products/webapp/localService` exits 0.

Documentation:

- [ ] `npm run docs:registry` executed, `node scripts/check-docs-fresh.mjs` green; `docs/registry/SERVICES.md` shows `Authorization: @requires "authenticated-user"` and the `@restrict` of `Products` in "Restrictions"; `HANDLERS.md` still "none".
- [ ] `docs/CHANGELOG.md`: lines for `srv` (`@requires`, `@restrict`, no contract change), `deps`/`srv` (mock users in `package.json`), `test` (metadata auth line, five authorization tests), `app` (`ui5-test-runner.json`), `docs` (ADR-0013, PATTERNS, CONVENTIONS, TESTING, ARCHITECTURE, README, template).
- [ ] `docs/STATE.md`: test counts (27 backend, OPA 0 skipped); ADR-0013 in the accumulated decisions; a line in "What works" about logging in as `alice`/`viewer`; the deployment debt row mentions that `Viewer`/`Editor` role templates will be generated by `cds add xsuaa`.
- [ ] `docs/architecture/PATTERNS.md`, row "Authorization": example `srv/catalog-service.cds`, decision ADR-0013, note "entity grants cover the draft actions; UI tests authenticate via `app/<app>/ui5-test-runner.json`". `docs/architecture/CONVENTIONS.md` section 2: "restrict" removed from the `srv/annotations/` list; the service line already says `@requires/@restrict`. `docs/architecture/TESTING.md` rule 5: "`defaults.auth = { username: 'alice' }` in every test file (also the contract test); anonymous requests with `{ auth: null }` assert `status` 401 (numeric `code`); denied roles assert `code: '403'`; mock users without password accept any password, unknown names are authenticated without roles". `docs/architecture/ARCHITECTURE.md`: "Authentication in development" sentence updated (prompt, `alice`/`viewer`) and a "Roles" table (`Viewer`, `Editor`, what they may do, mock users). `README.md`, run modes: one sentence on the Basic prompt and the users.
- [ ] `templates/service.test.js`: "denies anonymous access" uses `{ auth: null }` and expects `/401/`; a second test "denies a user without the role" with a default user and `code: '403'`.
- [ ] `docs/decisions/ADR-0013-catalog-authorization.md`: status "accepted" with the user's date (set by `architect` after the decision), consequences ticked by `docs-keeper`.
- [ ] `docs/features/catalog-authorization/SUMMARY.md` and `VERIFICATION.md` written; this `PLAN.md` marked done; `docs/LESSONS.md` entries (see step 11).

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | Research | `architect` | `CONTEXT.md`, `PLAN.md`, `docs/decisions/ADR-0013-catalog-authorization.md` | | done 2026-09-07; awaiting user decisions; re-check the merged `products-draft-edit` suite before phase 2 |
| 2 | Design (short) | `ux-designer` | `CONTEXT.md`, section "Screens" | Fiori error handling, standard actions (`mcp__fiori-mcp__search_docs`: "error handling message dialog", "UI.CreateHidden UI.UpdateHidden UI.DeleteHidden") | section filled: explicit yes/no on accepting the role-agnostic UI for this feature, the Basic prompt as the development login, verifier scenarios for `alice`/`viewer` in `en`/`ru`, and a one-paragraph sketch of the follow-up "role-aware UI" (hidden versus disabled actions); if `fiori-mcp` search is still unavailable, say so and reason from the FE V4 defaults observed in `categories-code-list/VERIFICATION.md` |
| 3 | Backend: service and users | `cap-backend-dev` | `srv/catalog-service.cds`, `package.json` (`cds.requires.auth.users` only) | Authorization (ADR-0013) | `mcp__cds-mcp__search_model` for `CatalogService` and `CatalogService.Products`, `search_docs` "@requires" and "@restrict" before the edit; `cds compile srv --to json` ok; `npm run lint` clean; `cds compile '*' --to edmx-v4 -s CatalogService -l en \| diff - app/products/webapp/localService/metadata.xml` empty; `cds env requires.auth.users` output in the report; `curl -s -o /dev/null -w '%{http_code}' http://localhost:4004/odata/v4/catalog/Products` against `cds watch` prints 401, `curl -u alice: ...` prints 200, `curl -u viewer: -X POST ...` prints 403 (three lines in the report); no `srv/*.js`, no `package-lock.json` change |
| 4 | Backend: tests | `test-backend` | `test/metadata.test.js` (one line), `test/catalog-service.test.js` (new `describe`) | Service test (ADR-0002, TESTING rule 5, ADR-0013) | `mcp__cds-mcp__search_docs` "cds.test defaults auth" before the edit; `npm test` green with 27 tests, full output in the report; snapshot files unchanged (`git status --short test/__snapshots__` empty); `npx prettier --write test/` |
| 5 | Gate phase 2 | orchestrator | | | steps 3 and 4 in one phase (after step 3 alone `test/metadata.test.js` is red); `npm run lint`, `npm test` green; commit `feat(srv): require authentication and Viewer/Editor roles on CatalogService` |
| 6 | UI: runner credentials | `test-ui` | `app/products/ui5-test-runner.json` (new) | User scenario; rule `tests-ui.md` | `mcp__fiori-mcp__search_docs` not needed (runner configuration); read `node_modules/ui5-test-runner/src/defaults/puppeteer.js` and `src/job.js` (`buildArgs`) to confirm the key names; `npm run lint` in `app/products` clean |
| 7 | UI tests | `test-ui` | none beyond step 6 | User scenario | fresh `npm run watch` in the root, then `npm run test:ui` in `app/products`: all journeys pass, 0 skipped; one run without the config file to record the failure mode (file restored afterwards); outputs in the report |
| 8 | Gate phase 3 | orchestrator | | | `npm run lint` in `app/products`; `npm test` in the root green; commit `test(app): authenticate OPA5 journeys as mocked user alice` (files of step 6) |
| 9 | Verification | `ui-verifier` | `docs/features/catalog-authorization/VERIFICATION.md`, `screenshots/` | | fresh `npm run watch`; login recipe (credentials in a top-level URL to the protected service document, then the sandbox); scenarios from the UI criteria for `alice`, `viewer`, anonymous, `ru`; mock mode and :8080 proxy checks; network evidence from `$batch` (`list_network_requests` with `resourceTypes: ["xhr","fetch"]`, `get_network_request` for headers and status); console; data restored; verdict "ready for review". If the URL-credential login does not work with chrome-devtools MCP 1.8.0, try a headed browser where the user enters `alice` once, then document the limitation and rely on steps 4 and 7 for the Viewer path |
| 10 | Review | `reviewer` | | | zero blocking findings; check specifically: `@requires`/`@restrict` only in `srv/catalog-service.cds`; no handler file; no `Authorization` string outside `test/` and `app/products/ui5-test-runner.json`; `package.json` diff limited to `cds.requires.auth.users`; `package-lock.json`, `manifest.json`, `ui5-mock.yaml`, `metadata.xml`, snapshot unchanged; `bob` still `Editor`; every backend test file sets `defaults.auth`; anonymous tests use `{ auth: null }`; English-only docs; CHANGELOG lines present |
| 11 | Documentation | `docs-keeper` | `docs/registry/*` (generated), `docs/CHANGELOG.md`, `docs/STATE.md`, `docs/architecture/PATTERNS.md`, `CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`, `README.md`, `templates/service.test.js`, `docs/features/catalog-authorization/SUMMARY.md`, `docs/LESSONS.md` | | `node scripts/check-docs-fresh.mjs` green; LESSONS entries: (a) `@requires` on a service protects `$metadata`, so every `cds.test` file needs `defaults.auth`, including the contract test; (b) mocked users without `password` accept any password and `"*": true` authenticates unknown names, so an "anonymous" test must send `{ auth: null }` and a named unknown user tests "no role" (403), not "not logged in" (401); (c) `ui5-test-runner` browser options (`--basic-auth-username`) go after `--` or into `ui5-test-runner.json` `browserArgs`, never before `--`; commit `docs: catalog-authorization summary and registry` |

### Details for the developers

Step 3, `srv/catalog-service.cds`. The file becomes:

```cds
using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
@requires: 'authenticated-user'
service CatalogService {
  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'Viewer' },
    { grant: '*',    to: 'Editor' }
  ]
  entity Products as projection on catalog.Products;
  @readonly entity Categories as projection on catalog.Categories;
}

using from './annotations/Products';
using from './annotations/Categories';
```

Nothing else changes in the file. `package.json`, `cds` block (the only change in the file; keep `"sapux"` and the scripts as they are):

```json
"cds": {
  "requires": {
    "auth": {
      "users": {
        "alice": { "roles": ["Editor"] },
        "bob": { "roles": ["Editor"] },
        "viewer": { "roles": ["Viewer"] }
      }
    }
  }
}
```

Do not set `kind`, `password`, `tenant` or a `[development]` profile; do not remove the defaults. Sanity checks: `npx cds env requires.auth.users | grep -c Editor` prints 2; `npx cds env requires.auth.kind` prints `mocked`.

Step 4, `test/metadata.test.js`: after `const test = cds.test(import.meta.dirname + '/..');` add `test.defaults.auth = { username: 'alice' }; // @requires on the service also protects $metadata (ADR-0013)`. `test/catalog-service.test.js`: reuse `newProduct`, `active`, `activeKey`, `GET`/`POST`/`PATCH`/`DELETE`; add two request-option helpers next to the draft helpers:

```js
// Authorization (ADR-0013): alice and bob are Editors, viewer is a Viewer, carol has no model role.
const as = (username) => ({ auth: { username } });
const anonymous = { auth: null }; // overrides defaults.auth, no Authorization header
```

Assertion shapes (verified): anonymous `const err = await expect(GET(url, anonymous)).to.be.rejectedWith(/401/); expect(err.status).to.equal(401);` (the `code` is the number 401, do not `containSubset({ code: '401' })`); denied role `const err = await expect(POST(url, body, as('viewer'))).to.be.rejectedWith(/403/); expect(err).to.containSubset({ code: '403' });`. The Viewer read test must not assert the product count. Order inside the file: the new `describe` goes last; it creates nothing, so no cleanup is needed, but the "cannot create" test checks as `alice` that no `Test Lamp` (active or draft) exists afterwards.

Step 6, `app/products/ui5-test-runner.json`:

```json
{
  "browserArgs": ["--basic-auth-username", "alice"]
}
```

Key `browserArgs` (or `"--"`) is consumed by `buildArgs` in `src/job.js` and appended after `--` to the puppeteer script, which calls `page.authenticate({ username: 'alice', password: '' })` (`src/defaults/puppeteer.js`). Do not add `--basic-auth-username` to `scripts.test:ui` before `--` (the runner rejects unknown options) and do not add `--` to the script (CI appends `--report-dir` with `npm run test:ui -- ...`, which would then become a browser argument). No dependency change, so `app/products/package-lock.json` stays untouched.

Step 9, verifier login. Navigate to `http://alice:@localhost:4004/odata/v4/catalog/` first (the service document is protected, Chrome answers the challenge with the URL credentials and caches them for `localhost:4004`, realm "Users"), then to `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`; XHR challenges reuse the cached credentials. For `viewer`, start a new browser instance (the auth cache is per session) and use `http://viewer:@localhost:4004/odata/v4/catalog/`. Data restored after the alice run: category of Laptop Pro 15 back to Electronics, drafts discarded, created products deleted (`DELETE ...IsActiveEntity=true` as `alice`).

Step 11, `templates/service.test.js`, `describe('authorization')`:

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

`docs/decisions/ADR-0013-catalog-authorization.md` (proposed): authentication for the whole service and the anonymous behavior, the role model and role names, code lists readable by any authenticated user, placement of the annotations (and the CONVENTIONS correction), the development users and the `*` default, the test idioms, the UI credential mechanism, the role-agnostic Fiori UI, the deferral of `xs-security.json`. Consequences for `PATTERNS.md`, `CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`, `README.md` and `templates/service.test.js` are executed by `docs-keeper` in step 11 after acceptance; the status is set by `architect` when the user decides.

## Decisions for the user

1. **Role model.** A) `Viewer` (read) and `Editor` (full CRUD incl. drafts) on `Products` (recommended: read access becomes an assignable role, verified end to end, one extra mock user). B) `authenticated-user` reads, `Editor` writes (one role less; every authenticated identity reads the catalog). C) A single `Admin` role for everything (no read-only consumers).
2. **Role names.** `Viewer`/`Editor` (recommended: short, one service, become the XSUAA scope names) versus `CatalogViewer`/`CatalogEditor` (prefix for a future second service; rename is cheap now, costly after role collections exist).
3. **Code lists and metadata.** Readable by any authenticated user (recommended: value help for both roles, autoexposed `Currencies` cannot carry `@restrict` without extra projections) versus `@restrict: [{ grant: 'READ', to: ['Viewer', 'Editor'] }]` on `Categories` plus explicit projections for `Currencies` and its texts.
4. **Development users.** `alice` Editor, `bob` Editor (needed by the draft lock test), new `viewer` Viewer, no passwords, defaults and `"*": true` kept (recommended: documented CAP default; unknown names have no roles and get 403) versus `"*": false` (only listed users may log in; unknown names get 401) versus giving `viewer` and `alice` passwords.
5. **Placement of the annotations.** Inline in `srv/catalog-service.cds` and fix the CONVENTIONS wording (recommended: PATTERNS, rule `srv-services.md` and `templates/service.cds` already say so) versus `srv/annotations/Products.cds` for `@restrict` (CONVENTIONS wording; `@requires` cannot live there) versus a separate `srv/catalog-service-auth.cds` (CAP "Separation of Concerns").
6. **Fiori UI for Viewers.** Accept the FE default in this feature: actions visible, 403 error dialog on use (recommended: no handler, backend enforcement is complete) versus adding role-aware hiding now (`UI.CreateHidden`/`UpdateHidden`/`DeleteHidden` bound to a computed element filled from `req.user`; first handler of the project, own plan). The follow-up is listed in STATE either way.
7. **Credentials for the OPA5 journeys.** `app/products/ui5-test-runner.json` with `browserArgs` (recommended: `test:ui` and CI unchanged, verified mechanism in the runner source) versus appending `-- --basic-auth-username alice` to `scripts.test:ui` (breaks the CI invocation that appends `--report-dir`) versus an `Authorization` header in the app or a `dummy` auth profile (rejected in ADR-0013).
8. **`xs-security.json`.** Leave untouched and regenerate with `cds add xsuaa --for production` in the deployment ADR; document the roles in `ARCHITECTURE.md` now (recommended: protected file, deployment not configured) versus adding the `Viewer`/`Editor` scopes and role templates now on explicit request (`cds compile srv --to xsuaa` output is in CONTEXT).
9. **Anonymous requests.** 401 with the Basic challenge for everything including `$metadata` (recommended: CAP default, matches the request) versus `@requires: 'any'` on the service with write restrictions only (public read; rejected in ADR-0013).

## Risks

| Risk | How it is detected | What to do |
|---|---|---|
| OPA5 journeys locked out: the headless browser cannot answer the Basic prompt | step 7: `iStartMyApp` never sees the List Report; runner network trace shows 401 on `$metadata` | `ui5-test-runner.json` with `browserArgs` (step 6); the deliberate run without the file documents the symptom; CI uses the same cwd, so it is covered |
| CI invocation breaks because credentials were put after `--` in `scripts.test:ui` | `ui-tests` job fails with an unknown-option error from the browser script or ignores `--report-dir` | not applicable with the config file; reviewer checks that `scripts.test:ui` is unchanged |
| `test/metadata.test.js` goes red after step 3 (no `defaults.auth`) | `npm test` between steps 3 and 4; Stop hook would block a phase end | steps 3 and 4 form one phase; the one-line fix is part of the plan |
| `ui-verifier` cannot log in through chrome-devtools MCP (URL credentials not honored or not cached for XHR) | step 9: sandbox shows an FE error and an empty list; `get_network_request` shows 401 | fallback: headed browser with a one-time manual login by the user; document the limitation; the Viewer path is proven by steps 4 and 7 |
| `bob` loses the Editor role by a later user decision (Decision 4 variant) | draft lock test answers 403 instead of 409 | `architect` rewrites the lock test criteria in `products-draft-edit` (or this plan) before phase 2 |
| The merged `products-draft-edit` suite differs from the assumed shape (helper names, counts) | step 1 re-check before phase 2 | `architect` adjusts file names and the target count; the criteria describe behavior, not line numbers |
| `@readonly` versus `@restrict` order: "does not allow creating categories" could report 403 for `alice`? (not expected: `Categories` has no `@restrict` and `alice` is authenticated) | step 4 | unchanged test; if it changes, record and decide |
| A Viewer sees actions that fail (UX surprise) | step 9 screenshots; designer's verdict in step 2 | accepted for this feature (Decision 6); follow-up in STATE |
| Users type an unknown name in the browser prompt and get an empty list with an error | manual use; documented in README | `"*": true` keeps the CAP default; README explains `alice`/`viewer` |
| `npm start` on :8080: the Fiori tools proxy handles the 401 differently from a direct call | step 9 | observation in STATE; `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD` hint for a follow-up; not a blocker since the sandbox on :4004 is the documented entry point |
| `fiori-mcp` documentation search unavailable (as on 2026-09-07) | step 2 | designer reasons from observed FE V4 behavior and says so; `release-watcher` reports the outage if it persists |
| Registry renders the `@restrict` array as raw JSON in the table | step 11 | acceptable; generator changes are outside `docs-keeper`'s mandate and would be a user request |
| Hooks: PostToolUse marks the registry stale after each edit; Stop hook requires `npm test` green and STATE/CHANGELOG updated between phases | hook messages | orchestrator updates the STATE "active feature" line after every phase; `docs-keeper` regenerates the registry in step 11 |
