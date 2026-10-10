# products-subcategory-cascade: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task.

Written for the recommended answers of `PLAN.md` (D1 = A: a category change clears the subcategory, Subcategory is disabled only while the category is empty; D2 = A: `FieldControl` 0, disabled input). Where a D2 = B (read-only) answer changes the design, the row says so.

## Floorplan and duplication check
- Floorplan: unchanged List Report + Object Page (SAP Fiori elements for OData V4). No new screen, page, fragment, controller extension or `manifest.json` change: the feature changes the editability of one field of an existing form, the Object Page section "General Information" (`UI.FieldGroup #GeneralInfo`, facet `GeneralInfo`). Guidelines: https://experience.sap.com/fiori-design-web/object-page/#forms and https://experience.sap.com/fiori-design-web/form/ (both from fiori-mcp "Grouping Fields with UI.FieldGroup and UI.ConnectedFields"); the dropdown control: https://experience.sap.com/fiori-design-web/combo-box/ (`references` of `get_api_reference sap.m.ComboBox`; fiori-mcp "Value Help as a Dropdown or Radio Button List": `ValueListWithFixedValues` renders a combo box).
- `docs/registry/UI-ARTIFACTS.md`: pages `ProductsList` and `ProductsObjectPage` (`editableHeaderContent=false`); the only extension is `RatingRangeFilter` (List Report filter bar). Nothing exists for the form, so nothing is duplicated; the whole change is the one annotation of ADR-0025.
- One user task: "enter Category before Subcategory, and pick a subcategory that fits the category". It stays one screen.
- Editing surfaces: only the Object Page form, in create mode (Create on the List Report posts a draft and opens it) and in edit mode (CONTEXT "Editing surfaces"). Not affected: the List Report Subcategory column, the Object Page display mode, the "Adapt Filters" Subcategory filter field.

