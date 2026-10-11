# products-details-section: context

Date: 2026-10-11. Author: `architect`. Branch: `feature/products-details-section` (worktree from `b466249`, `/feature` started 2026-10-12). Issue: #9.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens are in `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts are in `research/framework-facts.md`.

## Request
Issue #9: "Object Page: a new section Details, dependent on the subcategory" (original ru: a new Object Page section with details that depend on the subcategory). The product keeps a list of attribute values whose set of attributes follows the product's subcategory: a laptop has a screen size, memory and storage, a chair a material and a maximum load, a bottle a capacity. The section lives on the existing Object Page of `app/products`, is read-only for a `CatalogViewer` and is edited by a `CatalogEditor` inside the product draft (rows created, changed and deleted inline). It builds on `products-subcategories` (#8, ADR-0024: `Products.subcategory`, the category-narrowed value help, the draft reset) and `products-subcategory-cascade` (ADR-0025: mandatory subcategory, disabled until a category is chosen), both merged in `main` at `3054fa0`.

## User decisions
Taken on 2026-10-11 before this plan; fixed, not reopened here:
1. Reading (a), dynamic attributes: a new composition `Products.details`, the first composition in the model; ADR-0026 proposed.
2. Value: free text `value : String(100)` plus an optional `unit : String(10)` on the attribute (shown next to the value, for example `GB`, `kg`, `in`); no typed values, no per-attribute value lists. Plan gate (2026-10-11): units stay Latin and are not localized; the inch unit is `in`, not `"`.
3. Attributes are reusable across subcategories through an assignment entity (M:N): `DetailAttributes : CodeList { key code : String(30); unit }`, `SubcategoryAttributes { subcategory; attribute }`, `ProductDetails { product; attribute; value }`; a global attribute (`COLOUR`, `WEIGHT`) is simply assigned to many subcategories in the CSV. The key of `SubcategoryAttributes` is decided in PLAN D3 (recommended: `cuid` plus `@assert.unique.pair`).
4. Seed data: two or three attributes per subcategory for all 15 subcategories; the concrete list is PLAN D7 (20 attributes, 45 assignments, 15 detail rows on 7 products), reviewed at the plan gate.
5. `CatalogViewer` sees the section read-only; `CatalogEditor` creates, edits and deletes rows inside the product draft (ADR-0013). Measured: the Create and Delete buttons of an Object Page table exist only in edit mode, which a viewer never reaches (`UI.UpdateHidden`) (research sections 1 and 4); `ProductDetails` carries its own copy of the root's `@restrict`, which guards reads and, on the active path, writes through the product (measured by mutation in phase 2: without it a viewer creates a row through `POST Products(<id>,IsActiveEntity=true)/details` with 201 and `carol` reads `ProductDetails`).
6. One row per attribute per product. Flagged as asked: `@assert.unique` on `ProductDetails` costs more than one line, because cds 10.1.1 answers a violation on the active path with a 500 `ERR_SQLITE_ERROR` and writes nothing on a draft; the measured one-line alternative is a second `when` branch in the row's `@assert` constraint (`PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE`, 400 with the row named, draft message on the row), PLAN D2. Amended at the plan gate (D2, 2026-10-11): the constraint branch is the rule; no `@assert.unique` on `ProductDetails`.

Answered at the plan gate on 2026-10-11 (ADR-0026 accepted the same day):
- D1 = (i): a subcategory change that leaves foreign detail rows is rejected at Save, nothing is deleted; the root constraint branch writes the message on the Subcategory field at once, Save names each row; no handler.
- D2 = A: the duplicate branch `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` in the row's `@assert`, no `@assert.unique` on `ProductDetails` (amends decision 6).
- D3 = A: `SubcategoryAttributes : cuid` with `@assert.unique.pair: [ subcategory, attribute ]` in `db/schema.cds`.
- D4 = A: `attribute` and `value` are both `@mandatory`.
- D5 = A: Create is allowed before a subcategory exists; the dropdown is unfiltered then and the server rejects a foreign row at Save.
- D6 confirmed: `ru` "Kharakteristiki" for `Products.facet.details` and `ProductDetails.typeNamePlural` (the identical word in both locales), "Kharakteristika" for `ProductDetails.typeName`, the Attribute column and `DetailAttributes.code`; code points in `SCREENS.md` "Texts"; the section sits between "Pricing & Stock" and "Administrative Data".
- D7 accepted with the designer's refinements: `BATTERY_LIFE` `ru` "Vremya avtonomnoy raboty", `CAPACITY` `ru` "Obyem" with U+0435, `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` `ru` with "ne sootvetstvuyut novoy podkategorii"; `POWER` and `RAM` as asserted; units Latin, not localized; `SCREEN_SIZE` unit `in`.
- D8: ADR-0026 accepted (status sentence replaced).
- D9 confirmed: `@odata.draft.enabled` on `CatalogService.Products` only.
- From `SCREENS.md`: `![@UI.Importance]: #High` on the Attribute column only; no `Label` in the `UI.LineItem` records; the framework toolbar defaults stay, no `manifest.json` change; SCREENS questions 1-7 are closed accordingly.

