# catalog-hygiene: verification

Date: 2026-10-09. Agent: `ui-verifier`. Server: `npx cds serve --in-memory --port 4004` (fresh).

## Automated tests
Results of plan step 7, quoted from the `test-ui` and reviewer runs (not re-run by this agent):
```
npm test                  -> 144 passed, 11 files
npm run test:ui           -> 42 passed (40 opaTest + 2 QUnit), 0 skipped, job.failed: false
                             against a fresh `npx cds serve --in-memory --port 4004`, run by test-ui on 2026-10-09;
                             the reviewer reproduced 42/42 on port 4013
```
Skipped: the mock-mode check (`npm run start-mock`, PLAN "Risks"): not part of any gate, skipped, not blocking.

## Manual scenario check
| Scenario from PLAN | Steps | Result | Screenshot |
|---|---|---|---|
| V1 alice (blocking) | Primed Basic Auth alice via XHR, opened `#products-display` with `sap-ui-log-level=WARNING`; List Report shows Import from Excel, Create, Delete (disabled until a row is selected, present); opened Notebook Set Object Page: Edit and Delete visible. Console list after both pages: 8 entries, 0 containing `aggregateExpandSelect` or `Permissions/isEditor`; no error entries. `GET Permissions?$select=isEditor` in `$batch` (reqid 137) 200 `isEditor: true` | passed | `screenshots/V1-list-alice.png`, `screenshots/V1-object-alice.png` |
| V2 viewer (blocking) | Isolated browser context `viewerctx`, same-origin XHR priming as `viewer`, then `#products-display`. List Report (15 rows): visible buttons are only Select View, Share, Adapt Filters, Copy to Clipboard, Settings, Excel export, row Navigation: no Create, no Delete, no Import from Excel. Opened Notebook Set Object Page: only Share is visible, no Edit, no Delete. Console: 8 entries, same set as alice, 0 containing `aggregateExpandSelect` or `Permissions/isEditor`. `$batch` `GET Permissions?$select=isEditor` (auth header `viewer`) 200 `isEditor: false` | passed | `screenshots/V2-list-viewer.png`, `screenshots/V2-object-viewer.png` |
| V3 alice price edit | Edit on Notebook Set, typed `1234.56` into Price, Tab, then clicked the section heading to blur the amount/unit pair (the first Tab alone left the PATCH unsent; server log showed it only after the blur). `PATCH ... {"price":"1234.56","currency_code":"USD"}` answered 204, follow-up `DraftMessages` empty, no value-state error (field `1,234.56`). Discard Draft then Discard confirmed (server `DELETE Products(...IsActiveEntity=false)`). Reload with `sap-language=ru`: labels `Цена`, `Валюта`, `Остаток`, `Категория`, `Рейтинг`, `Редактировать`, `Удалить`, price `24,99 USD` unchanged | passed | `screenshots/V3-price-edit.png`, `screenshots/V3-ru-object.png` |
| V0 baseline (long path, bcffde0, port 4005) | Negative control: `git archive bcffde0` (4 long `$Path` values confirmed), `npx cds serve --in-memory --port 4005`, fresh isolated context, alice priming, same `sap-ui-log-level=WARNING`, same in-app List Report to Notebook Set Object Page. Console: 10 entries, exactly 1 matching. Verbatim: `[error] Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot read properties of undefined (reading '$select') at Object.aggregateExpandSelect (.../sap/ui/core/library-preload.js:2436:1633)` from `sap.ui.model.odata.v4.ODataPropertyBinding`. Otherwise the same warnings as V1 | TypeError reproduced (1 on baseline, 0 on the feature build) | `screenshots/V0-object-baseline.png` |

