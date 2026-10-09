# products-subcategories: framework facts

Date: 2026-10-09. Author: `architect`. Read by `architect` and `reviewer`; implementers read it only where a PLAN step names it.

Versions: `@sap/cds` 10.1.1, `@sap/cds-compiler` 7.0.3, `@sap/cds-fiori` 2.3.0, UI5 CDN 1.153.0 (`sap-ui-version.json`, 2026-10-09).

## 1. Consistency check: a declarative `@assert` constraint exists (cds-mcp)

Query `mcp__cds-mcp__search_docs` "@assert with expression declarative constraints case when then error message" and "@assert constraints evaluated after write in transaction drafts draftActivate":

- capire "Declarative Constraints" (`/docs/guides/services/constraints`): `@assert: (case when <condition> then '<message or i18n key>' end)` on an element; conditions may use **path expressions to associated entities** (`when Currency != Travel.Currency then 'Currencies must match'`); a message key is looked up in the service's message bundle in the user's locale (`'ASSERT_BEGINDATE_BEFORE_ENDDATE'`).
- "Served Out-of-the-Box": `@assert` constraints are collected into one query and pushed down to the database **after** the `INSERT`/`UPDATE`, inside the same transaction; a failure rolls the request back.
- "Draft Input Validation": on draft `PATCH` all `@assert`s are validated and messages are returned, the draft is still saved. "Validation on Active Entities": on `draftActivate` all constraints run as for an active write.
- Runtime source `@sap/cds/libx/_runtime/common/generic/assert.js` (10.1.1): `after(['INSERT','UPSERT','UPDATE'])` collects changed keys, `before('commit')` runs `SELECT keys, (case ...) as "@assert:<element>"`; association elements are skipped (`element.isAssociation && !element.isComposition`), so the check runs on the generated foreign key, to which the compiler propagates the annotation written on the association (CSN of the scratch probe: identical `@assert.xpr` on `subcategory` and `subcategory_code`); error `{ status: 400, message, target: <element> }`, target prefixed `in/` inside a draft action; on a draft `UPDATE` only messages whose target was touched by the PATCH are written to `DraftMessages` (`cds.env.features.assert_touched_only`, default on).

Consequence: the issue's "no `@assert.*` expresses it, so a `before` handler" is outdated. The subcategory/category rule is one annotation in `srv/annotations/Products.cds`; no handler is needed for (b). PATTERNS has no row for `@assert: (case ...)`, so ADR-0024 proposes one.

## 2. `@assert.target` (cds-mcp)

Query "@assert.target managed association foreign key check input validation": checks existence of the target on `CREATE`/`UPDATE` of a managed to-one association, before custom handlers; error code `ASSERT_TARGET`. Reused unchanged for `Products.subcategory` (0 EDMX lines, see `contract-delta-facts` memory and section 4 of `scratch-experiment.md`).

## 3. Draft PATCH handler (cds-mcp)

Query "lean draft handlers register on MyEntity.drafts UPDATE PATCH event draft modification": `srv.before('PATCH', MyEntity.drafts, ...)`; "The `PATCH` event is triggered whenever the user edits a field in a draft. It's actually an alias for the standard CRUD `UPDATE` event." Also: "Validate on active entities, not only on drafts" (active PATCH bypasses drafts). The reset handler of decision 3 is registered on `Products.drafts` only; the consistency rule stays on every write through the `@assert` constraint.

## 4. Dependent value help in Fiori Elements V4 (fiori-mcp and UI5 sources)

`mcp__fiori-mcp__search_docs` "ValueListParameterIn dependent value help filter by another field value OData V4", "ValueListWithFixedValues dropdown with in parameter ValueListParameterIn", "Field Help OData V4 in-parameter value empty ...":

- "In/Out Mappings in the Common.ValueList Annotation": `Common.ValueListParameterIn` takes a main-entity property (`LocalDataProperty`) into the filter of the value help entity (`ValueListProperty`); "if RegionID = 'ABC' is present ..., the Country value help applies filter RegionIdentifier eq 'ABC'"; CAP CDS sample with `$Type: 'Common.ValueListParameterIn'`.
- "Value Help as a Dropdown or Radio Button List": "Radio buttons must not be used for value lists with dependencies defined by ValueListParameterInOut or ValueListParameterIn" (the restriction names radio buttons only); "Text handling and sorting for dropdowns follow the Value Help Dialog logic". No sentence states the dropdown case explicitly.
- UI5 1.153.0 CDN sources (`sap/fe/macros/valuehelp/ValueHelpDelegate-dbg.js`, `sap/fe/macros/internal/valuehelp/ValueListHelper-dbg.js`): a fixed-values field is built as typeahead content (`_createValueHelpTypeahead`, `payload.isValueListWithFixedValues`); `getInitialFilterConditions` runs "everytime a value help content is shown" and, for `MTable` typeahead content, resolves In parameters through `_resolveInParameterConditions` from the binding context on the Object Page (`_getInitialFilterConditionsFromBinding`) and from sibling filter fields in the filter bar (`_getInitialFilterConditionsFromFilterBar`). `_createInitialFilterCondition` creates no condition for `null`/`""` unless `InitialValueIsSignificant`, so with an empty category the dropdown lists every subcategory.
- Conclusion (source-read, not yet measured in a browser): the dropdown (`ValueListWithFixedValues: true`) honors the In parameter; the field does not need to become a dialog. The OPA5 journey of PLAN step 9 is the measurement; the stop condition in PLAN "Risks" applies if it fails.

## 5. Refresh of the dependent field (fiori-mcp)

`mcp__fiori-mcp__search_docs` "Side effects SourceProperties TargetProperties field change object page draft PATCH refresh dependent field":

- "Side Effect with Single Source Property: the side effect request is sent immediately after the property was changed"; for a ComboBox/value help "side effect triggers when value is set or focus leaves control".
- "TargetProperties: a property or list of properties. You may use 1:1 navigation properties; front end will issue a $expand when needed." "If using text arrangement or value list + key changes, annotate side effects so the text updates when a key changes." Hence `TargetProperties: ['subcategory_code', 'subcategory/name']`.
- Fiori Elements V4 has no annotation that clears a dependent field by itself; a value appears empty only if the back end clears it and the UI re-reads it. Clearing is therefore a back-end decision (PLAN gate question 4).

## 6. Rejected mechanisms

| Mechanism | Why rejected |
|---|---|
| `before(['CREATE','UPDATE'], Products)` handler with `req.reject(400, 'KEY')` for the pair check (the issue's proposal) | The `@assert` constraint of section 1 expresses it declaratively, runs on active writes, on `draftActivate` and as a draft message, localized; a handler would duplicate the framework (invariant 6) |
| Composite key `Subcategories { key category; key code }` so that `@assert.target` checks the pair | Breaks ADR-0010 (single `code` key), gives `Products` a second category foreign key, and the generated ValueList of a composite-key code list is not the ADR-0011 shape |
| Keeping the compiler-generated ValueList and adding a second, qualified one with the In parameter | Two ValueLists on one property make FE V4 show a value help variant switch; ADR-0011 requires exactly one ValueList per property |
| Turning the subcategory into a value help dialog | Not needed (section 4); a dialog for 2-3 values contradicts ADR-0011 part 2 |
| `Common.ValueListRelevantQualifiers` (context-dependent value help) | Selects between several ValueLists by another field; one ValueList with an In parameter is the simpler documented mechanism |
| `Common.SideEffects` with `TriggerAction` to clear the field | Still needs an imperative action plus a second request; the PATCH handler of decision 3 clears in the same request |
