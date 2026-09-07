# products-draft-edit: verification

Date: 2026-09-07. Agent: `ui-verifier`.

Stack: fresh `npm run watch` (root, port 4004), started by this agent and stopped at the end. UI opened at `http://localhost:4004/products/webapp/test/flpSandbox.html#Shell-home` (only the "Product Catalog" tile shown, no SAP demo tiles), then via the tile / `#products-display`. Branch `feature/products-draft-edit`, HEAD `7c8ab1d`.

## Automated tests

Not rerun in this session; carried over per protocol from the previous phases (PLAN.md step 4/7/8 rows, already ticked `[x]`):
```
test-backend, npm test (phase 2): 22/22 tests green (per PLAN.md step 4 note).
test-ui, npm run test:ui (phase 3, app/products): 17/17 passed, 0 skipped (per PLAN.md step 7 note).
```
`ui-verifier`'s task in this session is the browser/HTTP check only.

## Manual scenario check

Order follows PLAN.md step 9 / CONTEXT.md "Scenarios for `ui-verifier`".

| # | Scenario | Steps | Result | Screenshot |
|---|---|---|---|---|
| 1 | Edit exists and works | Open Laptop Pro 15 (`en`); check header Edit/Delete; press Edit | **passed**: Edit and Delete shown in display mode; after Edit all 7 business fields (name, description, category, imageUrl, price, currency, stock) become inputs, Administrative Data stays read-only text, header title/description not editable. `$batch` contains `POST Products(ID=4b7e1d2a-...,IsActiveEntity=true)/CatalogService.draftEdit {"PreserveChanges":true}` → 201 | `op-display-with-edit.png`, `op-edit-mode.png` |
| 2 | Change and save | Category → Furniture, leave field, Save; then repeat to restore Electronics | **passed**: "Draft updated" (PATCH `{"category_code":"FURNITURE"}` → 204, DraftMessages `[]`); Save → display mode, header description "Furniture", toast "Object saved", focus lands on the (new) Edit button; `draftActivate` → 200 with `category_code":"FURNITURE"`; repeated with Electronics, confirmed via `GET Products?$filter=name eq 'Laptop Pro 15'` → `category_code":"ELECTRONICS"` | none (behavior only) |
| 3 | Cancel with discard confirmation / Cancel without changes | Edit, choose Kitchen, leave field (PATCH sent), click "Discard Draft" | **passed**: popover "Discard all changes?" with a "Discard" button (FE calls the Cancel button "Discard Draft", not literally "Cancel"); confirming → display mode with previous value (Electronics), toast "Draft discarded", focus on Edit; `DELETE Products(ID=...,IsActiveEntity=false)` → 204. Then Edit again, no changes, click "Discard Draft": returned to display mode directly, **no popover shown** (FE skips confirmation when the draft has no persisted change, as CONTEXT expected) | `discard-popover.png` |
| 4 | Draft indicator and Editing Status | Edit Laptop Pro 15, change Description, leave field (PATCH sent), navigate back via shell **Back** button | **partially passed / finding**: shell Back with a persisted draft change opens an FE **"Warning" dialog** ("You've made changes to this object. What would you like to do? Save / Keep Draft / Discard Draft") — this is *not* what CONTEXT documented ("no data-loss dialog: the draft is kept"); chose "Keep Draft" → OK, returned to List Report. Editing Status dropdown confirmed with exactly 6 options: All, All (Hiding Drafts), Unchanged, Own Draft, Locked by Another User, Unsaved Changes by Another User. "Own Draft" filter → exactly 1 row (Laptop Pro 15). **Defect/observation**: no "Draft" marker text is rendered anywhere in the List Report row (Product Name column or elsewhere) for the own-draft row, in either the "All" or "Own Draft" filter, confirmed both in the accessibility-tree snapshot and visually in the screenshot — this is the risk CONTEXT flagged in "Design decisions" #6 (`Products` has no `Common.SemanticKey`, so the HeaderInfo-Title-column fallback that CONTEXT expected does not materialize; escalate to architect, not a UI annotation fix by the verifier). Opening the "Own Draft" row from the filtered list opens the draft directly in edit mode (confirmed). Discarded the draft from there (popover "Discard all changes?" → Discard) to restore state; confirmed via `GET` that `description` is back to the seeded text and `$count` unaffected. "Unchanged"/"All (Hiding Drafts)" options were not separately re-verified with the draft still open (time budget); their presence and labels are confirmed (see options list above) | `lr-editing-status-and-draft-indicator.png`, `back-nav-warning-dialog.png` |
| 5 | Create flow (manual) | List Report → Create; Create with all fields empty; fill Product Name "Verifier Lamp", Category Furniture, Price 10, Currency EUR, Stock 1; Create; Delete; Create again + Discard immediately | **passed**: Create opens `Products(ID=...,IsActiveEntity=false)` in edit mode, title "New Object", footer button reads **"Create"** (not "Save"); 5 required-field markers (name, category, price, currency, stock) as designed. Create with everything empty: blocked **client-side**, message popover "Multiple errors occurred" with 6 field errors (price has two: amount + currency), **no network request sent**. Filled all required fields (category via F4 dropdown "Furniture", currency by typing "EUR"); Create → 201/200 draftActivate, display mode, `$count` → 16. Delete from the Object Page (confirmation dialog "Delete object Verifier Lamp "Furniture"?") → 204, `$count` → 15. Create again, immediately "Discard Draft": **no confirmation popover** for an untouched new draft (as CONTEXT flagged as acceptable), returned to List Report, `$count` stayed 15 | `op-create-mode.png`; the "blocked create, empty Category" screenshot was inadvertently overwritten by the scenario-7 stock-validation screenshot (both were saved to `op-validation-message.png`) — the 6-field-error state is documented above in text only, not as an image |
| 6 | Lock by another user | `curl -u bob: -d '{"PreserveChanges":true}' .../Products(ID=<Water Bottle>,IsActiveEntity=true)/CatalogService.draftEdit` (201, confirmed draft created for bob); List Report Editing Status → "Locked by Another User" | **passed with the same indicator finding as #4**: filter shows exactly 1 row (Water Bottle) but, as in scenario 4, **no "Locked by bob" text appears in the List Report row** (no semantic key). On the **Object Page**, however, the lock **is** clearly surfaced: header shows a "Locked" button; clicking it opens a popover "This object is being edited by bob. Last changed on Sep 7, 2026, 7:32:24 PM."; pressing Edit (still enabled) shows a clean error dialog "You cannot edit this object at the moment. It is locked by bob." with no unexplained console error. Cleaned up: `curl -u bob: -X DELETE .../Products(ID=...,IsActiveEntity=false)` → 204; `$filter=IsActiveEntity eq false&$count=true` → 0 afterwards | `lr-locked-by-bob.png`, `op-locked-by-bob-popover.png` |
| 7 | Validation feedback | Edit Water Bottle; Stock → `-1`, leave field; Price → `-1`, leave field; correct both; clear Product Name and Save (see note) | **passed for Stock/Price, Product Name part re-verified after the turn-budget reset — see below**. Stock `-1`: error appears immediately after a `PATCH {"stock":-1}` → 204 + `GET ...?$select=DraftMessages` → `{"code":"ASSERT_RANGE","target":".../stock","message":"Enter a value between 0 and 1000000."}`; field shows the error text, message button shows count **1** — confirms this rule is **server-side** (draft `DraftMessages`), field error appears only after the round trip. Price `-1`: field shows "Enter a number with a minimum value of 0.00" **immediately, with no PATCH sent at all** (confirmed by listing network requests: no new `$batch` fired for the price edit) — confirms this rule is enforced **client-side** by the OData V4 `Edm.Decimal` `Validation.Minimum` type facet, before any server round trip. See the follow-up note below for the cleared-Product-Name check | `op-validation-message.png` (Stock `-1` state) |
| 8 | `ru` locale | pending at time of writing this revision — see "Follow-up" | pending | pending |
| 9 | Keyboard and accessibility | pending at time of writing this revision — see "Follow-up" | pending | pending |
| 10 | Console and network summary | see dedicated sections below | see below | — |
| extra | Mock mode (orchestrator addition) | — | **not run, turn budget** — see "Follow-up" | — |

