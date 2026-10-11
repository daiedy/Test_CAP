# products-details-section: framework facts and measurements

Date: 2026-10-11. Author: `architect`. Read by `architect` and `reviewer`; implementers read it only where a PLAN step names it. Versions: `@sap/cds` 10.1.1, `@sap/cds-compiler` 7.0.3, `@sap/cds-dk` 10.1.0, UI5 CDN 1.153.0 (`sap-ui-version.json`, build 2026-09-30). Baseline: `main` at `18d56ab`, `metadata.xml` 884 lines.

## 1. MCP queries and findings

| Server | Query | Finding |
|---|---|---|
| cds-mcp `search_model` | `Products`, `Subcategories`, `CatalogService` | `CatalogService.Products` is `@odata.draft.enabled` with `@restrict` (Viewer READ, Editor `*`); `Subcategories` is a `CodeList` with `category`; no composition exists in the model (the first one) |
| cds-mcp `search_docs` | "composition children of a draft-enabled root ... create child via navigation" | capire "Lean Draft" table: an inactive (draft) parent reaches its composition children and its backlink associations inside the same draft document; "Draft-Enabled Entities": the root annotation is enough, CAP adds `.drafts` for the root and its composition tree; "Deep INSERT": compositions are deeply created, associations only fill foreign keys |
| cds-mcp `search_docs` | "@assert.unique constraint drafts activation" | `@assert.unique.<name>: [ a, b ]` becomes a DDL `UNIQUE` constraint on the flattened foreign keys; nothing about drafts or the error shape (measured in section 4: a violation is a 500 on the active path, nothing on a draft) |
| cds-mcp `search_docs` | "calculated elements on-read ... draft" | on-read calculated elements are supported by the `@cap-js` database services, can follow associations, cannot be used in ON conditions or as foreign keys; nothing about drafts (not needed: the chosen value-help mechanism uses no calculated element) |
| cds-mcp `search_docs` | "@restrict inheritance composition children auto-exposed" | capire "Compositions": restrictions of composition children are **not** checked by the runtime for requests that go through the root (expand, deep insert and update); "Events to Auto-Exposed Entities": an implicitly auto-exposed composition child "cannot be accessed directly"; capire "Control Exposure of Associations": only the target entity of a request passes the authorization check, so a directly addressed child projection needs its own `@restrict` |
| cds-mcp `search_docs` | "declarative constraints @assert case when exists ... path expression" | capire `@assert:` constraints are SQL `case` expressions; path expressions to associated entities are allowed; sets are checked with `exists <to-many path>[<infix filter>]`; `$self` reaches the top-level elements of the annotated entity (CDL "Name resolution") |
| cds-mcp `search_docs` | "draft events NEW PATCH before handler on composition child" | capire "Validation on Active Entities": saving a draft triggers one `CREATE` or `UPDATE` of the root "with all of its compositions through a deeply structured document", all `@assert`s run there; "Validating Drafts": on a draft `PATCH` all `@assert`s are validated and returned as messages while the draft is still updated; `PATCH` on `X.drafts` is an alias of `UPDATE` |
| fiori-mcp `search_docs` | "Object Page table section from a composition UI.ReferenceFacet ... creationMode" | "Create Mode Options for Object Page": `Inline`, `InlineCreationRows`, create page, create dialog, `External`; "Enabling Inline Creation Mode ...": the OData V4 manifest sample marks `"name": "Inline"` as "Results in Inline creation (default)" for an Object Page table, so no `manifest.json` change is needed for inline rows; `Capabilities.InsertRestrictions.RequiredProperties` marks required columns; a `Common.SideEffects` with `TargetEntities: [ <navigation> ]` refreshes the table |
| fiori-mcp `search_docs` | same query, result "Generic Action Buttons in Object Page Tables" | "The Create button on a table toolbar of the Object Page is displayed only when the Object Page is in Edit mode"; `Capabilities.InsertRestrictions.NonInsertableNavigationProperties` and `DeleteRestrictions.Deletable` can hide or disable them per row |
| fiori-mcp `search_docs` | "Common.SideEffects SourceProperties TargetEntities navigation property ..." | "Side Effects": `TargetEntities` takes navigation property paths (`items`, `businessPartner`) or absolute paths; value lists are cached and refreshed only by an absolute side effect on the value list collection |
| fiori-mcp `search_docs` | "In/Out Mappings in the Common.ValueList Annotation ...", "object page table Create and Delete buttons ..." , "Adding Actions to Tables ..." | **outage**: "Search is currently unavailable. The embeddings service failed to initialize" on three queries after the batch above (retried once); fallback per protocol section 3: the CDN debug sources in section 2, marked "not verified by MCP" |

