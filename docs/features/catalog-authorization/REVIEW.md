# catalog-authorization: review (plan step 14, phase 5)

Date: 2026-09-16. Reviewer: `reviewer`, autonomous gate mode. Scope: `git diff main...HEAD` over the four
commits `3fdd195` (plan, context, ADR), `df96757` (backend), `4e443e1` (UI), `d3a4db0` (verification plus
the fixture fix). Working tree clean at `d3a4db0`; no untracked files, no `docs/registry/.stale` marker.

`fiori-mcp` was disconnected this session. Every statement below about SAP Fiori Elements or UI5 internals
was established from the UI5 1.152.0 CDN debug sources (`https://ui5.sap.com/resources/<module>-dbg.js`,
the version the sandbox bootstraps), not from MCP, and is marked "not verified by MCP".

## Verdict

**Zero blocking findings. Ready to commit.**

The one open question handed to this review — the `Permissions` console error on :4004 — is an **accepted
observation**, not a blocking finding. Rationale in "Verdict on the `Permissions` console error" below.
Two documentation-truth defects and one stale code comment are non-blocking and belong to `docs-keeper`
and `test-backend` in phase 6.

## Blocking

None.

## Non-blocking

1. `test/metadata.test.js:55-58` — the comment above the third contract test still reads "Skipped on
   purpose until step 9 … step 9 only removes the `.skip`", but the `.skip` is gone and the test runs.
   A future reader is told a green test is inert. Delete or rewrite the comment to state what the test
   guards (the three `UI.*Hidden` terms with their `$edmJson` expression, whitespace-normalised because
   the compiler pretty-prints EDMX). Owner: `test-backend`.

2. `docs/STATE.md:8` — the phase-3 sentence states "the mock fixture must be an **object**, not a
   one-element array - the array form makes `sap-fe-mockserver` answer the singleton with 200 and an
   empty body, which would have made the mock UI permanently viewer-like". That is false and is
   contradicted two sentences later by the phase-4 sentence and by the committed fixture
   (`app/products/webapp/localService/mockdata/Permissions.json` = `[{ "ID": "me", "isEditor": true }]`).
   STATE is the first file every agent reads; leaving a refuted claim in it as an assertion of fact is
   exactly the failure mode the feature already paid for once. Rewrite the phase-3 clause as "was
   settled the wrong way in `4e443e1` and corrected in `d3a4db0`". Owner: `docs-keeper`.

3. `docs/features/catalog-authorization/PLAN.md:35,46` — the plan's stated target is "**37 backend
   tests**"; the suite is 38 (`npm test` → `Tests 38 passed (38)`). This is stale arithmetic in the
   plan, not a deviation by the implementer: the plan's own step-7 note (line 59) prescribes *two*
   `it`s in `test/metadata.test.js` (`exposes the Permissions singleton` plus the `UI.*Hidden` one),
   which makes 26 + 6 + 6 = 38. Correct the figure in the plan, in the acceptance-criteria heading and
   in `docs/STATE.md` when ticking. Owner: `docs-keeper`.

4. `docs/CHANGELOG.md` — no `docs` line yet for phase 1 (ADR-0013, PLAN, CONTEXT) or for the phase-6
   documentation work the plan's criterion lists (PATTERNS, CONVENTIONS, TESTING, ARCHITECTURE, README,
   `templates/service.test.js`). Expected at review time, listed so it is not lost. Owner: `docs-keeper`.

5. `docs/features/catalog-authorization/PLAN.md:77` — the acceptance criterion "Browser console … free of
   errors mentioning `401`, `403`, `Authorization`, `Permissions`, `Products` or `draft`" is not met and
   must not be silently ticked. Two independent things trip it: the `Permissions` binding error analysed
   below, and a pre-existing FE i18n assert `could not find any translatable text for key
   'T_NEW_OBJECT|Products'` that has nothing to do with this feature. Record the criterion as "not met,
   accepted with rationale" with a pointer to this review, and narrow the wording for future features —
   a substring list that matches every entity name in the model is not a usable gate. Owner: `docs-keeper`.

## Observations

- **Cyrillic in feature docs.** `docs/features/catalog-authorization/VERIFICATION.md:70,71` quote the
  rendered Russian UI as browser evidence, and `CONTEXT.md:234` shows a proposed `_ru.properties` line.
  `scripts/lib/file-checks.mjs:81-104` puts `docs/**` in the Cyrillic scope with no exception for
  feature docs, so the hook flags these. Established practice on `main` is the opposite: every prior
  `VERIFICATION.md` carries the same kind of quotation (`categories-code-list` 2 lines,
  `products-draft-marker` 1, `products-draft-edit` 7), all merged after review. Not a finding against
  this feature; the rule and the practice disagree and one of them should move (a `/retro` item).
  `test/catalog-service.test.js:266` and `docs/CHANGELOG.md:134` are pre-existing and allowed.