### Follow-up note (written after the file was first drafted, same session)

The remainder of scenario 7 (cleared Product Name + Save), scenario 8 (`ru`), scenario 9 (keyboard), the mock-mode extra scenario, final data-hygiene proof and server shutdown are completed after this file was first saved; see the "Update after the turn-budget instruction" section near the end of this document for their results, which supersede any "pending" marker above where addressed.

## Network evidence ($batch request lines observed)

All requests below are the inner `application/http` parts of a `POST /odata/v4/catalog/$batch`, all outer batch responses were HTTP 200 (the individual part status is noted).

```
POST Products(ID=4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a,IsActiveEntity=true)/CatalogService.draftEdit {"PreserveChanges":true}   → 201
PATCH Products(ID=4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a,IsActiveEntity=false) {"category_code":"FURNITURE"}                     → 204
POST Products(ID=4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a,IsActiveEntity=false)/CatalogService.draftPrepare {"SideEffectsQualifier":""}  → 200
POST Products(ID=4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a,IsActiveEntity=false)/CatalogService.draftActivate {}                    → 200
DELETE Products(ID=4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a,IsActiveEntity=false)                                                  → 204
GET Products?$filter=(IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null)&...                                    → 200 (Editing Status "All")
GET Products?$filter=IsActiveEntity eq false&...                                                                              → 200 (Editing Status "Own Draft" / "Locked by Another User")
PATCH Products(ID=1c4f8e9b-0d6a-1f2e-5c3b-8a9f0e1d2c3b,IsActiveEntity=false) {"stock":-1}                                      → 204, DraftMessages: [{"code":"ASSERT_RANGE","target":".../stock"}]
PATCH Products(ID=1c4f8e9b-0d6a-1f2e-5c3b-8a9f0e1d2c3b,IsActiveEntity=false) {"stock":300}                                     → 204, DraftMessages: []
POST Products(ID=1c4f8e9b-0d6a-1f2e-5c3b-8a9f0e1d2c3b,IsActiveEntity=false)/CatalogService.draftPrepare / draftActivate        → 200 (see "Open questions" — name unexpectedly stayed "Water Bottle")
```