## Affected entities and services
Result of `mcp__cds-mcp__search_model` (`Products`, `Subcategories`, `CatalogService`), `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md` and the scratch measurements of `research/framework-facts.md` sections 3, 4 and 6:

| Object | Exists now | What changes |
|---|---|---|
| `my.catalog.Products` (`db/schema.cds`) | `cuid, managed`, `category`, `subcategory`, no composition | `details : Composition of many ProductDetails on details.product = $self` (phase 2); EDMX gets `details` with `Partner="product"` |
| `my.catalog.DetailAttributes` | does not exist | `CodeList { key code : String(30); unit : String(10); subcategories : Association to many SubcategoryAttributes on subcategories.attribute = $self; }` (the backlink is what the constraints navigate); CSV `my.catalog-DetailAttributes.csv` (`code;name;unit`) and `.texts.csv` (`code;locale;name`, `ru`) |
| `my.catalog.SubcategoryAttributes` | does not exist | `cuid { subcategory : Association to Subcategories; attribute : Association to DetailAttributes; }` with `@assert.unique.pair: [ subcategory, attribute ]` in `db/schema.cds` (a persistence constraint, like `key`); CSV `ID;subcategory_code;attribute_code` |
| `my.catalog.ProductDetails` | does not exist | `cuid { product : Association to Products; attribute : Association to DetailAttributes; value : String(100); }`, no `@assert.unique` (D2); CSV `ID;product_ID;attribute_code;value` |
| `CatalogService.Products` (`srv/catalog-service.cds`) | `@odata.draft.enabled`, `@restrict` Viewer READ / Editor `*` | unchanged annotations; the composition makes `ProductDetails` part of the draft tree (`IsActiveEntity` etc. on the child) |
| `CatalogService.ProductDetails` | does not exist | explicit projection with the same `@restrict` as `Products`: only the target entity of a request is authorized and the target of `Products(...)/details` is the child, so these grants guard reads and active-path writes through the product (measured by mutation in phase 2); top-level writes answer 422 `DRAFT_MODIFICATION_ONLY_VIA_ROOT` by lean draft, a viewer's top-level `POST` without `IsActiveEntity` 403 by the grant first |
| `CatalogService.DetailAttributes`, `CatalogService.SubcategoryAttributes` | do not exist | `@readonly` projections like `Subcategories`; `SubcategoryAttributes { *, attribute.name as attributeName }` flattens the localized name for the dropdown (served in `ru` on request) |
| `srv/annotations/Products.cds`, `subcategory` constraint | `PRODUCTS_SUBCATEGORY_MISMATCH` branch | second branch `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` (`exists details[... not exists attribute.subcategories[subcategory.code = $self.subcategory.code]]`): an active subcategory change that leaves foreign rows is a 400, a draft change writes the message on the Subcategory field at once (D1); `details @title` |
| `srv/annotations/ProductDetails.cds` (new) | | `attribute @mandatory @assert.target @assert: (case <not assigned> / <duplicate> end)`, `value @mandatory`, titles; EDMX 0 lines for the constraints |
| `srv/annotations/DetailAttributes.cds`, `SubcategoryAttributes.cds` (new) | | titles only |
| `_i18n/i18n.properties` + `_ru` | 27 keys | +14 labels (`Products.details`, `Products.facet.details`, `ProductDetails.typeName|typeNamePlural|product|attribute|value`, `DetailAttributes.code|name|descr|unit`, `SubcategoryAttributes.subcategory|attribute|attributeName`) |
| `_i18n/messages.properties` + `_ru` | 12 keys | +3: `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE`, `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` |
| `app/products/annotations/Products.cds` | 3 facets, `#CategoryChanged` side effect | facet `Details` (`Target: 'details/@UI.LineItem'`, before `AdminData`), `Common.SideEffects #SubcategoryChanged { SourceProperties: [ subcategory_code ], TargetEntities: [ details ] }`, and `details` added to the `TargetEntities` of `#CategoryChanged` (the rows cache `product/subcategory_code` for their value help) |
| `app/products/annotations/ProductDetails.cds` (new) | | `UI.HeaderInfo` (TypeName, TypeNamePlural), `UI.LineItem` (`attribute_code` with `![@UI.Importance]: #High`, `value`, `attribute.unit`; no `Label` in the records), `Common.SideEffects #AttributeChanged { SourceProperties: [ attribute_code ], TargetProperties: [ 'attribute/name', 'attribute/unit' ] }`; on `attribute`: `Common.Text: attribute.name`, `#TextOnly`, `ValueListWithFixedValues`, one hand-written `Common.ValueList` (`CollectionPath 'SubcategoryAttributes'`, InOut `attribute_code`/`attribute_code`, In `product.subcategory_code`/`subcategory_code`, DisplayOnly `attributeName`) |
| `app/products/annotations/SubcategoryAttributes.cds`, `DetailAttributes.cds` (new), `annotations.cds` | | `attribute @Common.Text: attributeName #TextOnly`; `code @Common.Text: name #TextOnly`; three `using` lines |
| `app/products/webapp/manifest.json` | `ProductsObjectPage` without `controlConfiguration` | unchanged: `Inline` is the default creation mode of an Object Page table in FE V4 (research section 1); `fiori-app-dev` confirms with `list_functionality` that no table setting is needed |
| `app/products/webapp/localService/metadata.xml`, `test/__snapshots__/metadata.test.js.snap` | 884 lines | phase 2: 1180 measured (+296, 0 removed; 1177 on the scratch, which lacked the 3-line `Annotations` block of `Products.details @title`); phase 3: 1276 without the `UI.Importance` line, 1277 expected (+97 net against phase 2), the gate quotes the fresh count; each phase regenerates both |
| `app/products/webapp/localService/mockdata/` | `Products.json`, `Categories*.json`, `Subcategories*.json`, `Permissions.json` | new `ProductDetails.json`, `DetailAttributes.json`, `DetailAttributes_texts.json`, `SubcategoryAttributes.json`, generated from the CSVs in the shape of `Subcategories*.json` |
| `test/catalog-service.test.js` (75), `test/metadata.test.js` (12) | | new `describe('CatalogService.ProductDetails')` (+21) and +2 contract tests (one per phase) |
| OPA5 (50 `opaTest` + 2 QUnit) | | new `ProductDetailsSectionJourney.js` (+5), `RussianLocaleJourney.js` (+1), `data/DetailAttributeTexts.js` |