## 2. UI5 1.153.0 sources (CDN debug sources, read 2026-10-11; not verified by MCP)

- `sap/fe/macros/valuehelp/ValueHelpDelegate-dbg.js`, `_getInitialFilterConditionsFromBinding` (lines 703-765): the In-parameter values are read with `bindingContext.requestProperty(propertiesToRequest)` on the field's binding context, "Property values that are not cached yet are requested from the back end"; `propertiesToRequest` are the `LocalDataProperty` paths of the `ValueListParameterIn` records. `_buildPropertiesToRequest` (lines 766-812) documents that a source path may contain navigation steps and reduces partner navigations only when the field itself sits behind a navigation; for a field bound directly to a table row the path is requested as written. For a child row of `Products/details` with `LocalDataProperty` `product/subcategory_code`, the request is `requestProperty(['product/subcategory_code'])` on the row context, that is a late `$expand=product($select=subcategory_code)` on the row. An inactive (not yet created) row context is awaited first (`bindingContext.created()`).
- Consequence: the dependent value help of the child row can reuse the ADR-0024 shape with a navigation path in the In parameter; no calculated element and no copied foreign key are needed (section 5).
- `sap/fe/test/ObjectPage-dbg.js` line 265: `onTable(vTableIdentifier)` accepts `{ property: '<navigation>' }` (and an optional `qualifier`) and resolves it with `getTableId(property, qualifier)`, so the Details table is addressed as `onTheProductsObjectPage.onTable({ property: 'details' })` in OPA5.

## 3. Compiler facts (cds-compiler 7.0.3, scratch compile)

| Probe | Result |
|---|---|
| Unmanaged association on the child `assignment : Association to SubcategoryAttributes on assignment.attribute = attribute and assignment.subcategory = product.subcategory` | **compile error** `Can follow managed association "ProductDetails:product" only to the keys of its target, not to "subcategory"`: an ON condition cannot reach a non-key element through a managed association, so a to-one shortcut to the assignment row is impossible without a stored copy of the subcategory |
| `@assert: (case when ... not exists attribute.subcategories[subcategory.code = $self.product.subcategory.code] then 'KEY' end)` on `CatalogService.ProductDetails.attribute`, with `DetailAttributes.subcategories : Association to many SubcategoryAttributes on subcategories.attribute = $self` | compiles; CSN keeps `$self` inside the infix filter (`{"ref":["$self","product","subcategory","code"]}`), `$self` is the annotated entity (the detail row), not the filtered one; the runtime evaluates it correctly (section 4) |
| Second branch `when exists product.details[attribute.code = $self.attribute.code and ID != $self.ID] then 'DUPLICATE'` | compiles and works (section 4): the draft row reaches its draft siblings through the draft parent (lean draft, same document) |
| Root branch on `CatalogService.Products.subcategory`: `when subcategory.code is not null and exists details[attribute.code is not null and not exists attribute.subcategories[subcategory.code = $self.subcategory.code]] then 'KEY'` | compiles (nested `exists`, `$self` = the product); works on active root writes and drafts (section 4) |
| `LocalDataProperty: product.subcategory_code` in a hand-written `Common.ValueList` on `ProductDetails.attribute` | compiles to `<PropertyValue Property="LocalDataProperty" PropertyPath="product/subcategory_code"/>`; `cds lint` clean |
| `UI.LineItem` record `{ Value: attribute.unit }` | compiles to `Path="attribute/unit"` (a scalar reached through the association, allowed; the rule against `Value: <assoc>` concerns the association itself) |
| `Composition of many ProductDetails on details.product = $self` | EDMX `<NavigationProperty Name="details" ... Partner="product">` and `product ... Partner="details"`; `ProductDetails` gets the draft elements (`IsActiveEntity`, `HasActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData`, `SiblingEntity`) from the root's `@odata.draft.enabled` |
| `@assert.unique`, `@assert`, `@assert.target`, `@mandatory` on the child | `@assert.unique` and `@assert` leave no EDMX trace; `@mandatory` emits `Common.FieldControl` Mandatory as on the root |
| Projection `SubcategoryAttributes { *, attribute.name as attributeName }` | compiles; the name is served localized (section 4, `ru`); the compiler also generates two value lists on the projection's own foreign keys (`subcategory_code`, `attribute_code`), harmless as with `Subcategories/category_code` |

