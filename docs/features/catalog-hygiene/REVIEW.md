# catalog-hygiene: review

Date: 2026-10-09. Agent: `reviewer`. Scope: `git diff main...HEAD` (d1824ff spec and ADR-0003 amendment, bcffde0 backend, c47e8ed UI) plus the uncommitted `VERIFICATION.md` and `screenshots/`. `docs/STATE.md` and `docs/codemie/` excluded by the orchestrator. Documentation of step 10 (ADR-0013 amendment, PATTERNS, CONVENTIONS, CLAUDE.md, STATE rows, SUMMARY) is not judged as missing.

## Blocking
- none

## Important
- `docs/features/catalog-hygiene/VERIFICATION.md:24-25` The "Browser console" section is unfinished: line 25 ends with the leftover word `pending`, there is no "New errors: N. New warnings: N." line, and the 8 console entries that V1 and V2 counted are not listed or matched against the `63abadb` baseline (V0 only says "Otherwise the same warnings as V1"). So the PLAN criterion "No console message is new against the Browser console section of `VERIFICATION.md` at commit `63abadb` ... recorded in `VERIFICATION.md` Browser console" (`PLAN.md:25`, unticked) has no evidence. V1, V2 and the V0 control are fine; only this criterion is open. → Resume `ui-verifier` (it has the captured lists): name the 8 entries once against the known noise of `research/contract-delta.md` section 3, state the new-error and new-warning counts in the shape of `templates/feature/VERIFICATION.md` "Browser console", delete `pending`. Owner `ui-verifier`, before `docs-keeper` ticks the criteria for SUMMARY and metrics. Does not block the code. **Status: resolved** (re-review 2026-10-09, evidence below).

## Minor
- `app/products/webapp/test/integration/RoleAwareActionsJourney.js:4` Change outside the plan: PLAN step 7 (`PLAN.md:40`) says the journey stays "unchanged" and step 5 says "nothing else in `app/`", but c47e8ed rewrites the header comment to `/Permissions/isEditor`. The new text is correct (the old one would have named a path that no longer exists) and ui5lint is clean, but no CHANGELOG line or report mentions the edit. → `docs-keeper` names it in the step 10 `app` CHANGELOG line; no code change. **Status: resolved** (re-review 2: `docs/CHANGELOG.md:9`, the `app` line, names the comment-only edit).
- `docs/features/catalog-hygiene/VERIFICATION.md` (whole file) Differs from `templates/feature/VERIFICATION.md`: no `## Automated tests` section, so the ticked criterion "`npm run test:ui` ... 42 passed" (`PLAN.md:20`) has its output only in an agent report (runner output is gitignored). The mock-mode check that PLAN "Risks" (`PLAN.md:57`) asks to be "named in `VERIFICATION.md` if skipped" is not named. → `ui-verifier` (same resume as the Important item) adds the section with the `npm test` and `ui5-test-runner` summaries (the fresh ones under "Checked and in order" can be used) and one sentence that mock mode was not checked. **Status: resolved** (re-review 2026-10-09, evidence below).
- `docs/features/catalog-hygiene/PLAN.md:47` (step 10 check) `grep -rn "Decimal(10" docs CLAUDE.md` "finds only CHANGELOG and this feature's folder" cannot go green as written. `docs/decisions/ADR-0003-cds-modeling-rules.md:14` and `:39` keep the historical sentence on purpose (the amendment withdraws it in place), and `docs/features/products-excel-upload/SUMMARY.md:26` quotes the framework message `Value abc is not a valid Decimal(10,2)` verbatim as history. → `docs-keeper` runs the check with these three lines as named exceptions and does not rewrite them. The real targets are `docs/architecture/PATTERNS.md:12`, `docs/architecture/CONVENTIONS.md:58`, `CLAUDE.md:106` and the `docs/STATE.md` open-debt row. **Status: resolved** (re-review 2: the grep now finds exactly the three named lines; `docs/CHANGELOG.md:10` and the catalog-hygiene `SUMMARY.md` "Deviations" name them as exceptions; the four real targets are clean).
- `docs/features/catalog-hygiene/research/contract-delta.md` section 4 (the `docs-keeper` worklist) misses `docs/decisions/ADR-0021-products-excel-import.md:15`. Its decision 6 states that the `importProducts` `UI.Hidden` uses `$Path` to `/CatalogService.EntityContainer/Permissions/isEditor`. The section says it lists every `grep -rn "EntityContainer/Permissions"` hit outside CHANGELOG, and this hit is missing. → `docs-keeper`: the ADR-0013 amendment of step 10 names all four consumers, including the `importProducts` `UI.Hidden` of ADR-0021 decision 6, so a reader of ADR-0021 finds the short path; an optional one-line amendment pointer in ADR-0021. **Status: resolved** (re-review 2: `ADR-0013-catalog-authorization.md:39` names the `importProducts` `UI.Hidden` of ADR-0021 decision 6 among the four consumers; `ADR-0021-products-excel-import.md:44-45` adds "Amendment 3" pointing to it).
- `docs/decisions/ADR-0013-catalog-authorization.md:41` (found in re-review 2) The amendment says the measurements were taken "in one harness on `npx cds serve --in-memory --port 4004`". Control V0 ran on a `git archive bcffde0` copy served on port 4005 (`VERIFICATION.md:21`; the catalog-hygiene `SUMMARY.md` "Lessons" also says "another port, the same harness"). The measured outcomes (1 against 0 `TypeError`, hidden state on both pages, `7 7`, 697 lines, 7 short `<Path>`) are all correct; only the setup detail is wrong for V0. → `docs-keeper`: write "in one harness (same log level and navigation; V1 and V2 on port 4004, the V0 control on a `git archive` of bcffde0 on port 4005)" or drop the port. One-line fix, not blocking because no measured fact is wrong. **Status: open** (`docs-keeper`, before the phase 6 commit).