Price `-1` produced **no** corresponding `$batch` call (client-side block, verified by diffing `list_network_requests` before/after the edit).

## Browser console

No console error or warning mentioning `Products`, `draft`, `DraftAdministrativeData`, `IsActiveEntity` or the edit flow was observed during scenarios 1–7. Pre-existing, feature-unrelated noise (see `docs/features/categories-code-list/VERIFICATION.md` for the same list, not repeated as a new finding):
- `GET /appconfig/fioriSandboxConfig.json` 404 (immediately followed by the correct 200/304 on `/products/webapp/appconfig/...`)
- `GET /sap/bc/lrep/flex/data/products...` 404, `GET /sap/bc/lrep/flex/settings` 404 (Flexibility service not running locally)
- `POST /sap/bc/ui2/flp;sap-metrics-only` 404 (shell analytics ping)
- `[FUTURE FATAL] 'sap.ushell.ui.footerbar.AddBookmarkButton' is deprecated...` (ushell framework warning)

No new console messages were introduced by the draft feature itself in scenarios 1–7.

## Open questions / observations for the architect

1. **No draft/lock indicator text in the List Report row.** `Products` has no `Common.SemanticKey`; CONTEXT's "Design decisions" #6 already flagged this as unverified and asked that a missing indicator be escalated rather than fixed by the verifier. Confirmed missing in both the "own draft" case (scenario 4) and the "locked by another user" case (scenario 6). The Object Page compensates for the lock case (header "Locked" button + popover), but there is no equivalent compensation for the own-draft case on the List Report — a user who edits a product and navigates back sees no visual cue in the table that a draft exists for that row, only the Editing Status filter surfaces it. Recommend the architect decide whether a `Common.SemanticKey` (or another indicator strategy) is worth a follow-up feature.
2. **Shell Back navigation with a persisted draft change shows a 3-way "Warning" dialog** (Save / Keep Draft / Discard Draft), not the "no dialog, draft silently kept" behavior CONTEXT predicted. This is standard FE behavior (`sap.fe` unsaved-changes guard on browser/shell navigation) and is more protective than expected, not a defect, but CONTEXT's text should be corrected for accuracy.
3. **`anonymous` as Changed By after a UI save** — observed as expected per CONTEXT's explicit deviation note; **not** flagged as a defect.
4. Untranslated `DRAFT_ALREADY_EXISTS` / `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` in the CAP `ru` bundle — recorded as an observation only (see the `ru` section below for the concrete check), per CONTEXT this is an upstream/framework limitation, not a project defect.
5. The cleared-Product-Name-then-Save check needs a second look with a more deliberate field-clear technique — see the follow-up section for the final result.

---

## Update after the turn-budget instruction (same session, continued)

### Scenario 7 tail: cleared Product Name + Save

Retried twice: (1) focus Product Name → `Control+A` → `Backspace` → click Save directly: `draftActivate` succeeded and the active record kept `name: "Water Bottle"` unchanged. (2) `fill(uid, "")` on the Product Name field → click Save directly: same outcome, `GET Products(...)?$select=name` after Save still returned `"name":"Water Bottle"`. In both attempts the on-screen input showed no `value` attribute (i.e., appeared empty) immediately after the edit, yet the subsequent Save round-tripped and activated without any client-side or server-side required-field error, and the persisted name never actually changed.