### Sources
| Statement | Source |
|---|---|
| `Common.FieldControl` can be static, a path or an expression; it governs read-only, hidden, mandatory | fiori-mcp "Field Control" (Field building block) |
| A FieldControl `0` gives `FieldEditMode.Disabled`, `1` gives `ReadOnly`, both give `Display` in display mode | `research/framework-facts.md` (UI5 1.153.0 `UIFormatters.getEditMode`, `FieldControlHelper`), source-read, not measured |
| `FieldEditMode` has `Disabled`, `ReadOnly`, `Editable`, `Display` | `get_api_reference sap.ui.mdc.enums.FieldEditMode` |
| A disabled control "cannot be focused and is out of the tab-chain" | `get_api_reference sap.m.InputBase#enabled` |
| A non-editable (read-only) control can be tabbed to, highlighted and copied from | `get_api_reference sap.m.InputBase#editable` |
| A side effect with one source property is requested immediately after the change; for a combo box or value help when the value is set or the focus leaves | fiori-mcp "Side Effects" (step 1 and the framework doc's trigger list) |
| The In parameter filters the value help by the main-entity value | fiori-mcp "Input with Value Help" (In/Out Parameter Mapping), "Value Help as a Dropdown or Radio Button List" |
| Edit-mode state messages go to the message popover | fiori-mcp "Using Messages in SAP Fiori Elements" steps 1 and 8 |
| `UI.Placeholder` shows a text in `sap.m.Input` / `sap.m.ComboBox` before user entry | fiori-mcp "Configuring Fields in SAP Fiori elements (OData V4)" step 2 |
| Fiori rule "use disabled only when another control on the same screen can enable the field; otherwise read-only" | not verified by MCP: no fiori-mcp document on disabled versus read-only (two queries, also `research/framework-facts.md` row 31); from the SAP Fiori design guidelines, input field and combo box "States" sections |
| Accessibility verdicts | `ui5-best-practices-accessibility` skill (eight topics) plus the UI5 API rows above; fiori-mcp has no accessibility document for List Report / Object Page |

## Screen: Object Page, General Information form (create and edit mode)
- Title and subtitle: unchanged. Header title is the product name, the subtitle the category name (`UI.HeaderInfo`, `#TextOnly`); for a new draft both are empty until entered, as today.
- Filters: not applicable on the Object Page. On the List Report the filter bar is unchanged; the Subcategory field in "Adapt Filters" is a filter field, a `FieldControl` does not apply to it, it keeps accepting a value (unnarrowed, #8 D9).
- Table columns in order of importance: not applicable; the List Report Subcategory column (`#Low`) is unchanged.
- Actions and their placement: unchanged (Edit in the header, Save and Cancel/Discard Draft in the footer, by Fiori Elements). No new action; no "clear" button: emptying the Category text is the way to clear both.
- Object Page sections: unchanged order General Information, Pricing and Stock, Administrative Data. Field order in General Information unchanged: Name, Description, Category, Subcategory, Rating, Image URL. Category stays directly above Subcategory: the adjacency is what explains the dependency (no hint text, see "Texts" and Q2).
- Empty state and errors: the field states and messages below.
- Criticality and statuses: none.
- What is shown instead of a UUID (`TextArrangement`): no UUID here; Category and Subcategory show the localized name only (`#TextOnly`), in the field and in the dropdown, never the code. Unchanged.

### Field states
Edit mode means the page is editable (create mode or after Edit). "Disabled" is `FieldControl` 0 (D2 = A); with D2 = B read "read-only" (framed, focusable, not editable, value help closed).

| # | State | Reached by | Category | Subcategory value | Subcategory look | Subcategory dropdown |
|---|---|---|---|---|---|---|
| S1 | New product, category empty | Create on the List Report | empty, editable, label with the mandatory asterisk | empty | disabled: label "Subcategory" in normal contrast, input greyed (`sap_horizon` disabled style), no asterisk | cannot be opened (click, F4, Alt+Down do nothing); trying sends no `Subcategories` request |
| S2 | Category chosen while it was empty | S1 or S4, the user picks a category | the chosen name | empty | enabled as soon as the category value is set on the client, no asterisk (optional) | lists only the subcategories of the chosen category (In parameter), names in the session language |
| S3 | Category changed | edit mode with a pair (for example Laptop Pro 15), or S2 after a subcategory was picked; the user picks another category | the new name | emptied by the server (`resetStaleSubcategory`) and shown empty after the side effect `#CategoryChanged` | stays enabled (D1 = A) | lists the subcategories of the new category |
| S4 | Category emptied | edit mode, the user deletes the Category text and leaves the field | empty; no message until Save | emptied by the server, shown empty after the side effect | disabled again, immediately on the client | cannot be opened |
| S5 | Saved with an empty category | Save in S1 or S4 | error value state and the server's `@mandatory` message in the message popover (existing CAP text, no new key) | empty | disabled | cannot be opened |
| S6 | Display mode | after Save or Cancel, any product opened by `alice` or `viewer` | name as text | name as text, or the framework's empty display when the product has none | display mode: a `FieldControl` is not applied | none |

Notes on the transitions:
- S2 and S4 switch on the client: the `FieldControl` expression reads `category_code` of the same context (ADR-0025 decision 5), so the field changes state when the Category value changes, before the server answers. No reload, no busy indicator of its own.
- S3 and S4: the category `PATCH` and the side-effect read go in one `$batch` (#8 VERIFICATION); until it returns, the old subcategory name may show for a moment (in S4 inside a disabled field). Expected, not a defect (UX risk R2).
- Choosing the same category again changes nothing: no `PATCH`, the subcategory is kept.
- `PRODUCTS_SUBCATEGORY_MISMATCH` cannot be reached from the form: the dropdown offers only matching subcategories and a category change clears a foreign one. It stays an API-only message.

### Focus and keyboard
- Tab order of the form follows the field order. In S1 and S4 Tab from Category skips Subcategory and lands on Rating (`sap.m.InputBase#enabled`: a disabled control is out of the tab chain). In S2, S3 and S6 Subcategory is a tab stop again. With D2 = B it is always a tab stop.
- Fiori Elements does not move the focus when Subcategory changes state; the focus stays where the user put it. Subcategory never loses focus to a state change, because only a Category change disables it.
- Choosing a category by keyboard (F4 or Alt+Down, arrow keys, Enter) sets the value before the next key, so the following Tab reaches the enabled Subcategory.
- Typing part of a category name and pressing Tab: the combo box commits the value on focus leave, after the browser has already chosen the next tab stop, so Subcategory is expected to be skipped once and the focus lands on Rating; Shift+Tab returns to the now enabled Subcategory. Expected from the event order, not measured (UX risk R1, scenario V4).
- The disabled field ignores mouse clicks and the dropdown keys; nothing opens and no request is sent.

### Value help
- The single hand-written `Common.ValueList` with the `category_code` In parameter (ADR-0024 decision 1) is reused unchanged; there is no second ValueList and no second side effect.
- While disabled the dropdown cannot open, so the unnarrowed list (all 15 subcategories, In value empty) can no longer be opened in the form; it stays reachable only in "Adapt Filters" (#8 D9).
- Every seeded category has two or three subcategories (`db/data/my.catalog-Subcategories.csv`), so an enabled Subcategory never opens an empty list with the current data.

### Messages
- No new message. The feature adds no toast, no message strip, no dialog.
- Saving with an empty category shows the existing server error on Category (S5); Subcategory gets no message.
- A clearing by the server is silent, as today (#8 D8): the empty field is the feedback.

## Texts
No new i18n key on the recommended answers: Fiori Elements renders the disabled state without text, the labels exist.

| Key | `en` | `ru` | Status |
|---|---|---|---|
| `Products.category` | Category | in `_i18n/i18n_ru.properties`, unchanged | existing label |
| `Products.subcategory` | Subcategory | in `_i18n/i18n_ru.properties`, unchanged | existing label, also the value help title |
| `Products.placeholder.subcategory` | Depends on the category | U+0417 U+0430 U+0432 U+0438 U+0441 U+0438 U+0442 U+0020 U+043E U+0442 U+0020 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438 (Zavisit ot kategorii) | only if Q2 = B; root `_i18n` bundles (annotation text), the bundle holds the plain word, OPA `data/` files hold backslash-u escapes |

## Accessibility
Checklist of the `ui5-best-practices-accessibility` skill applied to the changed form (no view or fragment of the app changes; everything is rendered by Fiori Elements):

| # | Topic | Verdict |
|---|---|---|
| 1 | Landmarks | unchanged, provided by the Object Page |
| 2 | Labeling | the Subcategory label stays visible in every state and stays the field's label (the form element links label and field); the disabled input keeps its accessible name "Subcategory" and is exposed as unavailable. No placeholder is used as a label |
| 3 | Heading levels | unchanged (section title "General Information") |
| 4 | Focus and keyboard | disabled: out of the tab chain while the category is empty (by design of D2 = A, `sap.m.InputBase#enabled`); read-only (D2 = B) would keep the tab stop. No `tabindex` of the app; no focus jump on state change |
| 5 | Keyboard shortcuts | none added |
| 6 | Invisible messaging | the switch to disabled or enabled and the server clearing are not announced; Fiori Elements has no annotation for it and a controller extension would be client code for what one annotation does (ADR-0025 alternatives, invariant 6). Impact minor: a screen reader user meets the state on the next Tab or in browse mode. Accepted, Q3 |
| 7 | Reading order | DOM order equals visual order (Category, then Subcategory), unchanged |
| 8 | Target size | not applicable (no link, status or marker added) |

Correction to the `PLAN.md` risk line "A disabled input is skipped by Tab and not announced by screen readers": skipped by Tab, yes; screen readers still read it in browse (virtual cursor) mode with its label and an "unavailable" or "dimmed" state (general HTML behaviour, not verified by MCP); only the Tab path skips it. Disabled controls are exempt from the WCAG text-contrast requirement, so the greyed look needs no custom styling.

## Theme and tokens
Standard Fiori Elements rendering in `sap_horizon`: the disabled (or read-only) look comes from the theme. No custom CSS, no custom color, no style class. Same in `en` and `ru`; the labels are unchanged and were checked in both languages in #8 (`products-subcategories/SUMMARY.md`, "Verification").

## Verifier scenarios
In `en` and `ru` as `alice`, unless stated; every journey ends with Cancel or Discard Draft, no draft left.
- V1 (S1): Create on the List Report. Category shows the mandatory asterisk; Subcategory label visible in normal contrast, input greyed, no asterisk. Screenshot in both languages.
- V2 (S1): click the disabled Subcategory and its arrow, press F4 and Alt+Down on it: nothing opens; Network shows no new `Subcategories` request after these attempts.
- V3 (S1 to S2): choose a category with the keyboard (F4, arrow, Enter), then Tab: the focus lands on Subcategory; its dropdown lists only that category's subcategories (`$filter=category_code eq '...'`).
- V4 (S1 to S2, R1): type the start of a category name in Category and press Tab: record where the focus lands (expected Rating) and that Shift+Tab reaches the now enabled Subcategory. A finding to record, not a defect.
- V5 (S3): Edit Laptop Pro 15, change the category: Subcategory empty and enabled, the dropdown lists the new category's subcategories; the `PATCH` and the side-effect read in one `$batch`.
- V6 (S4): in the same edit, delete the Category text and leave the field: Subcategory empty and disabled; note whether the old name flashes in the disabled field before the `$batch` returns (R2).
- V7 (S5): in S4 press Save: one error on Category in the message popover, nothing on Subcategory, Subcategory still disabled; then Discard Draft and check Laptop Pro 15 as seeded.
- V8 (S6): as `viewer` and as `alice` in display mode: Subcategory shows the name as text, no greyed input; the "Adapt Filters" Subcategory field still accepts a value.
- V9 (labels and accessibility tree, Chrome DevTools): in S1 the Subcategory input has the accessible name "Subcategory" and a disabled state; in S2 the same name and no disabled state.

## UX risks
- R1: typeahead plus Tab skips the just-enabled Subcategory once (event order, not measured); notice in V4. If the user finds it disruptive, D2 = B keeps the tab stop at the same cost.
- R2: the old subcategory name may show briefly after a category change or emptying, until the side-effect read returns; notice in V5 and V6. With one `$batch` the gap is one round trip.
- R3: the disabled rendering of a dynamic `FieldControl` 0 is source-read, not measured; if the field renders editable or read-only, OPA5 (`editMode`) and V1 notice it; fallback D2 = B (`PLAN.md` risks).
- R4: if the UI cannot empty the mandatory Category (risk 2 of `PLAN.md`), S4 and S5 are reachable only through the API; S1 to S3 and S6 stay as designed.
- R5 (D3 = A): a draft written through the API with a subcategory but no category shows that subcategory inside a disabled field; the user cannot clear it directly, only by choosing a category (a foreign subcategory is then cleared). Not reachable from the form.
- R6: the `sap_horizon` disabled style is pale; an empty disabled field is easy to overlook. The visible label and its position under Category carry the meaning; V1 screenshots let the user judge.

## Open questions for the user
- Q1 (D2, look of the disabled state): A (recommended) disabled input (`FieldControl` 0): the SAP Fiori guideline reserves disabled for a field that another control on the same screen unlocks, which is this case (not verified by MCP); cost: skipped by Tab while disabled (R1). B read-only (`FieldControl` 1): stays a tab stop and is announced as read-only, but signals "not editable here" rather than "not yet". I agree with the plan's A.
- Q2 (hint text): A (recommended) none: the label and the position under the mandatory Category explain the dependency, no new key. B: a static `UI.Placeholder` "Depends on the category" on Subcategory (key `Products.placeholder.subcategory`, en and ru in "Texts"); it shows whenever the field is empty, enabled or not, is pale inside a disabled field, and `UI.Placeholder` has no `PATTERNS.md` row yet (a row or an ADR-0025 sentence first). A wording like "Select a category first" is rejected: it would be wrong in S3, where the field is enabled and empty.
- Q3 (screen reader announcement): accept that the state switch and the clearing are not announced (recommended; a custom announcement needs a controller extension, against ADR-0025 and invariant 6), or ask for it as a separate feature with its own ADR.