## Checked and in order
- No imperative currency check: `git diff main...HEAD -- srv` touches only `srv/annotations/Products.cds` (one line, `@assert.target`). `grep -rni currency srv/catalog-service.js srv/lib/` finds only the pre-existing `IMPORT_COLUMNS`/`MANDATORY_COLUMNS` mapping of `srv/lib/products-import.js:16,24`. No handler duplicates the annotation.
- Untouched: `git diff --stat main...HEAD` is empty for `db/data`, `app/products/webapp/localService/mockdata`, `_i18n`, `app/products/webapp/i18n` and the app manifest. `db/` changed only on `db/schema.cds:10` (`Decimal(15, 2)`), with no annotation in `db/`.
- Contract figures: `git diff --numstat main bcffde0` = `1 1` for `metadata.xml` and the snapshot (only `Precision="10"` to `"15"`). `git diff --numstat bcffde0 c47e8ed` = `7 7` for both files. `main` to `c47e8ed` = `8 8` for both. 697 lines before and after. 7 `<Path>/Permissions/isEditor</Path>`. The single remaining `EntityContainer/Permissions` in `metadata.xml:605` is the `<Annotations Target="CatalogService.EntityContainer/Permissions">` of the singleton itself, not a `<Path>`. A fresh `cds compile '*' --to edmx-v4 -s CatalogService -l en` is byte-identical to `metadata.xml` (empty `diff`).
- The four `$Path` values are identical (`'/Permissions/isEditor'`) on `app/products/annotations/Products.cds:27,75,76,77`. PLAN, CONTEXT and research say 27 and 74 to 76 because the comment above grew from two lines to three, as step 5 asked. The mismatch does not matter: the criterion and both contract tests identify the values by content, not by line, and the PLAN is pruned in phase 7. Not a finding.
- ADR-0003 amendment: `Date: 2026-09-07. Status: accepted.` is unchanged (`git show main:` and the working tree agree on line 3), as `templates/adr.md` requires. The amendment is dated with the approval (2026-10-09), withdraws the exception (A), records "no data migration in development" (B) and the Open question 1 decision (C, range stays `[0, 99999999.99]`). It follows the ADR-0021 amendment shape: `## Amendment` section plus `Amendment:` rows in Alternatives, Consequences and Sources. The pointer appended to the exception bullet (line 14) is a reference, not a rewrite.
- Test names equal the criteria: "exposes price as Edm.Decimal with precision 15 and scale 2", "rejects a price above the range (@assert.range)", "rejects an unknown currency code (@assert.target)", "reports an unknown currency on the draft and rejects activation (@assert.target)", "importProducts reports an unknown currency code". The referenced existing tests ("returns price as a string with its currency code", "exposes Currencies as a code list for the value help", "matches the EDMX snapshot", "keeps app/products/webapp/localService/metadata.xml in sync with the model") exist under those names. Each assertion matches its criterion: `target: 'currency_code'` on the active POST, 200 plus `DraftMessages` `ASSERT_TARGET` then 400 with suffix `currency_code$` on the draft, codes `[NOTHING_IMPORTED, ROW_INVALID]` with `/^Row 2, column "currency": /` and count 15 on the import.
- The `afterEach` cleanup in `describe('CatalogService.Products')` (`test/catalog-service.test.js:47-49`) cannot delete seeded rows: none of the 15 names in `db/data/my.catalog-Products.csv` starts with `Rejected `, `like 'Rejected %'` has no other wildcard, and only the two new tests use that prefix ("Rejected Currency", "Rejected Price"). It hits the active table only, not drafts. It copies the existing idiom of the import describe (`:510-514`, `like 'Bulk Product %'`, PATTERNS "Service test").
- `VERIFICATION.md`: V1 (alice) and V2 (viewer) passed on the List Report and the Object Page separately, each with 0 `aggregateExpandSelect`/`Permissions/isEditor` messages and `Permissions` 200 `isEditor: true`/`false` in `$batch`. The screenshots `V1-list-alice.png` (Import from Excel, Create, Delete) and `V2-list-viewer.png`/`V2-object-viewer.png` (none of them, no Edit, no Delete) show what the rows claim. The V0 negative control on bcffde0 with the long path reproduces exactly one TypeError with the verbatim text. V3 passed with `PATCH` `{"price":"1234.56","currency_code":"USD"}` 204, Discard Draft and the `ru` labels. The Cyrillic in V3 is quoted rendered UI (allowed).
- CHANGELOG `## 2026-10-09` (two `test` lines by `test-backend`): the facts check out against the tree (figures `1 1`, `7 7`, `8 8`, 697 lines, 144 tests in 11 files; the import reason `Target with this key doesn't exist.` is `ASSERT_TARGET` in the cds `_i18n/messages.properties:12`). No wrong fact. The db, srv, app and docs lines are step 10.
- Patterns and layers: `price` follows "Monetary amount"; `currency @assert.target` in `srv/annotations/` follows "Association target existence check"; the price bound stays declarative ("Format or range check"); the short path is the fallback that ADR-0013 part 8 names (`ADR-0013-catalog-authorization.md:33`), and the PATTERNS row text is step 10. Presentation is only in `app/products/annotations/`. No handler, no `console.log`, no new i18n text.
- Duplicates: the feature adds no function, handler, fragment, formatter or type (registry `REUSE-CATALOG.md`, `HANDLERS.md`). `mcp__cds-mcp__search_model` `CatalogService.Products` shows `price` `precision: 15, scale: 2` and `@assert.target: true` on `currency` and `currency_code`, matching registry `DOMAIN-MODEL.md:40-42`.
- Language: Cyrillic in the changed files is only the asserted `ru` test values in `test/catalog-service.test.js` that predate the feature, plus the quoted UI labels in `VERIFICATION.md`. The committed `.claude/agent-memory/architect/*` and `test-backend/*` files are English, and agent memory has been committed by earlier features.
- Gates, fresh run on 2026-10-09:
  - `npm run lint`: `0 errors, 2 warnings`. Both warnings are `no-console` in the gitignored `.pipeline/verify/build-verify-workbooks.mjs` (dated 2026-09-29), not part of this diff.
  - `npm test`: `Test Files 11 passed (11)`, `Tests 144 passed (144)`.
  - `npm run lint` in `app/products`: `UI5 linter report: Success! No findings detected.`
  - `node scripts/check-docs-fresh.mjs`: `docs/registry is fresh.`
  - `node scripts/check-feature-docs.mjs catalog-hygiene`: `PLAN.md and CONTEXT.md keep the shape of the templates.`
  - `npx prettier --check` on the two test files and the journey: `All matched files use Prettier code style!`
  - `ui5-test-runner` against `npx cds serve --in-memory --port 4013`: 42 of 42 passed (40 `opaTest` + 2 QUnit), exit 0. The server was stopped afterwards.