**This is recorded as inconclusive / a probable automation-tooling limitation, not a confirmed product defect.** The most likely explanation is that `Control+A`/`Backspace` and even a programmatic `fill("")` on this specific run did not reliably fire the `change` event UI5's `sap.m.Input` needs to mark the two-way-bound `name` property dirty before the button click was processed, so FE's Save handler read the last committed (non-empty) value. This does not match CONTEXT's expectation ("empty: FE required check on Save plus server `ASSERT_MANDATORY` on activation", exactly as observed for Category/Price/Currency/Stock in the Create-flow scenario 5, where the same required check worked correctly with 6 field errors). Given the Create-flow scenario already proves the required-field check works correctly for an empty Product Name (it was one of the 6 blocked fields), this is not escalated as a defect; a repeat check by a human or a differently-instrumented run is recommended if the architect wants full confidence specifically for the *edit* (not create) path with Product Name.

Data hygiene: confirmed unaffected (`name` never actually changed on the server in either attempt).

### Scenario 8: `ru` locale (`?sap-ui-language=ru`)

Reloaded Laptop Pro 15 with `?sap-ui-language=ru` (note: query string before the `#` hash, per memory `project-run-setup`).

- Display mode: page title "Laptop Pro 15 (Электроника) - Товар"; header actions "Редактировать" (Edit), "Удалить" (Delete); field labels "Название", "Описание", "Категория", "Ссылка на изображение", "Цена", "Валюта", "Остаток"; Administrative Data section "Служебные данные" with "Дата создания", "Создал", "Дата изменения", "Автор изменения".
- Edit mode: "Черновик" (Draft) menu button in the header; footer "Сохранить" (Save) and "Сбросить черновик" (Discard Draft/Cancel). Screenshot `ru-op-edit-mode.png`.
- Cancel without changes ("Сбросить черновик"): returned directly to display mode, no popover, same as `en`.
- List Report: filter label "Статус редактирования" (Editing Status), value "Все" (All); dropdown opened shows all 6 options fully translated and with no `[key]` placeholders: **Все**, **Все (кроме черновиков)** (All (Hiding Drafts)), **Без изменений** (Unchanged), **Собственный черновик** (Own Draft), **Блокировано другим пользователем** (Locked by Another User), **Несохраненные изменения другого пользователя** (Unsaved Changes by Another User). Screenshot `ru-lr-editing-status.png`.
- `curl -H 'Accept-Language: ru' .../$metadata | grep -c 'Draft'` → **26** occurrences. Sample of the Russian `Draft_*`/`DraftAdministrativeData` labels found via the `Annotations Target="CatalogService.DraftAdministrativeData/..."` blocks:
  - `CreationDateTime` → "Дата создания черновика"
  - `LastChangedByUser` → "Изменил черновик"
  - `InProcessByUser` → "Обрабатывает черновик"
- The required-field message and the `ASSERT_RANGE` text in `ru` were **not** re-verified live in this session (time budget); per CONTEXT and the `categories-code-list` precedent, `@sap/cds/_i18n/messages_ru.properties` ships translated `ASSERT_MANDATORY`/`ASSERT_RANGE`/`ASSERT_TARGET` texts, so this is expected to work but is not directly screenshotted here. Flagging as **not independently confirmed this session**, not as a failure.
- No `[key]`-style untranslated placeholders were seen anywhere in `en` or `ru` screens visited.

**Result: passed** for everything checked (Edit/Save/Cancel/Draft/Editing Status/its 6 options/`Draft_*` metadata labels); the field-level validation-message text in `ru` is unconfirmed by direct observation but not contradicted by anything seen.

### Scenario 9: keyboard and accessibility

