# products-validations: framework facts and scratch measurements

Date: 2026-10-13, amended 2026-10-14 (section 10: the rules on the details R10-R13, the `matchespattern` fact, the preventing controls, the EDMX figures of the amended model; R9 withdrawn by the user). Author: `architect`. Read by `architect` and `reviewer`; a plan step names this file for an implementer when the fact decides the step. Sources: `mcp__cds-mcp__search_docs` ("Input Validation", "`@assert:` constraint", "Custom Messages", "Localized Messages", "Draft Input Validation", "Expressions as Annotation Values", "Lean Draft" association table, "`@cds.api.ignore`", draft-specific events `SAVE`/`PATCH`), `mcp__cds-mcp__search_model` (`CatalogService.Products`), `@sap/cds` 10.1.1 sources (`lib/req/validate.js`, `libx/_runtime/common/generic/assert.js`), `@cap-js/db-service` `lib/cql-functions.js` (`error()`), `@sap/cds-common-content` 3.2.0 `db/data/sap-common-Currencies.csv`, and a scratch copy of the worktree at `baab1d0` (`/tmp/pv-scratch`, `node_modules` symlinked, `cds serve --in-memory --port 4015`, probes `probe.mjs` and `probe2.mjs`, results quoted below as P* and Q*).

## 1. Where each mechanism runs (cds 10.1.1)

| Mechanism | Implementation | Active `POST`/`PATCH` | Draft `PATCH` (while typing) | `draftActivate` (Save) |
|---|---|---|---|---|
| `@mandatory` | `lib/req/validate.js` line 109, 206-212: input validation, inserts and explicit `null` on update | 400 `ASSERT_MANDATORY` | nothing (a null stays silent; TESTING "cds 10 specifics") | 400, target `in/<field>` |
| `@assert.format` | `validate.js` line 111-113: `new RegExp(pattern, 'u')` on the input value; `null` passes | 400 `ASSERT_FORMAT`, target the element (P5a, P5b) | message in the `PATCH` response `DraftMessages` at once (P10b) | 400, `in/<field>` (P8d) |
| `@assert.range` | `validate.js` line 115-123: closed or open bounds, `_` = infinity (docs: since 8.5) | 400 `ASSERT_RANGE` (P3a, P3c) | in the `PATCH` response (P10c) | 400, `in/<field>` (P8d) |
| `@assert.target` | input validation | 400 `ASSERT_TARGET` | in the `PATCH` response (TESTING) | 400 |
| `ASSERT_DATA_TYPE` | type check | 400 | 400 on the `PATCH` itself (TESTING) | 400 |
| `@assert: (case ...)` | `assert.js`: `after INSERT/UPSERT/UPDATE` collects the changed keys, `req.before('commit')` runs one `SELECT` per entity with the `case` expressions pushed to the database | 400 at commit, `code` = the key, `target` = the element; several rules at once = `MULTIPLE_ERRORS` with `details[]` (P1, P4a, P6a) | written to `DraftMessages` at commit, so the `PATCH` response shows `[]` and the next `GET` the message (P8b, P8c); only for **touched** elements (`cds.env.features.assert_touched_only`, `assert.js` line 60-61) or elements named as `additionalTargets` (line 164-168; P9, P10) | 400, `in/<path>` (P11b: `in/details(ID=...,IsActiveEntity=false)/numberValue`) |
| handler `before('PATCH', <Child>.drafts)` with `req.reject({ status, code, target })` | custom | n/a | 400 on the `PATCH`, the value is **not** stored (Q4a, Q4b: `textValue` stays `null`) | n/a |
| handler `before('SAVE', <Root>)` | capire: `SAVE` on an active entity = `CREATE` + `UPDATE` | fires on a deep `POST` (`req.event` `CREATE`, `req.data.details` present, Q2) and on an active `PATCH` | does not fire | fires at activation with `req.event` `UPDATE` and the deep `details` in `req.data` (Q4d) |
| handler `before('SAVE', <Child>)` | same | fires on `PATCH Products(..,true)/details(..)` (`UPDATE`, flat row, Q3) | no | no (children are written through the root) |