Not affected: `importProducts` (no details column; a deep write of details is not part of the workbook), the List Report (no column, no filter), `Permissions`, authentication (new entity sets sit under the same `@requires: 'authenticated-user'`; anonymous callers still get 401 and no external caller changes).

## What already exists and is reused
- The dependent value help shape of ADR-0024 (`Products.subcategory` in `app/products/annotations/Products.cds`): reused for `ProductDetails.attribute` with one difference, the In parameter is the navigation path `product.subcategory_code`; FE 1.153 requests it from the row context (`requestProperty`, research section 2) and a draft row's `product` is the draft parent (section 4). A second mechanism (calculated element, copied foreign key, handler) is a review error.
- The `@assert: (case ...)` constraint shape of ADR-0024 (null guards on both operands, key in `_i18n/messages*`): reused three times, extended with capire's `exists <to-many>[<filter>]` and `$self` for the set-membership checks (ADR-0026 decision 5). No handler is added; `srv/catalog-service.js` is untouched.
- `Common.SideEffects` shape of `#CategoryChanged` (ADR-0024 decision 3) for `#SubcategoryChanged` and `#AttributeChanged`.
- `@readonly` code-list projections and `@Common.Text: name #TextOnly` on the key (ADR-0011) for `DetailAttributes`; the `Subcategories` CSV and mock-data shapes.
- Test helpers in `test/catalog-service.test.js`: `active()`, `activeKey()`, `draftKey()`, `as()` at module scope; `draftEdit()`, `readDraft()` (with a root-only `$select`), `messageCodes()` are block-scoped inside `describe('CatalogService.Products drafts')` (lines 341-354 at `b466249`), so step 4 hoists them to module scope with a `$select` parameter instead of copying them; per-`it` `afterEach` cleanup; `annotationsOf()` in `test/metadata.test.js`.
- OPA5: `pages/CategoryDropdown.js` (`iSelectItem(name, 'attribute_code')`, `iSeeItems(names, 'attribute_code')`: the typeahead table id regex is property-based, so it matches a table-cell dropdown too, to be probed), `pages/ObjectPageForm.js`, `data/SubcategoryTexts.js` as the template of `data/DetailAttributeTexts.js`, `sap.fe.test.ObjectPage#onTable({ property: 'details' })` with `iExecuteCreate`, `iChangeRow`, `iSelectRows`, `iExecuteDelete`, `iCheckRows`, `iCheckColumns`, `iCheckCells` (research section 2).
- `ui-verifier` console baseline: `docs/features/products-subcategory-cascade/VERIFICATION.md` at `5ab8b02` (pruned folder, git history).
- Nothing in `srv/lib/` applies (`products-import.js` is the Excel import).

