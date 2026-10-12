---
name: fe-v4-custom-fragment-writes
description: Writing from a custom FE V4 section fragment - ComboBox two-way type-ahead writes, which client message blocks FE Save, dependent bindings cannot create, draftEdit lacks after('EDIT') rows; ADR-0027 amendment 2026-10-12
metadata:
  type: project
---

Facts from the #9 browser proof (`docs/features/products-details-section/research/ui-proof.md`, ruling section F1-F9; UI5 1.153.0 CDN sources, not verified by MCP), ruled into the ADR-0027 amendment on 2026-10-12.

- `sap.m.ComboBox` with two-way `selectedKey` writes the model on every typed character (`handleInputValidation` -> `setSelection(null)` or type-ahead item). Bind the key `OneWay` and write in `change` (commit only) through `context.setProperty`. The clear icon fires `change` only when an item was selected.
- FE Save is blocked on the client only by a message with `validation: true` whose last control id is inside the visible view (`EditFlow#_checkForValidationErrors`), after `removeTransitionMessages()` drops every `persistent` message. A module's `setValueState` is not a message and does not block.
- A message on a V4 model path under the draft root is wiped at the next `DraftMessages` read (`ODataModel#reportStateMessages`, CAP `Common.Messages` + `#alwaysFetchMessages`). The safe shape is the framework's own: `target '<controlId>/<property>'`, `processor new ControlMessageProcessor()` (singleton), `validation: true`; the property must be bound so `MessageMixin` sets control id, label subtitle and value state.
- A relative list binding served from the parent's `$expand` (FE merges fragment bindings into the page GET under autoExpandSelect) has no own cache: `create()` sends nothing; `refresh()` throws. Use `parameters: { $$ownRequest: true, $select }` (measured POST 201 / DELETE 204), or `requestSideEffects` on the page context.
- `draftEdit` returns the data read before `after('EDIT')` handlers insert children; re-read with `requestSideEffects([{ $NavigationPropertyPath }])` on the draft context. FE binds the draft context before `setEditMode(Editable)`.
- Module-written PATCHes get no `DraftMessages` read from FE; request it after each write.

**Why:** the plan's named fallbacks (`sap.m.Select`, `selectionChange`, `ui>/isEditable` refresh) were either rejected by the user or did not address the cause; the cause was always the binding or message shape.

**How to apply:** any future custom section or column that writes data: plan these mechanisms up front instead of discovering them in a browser proof; see also [[handler-created-draft-children]] and [[fe-v4-custom-filter-field]].