Order at activation: input validation (`@mandatory`, `@assert.format`, `@assert.range`, `@assert.target`, data types) rejects the request before the constraints run; P8d shows only `ASSERT_RANGE` and `ASSERT_FORMAT` although the draft also carried a duplicate name, a minor-unit violation and a missing description. A user can therefore need two Save attempts: once for input validation, once for constraints. Fiori Elements shows the constraint messages earlier, after each field change, so in practice the second round is rare.

Fiori Elements reads `DraftMessages` after every field `PATCH` through the generated `Common.SideEffects #alwaysFetchMessages` (`search_model`: `SourceEntities: ['']`, `TargetProperties: ['DraftMessages']`); the `GET` joins the `PATCH`'s `$batch`, so a constraint message written at the `PATCH`'s commit is on the field when the batch answers. The custom `DetailsForm.js` does the same after its own writes (`requestDraftMessages`, ADR-0027 amendment D-2).

## 2. Custom messages

- `@assert.format.message`, `@assert.range.message`, `@mandatory.message` are read by `validate.js` (lines 109, 113, 120-123). A bare message key (`'PRODUCTS_PRICE_POSITIVE'`) is localized from `_i18n/messages.properties` and `messages_ru.properties` like a constraint key (P3a en, P3b ru, P5d ru). The error `code` stays `ASSERT_RANGE` / `ASSERT_FORMAT`; only the text changes. capire "Custom Messages" documents the annotation; the bare-key localization is measured, the docs show `'{i18n>key}'`.
- The cds defaults live in `node_modules/@sap/cds/_i18n/messages.properties` (`ASSERT_RANGE = Enter a value between {1} and {2}.`, `ASSERT_FORMAT = Enter a value matching the pattern {1}.`, `ASSERT_MANDATORY = Provide the missing value.`, `ASSERT_TARGET`, `ASSERT_ENUM`, `ASSERT_DATA_TYPE`), with `ru` translations. A project `_i18n/messages.properties` entry with the same key overrides the default for every field that uses the annotation (capire "Translations for Validation Errors"); a per-field `.message` is the finer tool and is what this feature uses. The `{0}` of a format message is the value, `{1}` the pattern; a range message gets `{1}`/`{2}` as the bounds with `>`/`<` prefixes on open bounds.
- `@assert: (case ...)` passes no arguments through a plain key. `@cap-js/db-service` `lib/cql-functions.js` exports a CQL function `error(message, args, targets)` that returns a JSON object; `assert.js` lines 131-142 parse it: `targets[0]` becomes `target`, the rest `additionalTargets`, `args` the message arguments. **Not in the capire docs** (two `search_docs` queries found nothing); source-level API, verified by the scratch run: `then error('PRODUCTS_PRICE_MINOR_UNIT', null, ('price', 'currency_code'))` compiles (CSN `{"func":"error","args":[{"val":...},{"val":null},{"list":[...]}]}`) and yields a draft message with `target .../price` and `additionalTargets [.../currency_code]` (P10). Targets are string literals: a path (`currency.code`) would be shortened to its last segment by `cql-functions.js` line 16 (`e.ref.at(-1)`), and the generated foreign key name is a compile error inside an annotation expression (`currency_code` "has not been found", first scratch compile; the ADR-0025 fact). On the active path the OData error carries `target` only (P4a, P6a).

## 3. Uniqueness on a draft-enabled entity

- Subqueries are not allowed in annotation expressions (capire "Expressions as Annotation Values": "the same expressions as in a select item or where clause, except subqueries"), so `exists (select ...)` is out.
- `@assert.unique` is DDL (`UNIQUE`), answers 500 `ERR_SQLITE_ERROR` with `@cap-js/sqlite` and writes nothing on a draft (ADR-0026, TESTING).
- A self-association in `db/schema.cds` with functions in its `on` condition compiles: `namesakes : Association to many Products on lower(trim(namesakes.name)) = lower(trim($self.name)) and namesakes.ID != $self.ID`. The constraint `when name is not null and exists namesakes then 'PRODUCTS_NAME_DUPLICATE'` rejects an exact, a case-different and a padded duplicate on the active path (P1a, P1b, Q1, Q1b), writes the draft message when the draft's `name` is touched (P8c), rejects an active rename to another product's name (P14) and lets a product keep its own name through `draftEdit` + `draftActivate` (P13b `[]`, P13c 200). From a draft the association resolves to active rows (capire "Lean Draft" table: inactive source, plain association, active target), so the own active sibling is excluded by `ID` and other users' drafts are not seen until their Save.
- `@cds.api.ignore` does not hide a navigation property (capire "Omitting Elements From APIs"), so `namesakes` is visible in `$metadata`: `NavigationPropertyBinding` + `NavigationProperty` + 3 label lines = +5 EDMX lines (scratch diff). SQLite's `lower()` folds ASCII only; Cyrillic names compare case-sensitively there (HANA folds Unicode).
- The import's per-row `duplicateNames` (lower + trim, ADR-0021 decision 5) has the same semantics and stays: the constraint is checked at commit and names no row (PATTERNS "Bulk create from a file").