## Applicable patterns
- "Parent-child relationship (document)": `Composition of many ... on details.product = $self`; this feature is its first application and adds the example path to the row (phase 6).
- "New entity", "Code list with selection from a list" (ADR-0003, ADR-0010: `UPPER_SNAKE` codes, `String(30)` because `WATER_RESISTANCE`/`WRITING_INSTRUMENTS`-length codes exist), "Translatable data texts", "Reference to another entity".
- "Read-only", "Authorization" (ADR-0013: the child projection carries the root's grants, which guard reads and active-path writes through the root), "Drafts" (ADR-0012: `@odata.draft.enabled` stays on the root only; the row gets the note that top-level writes to a composition child answer 422, or 403 when the child's grant refuses first).
- "Mandatory field", "Association target existence check", "Cross-field consistency check" (ADR-0024 decision 2; the `exists`/`$self` set-membership form is new and goes to ADR-0026).
- "Dependent value help" (ADR-0024 decision 1; the navigation-path In parameter on a composition child is new, ADR-0026 decision 7), "Value help from a code list" (ADR-0011), "Refresh after an action" and the `Common.SideEffects` shape of "Dependent field reset on a draft" for `#SubcategoryChanged`/`#AttributeChanged` (no handler, so the reset row itself does not apply).
- "Table columns, filters, header, sections" (`UI.Facets`, `UI.LineItem`; a table section needs a `UI.HeaderInfo.TypeNamePlural` on the child), "Texts" (labels in `_i18n`, `ru` in the same change).
- "OData contract", "metadata.xml snapshot update" in phases 2 and 3; "Service test" (ADR-0002, ADR-0012 idiom), "User scenario" (OPA5 on `sap.fe.test`), "Finish a feature" (ADR-0019).
- ADR needed: ADR-0026 (EAV composition, assignment entity, set-membership constraints, navigation-path In parameter, subcategory-change behaviour, no `@assert.unique` on the child).

## Relevant lessons
- LESSONS 2026-10-10: a plan-gate change must be reconciled in SCREENS in step 1b; the D answers of PLAN change SCREENS (D1, D5, D6).
- LESSONS 2026-10-10: measure every error path a plan maps; every status, code and target in the acceptance criteria below was measured on a scratch copy (research section 4), none is assumed.
- LESSONS 2026-10-09: `cds add data` writes into the protected `mta.yaml`; the CSVs are written by hand with UUIDs from `node -e "console.log(crypto.randomUUID())"`.
- LESSONS 2026-10-09: in a worktree the Bash guard refuses compound commands and computed `sed` ranges; run plain commands or a `node <file>` script.
- Research section 7: a bare `"` as a value in a `;`-separated CSV opens a quoted field and swallows the following rows (measured on the scratch); the inch unit is `in` (plan gate), so no quoting is needed; the fact goes to LESSONS.
- PATTERNS "Cross-field consistency check" and TESTING: a constraint's draft message is written at commit and shows on the next `GET`; a `NEW` (child `POST`) writes none, a `PATCH` of the element does; messages written by a failed `draftActivate` stay until the element is touched or the draft is saved (#8 F1).
- TESTING: match activation targets by suffix (`/attribute_code$`), assert `code` exactly; `draftActivate` of a new draft answers 201.
- TESTING: OPA5 runs against `npx cds serve --in-memory --port 4004`, never `cds watch`; journeys leave no draft and restore seeded data.
- Protocol section 3: `mcp__fiori-mcp__search_docs` went down during this spec ("embeddings service failed to initialize"); the FE facts of research section 2 come from the CDN debug sources and are marked "not verified by MCP"; the orchestrator records the outage once.

## Open questions
None: D1-D9 were answered by the user on 2026-10-11 (see "User decisions"); SCREENS questions 1-7 are closed the same way.
