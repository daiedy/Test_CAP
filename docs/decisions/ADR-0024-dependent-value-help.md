# ADR-0024: Dependent value help between code lists

Date: 2026-10-09. Status: accepted (user, 2026-10-09, feature `products-subcategories`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
Issue #8 adds `Subcategories : sap.common.CodeList` whose rows belong to one `Categories` row, and `Products.subcategory`. The subcategory must be chosen from the subcategories of the product's category, a mismatched pair must not be saved, and the Object Page must react when the category changes. Three gaps in `PATTERNS.md`:

1. "Value help from a code list" says the ValueList is "never written by hand"; the compiler-generated one carries only `InOut code` and `DisplayOnly name`, no In parameter. ADR-0011 part 1 already allows an explicit ValueList "when additional parameters are needed (`In`/`Out` ...)", but fixes neither its shape nor whether the dropdown (`ValueListWithFixedValues`) survives.
2. "Format or range check" names only `@assert.format`/`@assert.range` and otherwise a `before` handler. A rule between two fields across an association has no row. capire documents `@assert: (case when ... then '<key>' end)` constraints with path expressions, run by the runtime on every write, as draft messages, and on activation.
3. No row covers resetting a dependent field while a draft is edited; Fiori Elements V4 has no annotation that clears a field.

Evidence: `docs/features/products-subcategories/research/framework-facts.md` (cds-mcp, fiori-mcp, UI5 1.153.0 sources) and `research/scratch-experiment.md` (cds 10.1.1 scratch run, EDMX deltas).

## Decision
Decision 1, value help. On the dependent association, in `app/<app>/annotations/<Entity>.cds`, write one `Common.ValueList` by hand: `Label` from the element's i18n key, `CollectionPath` the dependent code list projection, `Parameters` = `ValueListParameterInOut` (own foreign key to `code`), `ValueListParameterIn` (the parent foreign key to the code list's parent foreign key, for example `category_code` to `category_code`), `ValueListParameterDisplayOnly` (`name`). Keep `Common.Text`, `#TextOnly` and `Common.ValueListWithFixedValues: true` as for any fixed code list (ADR-0011 part 2); the hand-written ValueList replaces the generated one, so the property still has exactly one. With an empty parent value the list is unfiltered. A filter-bar field on the dependent property follows the same annotation (FE resolves In parameters from sibling filter fields) and is planned with its own test when first used.

Decision 2, consistency. Express a rule between fields, including fields reached through an association, as an `@assert: (case when <condition> then '<MESSAGE_KEY>' end)` constraint on the element in `srv/annotations/<Entity>.cds`, message key in `_i18n/messages.properties` and `_ru`; no handler. Guard every nullable operand explicitly (`<assoc>.code is not null and <parent>.code is not null and ...`): CQL `!=` treats null as a value, so without the first guard an empty dependent value fails and without the second a dependent value chosen before the parent gets a message that a later parent PATCH does not remove (touched-only draft messages); an empty parent is left to its own `@mandatory`. For the dependent code list: `subcategory @assert: (case when subcategory.code is not null and category.code is not null and subcategory.category.code != category.code then 'PRODUCTS_SUBCATEGORY_MISMATCH' end)`. The runtime checks it after the write in the same transaction: 400 with the key as `code` and the foreign key as `target` on active writes, a `DraftMessages` entry on a draft PATCH that touched the element, 400 with target `in/<fk>` on `draftActivate`.

Decision 3, reset (applies when the user chooses "clear automatically", PLAN D4). A `before('PATCH', <Entity>.drafts)` handler in `srv/<name>-service.js` sets the dependent foreign key to `null` when the PATCH changes the parent foreign key, does not carry the dependent one, and the stored dependent value does not belong to the new parent (one `SELECT.one` on the code list). Active writes are not reset: there decision 2 rejects. `Common.SideEffects #<Parent>Changed: { SourceProperties: [ <parent fk> ], TargetProperties: [ '<dependent fk>', '<dependent assoc>/name' ] }` in `app/<app>/annotations/<Entity>.cds` makes Fiori Elements re-read the field and its text after the PATCH.

First application: `Products.subcategory` → `Subcategories` (feature `products-subcategories`).

## Alternatives
| Option | Why rejected |
|---|---|
| `before(['CREATE','UPDATE'], Products)` with `req.reject(400, 'KEY')` for the pair (the issue's proposal) | The `@assert` constraint covers active writes, activation, draft messages and localization declaratively (invariant 6); a handler would also miss the draft-message path unless written twice |
| Composite key on `Subcategories` so that `@assert.target` checks the pair | Breaks ADR-0010 (single `code` key) and adds a second category foreign key to `Products` |
| A second, qualified ValueList next to the generated one | FE shows a value help variant switch; ADR-0011 requires one ValueList per property |
| Value help dialog instead of the dropdown | Not needed: UI5 1.153.0 resolves In parameters for the typeahead content a fixed-values field uses; a dialog for two or three values contradicts ADR-0011 part 2 |
| `Common.ValueListRelevantQualifiers` | Chooses between several ValueLists; one ValueList with an In parameter is the documented mechanism for filtering |
| Reject at Save only, no reset (PLAN D4 alternative) | Fully declarative and kept as the user's option; the stale value stays visible and the user learns of it only from a failed Save |
| Reset in the client (controller extension) or via `SideEffects` `TriggerAction` | Client code for what one server rule does; a trigger action is still imperative and costs a second request |

## Consequences
- `PATTERNS.md`, section "Service and logic": new rows "Cross-field consistency check" (decision 2) and "Dependent field reset on a draft" (decision 3); section "UI Fiori Elements": new row "Dependent value help" (decision 1); the row "Value help from a code list" gets "except a dependent code list: see Dependent value help"; the row "Format or range check" points to "Cross-field consistency check". Examples: `srv/annotations/Products.cds`, `srv/catalog-service.js`, `app/products/annotations/Products.cds`.
- `templates/annotations-ui.cds`: a commented dependent value help block.
- `.claude/rules/ui-annotations.md` (protected): one sentence naming this exception to "never written by hand"; edited on a user request.
- The reviewer accepts a hand-written ValueList on a code-list foreign key only in the decision 1 shape and with an In parameter.
- A consistency error carries a project key, not an `ASSERT_*` code: `importProducts` maps only `ASSERT_*` errors to rows, so an import column for a dependent field needs that mapping extended first.
- EDMX cost on this model: decision 2 0 lines; decision 1 +8 net; decision 3's side effect +30 (entity type and entity set).

## Sources
- capire "Declarative Constraints" (`/docs/guides/services/constraints`), "Draft Input Validation", Node.js "Draft-specific Events" (`PATCH`), via `mcp__cds-mcp__search_docs`
- SAP Fiori elements "In/Out Mappings in the Common.ValueList Annotation", "Value Help as a Dropdown or Radio Button List", "Side Effects", via `mcp__fiori-mcp__search_docs`
- `https://ui5.sap.com/resources/sap/fe/macros/valuehelp/ValueHelpDelegate-dbg.js`, `sap/fe/macros/internal/valuehelp/ValueListHelper-dbg.js` (1.153.0)
- `@sap/cds/libx/_runtime/common/generic/assert.js` (10.1.1)
- ADR-0010, ADR-0011, ADR-0012; `docs/features/products-subcategories/research/`