## Verdict
ready to commit (the code and the contract: 0 blocking). The Important `VERIFICATION.md` item belongs to `ui-verifier` and must be closed before `docs-keeper` ticks the console criterion in step 10. The four Minor items go to `ui-verifier` and `docs-keeper`.
After the re-review: ready to commit. The Important item and the `VERIFICATION.md` template-shape item are resolved; three Minor items stay open for `docs-keeper` in step 10.
After re-review 2: ready to commit. The three step 10 Minor items are resolved. One new Minor item is open: the V0 port in `ADR-0013-catalog-authorization.md:41`, a one-line fix for `docs-keeper`. `PLAN.md:27` is ticked.

## Re-review 2026-10-09

Scope: only the two `VERIFICATION.md` items that `ui-verifier` fixed (uncommitted file, `git status` `??`). The other three Minor items were not re-checked; they are step 10 work.

### Important item, "Browser console": resolved
- `grep -c pending docs/features/catalog-hygiene/VERIFICATION.md` = `0`.
- `VERIFICATION.md:34-52` now has the baseline (the `63abadb` permalink plus `research/contract-delta.md` section 3), the capture conditions (`sap-ui-log-level=WARNING`, List Report then Object Page, V3 added nothing) and a table of the 8 entries, each with its level, count and status against the baseline. Entries 5, 7 and 8 (`DeviceSet`, `T_NEW_OBJECT|Products` x14, `<label for=FORM_ELEMENT>`) are named baseline noise. Entries 1 to 4 and 6 (`sap.fe.core` support-assistant hint, ObjectPage processing warning, two `Set unchanged path ... HeaderInfo`, `toggleHeaderOnTitleClick`) are Object Page template messages that are missing from the `63abadb` capture but identical on bcffde0 (V0).
- `VERIFICATION.md:50` reads "New errors: 0. New warnings: 0." in the shape of `templates/feature/VERIFICATION.md`, and the V0 delta is spelled out: 10 entries = the same 8 + the TypeError + a second `T_NEW_OBJECT` group.
- Judgement on comparing with bcffde0 rather than with `main`: bcffde0 differs from `main` in the contract by one `Precision` attribute (`1 1`, checked above), and `@assert.target` adds no EDMX line. Neither can produce Object Page `HeaderInfo` or header-toggle warnings. So "not introduced by this feature" holds for the five entries, and the console criterion (`PLAN.md:25`) now has its evidence.