## 4. Currencies and the minor-unit rule

`sap.common.Currencies` (`@sap/cds/common.cds` line 65-69) has `minorUnit : Int16`; `@sap/cds-common-content` 3.2.0 ships it in `db/data/sap-common-Currencies.csv` (`code,name,descr,minorUnit`, 204 data rows, 33 with `minorUnit` 0, among them `JPY`; `USD`, `EUR`, `GBP` are 2). The rule `when price is not null and currency.minorUnit is not null and currency.minorUnit = 0 and floor(price) != price then error(...)` rejects `JPY` with `10.50` (P4a) and accepts `JPY` with `10.00` (P4b); `floor()` is portable (ADR-0027). A currency with three minor units (`KWD`, `BHD`) cannot be entered beyond two decimals anyway: `Decimal(15, 2)` rejects the third decimal with `ASSERT_DATA_TYPE`.

## 5. Required details per assignment

Scratch variant with a copied column (`SubcategoryAttributes.required`, `ProductDetails.required`, CSV flags on Laptop `SCREEN_SIZE` and Mouse `BATTERY_LIFE`): branches `when required = true and attribute.valueType.code = 'TEXT' and (textValue is null or trim(textValue) = '')` on `textValue`, `... in ('INTEGER', 'DECIMAL') and numberValue is null` on `numberValue`, `... = 'LIST' and listValue.code is null` on `listValue`, `... = 'MULTI_LIST' and not exists selections` on `attribute`, all `then 'PRODUCTS_DETAIL_VALUE_REQUIRED'`. Measured: `draftActivate` of the Mouse with an empty required `BATTERY_LIFE` answers 400 with target `in/details(ID=...,IsActiveEntity=false)/numberValue` (P11b); filled, it activates (P11c); a draft row `PATCH` to `null` writes the message on the row and on the root `DraftMessages` with the full path (P11d, P11e). The recommended variant reads the assignment instead of a copy, `exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and required = true]`, the ADR-0026 decision 5 form that is already proven on draft rows (`$self` inside an infix filter, a draft row's `product` is the draft parent); it needs no handler change and cannot go stale on rows created through the API before the Edit fill.

## 6. Imperative rule for a per-row pattern (R9, withdrawn 2026-10-14)

Superseded: capire's portable string functions include `matchespattern(x, pattern)` (section 10.5), so the premise below ("no portable regex") was wrong, and the user withdrew R9 itself (the free-text `DIMENSIONS` attribute is remodelled in a separate issue). Kept as the record of the handler measurement. `@assert.format` is one static regex per element; a regex per attribute row was taken as not expressible as a portable `@assert` expression (SQLite `GLOB`/`REGEXP` and HANA `LIKE_REGEXPR` are not portable by themselves). Measured handler shape (probe 2): `before('SAVE', Products)` sees the deep `details` on a deep `POST` (Q2 rejects, Q2b accepts) and at `draftActivate` (Q4d, target `details(ID=...,IsActiveEntity=false)/textValue`); `before('SAVE', ProductDetails)` covers `PATCH Products(..,true)/details(..)` (Q3); `before('PATCH', ProductDetails.drafts)` rejects while typing and stores nothing (Q4a, Q4b). The activation target form Fiori Elements maps is `in/<path>` (the framework's own, section 1); through the UI the activation branch is unreachable because the draft `PATCH` branch never stores a bad value, so the `in/` form matters for API clients only.

