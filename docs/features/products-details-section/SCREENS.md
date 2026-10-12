# products-details-section: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task: a `CatalogEditor` fills in the attribute values of one product inside its draft; a `CatalogViewer` reads them. Issue #9.

Revision 2, 2026-10-12. Revision 1 (an FE table section with Create, an attribute dropdown, Value and Unit columns) was implemented, verified and rejected by the user as clumsy. This revision follows the user's decisions of 2026-10-12: U1 form fields generated from the subcategory, U2 one server-created field per assigned attribute in a fixed order, U3 keep common values on a subcategory change and warn about removed ones, U4 empty values allowed, U5 typed values, U6 the classification, plus the user addition MULTI_LIST (several values per list attribute). Data element names (value type, list values, position, constraints) are the architect's; this file names behaviour, layout and texts.

Language rule: `ru` values are given as Latin transliteration plus `U+XXXX` code points (invariant 10; the bundles and `.texts.csv` files hold the plain words, OPA5 `data/` files hold backslash-u escapes as `data/SubcategoryTexts.js` does). This file is ASCII only.

## Floorplan and duplication check

- Floorplan: the existing List Report + Object Page of `CatalogService.Products` (`docs/registry/UI-ARTIFACTS.md`: pages `ProductsList`, `ProductsObjectPage`; facets `GeneralInfo`, `PricingStock`, `Details`, `AdminData`; one fragment `RatingRangeFilter`). No new application, page or route.
- The section "Details" becomes a **Fiori Elements custom section**: one generic fragment (proposed name `app/products/webapp/ext/fragment/ProductDetailsSection.fragment.xml`) registered through Fiori MCP `controlConfiguration`/custom-section functionality, the PATTERNS row "Custom section or column" (`ext/fragment/<Name>.fragment.xml` + `controlConfiguration` via Fiori MCP). It replaces the `UI.ReferenceFacet` `Details` (target `details/@UI.LineItem`) of revision 1; the table annotations that only served the table (`UI.LineItem`, `UI.HeaderInfo` of `ProductDetails`, the attribute value help, `#AttributeChanged`) go with it (the architect lists the removals). The registry holds no other Object Page extension, so nothing is duplicated; the fragment is the first custom section of the app.
- Why not an annotation-only section: the fields are rows of a to-many composition with a different control per row (text, number, list, multi list). `UI.FieldGroup` needs one element per attribute (reading (b), rejected in ADR-0026), and FE V4 offers no "form over a collection". The custom section is the only way that keeps the rest of the Object Page in Fiori Elements (user decision U1).
- Position (unchanged): General Information, Pricing & Stock, **Details**, Administrative Data. The values describe the product and follow the two business forms; the audit data stays last (Object Page guideline, https://experience.sap.com/fiori-design-web/object-page/, stable URL, not re-verified this session).
- Out of scope, separate issues if wanted: maintenance of attributes, assignments, list values and constraints (today data files only); details in the Excel import; a List Report column, filter or completeness indicator.

### Sources used for this design

`mcp__fiori-mcp__search_docs` answered every query of this session with "Search is currently unavailable. The embeddings service failed to initialize" (three queries plus one retry). Rows marked "not verified by MCP" are expected behaviour handed to `ui-verifier`.

| Topic | Source | Status |
|---|---|---|
| Form = `sap.ui.layout.form.Form` with `ColumnLayout`, never `SimpleForm`; 2 columns at M, 3 at L, 4 at XL | `mcp__ui5-mcp-server__get_guidelines` section 4 "Rules to create a Form" | verified this session |
| `ColumnLayout`: S is always 1 column; FormElements flow "newspaper-like" over the columns; labels go beside the fields when the column is large (`labelCellsLarge` default 4) | `get_api_reference sap.ui.layout.form.ColumnLayout` | verified this session |
| The FormElement assigns its `Label` to its fields when no `labelFor` is set | `get_api_reference sap.ui.layout.form.FormElement#label` | verified this session |
| Unit right of the input: `sap.m.Input#description` ("a text after the input field, e.g. units of measurement"); `fieldWidth` splits the space, default 50% | `get_api_reference sap.m.Input#description`, `#fieldWidth` | verified this session |
| Empty value in display mode: `sap.m.Text#emptyIndicatorMode` `On` | `get_api_reference sap.m.Text#emptyIndicatorMode`, `sap.m.EmptyIndicatorMode` | verified this session |
| Numbers: `sap.ui.model.odata.type.Decimal` keeps the model value as a string, `minimum`/`maximum`/`scale` constraints, grouping on by default, `scale` pads the display unless `minFractionDigits` is overridden; prefer OData types for formatting | `get_api_reference sap.ui.model.odata.type.Decimal`; `get_guidelines` section 1 | verified this session |
| Multi-value list: `sap.m.MultiComboBox` (tokens; an invalid typed character is deleted at once and the Error state shows for a second; desktop arrow-key token navigation; full-screen dialog on phones); guideline https://experience.sap.com/fiori-design-web/multi-combobox/ | `get_api_reference sap.m.MultiComboBox` (`references`) | verified this session |
| Tokens carry a hidden accessibility text; guideline https://experience.sap.com/fiori-design-web/token/ | `get_api_reference sap.m.Tokenizer` (`_tokensInfo`, `references`) | verified this session |
| Clear icon on list controls (`showClearIcon`, since 1.96) | `get_api_reference sap.m.ComboBoxBase#showClearIcon` | verified this session |
| A message toast is not for warnings ("When not to use: You want to display an error or warning message"); guideline https://experience.sap.com/fiori-design-web/message-toast/ | `get_api_reference sap.m.MessageToast` | verified this session |
| Combo box guideline https://experience.sap.com/fiori-design-web/combo-box/ | `sap.m.ComboBox` API `references`, read 2026-10-09 | not re-verified this session |
| The look of the existing FE forms: label above value with a colon in both modes, 4 columns at the verifier's desktop window, numeric inputs right-aligned, currency right of the amount; the section heading is one `H2` | revision 1 `VERIFICATION.md` and `screenshots/s1-display-laptop.png`, `s5-d1-message-at-once.png` | measured 2026-10-12 |
| A custom section gets its title from the manifest and offers no slot on the heading line; the fragment reads the edit state from the FE `ui>/isEditable` model | FE custom-section knowledge | not verified by MCP; `fiori-app-dev` confirms with Fiori MCP `list_functionality` / `get_functionality_details` before building |
| A server warning targeted at `subcategory_code` shows on the Subcategory field (Warning state) and in the footer message popover, and does not block Save | revision 1 measured the analogous error path (the D1 message on the Subcategory field right after the change) | not verified by MCP; verifier scenarios 10-12 |
| Accessibility checklist | skill `ui5-best-practices-accessibility` on disk (SKILL.md, `references/labeling.md`, `heading.md`, `keyboard.md`, `invisible-message.md`) | read this session |

## Screen: Products Object Page, section "Details"

### Title, counter, layout

- Title: the section title and the anchor-bar entry read "Details" (`ru` Kharakteristiki), a manifest text of the custom section (new key in `webapp/i18n`, Texts). No subtitle. The page header is unchanged.
- Counter (U1, Akeneo-style completeness): "Filled 2 of 3" (`ru` "Zapolneno 2 iz 3") on its own line **directly under the section title**, left-aligned, as the first element of the fragment (`sap.m.Text`, no icon, no colour). Reason: FE renders the section heading itself and a custom section has no slot on the heading line (not verified by MCP; open question 4). M = number of fields shown (the attributes of the subcategory); N = number of filled fields. Filled means: TEXT non-empty after trimming, INTEGER or DECIMAL has a number, LIST has a value, MULTI_LIST has **at least one** value. The counter shows in display and edit mode and for the viewer; it updates as soon as a field value is committed (focus leave, Enter, list choice), not per keystroke. It is hidden when M = 0 (no subcategory, or a subcategory without attributes).
- Layout: one `sap.ui.layout.form.Form` with `sap.ui.layout.form.ColumnLayout`, one `FormContainer` **without a title**, one `FormElement` per field:

  | Setting | Value | Why |
  |---|---|---|
  | `columnsXL` / `columnsL` / `columnsM` | 4 / 3 / 2 | `get_guidelines` form rule; the existing FE forms show 4 columns at the verifier's desktop window, so the Details fields line up with General Information |
  | S (phone) | 1 column | fixed by `ColumnLayout` |
  | `labelCellsLarge` | 12 | label above the value in every column width, like the FE forms (the default 4 puts the label beside the field in wide columns) |
  | `emptyCellsLarge` | 0 (default) | |
  | Form `editable` | bound to the FE edit state | the Form renders the display/edit label styles (colons) itself |

  With three fields per subcategory the desktop shows one row: the three fields in the first three of four columns (as Administrative Data shows its four fields), at L one row of three, at M two fields in the first column and one in the second (newspaper order), on a phone one field under the other.
- Field order: fixed per subcategory (U2), the order of the assignment data; recommended order = PLAN D7 assignment order (LAPTOPS: Screen Size, Memory (RAM), Storage; MICE: Connectivity, Sensor Resolution, Battery Life; AUDIO: Connectivity, Battery Life, Colour; SEATING: Material, Maximum Load, Colour; DESK_ORGANIZATION: Material, Dimensions, Colour; APPLIANCES: Power, Capacity, Colour; DRINKWARE: Capacity, Material, Colour; FITNESS: Material, Thickness, Colour; the others as in D7).
- Labels: the localized attribute name (`DetailAttributes.name`, `ru` from the D7 texts), never the code. The Form adds the colon. No required marker: every value is optional (U4).

### Fields per value type

| Type (U6 + addition) | Attributes | Display mode | Edit mode control | Unit | Alignment |
|---|---|---|---|---|---|
| TEXT | Dimensions | `sap.m.Text`, wraps; "30 x 20 x 10 cm" | `sap.m.Input`, `maxLength` 100 (the stored length; typing stops at the limit, no message) | `description` = unit (`cm`) | start |
| INTEGER | Battery Life, Power, Memory (RAM), Storage, Maximum Load, Brightness, Pages, Pieces, Sensor Resolution | `sap.m.Text` "16 GB", locale grouping ("1,600 dpi" `en`, "1 600 dpi" `ru` with the no-break space the locale uses) | `sap.m.Input` type Text with a UI5 numeric binding type (no decimals), locale-aware | `description` = unit; Pages and Pieces have none | input text end-aligned, like Stock Quantity |
| DECIMAL | Weight, Capacity, Screen Size, Tip Size, Thickness | `sap.m.Text` "1.2 l" (`en`), "1,2 l" (`ru`); no padding zeros ("15 in", "0.75 l", "6 mm") | `sap.m.Input` type Text with `sap.ui.model.odata.type.Decimal` (string model value), locale-aware: "1,2" in `ru`, "1.2" in `en` | `description` = unit | input text end-aligned, like Price |
| LIST | Colour, Paper Size, Water Resistance (and Material if open question 1 says no) | `sap.m.Text` with the localized value name: "Black" | `sap.m.ComboBox`, items = the attribute's allowed values (localized names, no codes, fixed order of the Texts tables), `showClearIcon` on | none | start |
| MULTI_LIST | Connectivity (user); Material (recommended, open question 1) | `sap.m.Text`, the localized names joined by ", " in the fixed list order (not the selection order): "Bluetooth 5.0, Wireless 2.4 GHz" | `sap.m.MultiComboBox` (tokens), items as for LIST, `showClearIcon` on | none | start |

- Value plus unit in display mode: one text, number and unit separated by a no-break space (U+00A0), so "15" and "in" never wrap apart. An empty value shows the empty indicator alone, never "- in".
- Unit in edit mode: `sap.m.Input` `description`; `fieldWidth` 75% (a control property, no CSS), so a short unit (`in`, `GB`, `dpi`) sits next to the number roughly like the currency next to Price; fields without a unit use the full cell width.
- Number input: `sap.m.Input` type `Text`, not `Number`: the formatting and parsing come from the UI5 binding type, which follows the UI5 locale (get_guidelines: built-in data types with format options); the browser's native number field does not (not verified by MCP).
- Empty value (U4): display mode shows the empty indicator (`emptyIndicatorMode` `On`); in edit mode clearing a field (Backspace or the clear icon of a list) and leaving it stores an empty value; no placeholder text.
- What is shown instead of codes and UUIDs: attribute names and list value names only, localized; the row `ID`, attribute codes and list codes never appear (no `TextArrangement` needed, the fragment binds the names).

### Layouts of the seeded products

Desktop width (4 columns, three used). "(empty)" is the empty indicator U+2013 EN DASH in display mode and an empty input in edit mode; `[ ... ]` is an input, `[ ... v]` a combo box, `[(a x) (b x) v]` a multi combo box with tokens.

Laptop Pro 15 (Laptops), display:
```
Details
Filled 3 of 3
Screen Size:            Memory (RAM):           Storage:
15 in                   16 GB                   512 GB
```
edit:
```
Details
Filled 3 of 3
Screen Size:            Memory (RAM):           Storage:
[            15 ] in    [            16 ] GB    [           512 ] GB
```

Wireless Mouse (Mice), display:
```
Filled 2 of 3
Connectivity:           Sensor Resolution:      Battery Life:
Wireless 2.4 GHz        1,600 dpi               (empty)
```
edit:
```
Connectivity:                     Sensor Resolution:      Battery Life:
[(Wireless 2.4 GHz x)        v]   [         1,600 ] dpi   [               ] h
```

Office Chair (Seating), display (Material as MULTI_LIST per open question 1; as LIST the edit control is a combo box showing "Mesh"):
```
Filled 2 of 3
Material:               Maximum Load:           Colour:
Mesh                    120 kg                  (empty)
```
edit:
```
Material:               Maximum Load:           Colour:
[(Mesh x)          v]   [           120 ] kg    [                 v]
```

Phone width: one column; each field is label, then value or control, in the order above; the unit stays right of the input.

Other seeded products (D7 values plus one empty field each): Bluetooth Speaker Connectivity "Bluetooth 5.0", Battery Life "12 h", Colour empty (2 of 3); Coffee Maker Power "900 W", Capacity "1.2 l", Colour empty (2 of 3); Water Bottle Capacity "0.75 l", Material "Stainless steel", Colour empty (2 of 3); Yoga Mat Material "TPE", Thickness "6 mm", Colour empty (2 of 3); the 8 products without D7 rows show their three fields empty, "Filled 0 of 3". Every product with a subcategory shows exactly the fields of its subcategory, so the seed data needs a row (possibly empty) for every assigned attribute (U2).

### Product without a subcategory, subcategory without attributes

| State | Display mode | Edit mode |
|---|---|---|
| No subcategory (a new product before the subcategory is chosen; ADR-0025 makes it mandatory, so in display mode only legacy or API data) | text "No subcategory selected." (`sap.m.Text`, no counter, no form) | text "Select a subcategory to fill in the details." (no counter, no form); as soon as the subcategory is chosen the fields appear empty in their order and the counter reads "Filled 0 of 3" |
| Subcategory with no assigned attribute (not in the seed; future data) | text "This subcategory has no details." | the same text |

No illustration (`IllustratedMessage` is for empty pages and tables; one line in a section is enough), no message strip (it is guidance, not a message).

### Viewer

A `CatalogViewer` sees the display layout only: title, counter, labels and values; no inputs, no Edit (ADR-0013 `UI.UpdateHidden`). Nothing in the fragment depends on the role: it follows the FE edit state, which a viewer never reaches.

### Actions and their placement

- Section: no actions, no toolbar, no Create, no Delete, no attribute choice (U1). The section has no table, so no filters and no columns; the 7-column budget becomes "3 fields per subcategory" (at most 7 if a subcategory ever gets more, then the form wraps to a second row).
- Page header: unchanged (Edit, Delete, Share; hidden for non-editors by ADR-0013).
- Footer in edit mode: the standard Save, Discard Draft and the message button. Values are saved with the product draft like the other sections.

### Value states and messages

Every check fires when a value is committed (focus leave or Enter, list choice), never per keystroke. A field with an error shows the Error value state and its text below the field when focused; the message is also listed in the footer message popover, grouped under "Details", like the FE fields of the other sections. Recommended split, architect decides: parsing (not a number, decimals in an integer) on the client by the UI5 binding type, because it is static per value type; the per-attribute range and number of decimals on the server after the draft `PATCH` (a draft message on the field, the same channel as the existing `@assert.range` on Stock Quantity), because the bounds are data. If the architect puts the bounds into the client type instead, the framework texts replace the project texts of rows 3 and 4.

| # | Type | User enters | Result | Text `en` | Text `ru` |
|---|---|---|---|---|---|
| 1 | INTEGER, DECIMAL | "abc", "12a" | Error, nothing written | framework text of the UI5 type (expected "Enter a number.") | framework translation; `ui-verifier` quotes both |
| 2 | INTEGER | "16.5" (`en`) / "16,5" (`ru`) | Error, nothing written | framework text of the type (expected wording about no decimal places) | framework translation, quoted |
| 3 | INTEGER, DECIMAL | outside the attribute's range (table below) | Error | `PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE` "Enter a value from {0} to {1}." | "Vvedite znachenie ot {0} do {1}." |
| 4 | DECIMAL | more decimals than allowed ("15.55" for Screen Size) | Error | `PRODUCTS_DETAIL_VALUE_TOO_MANY_DECIMALS` "Enter a number with no more than {0} decimal places." | "Vvedite chislo. Dopustimo znakov posle zapyatoy: {0}." |
| 5 | LIST | text that matches no item ("Purple"), then Tab or Enter | Error on the combo box, the stored value stays unchanged; fixing the text or choosing an item clears the state | "Select a value from the list." (fragment text) | "Vyberite znachenie iz spiska." |
| 6 | MULTI_LIST | a character that matches no item | the control deletes the character at once and flashes Error for about a second (API behaviour); no token is created; the fragment sets the same value state text as row 5 so a reader of the flash sees a sentence | as row 5 (verifier records what the flash shows) | as row 5 |
| 7 | TEXT | more than 100 characters | prevented by `maxLength`, no message | | |
| 8 | any (API path) | a value that bypasses the UI (wrong type, unknown list code) | server rejects with the field targeted | `PRODUCTS_DETAIL_VALUE_NOT_NUMBER` "Enter a number."; `PRODUCTS_DETAIL_VALUE_NOT_IN_LIST` "Select a value from the list." | "Vvedite chislo."; "Vyberite znachenie iz spiska." |

Rows 3, 4 and 8 are needed only if the architect's plan has the server check; the keys then go to `_i18n/messages*.properties`. A field in the Error state must never be saved silently: Save is blocked with the error in the popover (FE does this for its own fields; scenario 5 checks the fragment's fields behave the same).