### Minor item, template shape: resolved
- `VERIFICATION.md:5-13` has `## Automated tests` with `npm test` 144 passed in 11 files and `npm run test:ui` 42 passed (40 `opaTest` + 2 QUnit), 0 skipped. The block says honestly that the figures are quoted from the `test-ui` run and this reviewer's port-4013 run, not re-run by the verifier. Both match the fresh outputs under "Checked and in order".
- `VERIFICATION.md:13` names the skipped mock-mode check ("not part of any gate, skipped, not blocking"), as PLAN "Risks" (`PLAN.md:57`) asks.
- Language: the only Cyrillic line is `VERIFICATION.md:20`, the V3 row with quoted rendered `ru` labels (allowed). Header, scenario table and verdict are unchanged.

## Re-review 2

Date 2026-10-09. Scope: the uncommitted step 10 documentation of `docs-keeper`. Verdict: ready to commit after the one-line ADR-0013 fix (Minor, open). 0 blocking, no wrong measured fact. The PLAN criterion "ADR-0003 carries an amendment ... ADR-0013 carries an amendment ... both checked by `reviewer`" (`PLAN.md:27`) is ticked.

### ADR-0013 amendment "short singleton path": in order, one Minor
- `Status:` untouched: line 3 is identical in `HEAD` and the working tree (`accepted (user, 2026-09-10, feature catalog-authorization)`).
- Facts against `VERIFICATION.md`:
  - Control on the commit before the switch: 1 `TypeError` (V0).
  - Short path: 0 `aggregateExpandSelect`/`Permissions/isEditor` messages for `alice` and `viewer` on both pages, 0 new errors and 0 new warnings (V1, V2, "Browser console").
  - Hidden state: `viewer` has no Create, Delete or Import from Excel on the List Report and no Edit or Delete on the Object Page, with `isEditor: false`; `alice` sees all of them, with `isEditor: true`.
  - All four points are correct.