## 7. EDMX cost per construct (scratch diff, baseline 1591 lines = committed `metadata.xml`)

| Construct | Lines | Where |
|---|---|---|
| `Products.namesakes` with `@title` | +5 | `NavigationPropertyBinding`, `NavigationProperty`, `Annotations` block with `Common.Label` |
| `SubcategoryAttributes.required : Boolean` | +1 (+3 with a `@title`) | `Property` (and its label block) |
| `ProductDetails.required @readonly` (variant B only) | +5 | `Property`, label and `Core.Computed` |
| `@assert.range: [(0), 99999999.99]` | +2 | `Validation.Minimum` becomes a block with `Validation.Exclusive` |
| `@assert.format` | +1 each | `Validation.Pattern` |
| `@assert.range.message`, `@assert.format.message`, `@assert: (...)`, `error()` | 0 | CSN only |
| `description @Common.FieldControl: (stock > 0 ? 7 : 3)` | +10 | `<If><Gt><Path>stock</Path><Int>0</Int></Gt><Int>7</Int><Int>3</Int></If>` on `Products/description` |
| `DetailAttributes.pattern : String(200)` with `@title` (R9, withdrawn) | +4 | `Property` and label |
| `SubcategoryAttributes.minValue`, `maxValue : Decimal(15, 3)` with titles (R10) | +8 | two `Property` lines and two label blocks |
| `DetailAttributes.atLeast : Association to DetailAttributes` with title (R11) | +28 | FK `Property`, `NavigationProperty`, `NavigationPropertyBinding`, labels and the generated `Common.ValueList` block of a code-list association |
| `DetailListValues.enables : Association to DetailAttributes` with title (R12) | +28 | same shape |
| `DetailAttributes.enabledBy` (backlink to many `DetailListValues`) with title (R12) | +5 | `NavigationProperty`, binding, label |
| `@CodeList.CurrencyCodes` on the service and `Common.UnitSpecificScale` on `Currencies/code` (optional R4 control) | +10 | container annotation block and one `Path` annotation |

Scratch total with the copied `required` column, no titles on `required`/`pattern`, the name rule as a constraint: 1591 to 1615. Totals of the amended model: section 10.7.

## 8. Writers the new rules touch (lesson 2026-10-10)

- `test/catalog-service.test.js` `newProduct` (stock 5, no description) fails R6: add a `description`.
- `test/fixtures/build-workbooks.mjs` `generatedRow` (`description: null`, `stock: 1`) fails R6 for the 1,000-row workbooks: add a description; `VALID_ROWS` carry descriptions, `https://` image URLs, prices > 0, names of 3+ characters and USD/EUR/GBP, so the committed `.xlsx` fixtures stay valid; `INVALID_ROWS` are rejected per row before any commit, the new pre-checks add messages only where a row passes input validation (none of the bad rows does), `test-backend` confirms by running the suite.
- `README.md` workbook section: one sentence per new rule the import enforces.
- Seeds: 15 products with descriptions, `https://images.unsplash.com/...` image URLs, prices > 0, USD; the proposed required assignments (`LAPTOPS/SCREEN_SIZE`, `MICE/DPI`, `SEATING/MAX_LOAD`, `APPLIANCES/POWER`, `APPLIANCES/CAPACITY`, `DRINKWARE/CAPACITY`, `FITNESS/THICKNESS`) are filled on every seeded product of those subcategories (`db/data/my.catalog-ProductDetails.csv`); `LIGHTING`, `AUDIO`, `DESK_ORGANIZATION`, `CUTLERY`, `BAGS`, `PHONE_ACCESSORIES`, `NOTEBOOKS`, `OUTDOOR`, `WRITING_INSTRUMENTS` get no required attribute because at least one seeded product there is empty, or because the OPA5 journeys save a product into them (`EditCategoryOnObjectPageJourney`, `SubcategoryDependsOnCategoryJourney`: Wireless Earbuds to Furniture/Lighting and back to Electronics/Audio).
- OPA5 journeys create products only to discard them (`SubcategoryDependsOnCategoryJourney` "Create shows the subcategory disabled"), edit Laptop Pro 15 (`SCREEN_SIZE` filled), Wireless Mouse (`DPI` filled, `BATTERY_LIFE` emptied again at the end: not required) and Bluetooth Speaker (`AUDIO`, none required).
- `importProducts` creates products without detail rows; the required check has nothing to check until the Edit fill (ADR-0027 D13) creates the rows, then the first Save asks for the values.