Proposed constraints per numeric attribute (architect confirms; open question 8):

| Attribute | Type | Unit | Minimum | Maximum | Decimals |
|---|---|---|---|---|---|
| Weight | DECIMAL | kg | 0.01 | 100 | 2 |
| Capacity | DECIMAL | l | 0.01 | 100 | 2 |
| Screen Size | DECIMAL | in | 1 | 100 | 1 |
| Tip Size | DECIMAL | mm | 0.1 | 10 | 2 |
| Thickness | DECIMAL | mm | 0.5 | 100 | 1 |
| Battery Life | INTEGER | h | 1 | 10000 | 0 |
| Power | INTEGER | W | 1 | 5000 | 0 |
| Memory (RAM) | INTEGER | GB | 1 | 1024 | 0 |
| Storage | INTEGER | GB | 1 | 16384 | 0 |
| Maximum Load | INTEGER | kg | 1 | 1000 | 0 |
| Brightness | INTEGER | lm | 1 | 20000 | 0 |
| Pages | INTEGER | | 1 | 2000 | 0 |
| Pieces | INTEGER | | 1 | 500 | 0 |
| Sensor Resolution | INTEGER | dpi | 100 | 50000 | 0 |

All seeded values fit (15, 16, 512, 1600, 12, 120, 900, 1.2, 0.75, 6).

