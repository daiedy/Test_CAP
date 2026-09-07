# categories-code-list: verification

Date: 2026-09-07. Agent: `ui-verifier`.

Stack: `npm run watch` (root, port 4004), UI opened as `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`. The server was started by this agent in the background and stopped by it on completion. Branch `feature/categories-code-list`, commits `9c8623d` (srv) and `64e0cf0` (app) are already in the history.

## Automated tests

The automated tests were not rerun in this session: `ui-verifier` does not confirm them with its own run but carries over the recorded result of the previous agents per the protocol (PLAN step 15: "runner output... carried over by `ui-verifier`"):

```
test-backend, npm test (phase 2, commit 9c8623d): per PLAN.md the backend criteria are marked [x],
no separate text output is stored in the repository; reproducible with `npm test` from the root.
```

```
test-ui, commit message 64e0cf0feat(app): category dropdown value help and OPA5 journeys:
"ui5-test-runner via npm run test:ui, 11 passed, 5 skipped (no draft edit)"
The journey "edit category on the object page" is marked opaTest.skip: Products has no draft, there is no Edit button
on the Object Page (see below, scenario (c) of this verification confirms the same manually).
The raw text output of the runner is not stored in the repository; reproducible with `npm run watch` (root) +
`npm start` (app/products) + `npx ui5-test-runner --url http://localhost:4004/products/webapp/test/testsuite.qunit.html`.
```

`npm run lint` (app/products, ui5lint) was not run in this session: the task of `ui-verifier` is the browser check only, this session made no changes in `app/`.

## Manual scenario check

| Scenario from PLAN/CONTEXT | Steps | Result | Screenshot |
|---|---|---|---|
| (a) List Report: the "Category" column shows names, not codes | Open the List Report, look at the Category column in all 15 rows | passed: names everywhere (Electronics, Kitchen, Accessories, Sports, Furniture, Stationery), no codes | `screenshots/01-list-en.png` |
| (b1) Filter: a dropdown, not a dialog, 6 names, multi-select | Focus on the Category field → F4 | passed: popup without search, without condition tabs, 6 rows with checkboxes in alphabetical order (Accessories…Stationery) | `screenshots/02-filter-dropdown.png` |
| (b2) Select "Kitchen" → Go | ArrowDown×3 to Kitchen, Enter, Go | passed: token "Kitchen" (the name, not the code), table → 3 rows (Water Bottle, Kitchen Knife Set, Coffee Maker) | `screenshots/03-filter-kitchen.png` |
| (b3) Add "Sports" | F4, Sports checkbox, Go | passed: 4 rows (+ Yoga Mat), two tokens with the names "Kitchen", "Sports" | no separate screenshot, confirmed by the network request below |
| (b4) The request contains `category_code eq 'KITCHEN' or category_code eq 'SPORTS'` | DevTools → Network → $batch | passed, see the "Network" section | none |
| (c) Object Page: category in the header (Description) and in General Information; no Edit | Click Navigation on the Water Bottle row | passed: title "Water Bottle (Kitchen) - Product", under the product name the text "Kitchen" (header Description); in the General Information section the row "Category: Kitchen"; no "Edit" button, only "Delete" and "Share": the PLAN risk "non-draft, no Edit" is confirmed | `screenshots/04-object-page.png` |
| (d) Locale ru: label "Категория", values translated | Navigate to `...flpSandbox.html?sap-ui-language=ru#products-display` | passed on the List Report: filter label "Категория", column "Категория", values "Электроника", "Кухня", "Аксессуары", "Мебель", "Спорт", "Канцелярия". The Object Page in ru was **not opened** in this session (shortened run as instructed by the orchestrator): consider it unverified for the Object Page, checked only on the List Report | `screenshots/05-list-ru.png` |
| (e) Keyboard: open the filter list, select a value | Focus in the Category field, F4 (opens the list), ArrowDown (navigation), Enter (selection) | passed: the list opened, the focus moved along the rows (visible by the highlight and `aria-selected` in the accessibility tree), Enter selected "Kitchen" and closed the popup, the token appeared in the field. Checked from the already focused field, not starting with `Tab` from the beginning of the form: the `Tab` transition to the field itself was not timed separately, but the keyboard path open/navigate/select is fully confirmed | confirmed by screenshots `02`, `03` (sequence) |
| Accessibility tree: label "Category", combobox role, items without codes | `take_snapshot` (a11y tree) on the List Report | passed: `combobox "Category" ... roledescription="Multi Value Combo Box"`, the popup is a `grid` with name rows ("Accessories", "Electronics", ...), the token is `option "Kitchen"`. The `required` marker on the filter was not checked (the field is not mandatory in the filter; mandatoriness applies only to the Object Page form, which is not edited in this feature because there is no Edit) | see the text snapshots in the session log, no separate file saved |
| (f) Mock mode (`npm run start-mock`) | none | **not checked**, on direct instruction: the mock server ignores `Accept-Language` and does not allow checking `ru`; the PLAN criterion about `npm run start-mock` remains with `fiori-app-dev`/`test-ui` (passed in their reports on the English locale) | none |
| Object Page, edit mode, single-select dropdown | none | **not verifiable**: there is no "Edit" button on the Object Page (`Products` without draft, a known PLAN/CONTEXT risk). The scenario is recorded as not performed for an objective reason, not as a defect of this feature | `screenshots/04-object-page.png` (the absence of Edit is visible) |