## Network evidence (`$batch` request lines)
```
V1 alice:  POST $batch [GET Permissions?$select=isEditor -> 200 {"isEditor":true}]
V1 alice:  POST $batch [GET Products(ID=0b3e7d8a-...,IsActiveEntity=true)?$select=...&$expand=DraftAdministrativeData(...),category(...) -> 200]
V2 viewer: POST $batch [GET Permissions?$select=isEditor -> 200 {"isEditor":false}]
V3 alice:  POST $batch [POST Products(...,IsActiveEntity=true)/CatalogService.draftEdit -> 201]
V3 alice:  POST $batch [PATCH Products(...,IsActiveEntity=false) {"price":"1234.56","currency_code":"USD"} -> 204; GET ...?$select=DraftMessages -> 200, DraftMessages []]
V3 alice:  DELETE Products(...,IsActiveEntity=false) (Discard Draft, seen in server log)
Failed requests (>=400, all known sandbox noise): GET /appconfig/fioriSandboxConfig.json 404, GET /sap/bc/lrep/flex/settings 404, GET /sap/bc/lrep/flex/data/products 404, POST /sap/bc/ui2/flp;sap-metrics-only 404
```

## Browser console
Baseline: `git show 63abadb8f82ae582a5593d3eefa2c98b9a3b763f:docs/features/products-rating-filter/VERIFICATION.md` section "Browser console" plus `research/contract-delta.md` section 3. Run with `sap-ui-log-level=WARNING`, en; V3 reload in ru checked labels only. Captured console after List Report then Object Page: 8 entries for alice (V1) and the same 8 for viewer (V2); the V3 console (after Edit and Discard) added nothing beyond them.

| # | Level | Entry (count) | Against the baseline |
|---|---|---|---|
| 1 | warn | `Some issues have been detected in your project, please check the UI5 support assistant rule for sap.fe.core` | not named in the baseline; framework message of the Object Page, also present on bcffde0 (V0) |
| 2 | warn | `Warning(s) during processing of Element ...ProductsObjectPage (sap.fe.templates.ObjectPage.ObjectPage)` | not named; also present on bcffde0 (V0) |
| 3 | warn | `[ 6] Set unchanged path: /Products/@com.sap.vocabularies.UI.v1.HeaderInfo` | not named; also present on bcffde0 (V0) |
| 4 | warn | `[ 8] Set unchanged path: /Products/@com.sap.vocabularies.UI.v1.HeaderInfo` | not named; also present on bcffde0 (V0) |
| 5 | info | `Range set DeviceSet has already been initialized` | known noise, named in the baseline |
| 6 | warn | `Setting toggleHeaderOnTitleClick will not take effect as it is not supported in the ObjectPageHeader` | not named; also present on bcffde0 (V0) |
| 7 | assert | `could not find any translatable text for key 'T_NEW_OBJECT|Products'` (x14) | known noise, named in the baseline (FE i18n assert) |
| 8 | issue | `Incorrect use of <label for=FORM_ELEMENT>` (count 3, up to 7 after Edit) | known noise, named in the baseline |

V0 (baseline bcffde0) shows 10 entries: the same 8 plus the TypeError (error, `Failed to read path /CatalogService.EntityContainer/Permissions/isEditor`, from `ODataPropertyBinding`, 1 time, verbatim in the V0 row) and a second `T_NEW_OBJECT|Products` assert group (x6) that follows it. The `Invalid empty segment` warning, the `PropertyInfo validation` and `Variant back reference` messages of the baseline were not in this capture (it starts at the last full navigation and the List Report load is not repeated). Failed requests are the four sandbox 404s named under Network evidence.

New errors: 0. New warnings: 0. Entries 1 to 4 and 6 are not listed in the rating-filter baseline, but they appear identically on the phase 2 commit (V0), so none is introduced by this feature; the only message the feature changes is the V0 `aggregateExpandSelect` TypeError, removed.

The 0-TypeError result of V1/V2 is a measured difference, not a capture-window artifact: the same harness (same log level, same in-app navigation, alice) on the phase 2 commit bcffde0 with the long path shows exactly 1 `aggregateExpandSelect` TypeError (scenario V0), and the feature build shows 0.

## Verdict
Ready for review. The negative control V0 reproduces the TypeError on the long path, so the method detects it. V1 and V2 pass on both pages, V3 passes. The one remark: after typing into Price and pressing Tab the PATCH is not sent until the amount/unit pair loses focus (focus moves to the currency part); this is standard FE behaviour, not a defect.