- **Viewer-side UI behaviour has no automated regression guard.** The OPA suite authenticates as exactly
  one user (`app/products/ui5-test-runner.json`), and that user is `alice`, so
  `RoleAwareActionsJourney.js` can only assert the editor half. If the three `UI.*Hidden` annotations
  ever stopped hiding anything, 38 backend tests and 25 OPA tests would all stay green. This was decided
  by the user on 2026-09-10 (PLAN "Open questions", answer 1) with the pre-agreed remedy of a second
  runner config `ui5-test-runner-viewer.json` plus a `test:ui:viewer` script if it ever regresses.
  Recorded so the gap is explicit, not to reopen the decision. Note that the *security* consequence is
  nil — enforcement is `@restrict`, proven by the seven new backend tests; only the cosmetic hiding is
  unguarded.

- **The mock fixture has no automated guard either.** The object-vs-array shape of
  `app/products/webapp/localService/mockdata/Permissions.json` decides whether `npm run start-mock`
  renders a usable UI, and the wrong shape was committed in `4e443e1` and only caught by a browser
  session. Nothing in `npm test`, `ui5lint` or CI would catch it again.

- **`PATCH /Permissions` is asserted (405); `POST` and `DELETE` on the singleton are not.** Low value —
  `@readonly` produces all three from the same source — but worth one sentence if the singleton ever
  grows.

- **OPA suite re-run by this review, not taken on trust.** Started `npx cds serve --in-memory --port
  4004` (port was free), ran `npm run test:ui` in `app/products`: six pages, `4/4 3/3 6/6 4/4 6/6 2/2`
  = **25 passed, 0 failed, 0 skipped**, 01:46 total. Data hygiene afterwards: `Products/$count` = 15,
  drafts = 0. Server stopped, port 4004 free again. The journey's assertions use real public
  `sap.fe.test` API (`TableAssertions.iCheckCreate`/`iCheckDelete` at
  `sap/fe/test/api/TableAssertions-dbg.js:319,354` resolve to
  `iCheckAction({ service: "StandardAction", action: …, unbound: true })`, `HeaderAssertions.iCheckEdit`
  /`iCheckDelete` at `sap/fe/test/api/HeaderAssertions-dbg.js:66,112`), and `iCheckAction` waits for a
  matching control, so a hidden-for-editors regression really turns the journey red. It is a genuine
  guard for plan risk R6. Not verified by MCP.

## Verdict on the `Permissions` console error

`[error] Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot
read properties of undefined (reading '$select')`, once per page load, both roles, on :4004.

**Decision: accepted observation with the rationale below, not a blocking finding.**

### Root cause, established from the UI5 1.152.0 sources (not verified by MCP)

The annotation path is used verbatim as an OData V4 *data* binding path, and UI5 cannot parse a
container-qualified path on that side:

1. `sap/ui/model/odata/v4/ODataPropertyBinding-dbg.js:403` → `_Cache.createProperty(...)`;
   `sap/ui/model/odata/v4/lib/_Cache-dbg.js:5020` routes a path without `(` and without `/$count` to
   `_SingletonPropertyCache`.
2. `_SingletonPropertyCache` (`_Cache-dbg.js:4849-4864`) splits the resource path on `/` and takes
   segment 0 as the singleton. For `CatalogService.EntityContainer/Permissions/isEditor` that makes the
   singleton `CatalogService.EntityContainer` and the relative property path `Permissions/isEditor`.
3. `_SingletonPropertyCache.prototype.fetchValue` (`_Cache-dbg.js:4894-4914`) calls
   `_Helper.wrapChildQueryOptions("/CatalogService.EntityContainer", "Permissions/isEditor", {}, …)`.
4. `wrapChildQueryOptions` (`_Helper-dbg.js:3483`) walks the first segment, finds
   `$kind: "Singleton"` — neither `NavigationProperty` nor `Property` — and **returns `undefined`**.
5. `_Helper.aggregateExpandSelect(mLateExpandSelect, undefined)` (`_Helper-dbg.js:238`) immediately
   reads `mQueryOptions.$select` → the exact TypeError observed. The sibling call site in
   `ODataParentBinding-dbg.js:1050` guards with `if (mWrappedQueryOptions)`; this one does not.
6. The rejection surfaces through `ODataPropertyBinding-dbg.js:335`
   `reportError("Failed to read path " + sResolvedPath, …)` — which is the observed message verbatim.