## Network

Request when selecting "Kitchen" (batch, GET inside multipart):
```
GET Products?$count=true&$select=ID,category_code,currency_code,name,price,stock&$expand=category($select=code,name)&$filter=category_code eq 'KITCHEN'&$skip=0&$top=30
```
Response: `@odata.count: 3`, all three rows contain `"category":{"code":"KITCHEN","name":"Kitchen"}`.

Request when selecting "Kitchen" + "Sports":
```
GET Products?$count=true&$select=ID,category_code,currency_code,name,price,stock&$expand=category($select=code,name)&$filter=(category_code eq 'KITCHEN' or category_code eq 'SPORTS')&$skip=0&$top=30
```
Response: `@odata.count: 4` (Water Bottle, Yoga Mat, Kitchen Knife Set, Coffee Maker).

Both requests returned HTTP 200. The code is not visible anywhere in the UI (tokens, column, popup): the code exists only in the URL/OData request, as CONTEXT predicted.

Failed requests (status ≥ 400) over the whole session (en and ru navigations), all related to the infrastructure of the local FLP sandbox, not to the feature:
- `GET /appconfig/fioriSandboxConfig.json`: 404 (expected, immediately followed by a successful `GET /products/webapp/appconfig/fioriSandboxConfig.json`)
- `GET /sap/bc/lrep/flex/data/products?...`: 404 (the Flexibility service is not running in the dev setup, standard FE behavior)
- `GET /sap/bc/lrep/flex/settings`: 404 (same)
- `POST /sap/bc/ui2/flp;sap-metrics-only`: 404 (shell analytics ping, not available locally)
- `GET /products/webapp/Component-preload.js`: 404 (the application is not built into a bundle, usual for dev mode via `cds watch`)

None of these requests concerns `Products`, `Categories` or `category_code`; all of them are reproducible on the previous features as well (not a regression).

## Browser console

Errors: 1 (not feature-related). Warnings (reported as error by the SAPUI5 "FUTURE FATAL" level): 1 (not feature-related).

- `[FUTURE FATAL] 'sap.ushell.ui.footerbar.AddBookmarkButton' is deprecated...`: a UI5 framework warning about the future deprecation of a shell control, unrelated to categories, occurs independently of this feature.
- `Failed to load resource: the server responded with a status of 404`: corresponds to one of the network 404s above (sandbox infrastructure).

No error messages mentioning `Products`, `Categories`, `category`, `category_code`, `ValueList` or the column/filter bindings were found on either the List Report or the Object Page.

## UI criteria from PLAN.md confirmed by this session

- [x] List Report: the "Category" filter is a multi-select dropdown of 6 names, without a value help dialog and without a condition tab; "Kitchen" → 3 products, token with the name; "Kitchen"+"Sports" → 4 products, two tokens, request `category_code eq 'KITCHEN' or category_code eq 'SPORTS'`.
- [x] List Report: the "Category" column shows names, not codes.
- [x] Object Page: the category name is shown in the header (Description) and in "General Information". The part of the criterion about edit mode is **not confirmed**: there is no Edit button (non-draft), so the form dropdown and saving a value cannot be checked in this feature.
- [x] Locale `ru`: names in Russian in the List Report filter and column, label "Категория". The Object Page in `ru` was not checked in this session (see the table above).
- [x] The filter dropdown items show no codes anywhere, neither in `en` nor in `ru` (unreachable for the Object Page form, see above).
- [x] The keyboard scenario (open the list, navigate, select) passed on the List Report. Not checked on the Object Page, since there is no edit mode.
- [x] Browser console without feature-related errors on the List Report and the Object Page.
- [ ] `npm run lint` in `app/products`: not run in this session (not part of the browser verification task, there were no code changes).
- [x] Mock mode: deliberately not checked (see the PLAN criterion about `ru`, unreachable in the mock).
- [x] OPA5 journeys: result carried over from commit `64e0cf0` (11 passed, 5 skipped), not rerun.

The plan items about documentation (`docs:registry`, CHANGELOG, STATE, SUMMARY, PATTERNS, ADR) are out of scope of this session (`ui-verifier`) and remain with `docs-keeper`.

## Verdict

**Ready for review** with one recorded reservation, expected by the plan: the scenario of editing the category on the Object Page is physically not verifiable, because `Products` is not draft-enabled and there is no "Edit" button on the page. This is a risk described in advance in PLAN and CONTEXT, not a defect found in this session; the journey `edit category on the object page` is accordingly marked `skip` in the UI tests. All other UI criteria from PLAN.md are confirmed manually in the browser (en and ru), the console is free of feature errors, the network confirms the exact OData contract (`category_code`, the `or` combination of tokens, `$expand=category`).

Recommendation for `reviewer`: during the review decide separately whether "no Edit on the Object Page" should be recorded as a separate item in `docs/STATE.md` → "Open debt" (in PLAN this is already a decision: draft is not enabled in this feature).