## 9. Not verified by MCP

- `error()` in `@assert` (section 2): source and scratch only.
- Fiori Elements rendering of `additionalTargets` (both fields in the error state) and the mapping of an `in/details(...)/numberValue` activation error onto a control of the custom `DetailsForm` section: not measured, browser proof in phase 3 (`ui-verifier`); `fiori-mcp` `search_docs` has no page on `additionalTargets`.
- Whether Fiori Elements applies `Validation.Pattern` or `Validation.Exclusive` on the client before the request: not measured; `ui-verifier` records what happens on the field.
- The UI5 currency code-list customizing (section 10.8): read from the CDN debug source of `sap/ui/model/odata/v4/ODataMetaModel`, no fiori-mcp page; whether the Fiori Elements currency field refuses `10.50 JPY` before the request with the two annotations in place is a browser proof.
- `coalesce()` in `error()` arguments (section 10.6): ANSI SQL, measured on SQLite, not in CAP's portable function list; the `case when ... is null then ... else ... end` form is the CQL fallback.
- `$self.<element>` compared with the filtered entity's columns inside an infix filter and `numberValue not in (...)` (sections 10.1, 10.2): measured on SQLite; HANA shares the CQL-to-SQL path of the existing constraints, not measured.

## 10. Amendment 2026-10-14: rules on the details, controls, figures

Scratch: a copy of the worktree at `eee6fbd` under `/Users/anton_straltsou/.claude/jobs/0714fed1/tmp/pv-scratch` (`node_modules` linked, `cds serve --in-memory`, a generator `gen.mjs` that applies the amended model with the R11 and R12 variants as arguments, probes `probe3.mjs` and `probe4.mjs`, `measure.sh` for the EDMX counts; deleted after the measurements). Results quoted as A*. Three server runs: ASSIGN+PATH, ATTR+NESTED, LIT+PATH, plus ATTR+PATH with the reachable STORAGE bound of probe 4.

### 10.1 R10: bounds per assignment

Model: `SubcategoryAttributes.minValue`, `maxValue : Decimal(15, 3)` (nullable), the CSV columns from the user's table. Branch on `ProductDetails.numberValue` after the global bounds:

```cds
when numberValue is not null and product.subcategory.code is not null
  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code
    and ((minValue is not null and $self.numberValue < minValue) or (maxValue is not null and $self.numberValue > maxValue))]
  then 'PRODUCTS_DETAIL_VALUE_OUT_OF_SUBCATEGORY_RANGE'
```

`$self.numberValue` compared with the filtered entity's own columns inside the infix filter compiles and runs. Measured: active deep `POST` of a laptop with `SCREEN_SIZE` 9 (global 1..100, LAPTOPS 10..18) answers 400 with the new key and target `details(ID=...)/numberValue` (A1); `0.5` answers the global `PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE` because the global branches come first (A2); `15` answers 201 (A3). Draft: `PATCH` of Laptop Pro 15's `SCREEN_SIZE` row to 25 answers 200 with `[]`, the row's and the root's `DraftMessages` then carry the key with the full path (A4, A5); `draftActivate` answers 400 with target `in/details(ID=...,IsActiveEntity=false)/numberValue` (A6); the `PATCH` back to 15 clears it (A7). Every seeded `ProductDetails.numberValue` lies inside its assignment's bounds (checked against `db/data/my.catalog-ProductDetails.csv`: 15, 16, 512; 1600; 120; 900, 1.2; 12; 0.75; 6).

### 10.2 R13: power of two

`when numberValue is not null and attribute.code = 'RAM' and numberValue not in (1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024) then 'PRODUCTS_DETAIL_VALUE_NOT_POWER_OF_TWO'` compiles (`not in` with a value list). Draft `PATCH` of the RAM row to 12 writes the message on the row (A8), `draftActivate` answers 400 on the row (A9), 16 clears it (A10).

### 10.3 R11: three forms of the cross-row rule