So the error is an **unguarded framework defect in UI5 1.152.0**, reached deterministically, identically,
for every user and every page. That binding never issues a request and never delivers a value.

The working evaluation is a different route. SAP FE resolves the container-qualified form correctly in its
converted metadata: `sap/fe/core/converters/MetaModelConverter-dbg.js:565-571` gives a singleton the fully
qualified name `<Container>/<Singleton>`, and `convertMetaModelContext` (same file, ~line 932) explicitly
strips the container prefix (`if (oConvertedMetadata.entityContainer.fullyQualifiedName === firstPart)`).
That route yields the `GET Permissions?$select=isEditor` inside `$batch` that the verifier captured with
the correct value in every trace — which is precisely the request signature a *short-path*
`_SingletonPropertyCache` produces (`sSingleton = "Permissions"`, late `$select=isEditor`).

### Why this is not blocking

- **It is deterministic, therefore it cannot be the source of a role-dependent flip.** The failing branch
  fails the same way for `alice` and for `viewer`, on both pages, in both locales. The verifier's five
  consistent measurements are not five lucky draws; they are the other, working branch doing its job.
- **The contrast with mock mode is itself evidence.** When the singleton genuinely did not resolve
  (`500 tenantJsonData.forEach is not a function`, VERIFICATION scenario 6), the symptom was loud,
  immediate and asymmetric: Create/Delete present on the List Report, Edit missing on the Object Page.
  An unresolved value in this mechanism does not fail silently — it fails visibly. On :4004 nothing of
  the kind was seen in any measurement.
- **The defect is in the framework, and the path form is CAP's own documented recipe** ("Serving SAP
  Fiori UIs → Role-based Visibility", cited in ADR-0013 part 8). Blocking the feature would punish the
  implementer for following the prescribed way.
- **Nothing security-relevant depends on it.** Enforcement is `@requires`/`@restrict`, server-side,
  covered by the seven new backend tests including `draftEdit`, draft-create, `PATCH` and `DELETE` as a
  viewer, and by `carol` (authenticated, no role) getting 403.
- **The remedy cannot be executed or validated inside the review phase.** The plan's pre-approved
  fallback — the short path `/Permissions/isEditor` — is a model change that forces a contract
  regeneration (`metadata.xml`, `npx vitest -u`) and a fresh browser verification, and carries a real
  risk of regressing the blocking viewer criterion if FE's converter treats the short form differently.
  That is a follow-up, not a review-phase fix.

### What should happen instead

- Do **not** tick PLAN line 77. Record it as "not met, accepted with rationale" (non-blocking finding 5).
- Add a `docs/LESSONS.md` entry with the citation chain above: an `$edmJson` `$Path` through the entity
  container is valid for FE's converted metadata but invalid as an OData V4 data binding path, and UI5
  1.152.0 reports it as an unguarded `TypeError` in `aggregateExpandSelect` rather than a clean message.
- Put the follow-up in STATE "open debt": try `/Permissions/isEditor`, regenerate the contract, re-verify
  in a browser. The expectation from the source reading is that the error disappears, because
  `wrapChildQueryOptions("/Permissions", "isEditor", …)` resolves to a `$kind: "Property"` and returns
  `{$select: ["isEditor"]}` instead of `undefined`. Not proven — it needs a browser.

## Checked and in order

The plan's step-14 checklist, item by item, with the evidence.

