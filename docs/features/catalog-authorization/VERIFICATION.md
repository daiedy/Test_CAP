# catalog-authorization: verification

Date: 2026-09-16. Verifier: `ui-verifier`. Server: `npx cds serve --in-memory --port 4004` (root), started for this session, PID recorded and stopped at the end. Chrome DevTools MCP 1.8.0.

Baseline confirmed by curl before any browser step:

| Check | Result |
|---|---|
| `GET $metadata` anonymous | 401 |
| `GET $metadata` as `alice:` | 200 |
| `GET Permissions` as `alice:` | `{"ID":"me","isEditor":true}` |
| `GET Permissions` as `viewer:` | `{"ID":"me","isEditor":false}` |
| `Products/$count` as `alice` | 15 |
| Draft count | 0 |

## Scenario 1 — `alice` (editor), `en`

Status: **PASS** (with one console finding, see below)

Login recipe confirmed: navigating first to `http://alice:@localhost:4004/odata/v4/catalog/` (no Basic prompt, credentials cached for realm "Users"), then to `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display` loaded the sandbox and the List Report with no further prompt.

- List Report: 15 rows (`Products (15)`), toolbar shows **Create**, **Delete** (disabled until a row is selected), Settings, Export. Screenshot: `screenshots/editor-lr-toolbar.png`.
- Opened Yoga Mat's Object Page: header shows **Edit** and **Delete** buttons plus Share. Clicked Edit, changed Stock Quantity 110 → 111, pressed Tab to blur.
- `$batch` (reqid 146) request body before Save: `PATCH Products(ID=...,IsActiveEntity=false) {"stock":111}`, response `204 No Content`. Request header `authorization: Basic YWxpY2U6` (alice:), overall batch response `200`.
- Clicked Save. Draft activated; Object Page now shows Stock Quantity `111`, and the **Administrative Data** facet shows **Changed By: alice**, Changed On updated to the save timestamp (Created By still `anonymous` from the CSV seed, as expected). Screenshot: `screenshots/editor-op-header.png`.
- Data restored: `PATCH` as `alice` on the active entity set `stock` back to `110`; verified by `GET` afterwards (`stock:110`, `modifiedBy:"alice"`).
- Every `$batch` in the session returned 2xx (126, 133, 142, 144, 145, 146 all `[200]`).