| Form | Model | Expression | Result |
|---|---|---|---|
| ASSIGN (the user's data-driven option, nested) | `SubcategoryAttributes.atLeast : Association to DetailAttributes` plus a backlink `DetailAttributes.rows : Association to many ProductDetails on rows.attribute = $self` (the only way to name the other row from inside the assignment filter) | `exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and atLeast.code is not null and exists atLeast.rows[product.ID = $self.product.ID and numberValue is not null and numberValue > $self.numberValue]]` | compiles; fires on the active `POST` (A11) and at `draftActivate` (A12); on the draft a touched STORAGE row (128 against RAM 1024 in the draft) gets no message (A13): `rows` starts at `DetailAttributes`, which is not draft-enabled, so it resolves to the active `ProductDetails` table (lean draft: a plain association from an active source targets active data) and compares with the active sibling. Wrong while editing: rejected |
| ATTR (data-driven, one level) | `DetailAttributes.atLeast : Association to DetailAttributes`, CSV `STORAGE` -> `RAM` | `when numberValue is not null and attribute.atLeast.code is not null and exists product.details[attribute.code = $self.attribute.atLeast.code and numberValue is not null and numberValue > $self.numberValue] then error('PRODUCTS_DETAIL_VALUE_BELOW_OTHER', (coalesce(attribute.localized.name, attribute.name), coalesce(attribute.atLeast.localized.name, attribute.atLeast.name)), 'numberValue')` | draft: a touched STORAGE row below RAM gets the message "Storage must not be below Memory (RAM)." (A14); `draftActivate` 400 on the STORAGE row (A15); active `POST` 400 (A16); with `Accept-Language: ru` the names are the Russian ones from `DetailAttributes.texts.csv` (A17). Chosen |
| mirror branch on the referenced row | none | `when numberValue is not null and exists product.details[attribute.atLeast.code = $self.attribute.code and numberValue is not null and numberValue < $self.numberValue] then '<KEY>'` | fires live when the RAM row is touched (A18) and again at activation, so one defect gives two messages at Save (A15). Optional (CONTEXT D11) |
| LIT (literal codes) | none | `when numberValue is not null and attribute.code = 'STORAGE' and exists product.details[attribute.code = 'RAM' and numberValue is not null and numberValue > $self.numberValue]` | same behaviour as ATTR without the names (A19). Not chosen: ties `srv/annotations/` to seed codes |

Reachability: with the user's bounds (RAM 4..128, STORAGE 128..8192) a storage below the memory cannot lie inside both bounds, so R11 could only fire together with an R10 message; probe 4 used STORAGE 32..8192 (CONTEXT D12).

### 10.4 R12: value-driven dependency

Model: `DetailListValues.enables : Association to DetailAttributes` (CSV: `BLUETOOTH_5_0`, `BLUETOOTH_5_3`, `WIRELESS_2_4_GHZ`, `WIFI` -> `BATTERY_LIFE`) and the backlink `DetailAttributes.enabledBy : Association to many DetailListValues on enabledBy.enables = $self`. Guard branch on `numberValue`, two equivalent forms, both compile and behave the same (runs 1 and 2):

```cds
when numberValue is not null and exists attribute.enabledBy
  and not exists product.details.selections[value.enables.code = $self.attribute.code]
  then 'PRODUCTS_DETAIL_VALUE_NOT_ENABLED'
-- or: and not exists product.details[exists selections[value.enables.code = $self.attribute.code]]
```

Measured, active: `WIRED_USB` plus battery 12 answers 400 (A20); `BLUETOOTH_5_0` plus 12 answers 201 (A21); no `CONNECTIVITY` row plus 12 answers 400 (A22, a dependent attribute needs its enabler in the same product); `WIRED_USB` plus `null` answers 201 (A23). Draft of Wireless Mouse (seeded `WIRELESS_2_4_GHZ` and `BLUETOOTH_5_0`, battery empty): `PATCH` battery 12 gives no message (A24); `DELETE` of both selections gives no message because the battery row is not touched (A25); `draftActivate` answers 400 with `in/details(...)/numberValue` (A26); a `PATCH` of the battery writes the message on the row (A27); `POST` of the `WIFI` selection, `PATCH` 13, `draftActivate` 200 (A28-A30). So the server guards the value path while typing and the selection path at Save; the form's disabled-and-cleared row covers the selection path on the client.

### 10.5 R9 fact: `matchespattern` in a constraint (withdrawn rule)

capire "Standard Functions" lists `matchespattern(x, pattern)` among the portable string functions; `@cap-js/sqlite` `lib/cql-functions.js` lines 74-82 map `matchesPattern`/`matchespattern` to SQLite `regexp`, registered in `SQLiteService.js` line 31 as the JavaScript `RegExp(re).test(x)`; HANA uses `LIKE_REGEXPR`, so the dialect is the database's. In an `@assert` branch with a column as the pattern (`not matchespattern(textValue, attribute.pattern)`, `DetailAttributes.pattern` seeded `^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$`): active `POST` 400 with the key, target `details(ID=...)/textValue` and the `error()` args (A31); `30x20x10` and `30.5x20x10.25` 201 (A32, A33); draft `PATCH` stores the value and writes the message on the next read (A35, unlike the handler of section 6, which stored nothing); `draftActivate` 400 `in/details(...)/textValue` (A36); active `PATCH` through the product 400, target `textValue` (A38). The user withdrew R9 on 2026-10-14 (dimensions remodel), so this stays a fact for ADR-0028's alternatives.

### 10.6 `error()` arguments with paths and localization

`@cap-js/db-service` `lib/cql-functions.js` line 17 accepts a ref or a list of refs as `args`: `attribute.descr` fills `{0}` (A31); `attribute.localized.descr` resolves through `$user.locale` and is `null` when the locale has no texts row (A31 in `en`, the `ru` text with `Accept-Language: ru`, A34); `coalesce(attribute.localized.name, attribute.name)` gives the localized name or the base name (A17). A draft message keeps the text rendered in the locale of the request that wrote it (probe 4 K: a `ru` read after an `en` `PATCH` shows the English names); Fiori sends one `Accept-Language` for the session, so the UI does not see it.

### 10.7 EDMX totals of the amended model (baseline 1591, R9 removed)

| Model | Lines |
|---|---|
| R1-R8 of the original plan (`namesakes`, `required`, `Validation.Exclusive`, two `Validation.Pattern`) | 1604 |
| + R10 `minValue`, `maxValue` with titles (+8) | 1612 |
| + R11 `DetailAttributes.atLeast` (+28) | 1640 |
| + R12 `enables` (+28) and `enabledBy` (+5): phase 2 | 1673 |
| + `description @Common.FieldControl` (+10): phase 3 | 1683 |
| + `@CodeList.CurrencyCodes` and `Common.UnitSpecificScale` (+10, only with D13) | 1693 |

A managed association to a code list costs 28 lines because the compiler generates its `Common.ValueList` block; `@Common.ValueList: null`, `@Common.ValueList.viaAssociation: null` and `@cds.odata.valuelist: false` on the association leave the count unchanged (measured on `DetailListValues.enables`). A plain `String(30)` code column instead of the association would cost +3 and lose the foreign key and the project's association style (PATTERNS "Reference to another entity"); not chosen.

### 10.8 Currency client-side check (R4 control)

`sap/ui/model/odata/v4/ODataMetaModel-dbg.js` from the CDN (`requestCodeList`, lines 2855-2965, `requestCurrencyCodes`, lines 2995-3033): the currency customizing is read only when the entity container carries `com.sap.vocabularies.CodeList.v1.CurrencyCodes` with `CollectionPath` and `Url`, and the code list's single key carries `Common.Text` and `Common.UnitSpecificScale` (a code without a scale is ignored with a logged error). The project EDMX has `Common.Text` on `Currencies/code` and nothing else; `@sap/cds/common.cds` line 68 annotates `minorUnit` with a `@title` only; `@sap/cds-common-content` 3.2.0 ships data, no annotations. `annotate CatalogService with @CodeList.CurrencyCodes: { CollectionPath: 'Currencies', Url: './$metadata' }` plus `code @Common.UnitSpecificScale: minorUnit` on `CatalogService.Currencies` compile to the container annotation and a `Path` annotation (+10 lines). Whether the Fiori Elements currency field then refuses `10.50 JPY` before the request is a browser proof.