| Check | Result |
|---|---|
| `@requires` / `@restrict` only in `srv/catalog-service.cds` | Yes: `srv/catalog-service.cds:4` and `:7`. The only other tracked occurrences are prose in comments (`srv/catalog-service.js:5`, `test/metadata.test.js:7`, `test/catalog-service.test.js:283`). Nothing in `db/`, nothing in `srv/annotations/`, nothing in `app/`. |
| `srv/catalog-service.js` holds exactly one `this.on(...)` and no enforcement | Yes: `grep -c 'this\.on(' srv/catalog-service.js` = 1. `req.user` occurs once, `srv/catalog-service.js:11`, inside the reply payload. No `before`, no `after`, no `cds.log`, no `console.log`, no `srv/lib/`, no user-facing string. Matches the plan's code block byte for byte. |
| `UI.*Hidden` only in `app/products/annotations/Products.cds` | Yes: `app/products/annotations/Products.cds:58-60`. Elsewhere only in generated artifacts (`metadata.xml`, the EDMX snapshot) and in comments. ADR-0004 layering holds: presentation in `app/`, the `isEditor` element it reads is service API in `srv/`. |
| No `Authorization` outside `test/` and `ui5-test-runner.json` | Yes. Tracked hits: `scripts/gen-registry.mjs:195` (pre-existing, unchanged — present on `main` too) and `test/catalog-service.test.js:30,33,283`. No credential reaches shipped UI code; `app/products/ui5-test-runner.json` carries a username and no password. |
| `package.json` diff limited to `cds.requires.auth.users` | Yes — the diff is the `"cds"` block only; `sapux` and all scripts untouched. |
| Lockfiles, `manifest.json`, `ui5-mock.yaml`, `ci.yml` unchanged | Yes: `git diff --quiet main...HEAD` exits 0 for `package-lock.json`, `app/products/package-lock.json`, `app/products/webapp/manifest.json`, `app/products/ui5-mock.yaml`, `app/products/package.json`, `app/products/ui5.yaml`, `.github/workflows/ci.yml`. |
| `bob` still a `CatalogEditor` | Yes, `package.json` → `cds.requires.auth.users.bob.roles = ["CatalogEditor"]`. The ADR-0012 draft-lock test still asserts 409 `DRAFT_ALREADY_EXISTS` and is green. |
| `defaults.auth` in every `cds.test` file, and not in the hooks test | Yes: `test/metadata.test.js:8` (new), `test/catalog-service.test.js:6` (pre-existing). `test/hooks-protect-bash.test.js` uses `spawnSync` only, no `cds.test`, no auth — correct. |
| Anonymous `{ auth: null }`, 401 numeric `status`, 403 as `code: '403'` | Yes: the `anonymous` helper at `test/catalog-service.test.js:33`; `expect(err.status).to.equal(401)` for both anonymous assertions and for the singleton; `containSubset({ code: '403' })` for every denied-role assertion. |
| `metadata.xml` and the snapshot consistent with a fresh compile | Yes: `cds compile '*' --to edmx-v4 -s CatalogService -l en \| diff - app/products/webapp/localService/metadata.xml` is empty. Against `main`: **+50 lines, 0 removed**, as the plan predicts. The snapshot test is green in the same tree. |
| English everywhere the AI reads | Yes for code, comments and commit messages (no Cyrillic in any of the four commit messages). Docs: see the observation above. |
| CHANGELOG lines per area | `srv` (2, incl. the contract), `app` (2), `test` (3). `docs` pending for phase 6. |
| Duplication / a second way | None. `docs/registry/HANDLERS.md` said "none, all logic is declarative" before this change, so `srv/catalog-service.js` is the first handler and duplicates nothing; `REUSE-CATALOG.md` lists no utility it could have reused; `SERVICES.md`/`DOMAIN-MODEL.md` had no singleton. The new way ("role-aware UI visibility via a permission singleton") is exactly the case invariant 4 allows: it is carried by an accepted ADR (`ADR-0013` part 8), with the `PATTERNS.md` row scheduled for `docs-keeper` step 15. Caveat: this was checked against `docs/registry/*` and the diff, **not** against `mcp__cds-mcp__search_model` — the registry is freshly regenerated and committed in this branch, so it is current, but the MCP cross-check was not run. |
| Registry freshness | `node scripts/check-docs-fresh.mjs` → "docs/registry is fresh." exit 0; the regenerated registry is committed; no `.stale` marker exists. |

### Commands run by this review

```
npm test                                  → Test Files 3 passed (3) | Tests 38 passed (38)
npm run lint                              → cds lint, no output (clean)
npx prettier --check srv/ test/           → All matched files use Prettier code style!
npx eslint srv/catalog-service.js         → clean
cd app/products && npm run lint           → UI5 linter report: Success! No findings detected.
node scripts/check-docs-fresh.mjs         → docs/registry is fresh. (exit 0)
cds compile '*' --to edmx-v4 … | diff -   → empty (metadata.xml in sync)
diff main metadata.xml                    → 50 added, 0 removed
cd app/products && npm run test:ui        → 4/4 3/3 6/6 4/4 6/6 2/2 = 25 passed, 0 failed (01:46)
git status --porcelain -uall              → clean
```

## Not examined

- `mcp__cds-mcp__search_model` was not run this session; the duplication check rests on the freshly
  regenerated `docs/registry/*` and on the diff.
- `fiori-mcp` was disconnected, so no MCP confirmation of FE's `UI.*Hidden` / `$edmJson` handling; the
  UI5 and FE source citations above are the fallback and are marked "not verified by MCP".
- The browser was not available to this review, so the `Permissions` console error was analysed
  statically from the UI5 sources, not reproduced; the short-path fallback was not tried.
- The pre-existing `T_NEW_OBJECT|Products` i18n assert was not re-measured against `main` (the verifier
  did not either); it is treated as pre-existing on the strength of it naming an FE dialog title that
  this feature does not touch.