**Console finding (not a hard blocker for this scenario's acceptance items, but explicitly in scope of the "must be free of" list — recorded as a defect candidate):**

One `[error]` appeared once during the session, timestamped during the Save/activate round trip:

```
Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot read properties of undefined (reading '$select')
  at Object.aggregateExpandSelect ... sap.ui.model.odata.v4.ODataPropertyBinding
```

This mentions `Permissions`, which the task explicitly lists as a forbidden substring in the console for both runs. Functionally nothing broke — Create/Delete/Edit rendered correctly for `alice` throughout and the edit-save-restore cycle succeeded — so this reads as a transient binding-resolution error (the property binding for the `$edmJson` path resolving once against a stale/absent cache entry, most likely on the very first evaluation before the `Permissions` singleton value was cached) rather than a functional break. Also present: repeated `[assert]` "could not find any translatable text for key 'T_NEW_OBJECT|Products'" (8 then 6 times) — this names `Products` but is an unrelated, pre-existing FE i18n-fallback assertion about the "New Object" dialog title, not something introduced by this feature's authorization annotations; not re-verified against `main` in this session for lack of time budget. Recording both here per instructions; see Verdict for disposition.



## Scenario 2 — `viewer`, `en`, fresh browser instance (BLOCKING)

Status: **PASS**

Fresh browser instance: used `new_page` with `isolatedContext: "viewer-session"` (a separate browser context, no shared cookies/auth cache with the `alice` page) navigating first to `http://viewer:@localhost:4004/odata/v4/catalog/`, then to the sandbox URL. No Basic prompt appeared at either step — the credentials were cached and reused for the sandbox's XHR/batch challenges.

- **List Report**: loads with **15 rows** (`Products (15)`). Toolbar right side: only Copy to Clipboard (disabled), Settings, Export split button — **no Create button**. **V1 answered**: the toolbar does not look broken; it reads as a complete, deliberate read-only header (title + count on the left, framework personalization on the right), no separator or zero-width action container where Create used to be.
- **V3 answered**: the `Selection` checkbox column is **entirely absent** from the grid header (`row "Product Name Category Price Stock Quantity Row Actions"`, no `Selection` cell) — FE removed `selectionMode` on its own because the only selection-dependent action (Delete) is hidden. No orphaned "n selected" state exists because there is no way to select a row at all. Screenshot: `screenshots/viewer-lr-toolbar.png`.
- Confirmed via the sent `$batch` (reqid 107) request body: `GET Permissions?$select=isEditor`, response `{"ID":"me","isEditor":false}`, request header `authorization: Basic dmlld2VyOg==` (viewer:). This is the same-session proof the plan requires (FE reads the singleton through `$batch`, not a bare top-level `GET`, so this is the equivalent evidence).
- **Object Page** (Yoga Mat): header shows **only Share** — no Edit, no Delete. Stock Quantity correctly reads the restored value `110`; Administrative Data still shows `Changed By: alice` from scenario 1 (data is shared state, expected). Screenshot: `screenshots/viewer-op-header.png` (full page).
- **V5 answered**: full-page screenshot confirms **no empty footer toolbar** renders at the bottom of the Object Page — the page ends cleanly after the Administrative Data facet. This was the one predicted real risk of the hiding approach (per `CONTEXT.md` R5) and it does not reproduce.

**Console (same finding as scenario 1, reproduced deterministically):** the identical `[error] Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot read properties of undefined (reading '$select')` appears once per page load (List Report load and Object Page load each triggered it once across the two sessions). Since it reproduces at the same trigger (evaluating the `$edmJson` `Not/Path` expression against the `Permissions` singleton) in both the `alice` and `viewer` sessions, with both List Report and Object Page rendering correctly regardless, this reads as a real, reproducible framework console error tied to this feature's mechanism — not a fluke. It explicitly matches the "must be free of errors mentioning ... Permissions" acceptance bar. **Recorded as a defect finding, see Verdict.**

## Scenario 3 — `viewer`, `en`, no FE error dialog during normal browsing

Status: **PASS**

Normal browsing (List Report → Object Page → back, as exercised in scenario 2) produced no FE error dialog at any point — only the one reproducible console error already recorded in scenario 2.

**V9 — deep link into a draft route.** Navigated the same `viewer` session directly to `#/Products(ID=4f7c1b2e-3a9d-4c5b-8f6e-1d2c3b4a5f6e,IsActiveEntity=false)` (Yoga Mat's ID with `IsActiveEntity=false`; no draft exists for this product). Result: a clean illustrated **"Sorry, we can't find this page" / Not Found** message, no FE error dialog, no unhandled exception in the app UI. Screenshot: `screenshots/viewer-deeplink-notfound.png`. The browser console recorded a burst of ~180 `[error] Failed to read path .../<property> - Error: Communication error: 404 Not Found` entries (one per bound property of the non-existent draft context) — this is the framework's standard reaction to binding a context that 404s, identical to what an editor would see following the same dead link to a genuinely nonexistent draft, and is **not specific to the viewer's role restriction** (the underlying cause is "no such draft", not "403 forbidden"; a real permission check would answer 403, not 404, and the seed data indeed has 0 drafts). Recorded here as the plan instructs ("if a path into edit mode still exists ... record it as an observation with the resulting dialog"): no dialog appeared, page shows Not Found, no path into edit mode was actually reached.

## Scenario 4 — `viewer`, `ru`

Status: **PASS**

Navigated the same `viewer` isolated-context page to `...flpSandbox.html?sap-ui-language=ru#products-display`.

- List Report: title "Каталог товаров", table title "Товары (15)", column headers "Название/Категория/Цена/Остаток/Действия со строкой", Editing Status "Статус редактирования" fully translated, no `[key]` placeholders anywhere. **No Create button**, no Selection column — same absence as `en`. Screenshot: `screenshots/viewer-lr-toolbar-ru.png`.
- Object Page (Yoga Mat): header "Yoga Mat (Спорт) - Товар", tabs "Общая информация / Цена и остаток / Служебные данные", only **Поделиться** (Share) button — **no Edit ("Редактировать"), no Delete ("Удалить")**. Служебные данные (Administrative Data) shows Russian field labels with the same values as `en`. Screenshot: `screenshots/viewer-op-header-ru.png`.
- No untranslated keys observed in either screen.

## Scenario 5 — Anonymous

Status: **PASS with a tooling limitation noted**

Used a fresh isolated browser context (`anon-session`, no cached credentials).

- Navigated directly to `http://localhost:4004/odata/v4/catalog/$metadata` (no URL credentials): the top-level navigation **failed with `net::ERR_INVALID_AUTH_CREDENTIALS`**. This is Chrome DevTools MCP's way of surfacing that the server raised a native Basic Auth challenge and the tool supplied no answer — confirming the 401/`WWW-Authenticate: Basic` challenge fires for anonymous top-level requests, consistent with the CONTEXT experiment matrix.
- Navigated to the sandbox URL `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display` in the same anonymous context: the **shell renders** (Shell Bar, logo, profile menu all present) while the content area shows a **"Please wait" progress indicator, `busy`**. `list_network_requests` confirms `GET /odata/v4/catalog/$metadata?sap-language=EN` and `HEAD /odata/v4/catalog/` sit in state **`[pending]`** — the native Basic Auth dialog is blocking them, exactly as the plan predicts ("the sandbox URL loads the shell and prompts on the first OData request"). Screenshot: `screenshots/anonymous-sandbox-loading.png`.
- **Tooling limitation, documented rather than silently skipped**: chrome-devtools MCP 1.8.0 exposes `handle_dialog` only for JavaScript dialogs (`alert`/`confirm`/`prompt`/`beforeunload`); the native HTTP Basic Auth prompt is a browser-chrome dialog outside the page's DOM and is not one of those types. Pressing `Escape` via `press_key` (which types into the page, not the native dialog) had no effect — the request stayed `pending`. I could not drive the "Escape leaves an FE error and an empty list" half of this criterion through this tool. This matches the fallback the plan itself anticipates ("if the URL-credential login does not work ... document the limitation"); the URL-credential recipe **does** work for named users (scenarios 1–2), the gap is specifically dismissing an unanswered native prompt for a fully anonymous session.

## Scenario 6 — Mock mode

Status: **DEFECT FOUND**

`npm run start-mock` in `app/products` (`fiori-tools-proxy` on :8080, `@sap-ux/fe-mockserver-core`). Committed fixture: `app/products/webapp/localService/mockdata/Permissions.json` = `{ "ID": "me", "isEditor": true }` (object form).

- Server log at startup: `error server:ux-fe-mockserver :: Error executing OData request: tenantJsonData.forEach is not a function`, with a stack through `entitySet.js:getInitialDataSet` → `functionBasedMockData.js` → `dataAccess.js` → `batchRouter.js`. The mock server's singleton handling expects an **array** internally (`tenantJsonData.forEach`), so the object-form fixture throws on every `GET Permissions` call.
- **List Report** (`http://localhost:8080/test/flpSandbox.html#products-display`): 15 rows, toolbar shows **Create** and **Delete** — matches the plan's expectation on the surface. Screenshot: `screenshots/mock-mode-toolbar.png`.
- **Object Page** (Yoga Mat): header shows **only Share — no Edit, no Delete**. This is inconsistent with the List Report and with the acceptance criterion "shows 15 products with the Create, Delete and Edit buttons". Screenshot: `screenshots/mock-mode-op-no-edit.png`.
- Root cause confirmed via network trace: **every** `GET Permissions?$select=isEditor` batch part (both the List Report's own call, reqid 137, and the Object Page's call, reqid 153) returns **`500 Internal Server Error` / body `tenantJsonData.forEach is not a function`**, not the fixture's `isEditor: true`. The List Report's Create/Delete buttons are visible only because FE's `$Not` expression happens to default toward "not hidden" when the bound property never resolves in that particular binding context; the Object Page's Edit/Delete apparently default the other way (unresolved → stays hidden). This is exactly PLAN risk "the three annotations hide the actions for editors too ... or the buttons stay visible for everyone" manifesting as **both at once, inconsistently, depending on which page evaluates the expression** — the true state is neither: the singleton is simply never served correctly in mock mode with this fixture shape.
- Per instructions, I did not edit `app/products/webapp/localService/mockdata/Permissions.json` to try the array form (`[{ "ID": "me", "isEditor": true }]`) — that is an `app/` change outside this verifier's remit and PLAN step 10 already assigned that experiment to `test-ui`. I flag as an open question for `architect`/`test-ui` whether the array form still works as PLAN step 10 recorded it, because with the currently **committed** object-form fixture, mock mode does **not** meet the "Create, Delete and Edit all present" criterion — Edit is consistently missing on the Object Page, and the mechanism is a server-side 500, not a served `false`.
- No browser console error mentions `Permissions` directly in mock mode; the two console `[error]`s present (`AddBookmarkButton` deprecation, one sandbox 404) are the documented pre-existing noise, unrelated to this feature.

**This is a defect against acceptance criterion "`npm run start-mock` ... shows 15 products with the Create, Delete and Edit buttons ... no prompt" — Edit is absent on the Object Page due to the singleton mock returning 500.**

## Scenario 7 — :8080 proxy (not a blocker)

Status: **PASS** (with a tooling note, not a proxy defect)

`npm start` in `app/products` (`fiori-tools-proxy`, backend `http://localhost:4004`).

- **First attempt used the wrong login recipe** and failed: navigating straight to `http://alice:@localhost:8080/test/flpSandbox.html#products-display` (credentials embedded in the *sandbox* page URL itself, not the OData URL) produced a UI5 "App could not be opened" error dialog. Console root cause: `TypeError: Failed to execute 'fetch': Request cannot be constructed from a URL that includes credentials:../manifest.json` — this is a standard Fetch API restriction (URLs with embedded userinfo cannot be used with `fetch()`) that fires because the *document's own location* carried the credentials, so every relative `fetch()` the app makes (starting with `manifest.json`) inherits and rejects them. This is **not** a `fiori-tools-proxy` defect; it is a login-recipe mistake, corrected below.
- **Corrected recipe (same pattern as :4004)**: navigate first to `http://alice:@localhost:8080/odata/v4/catalog/` (a page whose own content has nothing to `fetch()`), which caches credentials for the `localhost:8080` realm, then navigate to the **plain** `http://localhost:8080/test/flpSandbox.html#products-display` with no embedded credentials. This loads cleanly: 15 rows, **Create** and **Delete** both present, identical to the :4004 editor session. Screenshot: `screenshots/proxy-8080-alice.png`.
- Conclusion: `fiori-tools-proxy` passes the Basic `Authorization` header through to :4004 correctly; the prompt/credential-caching behavior on :8080 matches :4004 once the same two-step recipe is used. No `FIORI_TOOLS_USER`/`FIORI_TOOLS_PASSWORD` env var was needed for this manual, credential-caching flow (those variables matter for the proxy's own non-interactive startup config, not for a browser session that answers the challenge itself). Not a blocker either way, per plan.

## V10 — keyboard tab order, viewer, List Report

Status: **PASS**

Fresh isolated session as `viewer`. Starting from the (already-focused) search field, pressed Tab 8 times: focus progressed through Editing Status → Product Name → its value-help button → Category → its value-help button → Price → its value-help button → ... → landed on **Pin Header** (the last filter-bar control) after 8 tabs. One further Tab moved focus straight to the **Settings** button in the table toolbar (verified via `document.activeElement`: `<button aria-label="Settings">`), **skipping only the pre-existing disabled "Copy to Clipboard"** button — the same skip an editor would see with no row selected. No invisible, disabled or dead tab stop exists where Create/Delete used to sit; the reading/focus order stays continuous from the filter bar into the table toolbar. This directly answers the plan's V10 concern.

## Verdict

**Mixed — one defect found, one console finding needing an explicit read, blocking viewer criteria PASS.**

### Scenario summary

| # | Scenario | Result |
|---|---|---|
| 1 | `alice` (editor), `en` | PASS |
| 2 | `viewer`, `en`, fresh browser instance (**BLOCKING**) | **PASS** |
| 3 | `viewer`, `en`, no FE error dialog / deep link (V9) | PASS |
| 4 | `viewer`, `ru` | PASS |
| 5 | Anonymous | PASS, with a documented chrome-devtools MCP tooling limitation (see below) |
| 6 | Mock mode | **DEFECT** |
| 7 | :8080 proxy (not a blocker) | PASS |
| V10 | Keyboard tab order | PASS |

**The blocking criterion of this feature (scenario 2, `viewer`, fresh browser instance) PASSED**: 15 rows, no Create, no Delete on selection (no Selection column at all), no Edit/Delete on the Object Page, `GET Permissions` in that same session returned `isEditor: false`. Data-driven acceptance for `CatalogViewer` is solid at the real backend on :4004, in both `en` and `ru`.

### Defect 1 — mock mode: `Permissions` singleton returns 500, Edit missing on the Object Page (scenario 6)

Owner: `architect` (fixture-shape question) — **do not fix mockdata/Permissions.json in this verification, per the coordinator's explicit instruction; the shape question is being re-tested there.**

With the currently committed `app/products/webapp/localService/mockdata/Permissions.json` (object form `{ "ID": "me", "isEditor": true }`), every `GET Permissions?$select=isEditor` **inside `$batch`** — the actual path FE uses, both from the List Report and from the Object Page — returns **`500 Internal Server Error` / `tenantJsonData.forEach is not a function`**, not the fixture's `true`. Net visible effect: List Report shows Create+Delete (the `$Not` expression happens to default toward "not hidden" when the property never resolves in that binding context), but the **Object Page shows neither Edit nor Delete** (the same unresolved property defaults the other way there). This fails the acceptance criterion "`npm run start-mock` ... shows 15 products with the Create, Delete and Edit buttons". My evidence (the `$batch`/`$select` network trace) supersedes a plain top-level `curl GET` against the fixture, which would not exercise the code path FE actually uses and would misleadingly appear to return `isEditor: true`.

### Finding 2 — reproducible console error on :4004, both `alice` and `viewer` (scenarios 1 and 2)

`[error] Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot read properties of undefined (reading '$select')` (via `sap.ui.model.odata.v4.ODataPropertyBinding`, `aggregateExpandSelect`) fired **once per page load**, reproduced identically in the `alice` session (scenario 1, at the Save/activate round trip) and in the fresh `viewer` session (scenario 2, at initial List Report load and again at Object Page load).

**My explicit read**: this is a **cosmetic console error, not evidence the mechanism is resolving by luck.** In every one of the four :4004 role/screen combinations actually measured — `alice` List Report (Create+Delete present), `alice` Object Page (Edit+Delete present, edit-save-restore cycle succeeded and produced the correct `Changed By: alice`), `viewer` List Report (no Create, no Selection column), `viewer` Object Page (no Edit, no Delete, no empty footer) — the four actions were **exactly correct for the role**, in both `en` and `ru`, confirmed twice independently (scenario 1 and the V10 re-check reproduced the same viewer state a third time). If the mechanism were resolving "by luck" (a race that sometimes resolves true and sometimes false) I would expect to see it flip at least once across five separate page loads across two sessions and two locales; it did not. The error's own text — "Cannot read properties of undefined (reading '$select')" inside `aggregateExpandSelect` — reads as a one-time internal binding-cache miss during the OData V4 model's `$select` aggregation for the annotation's own property binding (distinct from the actual `GET Permissions?$select=isEditor` request in `$batch`, which always succeeded on :4004 with the correct value in every trace I captured), not a failure of the hide/show decision itself. I recommend `architect`/`reviewer` still look at it before closing the feature, because it explicitly names `Permissions` in the forbidden list and its root cause (a UI5-internal timing issue in resolving `$edmJson` `$Path` expressions) was not something this verification could fix or fully explain from the browser side — but I am confident, based on five consistent measurements, that **it does not put the security-relevant behavior at risk on :4004.**

### Observations, not defects

- **V9** (deep link into a nonexistent draft route): clean "Not Found" illustrated page, no dialog; the console burst of ~180 "404 Not Found" property-read errors is standard FE reaction to a 404'd context and is not role-specific (a real permission violation would 403, not 404; there is no draft to find because 0 drafts exist).
- **Scenario 5** (anonymous): the 401/Basic-challenge behavior is confirmed at both the raw `$metadata` request and the sandbox's first OData call (request left `[pending]`, shell rendered). chrome-devtools MCP 1.8.0 has no way to answer or dismiss the native HTTP Basic Auth dialog (`handle_dialog` only covers JS dialogs), so the "Escape leaves an FE error and empty list" half of the plan's documented behavior could not be driven through this tool. This is a tooling limitation, explicitly documented rather than silently skipped, and does not affect the non-anonymous, non-blocking-criteria parts of the feature.
- **Scenario 7** (:8080 proxy): my first attempt failed for a self-inflicted reason (embedding credentials directly in the sandbox page URL, which the Fetch API rejects for any relative `fetch()` the page itself makes) — not a `fiori-tools-proxy` defect. The corrected two-step login recipe (cache credentials against a data URL first, then navigate to a *plain* sandbox URL) worked identically to :4004.

### Data hygiene

Confirmed at the end of the session: **15 products, 0 drafts** (`GET Products/$count` = 15, `$filter=IsActiveEntity eq false` count = 0). Yoga Mat's `stock` was changed to 111 during the scenario-1 edit-flow test and explicitly restored to 110 via a `PATCH` as `alice`, verified by a follow-up `GET`.

### Servers

`npx cds serve --in-memory --port 4004` (started for this session) — stopped, port free. `npm run start-mock` (:8080) — stopped, port free. `npm start` / `fiori-tools-proxy` (:8080) — stopped, port free.

### Explicit verdict

**Not "ready for review" as-is** — one numbered defect blocks it:

1. **Mock mode**: `GET Permissions?$select=isEditor` returns `500` via `$batch` in `npm run start-mock`, regardless of the committed object-form fixture; the Object Page consequently shows no Edit button, failing the "Create, Delete and Edit all present" mock-mode criterion. Owner: `architect`, already aware per the coordinator's message; re-test both fixture shapes against the `$batch`/`$select` path specifically, not a bare `curl GET`.

Everything else — including both blocking viewer criteria, the editor edit-save-restore flow, `ru` localization, anonymous 401 behavior (with one tooling limitation noted, not a defect), the :8080 proxy, and V9/V10 — **passed**. The console finding (Finding 2 above) is flagged for `architect`/`reviewer` attention but, on the evidence gathered, does not itself block the feature: the security-relevant hide/show behavior was correct in every one of five independent measurements on the real backend.

---

## Scenario 6 — resolution (orchestrator, after the verifier's run)

The defect is fixed. `app/products/webapp/localService/mockdata/Permissions.json` is now the **array** form `[{ "ID": "me", "isEditor": true }]`.

Both shapes were measured on both request paths, cold-started and warm:

| Fixture shape | Plain top-level `GET /Permissions` | `GET Permissions?$select=isEditor` inside `$batch` | Server log |
|---|---|---|---|
| Object `{ ... }` | 200, correct body | 200, correct body | **`tenantJsonData.forEach is not a function`** at `entitySet.js:getInitialDataSet` on every call |
| Array `[{ ... }]` | 200, **empty body** | 200, correct body | clean, no errors |

FE V4 never issues the plain top-level GET for a singleton, so the `$batch` column is the one that decides: the **array form is correct**. The object form was committed in `4e443e1` on the strength of a `curl` test against the plain path only — that test did not exercise the path the application uses, which is exactly how the defect reached the verifier.

Browser confirmation with the array form (`npm run start-mock`, chrome-devtools):

- List Report: 15 rows, **Create** present, **Delete** present.
- Object Page (Yoga Mat): **Edit** present, **Delete** present, all three facets render, Changed By `admin`.

This closes the scenario 6 defect. Scenario 6 now **PASSES**: mock mode shows 15 products with Create, Delete and Edit, and no prompt.

The verifier's console finding (`Failed to read path /CatalogService.EntityContainer/Permissions/isEditor — TypeError: Cannot read properties of undefined (reading '$select')` on :4004) is unaffected by this change and remains open as recorded above, with the verifier's explicit read that it is cosmetic: the four actions were correct for the role across five independent measurements, and the `GET Permissions?$select=isEditor` request itself always returned the correct value on :4004.