### Subcategory change (U2, U3)

What happens, in the order the user sees it, when the Subcategory of a product in edit mode changes (the field is in General Information, FE-owned):
1. The draft `PATCH` of `subcategory_code` lets the server keep the values of attributes the old and the new subcategory share, delete the others and create empty fields for the new attributes (architect's mechanism).
2. The Details section re-reads (the existing `#SubcategoryChanged` side effect with `TargetEntities: [ details ]`) and shows the fields of the new subcategory in its order; kept values stay filled; the counter updates.
3. **Warning**, only when at least one **filled** value was removed (open question 2): a server message of severity Warning targeted at `subcategory_code`:
   - `en`: "Values removed: {0}. These details do not apply to the new subcategory: {1}."
   - `ru`: "Udaleno znacheniy: {0}. Eti kharakteristiki ne otnosyatsya k novoy podkategorii: {1}."
   - `{0}` = number of filled values removed; `{1}` = their localized attribute names in the old field order, joined by ", ". The counter form "Values removed: 3" avoids plural agreement in both languages ("Udaleno znacheniy: 1" is correct Russian, a plural sentence would not be).
   - Example (Laptop Pro 15 to Mice): "Values removed: 3. These details do not apply to the new subcategory: Screen Size, Memory (RAM), Storage."
   - Where: the Subcategory field shows the Warning value state with the text (the user's focus is still there), the footer message button shows a warning with count 1, the popover lists it under "General Information". Severity Warning, not Error: nothing has to be fixed and Save stays possible. The message stays until the subcategory is changed again or the draft is saved or discarded; it must survive the side-effect re-read that follows the change (UX risk 1). It is not repeated at Save.
   - Undo: changing the subcategory back does **not** bring the removed values back (they were deleted); Discard Draft restores the saved values of an existing product. The message does not mention it (open question 7).
4. Nothing was filled among the removed fields: no message; the fields simply change.

Considered and rejected:

| Form | Why not |
|---|---|
| Confirmation dialog before the change | FE offers no hook before a field value is committed; it needs a controller extension on an FE-owned field (custom code in a page the project keeps annotation-driven); it would ask even when nothing filled is lost, and the draft already makes the change reversible (Discard Draft). Fiori prefers reversible actions over confirmations (general guideline knowledge, not verified by MCP) |
| Message toast after the change | the toast guideline says not to use it for warnings, and it disappears (`sap.m.MessageToast`, MCP-verified) |
| Message strip inside the Details section | custom code in the fragment, a second place for messages next to the FE message popover, and it would sit away from the field the user just changed; fallback only if UX risk 1 materialises |

Category change: ADR-0024 empties the subcategory when the category changes. Recommended (open question 3): the fields are **not** touched while the subcategory is empty; the section shows "Select a subcategory to fill in the details."; when the new subcategory is chosen, step 1 runs against the fields of the last subcategory, so a shared attribute (Colour, Material) survives a category change and the warning of step 3 appears once, on the Subcategory field. Save is impossible in between, because the subcategory is mandatory (ADR-0025).

### Criticality and statuses

None. The counter is neutral text in every state, also at "Filled 0 of 3" or "Filled 3 of 3": empty values are allowed (U4), so incompleteness is not a problem the user must fix, and a red or orange status would say otherwise (open question 4). Errors and the warning use the theme's semantic value states and the FE message popover.

## Texts

Where the keys live (rule `i18n.md`): texts of the fragment and the custom-section title in `app/products/webapp/i18n/i18n.properties`, `i18n_en.properties` and `i18n_ru.properties` (keys `<page>.<element>.<property>`); server messages in `_i18n/messages.properties` and `_i18n/messages_ru.properties`; attribute names and list value names in data (`.csv` / `.texts.csv`). Framework texts need no key: the numeric type messages, the empty indicator, token and clear-icon texts, Save / Discard Draft, the message popover.

Code points of the new `ru` words (no letter yo, U+0451; the project's `ru` texts do not use it). Words already listed in revision 1 and the D7 attribute names keep their code points (PLAN D7, the `.texts.csv` in the repository).

| Transliteration | Code points |
|---|---|
| Kharakteristiki | U+0425 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0438 |
| kharakteristiki (lower case) | U+0445 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0438 |
| kharakteristik | U+0445 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A |
| Zapolneno | U+0417 U+0430 U+043F U+043E U+043B U+043D U+0435 U+043D U+043E |
| iz | U+0438 U+0437 |
| Vyberite | U+0412 U+044B U+0431 U+0435 U+0440 U+0438 U+0442 U+0435 |
| podkategoriyu | U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+044E |
| chtoby | U+0447 U+0442 U+043E U+0431 U+044B |
| zapolnit | U+0437 U+0430 U+043F U+043E U+043B U+043D U+0438 U+0442 U+044C |
| Podkategoriya | U+041F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+044F |
| ne | U+043D U+0435 |
| vybrana | U+0432 U+044B U+0431 U+0440 U+0430 U+043D U+0430 |
| U (one letter) | U+0423 |
| etoy | U+044D U+0442 U+043E U+0439 |
| podkategorii | U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438 |
| net | U+043D U+0435 U+0442 |
| znachenie | U+0437 U+043D U+0430 U+0447 U+0435 U+043D U+0438 U+0435 |
| spiska | U+0441 U+043F U+0438 U+0441 U+043A U+0430 |
| Udaleno | U+0423 U+0434 U+0430 U+043B U+0435 U+043D U+043E |
| znacheniy | U+0437 U+043D U+0430 U+0447 U+0435 U+043D U+0438 U+0439 |
| Eti | U+042D U+0442 U+0438 |
| otnosyatsya | U+043E U+0442 U+043D U+043E U+0441 U+044F U+0442 U+0441 U+044F |
| k (one letter) | U+043A |
| novoy | U+043D U+043E U+0432 U+043E U+0439 |
| Vvedite | U+0412 U+0432 U+0435 U+0434 U+0438 U+0442 U+0435 |
| chislo | U+0447 U+0438 U+0441 U+043B U+043E |
| ot | U+043E U+0442 |
| do | U+0434 U+043E |
| Dopustimo | U+0414 U+043E U+043F U+0443 U+0441 U+0442 U+0438 U+043C U+043E |
| znakov | U+0437 U+043D U+0430 U+043A U+043E U+0432 |
| posle | U+043F U+043E U+0441 U+043B U+0435 |
| zapyatoy | U+0437 U+0430 U+043F U+044F U+0442 U+043E U+0439 |

Fragment and manifest texts (`webapp/i18n`, all three files):

| Key | Type | `en` | `ru` (transliteration) |
|---|---|---|---|
| `ProductsObjectPage.details.title` | `#XTIT` | Details | Kharakteristiki |
| `ProductsObjectPage.details.filled` | `#XFLD` | Filled {0} of {1} | Zapolneno {0} iz {1} |
| `ProductsObjectPage.details.noSubcategory` | `#XMSG` | No subcategory selected. | Podkategoriya ne vybrana. |
| `ProductsObjectPage.details.selectSubcategory` | `#XMSG` | Select a subcategory to fill in the details. | Vyberite podkategoriyu, chtoby zapolnit kharakteristiki. |
| `ProductsObjectPage.details.noAttributes` | `#XMSG` | This subcategory has no details. | U etoy podkategorii net kharakteristik. |
| `ProductsObjectPage.details.valueNotInList` | `#XMSG` | Select a value from the list. | Vyberite znachenie iz spiska. |

The section title is also the accessible name of the form (Accessibility). The `_i18n` keys of the revision 1 table (`Products.facet.details`, `ProductDetails.typeName`, `typeNamePlural`, `ProductDetails.attribute`, `ProductDetails.value`, `DetailAttributes.unit` as a column header) are no longer shown by this screen; the architect decides which stay as `@title` of the model.

Server messages (`_i18n/messages*.properties`, `#XMSG`):

| Key | `en` | `ru` (transliteration) | Needed |
|---|---|---|---|
| `PRODUCTS_DETAILS_VALUES_REMOVED` (severity Warning) | Values removed: {0}. These details do not apply to the new subcategory: {1}. | Udaleno znacheniy: {0}. Eti kharakteristiki ne otnosyatsya k novoy podkategorii: {1}. | yes (U3) |
| `PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE` | Enter a value from {0} to {1}. | Vvedite znachenie ot {0} do {1}. | if the server checks ranges |
| `PRODUCTS_DETAIL_VALUE_TOO_MANY_DECIMALS` | Enter a number with no more than {0} decimal places. | Vvedite chislo. Dopustimo znakov posle zapyatoy: {0}. | if the server checks decimals |
| `PRODUCTS_DETAIL_VALUE_NOT_NUMBER` | Enter a number. | Vvedite chislo. | if the server checks types |
| `PRODUCTS_DETAIL_VALUE_NOT_IN_LIST` | Select a value from the list. | Vyberite znachenie iz spiska. | if the server checks list codes |

The revision 1 messages `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` and `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` cannot appear in this UI any more (the server owns the rows); whether they stay as API guards is the architect's call.

### List values

Proposed codes (`UPPER_SNAKE`, ADR-0010) and names; the order of each table is the dropdown order and the display order of joined MULTI_LIST values. The seeded values are covered: Mesh, Stainless steel, TPE (Material), Wireless 2.4 GHz, Bluetooth 5.0 (Connectivity). International designations stay Latin in `ru` like the units (TPE, Bluetooth, Wi-Fi, USB, A4, Letter, IPX; open question 6); a `ru` name equal to the `en` name may be left out of the `.texts.csv` (English fallback).

Material (MULTI_LIST recommended, open question 1), 12 values:

| Code | `en` | `ru` | `ru` code points |
|---|---|---|---|
| `MESH` | Mesh | Setka | U+0421 U+0435 U+0442 U+043A U+0430 |
| `FABRIC` | Fabric | Tkan | U+0422 U+043A U+0430 U+043D U+044C |
| `LEATHER` | Leather | Kozha | U+041A U+043E U+0436 U+0430 |
| `WOOD` | Wood | Derevo | U+0414 U+0435 U+0440 U+0435 U+0432 U+043E |
| `BAMBOO` | Bamboo | Bambuk | U+0411 U+0430 U+043C U+0431 U+0443 U+043A |
| `PLASTIC` | Plastic | Plastik | U+041F U+043B U+0430 U+0441 U+0442 U+0438 U+043A |
| `SILICONE` | Silicone | Silikon | U+0421 U+0438 U+043B U+0438 U+043A U+043E U+043D |
| `TPE` | TPE | TPE (Latin) | |
| `ALUMINIUM` | Aluminium | Alyuminiy | U+0410 U+043B U+044E U+043C U+0438 U+043D U+0438 U+0439 |
| `STAINLESS_STEEL` | Stainless steel | Nerzhaveyushchaya stal | U+041D U+0435 U+0440 U+0436 U+0430 U+0432 U+0435 U+044E U+0449 U+0430 U+044F, space, U+0441 U+0442 U+0430 U+043B U+044C |
| `GLASS` | Glass | Steklo | U+0421 U+0442 U+0435 U+043A U+043B U+043E |
| `CERAMIC` | Ceramic | Keramika | U+041A U+0435 U+0440 U+0430 U+043C U+0438 U+043A U+0430 |

Colour (LIST), 12 values (adjectives in the masculine form, agreeing with Tsvet and tovar):

| Code | `en` | `ru` | `ru` code points |
|---|---|---|---|
| `BLACK` | Black | Chernyy | U+0427 U+0435 U+0440 U+043D U+044B U+0439 |
| `WHITE` | White | Belyy | U+0411 U+0435 U+043B U+044B U+0439 |
| `GREY` | Grey | Seryy | U+0421 U+0435 U+0440 U+044B U+0439 |
| `SILVER` | Silver | Serebristyy | U+0421 U+0435 U+0440 U+0435 U+0431 U+0440 U+0438 U+0441 U+0442 U+044B U+0439 |
| `BLUE` | Blue | Siniy | U+0421 U+0438 U+043D U+0438 U+0439 |
| `RED` | Red | Krasnyy | U+041A U+0440 U+0430 U+0441 U+043D U+044B U+0439 |
| `GREEN` | Green | Zelenyy | U+0417 U+0435 U+043B U+0435 U+043D U+044B U+0439 |
| `YELLOW` | Yellow | Zheltyy | U+0416 U+0435 U+043B U+0442 U+044B U+0439 |
| `PINK` | Pink | Rozovyy | U+0420 U+043E U+0437 U+043E U+0432 U+044B U+0439 |
| `BROWN` | Brown | Korichnevyy | U+041A U+043E U+0440 U+0438 U+0447 U+043D U+0435 U+0432 U+044B U+0439 |
| `BEIGE` | Beige | Bezhevyy | U+0411 U+0435 U+0436 U+0435 U+0432 U+044B U+0439 |
| `MULTICOLOUR` | Multicolour | Raznotsvetnyy | U+0420 U+0430 U+0437 U+043D U+043E U+0446 U+0432 U+0435 U+0442 U+043D U+044B U+0439 |

Connectivity (MULTI_LIST, user), 6 values:

| Code | `en` | `ru` | `ru` code points |
|---|---|---|---|
| `BLUETOOTH_5_0` | Bluetooth 5.0 | Bluetooth 5.0 (Latin; a version number keeps its dot) | |
| `BLUETOOTH_5_3` | Bluetooth 5.3 | Bluetooth 5.3 (Latin) | |
| `WIRELESS_2_4_GHZ` | Wireless 2.4 GHz | Besprovodnoe 2,4 GGts | U+0411 U+0435 U+0441 U+043F U+0440 U+043E U+0432 U+043E U+0434 U+043D U+043E U+0435, space, 2,4 (ASCII, decimal comma), space, U+0413 U+0413 U+0446 |
| `WIFI` | Wi-Fi | Wi-Fi (Latin) | |
| `WIRED_USB` | Wired (USB) | Provodnoe (USB) | U+041F U+0440 U+043E U+0432 U+043E U+0434 U+043D U+043E U+0435, then ASCII " (USB)" |
| `WIRED_AUDIO_JACK` | Wired (audio jack) | Provodnoe (audiorazyem) | U+041F U+0440 U+043E U+0432 U+043E U+0434 U+043D U+043E U+0435, ASCII " (", U+0430 U+0443 U+0434 U+0438 U+043E U+0440 U+0430 U+0437 U+044A U+0435 U+043C, ASCII ")" |

With this order the seeded Wireless Mouse plus Bluetooth 5.0 displays "Bluetooth 5.0, Wireless 2.4 GHz" (`ru` "Bluetooth 5.0, Besprovodnoe 2,4 GGts").

Paper Size (LIST), 6 values: `A4` A4, `A5` A5, `A6` A6, `B5` B5, `LETTER` Letter (all Latin in both languages), `POCKET` Pocket / Karmannyy (U+041A U+0430 U+0440 U+043C U+0430 U+043D U+043D U+044B U+0439).

Water Resistance (LIST), 6 values (IEC 60529 levels; "Not water-resistant" instead of "None", which reads like "no value" in a dropdown):

| Code | `en` | `ru` | `ru` code points |
|---|---|---|---|
| `NONE` | Not water-resistant | Bez zashchity ot vody | U+0411 U+0435 U+0437, space, U+0437 U+0430 U+0449 U+0438 U+0442 U+044B, space, U+043E U+0442, space, U+0432 U+043E U+0434 U+044B |
| `IPX4` | Splash-resistant (IPX4) | Zashchita ot bryzg (IPX4) | U+0417 U+0430 U+0449 U+0438 U+0442 U+0430, space, U+043E U+0442, space, U+0431 U+0440 U+044B U+0437 U+0433, ASCII " (IPX4)" |
| `IPX5` | Water-jet-resistant (IPX5) | Zashchita ot struy (IPX5) | Zashchita ot as above, space, U+0441 U+0442 U+0440 U+0443 U+0439, ASCII " (IPX5)" |
| `IPX6` | Powerful-jet-resistant (IPX6) | Zashchita ot silnykh struy (IPX6) | Zashchita ot as above, space, U+0441 U+0438 U+043B U+044C U+043D U+044B U+0445, space, struy as above, ASCII " (IPX6)" |
| `IPX7` | Temporary immersion (IPX7) | Kratkovremennoe pogruzhenie (IPX7) | U+041A U+0440 U+0430 U+0442 U+043A U+043E U+0432 U+0440 U+0435 U+043C U+0435 U+043D U+043D U+043E U+0435, space, U+043F U+043E U+0433 U+0440 U+0443 U+0436 U+0435 U+043D U+0438 U+0435, ASCII " (IPX7)" |
| `IPX8` | Continuous immersion (IPX8) | Dlitelnoe pogruzhenie (IPX8) | U+0414 U+043B U+0438 U+0442 U+0435 U+043B U+044C U+043D U+043E U+0435, space, pogruzhenie as above, ASCII " (IPX8)" |

Attribute names (labels) and units: unchanged from revision 1 (PLAN D7 with the plan-gate refinements); units stay Latin and are not localized.

## Accessibility

Checklist of `ui5-best-practices-accessibility` applied to the custom section; what `fiori-app-dev` must do, and what `ui-verifier` confirms in the DOM.

- Landmarks (topic 1): the Object Page and its sections carry the FE landmarks; the fragment adds none. The Form gets an accessible name equal to the section title: `ariaLabelledBy` to a `core:InvisibleText` bound to `ProductsObjectPage.details.title`, placed before the Form (labeling.md section 8), because the FormContainer has no visible title.
- Labeling (topic 2): every field's `sap.m.Label` is the `label` of its `FormElement`; **do not set `labelFor` by hand**: the FormElement assigns the label to its field when `labelFor` is empty (API, verified), and a hand-written id inside a list-bound template would not survive the clone suffix. Effect in the DOM: `<label for>` (or `aria-labelledby`) of each input, combo box and multi combo box points to its control. The unit is the Input `description`, rendered after the field and referenced from the input, so a screen reader announces "Screen Size, 15, in" (verifier reads `aria-describedby`). In display mode the label and the `sap.m.Text` are read in order. List items and tokens carry the localized names only.
- MULTI_LIST tokens: the tokenizer's hidden accessibility text announces the number of tokens when the control gets focus (framework text, quoted by the verifier in `en` and `ru`); each token is read by its name; the delete icon of a token is decorative for the keyboard (Backspace/Delete remove a focused token).
- Empty value: the empty indicator renders a dash for the eye and a hidden framework text for screen readers (expected "Empty"; verifier quotes it), so an empty field is never announced as silence.
- Heading levels (topic 3): the section title is an `H2` rendered by FE, the same level as the other sections (measured in revision 1). The fragment adds **no `Title`**, no FormContainer title and no toolbar title, so the section has exactly one heading and no level is skipped. The counter is plain text, not a heading.
- Focus and keyboard (topic 4):
  - Edit mode Tab order = visual order = DOM order: ... Stock Quantity (last field of Pricing & Stock), then the Details fields in their order (Laptop Pro 15: Screen Size, Memory (RAM), Storage), then the next tab stop after the section (Administrative Data has none in edit mode), then the footer. The unit text, the counter and the hint texts are not tab stops. At M width the newspaper order (column 1 top to bottom, then column 2) is still the DOM order.
  - Display mode: no tab stops in the section. F6 / Shift+F6 moves between sections (each `ObjectPageSection` is an F6 group); no `sap-ui-fastnavgroup` to add.
  - TEXT, INTEGER, DECIMAL: type, Enter or Tab commits; Escape reverts the uncommitted text.
  - LIST (`sap.m.ComboBox`): typing filters the list and completes the first match in the field; F4 or Alt+Down opens and closes the list; Arrow Up/Down move through items; Enter chooses; Escape closes the list or reverts; Tab commits the completed match and leaves; the clear icon is reachable by mouse, Backspace empties the field from the keyboard.
  - MULTI_LIST (`sap.m.MultiComboBox`): typing filters and completes; Enter adds the completed item as a token and keeps the focus in the field for the next value; F4 or Alt+Down opens the list with checkboxes, Space toggles an item, Enter or Escape closes; Backspace in an empty text field focuses the last token, a second Backspace (or Delete) removes it; Arrow Left/Right move between tokens (API: "review the tokens by pressing the right or left arrows"); Tab leaves the control (tokens are not separate tab stops).
  - No `tabindex`, no `initialFocus` to set.
- Keyboard shortcuts (topic 5): the FE draft shortcuts (Save, Discard) apply; nothing to add.
- Invisible messaging (topic 6): no `InvisibleMessage` in the fragment. The counter changes as a consequence of the user's own edit of a field that already confirms it, so announcing it after every commit would be noise. Errors and the subcategory warning use the field value states and the FE message popover, the same channel for every user (invisible-message.md: no information only for assistive technology). Verifier checks that the warning on the focused Subcategory field is exposed to the accessibility tree (value state text referenced by the field); if not, UX risk 2.
- Reading order (topic 7): DOM order equals the visual order: heading, counter, then the fields in their order, each label before its control and the unit after it; on a phone the single column keeps the same order.
- Target size (topic 8): no `Link`, `ObjectStatus` or `ObjectIdentifier` in the section; inputs, combo boxes, tokens and their clear icons are standard-sized controls.

## Theme and tokens

Standard controls only: `sap.ui.layout.form.Form` with `ColumnLayout`, `FormContainer`, `FormElement`, `sap.m.Label`, `sap.m.Text` (with `emptyIndicatorMode`), `sap.m.Input` (`description`, `fieldWidth`, `textAlign`, `maxLength`), `sap.m.ComboBox` and `sap.m.MultiComboBox` (`showClearIcon`), `sap.ui.core.Item`, `sap.ui.core.InvisibleText`, inside the FE custom section; the messages are FE's message popover and value states. Theme `sap_horizon` as the whole app; value states use the theme's semantic colours; no custom CSS, no inline style, no colour, no icon, no `Component.js` change. The `get_guidelines` rules apply to the fragment: XML only, `core:require` for types and any formatter module, data binding for every text (`{i18n>...}`), OData types for numbers, no globals, keys in all three `webapp/i18n` files.

## Verifier scenarios

Users `alice` (CatalogEditor) and `viewer` (CatalogViewer) from `package.json`; `ru` through `sap-ui-language=ru` on the FLP sandbox URL. Record each as evidence in `VERIFICATION.md` (screenshot plus quoted rendered text, Cyrillic allowed there). Record the `$batch` of every value commit (the `PATCH` payload shows the stored form, for example `"1.5"` for `ru` "1,5"). Leave no draft; end with 15 products and the seeded values.

1. Display, `alice`, `en`: Laptop Pro 15. Anchor bar General Information, Pricing & Stock, Details, Administrative Data. Section heading "Details", one `H2`; next line "Filled 3 of 3"; fields "Screen Size: 15 in", "Memory (RAM): 16 GB", "Storage: 512 GB" in this order, labels above values with a colon, in one row aligned with the column grid of General Information at the same window width; no table, no toolbar, no Create or Delete, no codes. Wireless Mouse: "Filled 2 of 3", "Connectivity: Wireless 2.4 GHz", "Sensor Resolution: 1,600 dpi", "Battery Life:" with the empty indicator. Office Chair: "Material: Mesh", "Maximum Load: 120 kg", "Colour:" empty, "Filled 2 of 3". Backpack: three empty fields, "Filled 0 of 3". Coffee Maker "Capacity: 1.2 l" (no padding zero).
2. Display, `alice`, `ru`: Coffee Maker. Title Kharakteristiki, "Zapolneno 2 iz 3", fields Moshchnost "900 W", Obyem "1,2 l" (decimal comma, unit Latin), Tsvet empty. Wireless Mouse: Podklyuchenie "Besprovodnoe 2,4 GGts", Razreshenie sensora "1 600 dpi" (record the grouping character). Quote every Russian string; compare with the code points of "Texts".
3. Edit numbers, `alice`, `en`: Laptop Pro 15, Edit. Inputs with the units "in", "GB", "GB" right of them, numbers end-aligned (compare with Price and Stock Quantity), Tab from Stock Quantity lands in Screen Size. Change Screen Size to 15.6, Tab: one `PATCH` with the value, counter still "Filled 3 of 3". Save: display "15.6 in". Edit, set 15 back, Save.
4. Locale-aware decimal, `alice`, `ru`: Coffee Maker, Edit, Obyem: type "1,5", Tab: the `PATCH` stores "1.5"; Save: display "1,5 l"; reload in `en`: "1.5 l". In `ru` type "1.5" once and record whether it is accepted as 1,5 or rejected (UX risk 4). Restore 1.2.
5. Invalid numbers, `alice`, `en`: Laptop Pro 15, Edit. Memory (RAM) "abc", Tab: Error state and text (quote); "16.5": Error (quote); "0": out of range, Error with "Enter a value from 1 to 1024." or the framework text (record which channel answered and when: on focus leave or after the `PATCH`); Screen Size "15.55": decimals Error (quote). With one error left, press Save: record that Save is blocked and the popover lists the field under "Details"; no invalid value reaches the active product. Quote one of the texts in `ru`. Discard Draft.
6. Empty values (U4), `alice`, `en`: Wireless Mouse, Edit. Battery Life: type 12, Tab: counter "Filled 3 of 3"; clear it, Tab: "Filled 2 of 3"; clear Sensor Resolution too: "Filled 1 of 3"; Save succeeds: both show the empty indicator in display mode; quote the screen-reader text of the empty indicator from the DOM. Edit, Sensor Resolution 1600, Save.
7. LIST, `alice`, `en`: Office Chair, Edit, Colour. F4: 12 names in the order of the Texts table, no codes. Type "Bl": the field completes to "Black" (or "Blue", record which); Enter; counter "Filled 3 of 3". Type "Purple", Tab: Error "Select a value from the list.", no `PATCH`; Escape or fix it. Save with Black: display "Colour: Black". Edit, clear Colour with the clear icon, Save: Colour empty again. In `ru` once: the list shows Chernyy, Belyy, ... (quote two names).
8. MULTI_LIST add, `alice`, `en`: Wireless Mouse, Edit, Connectivity shows the token "Wireless 2.4 GHz". Type "Blu": completes to "Bluetooth 5.0"; Enter: a second token, focus stays in the field. Save: display "Connectivity: Bluetooth 5.0, Wireless 2.4 GHz" (list order, not selection order); record the stored form in the `PATCH`.
9. MULTI_LIST remove and invalid, `alice`, `en`: Wireless Mouse, Edit, Connectivity. Backspace in the empty text field: the last token gets the focus; Backspace again: it is removed. Remove "Bluetooth 5.0" (whichever key path works; record it). Type "Zz": record the brief Error flash and any text it shows; no token. Remove every token: counter "Filled 2 of 3"; F4 and Space on "Wireless 2.4 GHz" to restore it; Save: display "Connectivity: Wireless 2.4 GHz".
10. Subcategory change, everything removed (U3), `alice`, `en`: Laptop Pro 15, Edit, Subcategory to Mice. At once: the Subcategory field in the Warning state with "Values removed: 3. These details do not apply to the new subcategory: Screen Size, Memory (RAM), Storage."; the footer message button shows a warning, count 1; Details shows Connectivity, Sensor Resolution, Battery Life, all empty, "Filled 0 of 3"; record the `$batch` (the `PATCH`, the message read, the `details` re-read). Wait for any further side-effect requests: the warning is still visible (UX risk 1). Set Subcategory back to Laptops: three empty fields, no new warning (nothing filled was lost). Discard Draft: display shows 15 in, 16 GB, 512 GB.
11. Subcategory change, partial (U3), `alice`, `en`: Wireless Mouse, Edit, Subcategory to Audio. Connectivity keeps "Wireless 2.4 GHz", Battery Life stays (empty), Colour appears empty, Sensor Resolution is gone; warning "Values removed: 1. These details do not apply to the new subcategory: Sensor Resolution."; "Filled 1 of 3". Save: succeeds, the warning does not block it; record whether it is shown again at Save. Restore: Edit, Subcategory Mice, Sensor Resolution 1600, Save (Battery Life empty, Connectivity kept).
12. No warning when nothing filled is lost, `alice`, `en`: Bluetooth Speaker (Connectivity Bluetooth 5.0, Battery Life 12, Colour empty), Edit, Subcategory to Mice: Connectivity and Battery Life kept, Sensor Resolution appears empty, no message, the message button does not appear; "Filled 2 of 3". `ru` once on Laptop Pro 15 to Mice: quote the Russian warning. Discard Draft each time.
13. Category change (open question 3 default), `alice`, `en`: Office Chair, Edit, Category to Electronics: Subcategory empties (ADR-0024), Details shows "Select a subcategory to fill in the details.", no counter. Category back to Furniture, Subcategory Seating: Material Mesh and Maximum Load 120 are back, no warning. Discard Draft.
14. New product, `alice`, `en`: List Report, Create. Details shows "Select a subcategory to fill in the details.". Fill name, price, currency, stock, Category Furniture, Subcategory Seating: Material, Maximum Load, Colour appear empty, "Filled 0 of 3"; Maximum Load 100: "Filled 1 of 3". Save: display mode with "Maximum Load: 100 kg". Delete the product from its header; the List Report shows 15 rows.
15. Viewer, `viewer`, `en`: Laptop Pro 15: the display layout of scenario 1 with the counter, no input anywhere in the section, no Edit in the header. `ru` once for the title and the counter.
16. Keyboard and screen reader, `alice`, `en`: Wireless Mouse, Edit, mouse untouched: Tab from Stock Quantity into Connectivity, Tab to Sensor Resolution, Tab to Battery Life, Tab out of the section (record the next stop). In Connectivity: F4 opens, Arrow Down, Space toggles, Escape closes; Arrow Left reaches a token. Office Chair Colour: Alt+Down opens, Enter chooses. F6 moves from General Information to Pricing & Stock to Details. DOM reads: the label of each field points to its control; `aria-describedby` of an input with a unit contains the unit; the multi combo box exposes the token count text (quote `en` and `ru`); the Form has the accessible name "Details"; the section has one heading, `H2`, and the counter is not a heading.
17. Responsive, `alice`, `en`: Laptop Pro 15 in display and edit mode at the desktop window (three fields in one row, aligned with General Information) and at a phone width (device emulation, about 375 px): one column, label above each value, the unit still right of the input and not cut. Record the M width (two columns) if the emulation offers it.
18. Console: compare the browser console of scenarios 1-17 with the console section of revision 1 (`docs/features/products-details-section/VERIFICATION.md` at `cc23ef0`, which already lists the baseline of `products-subcategory-cascade` at `5ab8b02`). The revision 1 table noise (`PropertyInfo validation is disabled` for `fe::table::details::LineItem`, `Unknown qualified name Edm.String` for `SubcategoryAttributes`) should be gone; no new error; record the count of the DevTools issue "Incorrect use of <label for=FORM_ELEMENT>" (labels pointing to display texts may raise it) against the baseline count of 1; name the known noise, do not forbid substrings.

## UX risks

1. The subcategory warning disappears too early: FE reads `DraftMessages` after a `PATCH`; if the warning reaches the client only in the `sap-messages` header and is not stored as a draft message, the next message read may replace it within a second. Detection: scenario 10. Mitigation is the architect's (store it as a draft message targeted at `subcategory_code`); the message strip in the section is the fallback (custom code).
2. A screen-reader user may not hear the warning if the value state of the FE Subcategory field is not announced while the field keeps the focus. Detection: scenario 16 (accessibility tree of the focused field). A custom `InvisibleMessage` would need code on an FE-owned field; out of scope, follow-up if it fails.
3. Changing the subcategory back does not restore removed values; only Discard Draft does (open question 7). The warning names what was removed, so the user can retype it.
4. A Russian user who types a dot ("1.5") may be rejected or misread, because the `ru` decimal separator is the comma and the dot is not the grouping character (space). Detection: scenario 4; accepted framework behaviour either way, recorded.
5. A field in the Error state could be saved with its last valid value if the fragment's client-side errors are not in the FE message model. Detection: scenario 5; requirement: Save blocked with the error listed.
6. Server range messages format `{0}` and `{1}` without the user's locale ("0.01" in `ru` instead of "0,01"): the integer bounds read fine, the decimal ones do not. Acceptable; the architect may pass preformatted numbers.
7. Grouping: "1,600 dpi" / "1 600 dpi" is the UI5 default (Price shows "1,299.99"); some catalogues print "1600 dpi" (open question 5).
8. A product whose seed data lacks a row for an assigned attribute shows fewer fields and a smaller M ("Filled 2 of 2"). Detection: scenario 1 on every seeded product with D7 rows; the seed needs a row per assigned attribute (U2).
9. The section re-renders when the side effect re-reads `details`; a value being typed in a Details field at that moment is not affected, because only a Subcategory or Category change triggers it, which takes the focus out of the section.
10. `fieldWidth` 75% may squeeze long inputs on a phone or leave a gap on a wide desktop column. Detection: scenario 17; adjust the property, never CSS.
11. Mock mode (`npm run start-mock`) needs updated JSON for the new list values and constraints and does not serve `ru`; not a gate.

## Open questions for the user

Each has a recommended default that the plan can proceed with.

1. Is Material a multi-value attribute (MULTI_LIST)? Default: **yes** (a chair is Mesh and Aluminium, a bottle Stainless steel and Silicone); Connectivity is MULTI_LIST by your decision; Colour, Paper Size and Water Resistance stay single-value (LIST).
2. Should the subcategory-change warning appear only when a **filled** value is removed? Default: **yes**; when only empty fields change, no message (nothing is lost).
3. A category change empties the subcategory (ADR-0024). Should the detail values survive until the new subcategory is chosen, so shared attributes (Colour, Material) are kept and the warning appears once? Default: **yes**; the alternative (delete everything when the subcategory empties) loses shared values on every category change.
4. The counter "Filled 2 of 3" sits on its own line directly under the section title, as neutral text in every state; a custom section has no slot on the heading line. Default: **accept**, no colour, no percentage.
5. Large numbers grouped as the UI5 default ("1,600 dpi", `ru` "1 600 dpi")? Default: **yes**, consistent with Price.
6. International designations stay Latin in `ru` list names (TPE, Bluetooth 5.0, Wi-Fi, USB, A4, Letter, IPX4), while "Wireless 2.4 GHz" becomes "Besprovodnoe 2,4 GGts" with the Russian unit abbreviation inside the name. Default: **yes**, as Russian catalogues write them.
7. Should the warning mention the undo ("Discard the draft to restore them.")? Default: **no**: Discard Draft also discards every other change of the draft, so the hint could cost more than it saves.
8. The proposed ranges and decimals per numeric attribute (table under "Value states and messages") and the five value lists (Texts, "List values"). Default: **as proposed**; edit any row at the gate.