- Contract: `7 7` against bcffde0, 697 lines, 7 short `<Path>`, no container-qualified `<Path>`. This matches `git diff --numstat` and the grep counts above.
- The amendment names all four consumers, including ADR-0021 decision 6 (`:39`). It adds an `Amendment:` row in Alternatives (`:73`), Consequences (`:98`) and Sources (`:112`), the shape of the ADR-0021 amendments.
- The only inaccuracy is the port of the V0 control (`:41`), the new Minor item above.

### ADR-0021 "Amendment 3": in order
- `:44-45` is a two-sentence pointer to the ADR-0013 amendment, numbered after "Amendment 2", and the Consequences bullet on the TypeError (`:86`) gains "Amendment 3: removed by the short path." The decision 6 text stays as the historical record, as the other amendments of this ADR do.

### Factual sweep of the other step 10 files: in order
- `docs/CHANGELOG.md` `## 2026-10-09`: the db, srv, app and docs lines agree with the tree:
  - figures `1 1`, `7 7`, `8 8`, 697;
  - the `ASSERT_TARGET` text;
  - 49 and 10 tests (`grep -c "^\s*it("`);
  - the three `Decimal(10` exceptions;
  - the LESSONS change.
- `docs/STATE.md` (Open debt and What works only):
  - the rows for `price`, `$Path` TypeError and `currency` are removed;
  - "144 tests in 11 files: 49 ... 10 ..." is correct;
  - the auth item now names the short path with the ADR-0013 amendment.
- `docs/architecture/PATTERNS.md`:
  - "Monetary amount" lost the parenthesis;
  - "Association target existence check" lists `Products.category`, `Products.currency`;
  - "Role-aware UI visibility" writes `'/Permissions/<flag>'` and one sentence on the container-qualified form (works, trips the `TypeError`, 0 with the short path).
- `docs/architecture/CONVENTIONS.md` section 3 and `CLAUDE.md` "Known debt" drop the price exception. Remaining `EntityContainer/Permissions` hits in `docs/` are historical records (ADR-0013 part 8, ADR-0021 decision 6, `catalog-authorization/SUMMARY.md:10` "What was done") or the PATTERNS sentence on the alternative form.
- `docs/LESSONS.md`:
  - the 2026-09-16 "Pending upstream" entry is removed;
  - its knowledge now lives in the PATTERNS row and the ADR-0013 amendment, and CHANGELOG `:10` records the removal, as the LESSONS header rule asks;
  - two new `Pending /retro` entries, the second matching the red proof `test-backend` reported (CHANGELOG phase 2 line).
- `docs/features/catalog-authorization/SUMMARY.md`: the open-debt bullet is closed with the measured outcome and the ADR-0013 pointer.
- `docs/features/catalog-hygiene/SUMMARY.md`:
  - "What was done" and "Deviations" match the tree and this review;
  - `## Cost` is the placeholder for phase 7.
  - Note for the orchestrator in phase 7, not a finding: "Deviations" says criteria 27 and 28 "stay unticked until phase 7". Criterion 27 is ticked by this pass, so that sentence should name only 28.
- Gates after step 10:
  - `node scripts/check-docs-fresh.mjs`: `docs/registry is fresh.`
  - `npm test`: `Test Files 11 passed (11)`, `Tests 144 passed (144)`. The doc-shape and prompt-budget tests are green with the edited STATE, LESSONS and CLAUDE.md.