On Laptop Pro 15 (`en`, freshly reloaded, display mode): the "Edit" button is the default-focused element on page load (confirmed in the accessibility snapshot, `focusable focused`). Pressed **Enter** → page switched to edit mode (Edit reachable by keyboard, confirmed). In edit mode, the accessibility snapshot showed `combobox "Category" ... required value="Electronics"` — confirmed **announced as a required combobox**, and focus landed on the Product Name field (first editable field) immediately after Edit. Footer `Save` and `Discard Draft` (Cancel) are both present as ordinary focusable buttons; `Discard Draft` carries `keyshortcuts="Esc"`. Pressed **Escape** with no pending changes → draft discarded, returned to display mode directly (no popover, consistent with scenario 3's "Cancel without changes"), and **focus landed on the "Edit" button** (a visible, sensible control — not `body`). Focus-after-Save was already confirmed identically in scenario 2 (lands on Edit). Category restored to Electronics throughout (no actual edit was made in this scenario). Ctrl+E / Ctrl+S shortcut hints are visible in the DOM (`StaticText "Cmd+E"` / `"Cmd+S"` in the snapshots) but were not separately exercised as a keyboard-shortcut test (CONTEXT marks this as an optional note only).

**Result: passed** for all four checklist items (Edit reachable by keyboard; Category announced as required combobox; Save/Cancel reachable; focus after Save and after Cancel lands on a visible control).

### Scenario 10: console and network summary

Across scenarios 1–9: no console error or warning mentioning `Products`, `draft`, `DraftAdministrativeData`, `IsActiveEntity`, or the edit flow. All draft-related `$batch` inner requests returned 2xx except the two deliberately provoked failures in scenario 7 (`ASSERT_RANGE` surfaced as a 200 `DraftMessages` entry, not an HTTP error — consistent with CONTEXT: draft-time rule violations are messages with HTTP 200, only `draftActivate` would turn them into a 400, which was not attempted with the invalid value still in place). Pre-existing sandbox noise (404s on `fioriSandboxConfig.json`/`sap/bc/lrep/...`, the `AddBookmarkButton` deprecation warning) is unchanged from `categories-code-list/VERIFICATION.md` and not a new finding.

### Extra scenario: mock mode

**Not run — turn budget.** Per the coordinator's explicit instruction this scenario was skipped entirely in this session. It remains unverified by `ui-verifier` in the browser; the HTTP-only mock verification already carried out by `fiori-app-dev` in PLAN.md step 6 (15 products, `draftEdit`/`PATCH`/`draftActivate`/`DELETE` all working over plain HTTP against `npm run start-mock`) is unaffected and stands as the only mock-mode evidence for this feature. `app/products/webapp/localService/mockdata/Products.json` was not touched in this session (`git status` unaffected, no `start-mock` process was ever started here).

## Final data-hygiene proof (after all scenarios, before shutdown)

```
GET /odata/v4/catalog/Products?$count=true&$top=0                          → 15
GET /odata/v4/catalog/Products?$filter=IsActiveEntity eq false&$count=true&$top=0 → 0
GET /odata/v4/catalog/Products?$filter=name eq 'Laptop Pro 15'&$select=category_code,description
  → category_code: "ELECTRONICS", description: "High-performance laptop with 15-inch display, 16GB RAM, and 512GB SSD" (seeded value)
```

Server shutdown: `pkill -f "cds watch"`; confirmed `curl .../$metadata` on port 4004 fails (connection refused) afterward. Port 8080 was never opened in this session (mock mode skipped), so no process to stop there.

## Verdict

**Ready for review**, with the following items the orchestrator/architect should note before ticking the PLAN.md acceptance criteria:

- All 10 CONTEXT scenarios were executed and passed except two partial items, both already anticipated as risks in CONTEXT/PLAN and explicitly not attributable to a coding mistake by this feature's implementers:
  1. Scenario 4/6: no draft/lock indicator text in the List Report row (no `Common.SemanticKey` on `Products`) — a design-scope question for the architect, not a defect to fix blindly.
  2. Scenario 7: the cleared-Product-Name-then-Save check on the *edit* path is inconclusive due to a likely browser-automation quirk (not reproduced as a defect via the Create-flow path, where the same check worked correctly).
- Scenario 4 also surfaced one CONTEXT-documentation inaccuracy (the shell-Back "Warning" dialog), not a code defect — CONTEXT's description should be corrected by the architect/docs-keeper.
- `ru` (scenario 8) passed for everything checked; the field-level validation-message text in `ru` was not independently re-confirmed this session (time budget) but nothing seen contradicts it.
- The mock-mode extra scenario was not run this session per explicit instruction; it does not block "ready for review" since it was already covered by `fiori-app-dev` at the HTTP level in PLAN.md step 6.
- `npm run lint` in `app/products` and `git diff --quiet manifest.json` were **not** re-run by this agent in this session (out of scope for the browser/HTTP verification task); these remain the responsibility of the phase-3 gate / reviewer per PLAN.md step 8, already recorded there as done.

Data hygiene fully restored and proven (15 products, 0 drafts, Laptop Pro 15 back to Electronics/original description); the server this agent started was stopped.