## 4. Runtime facts (cds 10.1.1, scratch `cds.test` run, mocked auth, SQLite in-memory)

Method: `rsync` of the worktree to `/tmp/details-scratch` (without `node_modules`, `.git`, `docs`, `.claude`), `node_modules` symlinked; the model of section 6 plus a six-attribute seed; one throwaway Vitest file per probe, `npx vitest run test/scratch-details.test.js` in the scratch. Nothing in the project changed.

| Request (as `alice` unless stated) | Result |
|---|---|
| `GET Products(<laptop>,true)/details?$expand=attribute($select=name,unit)` | the seeded rows with `attribute.name` and `unit`; with `Accept-Language: ru` the `ru` names |
| `GET SubcategoryAttributes?$filter=subcategory_code eq 'LAPTOPS'&$select=attribute_code,attributeName` | only the assigned attributes, `attributeName` localized (`ru` on request) |
| `POST ProductDetails {IsActiveEntity: true, ...}` (top level, any payload, also as `viewer`) | **422 `DRAFT_MODIFICATION_ONLY_VIA_ROOT`** "A draft-enabled entity can only be modified via its root entity": lean draft locks every top-level write to the composition child, before authorization |
| `POST Products(<mouse>,true)/details { attribute_code: 'COLOUR', value }` (active, via the root) | 201, `IsActiveEntity: true` |
| same with an attribute not assigned to the product's subcategory | 400 `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, target `attribute_code`, localized in `ru` |
| same with an unknown attribute code / without an attribute | 400 `ASSERT_TARGET` / `ASSERT_MANDATORY`, target `attribute_code` |
| `PATCH Products(<mouse>,true)/details(<id>,true) { attribute_code: <foreign> }` | 400 `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, target `attribute_code`; a `value` PATCH is 200 |
| `PATCH Products(<mouse>,true) { subcategory_code: 'AUDIO' }` while a row holds an attribute not assigned to AUDIO | 400 `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS`, target `subcategory_code` (root branch) |
| deep `POST Products { IsActiveEntity: true, ..., details: [ <foreign> ] }` | 400 `MULTIPLE_ERRORS`: `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` on `subcategory_code` and `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED` on `details(ID=...)/attribute_code` |
| deep `POST` with two permitted rows; `DELETE Products(<id>,true)` | 201 with 2 details; 204 and `ProductDetails?$filter=product_ID eq <id>` is empty (cascade) |
| `viewer`: `GET ProductDetails`, `GET Products(...)/details` | 200, 200 |
| `viewer`: `POST Products(<mouse>,true)/details`, `PATCH`/`DELETE` of a child via the root | 403 `'403'` each |
| `carol` (no catalog role): `GET ProductDetails` / `GET DetailAttributes` | 403 (explicit `@restrict` on the child projection) / 200 (code list, like `Categories`) |
| `POST DetailAttributes`, `POST SubcategoryAttributes` | 405 `ENTITY_IS_READ_ONLY` |
| draft: `POST Products(<laptop>,false)/details { attribute_code: <foreign> }` | 201; the child's and the root's `DraftMessages` stay `[]` (a NEW is not a touched PATCH) |
| draft: `GET .../details(<child>,false)?$expand=product($select=IsActiveEntity,subcategory_code)`, `GET .../details(<child>,false)/product`, top-level `GET ProductDetails(<child>,false)?$expand=product(...)` | `product` is the **draft** parent (`IsActiveEntity: false`, the draft's `subcategory_code`): the FE late request of `product/subcategory_code` sees the draft's current subcategory |
| draft: `PATCH <child> { attribute_code: <foreign> }` then `GET` | 200; one message `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED` with target `/Products(<laptop>,false)/details(<child>,false)/attribute_code` on the child's **and** the root's `DraftMessages` |
| draft: `PATCH <child> { attribute_code: <already used> }` then `GET` | 200; message `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` on the child (constraint branch) |
| `draftActivate` with a foreign child | 400 `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, target `in/details(ID=<child>,IsActiveEntity=false)/attribute_code` |
| `draftActivate` with an empty child row | 400 `MULTIPLE_ERRORS`: `ASSERT_MANDATORY` on `in/details(...)/attribute_code` and `.../value` |
| draft: `PATCH Products(<laptop>,false) { subcategory_code: 'MICE' }` (3 seeded LAPTOPS rows) then `GET` | 200; root `DraftMessages` holds one `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` on `.../subcategory_code` (root branch, immediate) |
| `draftActivate` after that change | 400 `MULTIPLE_ERRORS`: the root message on `in/subcategory_code` plus one `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED` per seeded row on `in/details(ID=...,IsActiveEntity=false)/attribute_code` (all children are re-checked at activation, not only changed ones) |
| draft: `PATCH` the subcategory back, `GET` | the root message is gone (element touched again); the three per-row messages written by the failed activation stay until the rows are touched or the draft is saved (standard touched-only draft messages, as in #8 F1); the next `draftActivate` is 200 |
| new draft product: child `POST` before a subcategory, then `PATCH subcategory_code` | the child is accepted (guard `product.subcategory.code is not null`), `product.subcategory_code` is `null` (unfiltered dropdown); the subcategory PATCH writes the root message when the row does not fit; activation 400 until the row is fixed, then 201 |
| **`@assert.unique.attributePerProduct: [product, attribute]` on `ProductDetails`** | a duplicate on the active path (`POST` via the root, deep `POST`, `draftActivate`) is a **500 `ERR_SQLITE_ERROR` "UNIQUE constraint failed"**, not a 400; a draft `PATCH` to a duplicate is 200 without a message. cds 10.1.1 with `@cap-js/sqlite` does not translate the violation |
| the same without `@assert.unique`, with the `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` branch | active `POST` duplicate 400 with the key and target `attribute_code`, nothing written; deep `POST` with two equal rows 400 `MULTIPLE_ERRORS` naming both rows; `draftActivate` with a duplicate 400 naming both rows (the new and the seeded one); after deleting one, 200 |

## 5. Mechanisms considered and rejected

| Mechanism | Why not |
|---|---|
| Reading (b) of the issue: fixed typed detail elements on `Products` shown per subcategory with `UI.Hidden` paths | rejected by the user (decision 1): every new attribute would be a model change and a contract change; 20 attributes would add 20 columns to every product |
| Attributes bound to one subcategory (`DetailAttributes.subcategory`) | rejected by the user (decision 3): one `Colour` row per subcategory, the same name 15 times in the code list and its texts |
| Calculated element on the child `subcategory_code = product.subcategory_code` as the In parameter | a contract property with no business meaning; whether an on-read calculated element follows the draft parent on `.drafts` is unmeasured; the FE delegate reads a navigation path directly (section 2), so nothing is gained |
| Foreign key copied into the child by a `before('NEW')` handler | duplicated data, stale after a subcategory change, imperative (invariant 6) |
| Child referencing the assignment row (`attribute : Association to SubcategoryAttributes`) | keeps the guard a plain path compare (`attribute.subcategory.code != product.subcategory.code`), but changes the agreed shape, the row's key becomes an assignment UUID, a `Colour` row would not survive a subcategory change even where `Colour` is assigned to the new subcategory, and the `exists` form (section 3) achieves the same declaratively |
| Unmanaged `assignment` association on the child | compile error (section 3) |
| `before` handlers on `ProductDetails` (`NEW`, `PATCH`, `CREATE`, `UPDATE`) and on `Products` for the guard | the `@assert` constraints cover active writes through the root, deep writes, draft messages and activation (section 4); a handler would need four registrations and would miss the draft-message path |
| `@assert.unique` on `ProductDetails` (user decision 6 as written) | a 500 on every active duplicate (section 4); kept only on `SubcategoryAttributes`, whose only writer is the CSV at deploy time |
| `@odata.contained` on the composition (no `ProductDetails` entity set) | capire marks containment as an opt-in with its own restrictions; the entity set is already write-locked by lean draft (422) and read-guarded by `@restrict`; the mock server and the OPA page objects work with plain entity sets |
| Composite key `(subcategory, attribute)` on `SubcategoryAttributes` | see ADR-0026 alternatives: CONVENTIONS allow composite keys only for text and code tables; nothing references the assignment row, so the natural key buys nothing; `@assert.unique.pair` costs one line and no EDMX |
| `UI.FieldGroup` instead of a table for the section | a field group needs one element per attribute (reading (b)); a to-many composition is a table |
| Hiding the table's Create while the product has no subcategory (`Capabilities.InsertRestrictions.NonInsertableNavigationProperties` with an `If` on `subcategory_code`) | possible later; with a mandatory subcategory the flow is category, subcategory, details, and the server rejects a foreign row at Save; not planned (PLAN D5) |

## 6. Scratch model that produced the figures

`db/schema.cds`: `Products.details : Composition of many ProductDetails on details.product = $self`; `DetailAttributes : CodeList { key code : String(30); unit : String(10); subcategories : Association to many SubcategoryAttributes on subcategories.attribute = $self; }`; `@assert.unique.pair: [ subcategory, attribute ] entity SubcategoryAttributes : cuid { subcategory; attribute }`; `entity ProductDetails : cuid { product : Association to Products; attribute : Association to DetailAttributes; value : String(100); }` (no `@assert.unique`).
`srv/catalog-service.cds`: `ProductDetails` projection with the `Products` `@restrict`; `@readonly DetailAttributes`; `@readonly SubcategoryAttributes { *, attribute.name as attributeName }`.
`srv/annotations/ProductDetails.cds`: `attribute @mandatory @assert.target @assert: (case <not assigned> / <duplicate> end)`, `value @mandatory`; `srv/annotations/Products.cds`: the root branch added to the existing `subcategory` constraint.
`app/products/annotations/Products.cds`: facet `{ ID: 'Details', Target: 'details/@UI.LineItem' }` before `AdminData`, `Common.SideEffects #SubcategoryChanged { SourceProperties: [ subcategory_code ], TargetEntities: [ details ] }`; `ProductDetails.cds`: `UI.HeaderInfo` (TypeName, TypeNamePlural), `UI.LineItem` (`attribute_code`, `value`, `attribute.unit`), `Common.SideEffects #AttributeChanged { SourceProperties: [ attribute_code ], TargetProperties: [ 'attribute/name', 'attribute/unit' ] }`, on `attribute` Text/TextOnly/FixedValues and the hand-written ValueList (InOut `attribute_code`/`attribute_code`, In `product.subcategory_code`/`subcategory_code`, DisplayOnly `attributeName`); `SubcategoryAttributes.cds`: `attribute @Common.Text: attributeName #TextOnly`; `DetailAttributes.cds`: `code @Common.Text: name #TextOnly`.

EDMX (`cds compile '*' --to edmx-v4 -s CatalogService -l en`):

| State | Lines | Against 884 |
|---|---|---|
| Phase 2: `db/` and `srv/` of this model, `app/` unchanged | 1177 | +293, 0 removed |
| Phase 3: plus the app annotations above | 1273 | +389 against 884; +96 net against phase 2 (the compiler-generated value list on `ProductDetails/attribute_code` is replaced by the hand-written one) |

Seven `Common.ValueList` terms in both states (four today): `ProductDetails/attribute_code` (generated in phase 2, hand-written in phase 3), `SubcategoryAttributes/subcategory_code` and `SubcategoryAttributes/attribute_code` (generated). The `@assert` branches and `@assert.unique` add 0 lines; the `details` label adds 1.

## 7. Seed-data fact

A bare `"` as the inch unit in `my.catalog-DetailAttributes.csv` opened a quoted field and swallowed the following rows (every `attribute` expand came back `null`). The CSV spelling of one double quote is `""""` (a quoted field holding an escaped quote); `cds deploy` then loads `"` as the value. The user chose the unit `in` at the plan gate (2026-10-11), so the feature needs no quoting; the trap stays a LESSONS fact.
