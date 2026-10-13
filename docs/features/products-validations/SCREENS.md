# products-validations: screens

Written by `ux-designer` (2026-10-13) from the SAP Fiori guidelines, `CONTEXT.md` (rules R1-R9, decisions D1-D10), `PLAN.md` and `research/validation-facts.md` section 1; read by `fiori-app-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task: edit a product (or create one) and save it without errors. No new screen is added; what changes is when and where the required marker and the validation message appear on the existing Product Object Page. The user reviews this file at the plan gate together with D1-D10 (D10 is this file).

## Floorplan and duplication check

Floorplan: the existing List Report + Object Page of `app/products` (`docs/registry/UI-ARTIFACTS.md`: `ProductsList`, `ProductsObjectPage` with the custom section `Details` after `PricingStock`, ADR-0027). Nothing is added: no page, no section, no column, no filter, no action, no `manifest.json` change. The feature changes the behaviour of two mechanisms the page already has in edit mode: the required marker on a label and the message on a field (value state plus message popover entry).

Sources (`mcp__fiori-mcp__search_docs`, 2026-10-13, seven queries, all answered, no outage):

| Document | What it says that this design relies on | URL / status |
|---|---|---|
| "Using Messages in SAP Fiori Elements" step 1 | State messages persist in the backend and are shown "until corrected"; in Object Page edit mode they appear in the message popover together with client-side validation messages; they are not expected in display mode or in the List Report | MCP document, no URL |
| same, step 2 | After the user edits a field "the backend must revalidate changed fields and add/remove state messages"; "configure multiple targets in a single message only for special scenarios (e.g., inter-field dependency like start date > end date or unit-of-measure associated field). Ensure all targeted fields are visible on the same UI page" | the citable basis for the two-target rules R4 (price and its currency: the unit-of-measure case) and R6 |
| same, step 5 | OData V4: when the message property is requested, the model removes the entity's state messages and refills them from the response | why a corrected field loses its message at the next read |
| same, step 8 | Message button visible only while bound messages exist, coloured by the highest severity, shows the error count; the popover groups by section, shows a subtitle, navigates to the field on click, has a severity filter | the popover design in "Empty state and errors" |
| "Draft Validation" | Enter in a field triggers the global side effect; CAP generates one (`#alwaysFetchMessages`, `SourceEntities: ['']`, `search_model`), so the messages are fetched after every field change and on Enter | live example https://ui5.sap.com/test-resources/sap/fe/core/fpmExplorer/index.html#/advancedFeatures/guidance/draftValidation |
| "Field Control" | `Common.FieldControl` static or by path; the FormElement building block "automatically creates and manages the label, including visualizing when an input value is mandatory" | the marker of the FE sections is framework-rendered; no custom code there |
| "Support for Extended OData Annotations (V4)" | `If` expressions are supported for `Common.FieldControl` | the `(stock > 0 ? 7 : 3)` form of R6 renders as `<If><Gt>` and is in scope |
| "Draft Handling" steps 1 and 10 | "Validation errors: technical inconsistencies (e.g., wrong data type, overflow) block saving and prompt users to fix errors before Save"; draft design guideline | https://experience.sap.com/fiori-design-web/draft-handling/ (returned by MCP) |
| "Handling Inconsistent Input" step 4 | Client type errors block Save on the client; business rules come back as state messages from the server | the two message kinds of this feature |
| "Configuring Fields (V4)" step 2 | `UI.Placeholder` exists for inputs | not used: a static placeholder shows in every empty state (lesson of #8); the hint of R9 lives in the message |

Not in the snapshot (asked, unrelated documents returned): the rendering of a message with `additionalTargets`; whether `Validation.Pattern` or `Validation.Exclusive` are applied on the client; a design document on message wording or on the required-field indicator. The rows below that depend on them are marked "expected" and are verifier scenarios. The design guideline URLs for the Object Page, form field validation, the message popover and UI texts (https://experience.sap.com/fiori-design-web/object-page/, https://experience.sap.com/fiori-design-web/form-field-validation/, https://experience.sap.com/fiori-design-web/message-popover/, https://experience.sap.com/fiori-design-web/ui-text-guidelines/) are stable but were not returned by MCP this session: not re-verified.

Where MCP corrected my assumptions: (1) I assumed a required or cross-field rule is checked only at Save; the FE document expects the backend to revalidate after every field change and the client to show the result in the popover while editing, so the live R4 and R6 messages are framework-conform, not an oddity. (2) I assumed one message marks one field; the FE document names the multi-target message as the intended form for an inter-field dependency, with the condition that both fields are on the same page (they are: one Object Page).

UI5 facts (`mcp__ui5-mcp-server__get_api_reference`, resolved against OpenUI5 1.136.5; the app runs 1.152 or 1.153 from the CDN): `sap.m.Label#required` adds the asterisk to the label text (FE shows it on a filled required field too, measured in #8 with `iCheckField(..., { required: true })` on a filled Subcategory); `sap.m.InputBase#valueStateText` is the text of the value state pop-up, a framework default text when empty; `sap.ui.model.odata.type.Decimal` has the constraints `minimum`, `minimumExclusive`, `maximum`, `maximumExclusive`, `precision`, `scale`, and `validateValue` throws a `ValidateException` on a violation. Not verified by MCP: the V4 `ODataMetaModel` maps `Validation.Minimum` and `Validation.Maximum` with `Validation.Exclusive` on an `Edm.Decimal` property to exactly these constraints (UI5 source `sap/ui/model/odata/v4/ODataMetaModel`, `mUi5TypeForEdmType`) and maps nothing for `Validation.Pattern` on `Edm.String`. If the verifier confirms it, R3 is checked on the client with the framework text before any request, while R1 and R5 are checked by the server with the project text (see "R3 and R4", UX risk 1, Q2).

## Screen: Product Object Page in edit mode

- Title and subtitle: unchanged (`UI.HeaderInfo`: product name, category name, header image).
- Filters: none (Object Page).
- Table columns: none; the List Report is unchanged (see "List Report and display mode").
- Actions and their placement: unchanged. Footer: Save and Discard Draft (framework) plus the framework's message button at the left of the footer, which exists only while the draft carries bound messages and shows the error count (FE doc step 8).
- Object Page sections: unchanged order: General Information (Name, Description, Category, Subcategory, Rating, Image URL), Pricing & Stock (Price, Currency, Stock), Details (custom typed form of ADR-0027), Administrative Data. Only edit mode is affected.
- Empty state and errors: see "Empty state and errors".
- Criticality and statuses: every message of this feature is an Error (red value state, red popover entry, red footer button). The Warning of a subcategory change (`PRODUCTS_DETAILS_VALUES_REMOVED`) and the Details counter badge stay as in #9. No new status, no new colour.
- What is shown instead of a UUID (`TextArrangement`): unchanged (`#TextOnly` on Category and Subcategory; the currency code with its name from the standard code list). The new `Products.namesakes` navigation and `SubcategoryAttributes.required` have no UI of their own: they appear nowhere on the screens and are labelled only for `$metadata`.

### When a message appears and where

The timing matrix of `research/validation-facts.md` section 1, translated into what the user sees. "Leaving the field" means Tab, a click elsewhere or Enter: Fiori Elements writes the field (`PATCH`) and reads the draft messages in the same `$batch` (`#alwaysFetchMessages`; the custom Details form does the same after its own writes through `requestDraftMessages`, ADR-0027 amendment D-2), so every server message of this feature reaches the field in one step, right after the field is left. Nothing happens per keystroke.

| Rule | Kind | Appears | On the field (value state Error with the text) | In the message popover |
|---|---|---|---|---|
| `@mandatory` on Name, Price, Currency, Stock, Category, Subcategory (exists) | input validation | only at Save (activation 400) | yes, after Save, framework text "Provide the missing value." (cds bundle, `en` and `ru`) | one entry per empty field |
| R1 name too short, R5 image URL not https (`@assert.format`) | input validation, message in the `PATCH` response | after leaving the field; again at Save while still wrong | yes | yes |
| R3 price not above 0 (`@assert.range` open bound) | expected: client type check (framework text) before any request; server `ASSERT_RANGE` with the project text on API paths and in the import | at once when the field is left | yes, framework text expected | yes, as a client validation entry; Save refused on the client |
| R2 duplicate name, R4 price x currency, R6 description x stock, R7 description = name (`@assert` constraints) | state message written at the commit of the field's `PATCH`, read in the same batch | after leaving a field that is one of the rule's targets (`touched` or `additionalTargets`); at Save for everything | yes, on every target field | one entry per message (expected: a two-target message is one entry) |
| R8 required detail (`@assert` on the row) | state message on the row and on the product | after leaving the detail field; at Save | yes for TEXT, INTEGER, DECIMAL, LIST (the control binds the column); no for MULTI_LIST (target `attribute_code`, nothing binds it) | yes |
| R9 text pattern (optional, handler) | `PATCH` refused with 400 | after leaving the field | expected: the typed text stays in the field with the Error state; the stored value does not change | yes |

Order at Save (research P8d): input validation (`@mandatory`, format, range, types) refuses first and alone. The constraint messages the draft already carries stay visible, but a constraint that has not fired yet (its fields were never touched in this draft) is reported only on the next Save, after the input errors are fixed. See "Save and the second round".

### Required markers and the create flow

The marker is the asterisk in front of the label text, rendered by the framework from `Common.FieldControl` in the FE sections and by `DetailsForm.js` from the assignment in the Details section. A marker blocks nothing by itself; the server rule behind it does (ADR-0025 point 3, ADR-0028 decision 4).

| Field | Marker | Source | When it changes |
|---|---|---|---|
| Name, Price, Currency, Stock, Category | always in edit mode | static `@mandatory` (exists) | never |
| Subcategory | once a category is set; disabled and unmarked before | `(category.code is null ? 0 : 7)` (ADR-0025, exists) | on the client when Category is committed |
| Description | while Stock is above 0; unmarked at 0 or empty | `(stock > 0 ? 7 : 3)` (R6, new) | on the client when Stock is committed (field left or Enter), before the server answers, no request needed; clearing Stock or setting 0 unmarks it; the marker stays while the field is filled |
| Image URL, Rating | never | optional | |
| Details: a required attribute of the subcategory (D6: Screen Size on Laptops; Sensor Resolution on Mice; Maximum Load on Seating; Power and Capacity on Appliances; Capacity on Drinkware; Thickness on Fitness) | in edit mode only, like the FE sections | `SubcategoryAttributes.required` from the row's expanded assignment, `isRequired(row, subcategoryCode)` (R8, new); set with `labelFor` in `applyLabelTarget`, so display mode shows none | when the rows are built or rebuilt (Edit, subcategory change); hidden in display mode, where no FE label carries a marker either |
| Details: every other attribute | never | | |

Create (the plus button of the List Report, a new draft): before anything is typed, Name, Price, Currency, Stock and Category carry the marker; Subcategory is disabled without a marker; Description, Image URL and Rating have none; the Details section shows the existing hint "Select a subcategory to fill in the details.". Choosing a category enables and marks Subcategory. Choosing a subcategory lets the server create the detail rows, and the Details form shows them with the marker on the required ones (Laptops: Screen Size marked, Memory (RAM) and Storage not). Typing a stock above 0 and leaving the field marks Description at once; if Description is still empty, the R6 message follows on both fields in the same step (see "R6 and R7").

Edit of an existing product: the same markers, Description marked for every seeded product (all have stock above 0). A seeded product carries no message after Edit: its required details are filled and no rule is violated by the seed (research section 8).

### R1 and R2: Name

- R1: the user types a name shorter than 3 characters after trimming (`AB`, ` A `) and leaves the field. The field turns red with `PRODUCTS_NAME_TOO_SHORT`; the popover lists it under General Information with the subtitle "Product Name". A corrected name clears both when the field is left.
- R2: the user types a name that another product has, in any case and padding (`backpack `), and leaves the field: same rendering with `PRODUCTS_NAME_DUPLICATE`. The product's own name never triggers it (Edit of Backpack, retype `Backpack`, Save: no message). A name another user is drafting at the same time is not detected until that draft is saved; the later Save then fails with this message (plan risk, by design).
- Both at once are not reachable with the seed (a one- or two-letter duplicate does not exist); if a name violated both, the field would carry two entries (UX risk 2).
- `@mandatory` on Name is unchanged: an empty Name is reported at Save only.

### R3 and R4: Price and Currency

- R3: the user types `0` or a negative price and leaves the field. Expected (not verified by MCP; verifier V5): the client `Decimal` type carries `minimumExclusive` from the new `Validation.Exclusive`, so the field turns red at once with the framework text (expected "Enter a number greater than 0", the UI5 core text `EnterNumberMinExclusive`, in `ru` from the UI5 bundle), no `PATCH` is sent, nothing is stored, and Save is refused on the client with the entry in the popover (the behaviour measured in #9 for a client validation message). The project text `PRODUCTS_PRICE_POSITIVE` is then seen by API clients and in the import's row errors, not on this screen. If the verifier finds that the client ignores the exclusive bound, the server text appears in the `PATCH` response like R1. Either way the user sees one immediate message on Price. Decision for the user: Q2.
- The existing client checks stay: more than two decimals (`10.505`) and a non-number are refused by the type with framework texts.
- R4: the user has a currency without decimal places (`JPY`; 33 of the 204 standard currencies) and a price with decimals (`10.50`), in either order: `JPY` chosen on a draft that holds `10.50`, or `10.50` typed with `JPY` set. After the second field is left, Price and Currency both turn red with the same text `PRODUCTS_PRICE_MINOR_UNIT`, and the popover shows one entry (expected: the V4 model keeps one `sap.ui.core.message.Message` with two targets; verifier V4). Fixing either side (price `11`, or currency `USD`) clears both fields in one step, because the constraint re-runs when either target is touched. At Save the server reports the first target only (research): Price red, one entry.
- Both fields are in the same section (Pricing & Stock), so the two red fields are visible together, as the FE document requires for a multi-target message.

### R5: Image URL

The user types an address that does not start with `https://` or contains a space (`http://example.com/a.png`, `https://example.com/a b.png`) and leaves the field: red with `PRODUCTS_IMAGE_URL_HTTPS`, entry under General Information. An empty Image URL stays allowed (optional field; `null` passes the format check). The header image keeps the stored (active) image while the draft is edited; a wrong draft URL cannot be saved, so a broken header image never reaches display mode.

### R6 and R7: Description and Stock

- Marker: Description is marked while Stock is above 0 (table above).
- R6 message: the rule fires when Stock is committed above 0 while Description is empty, and when Description is emptied while Stock is above 0. Both fields turn red with `PRODUCTS_DESCRIPTION_REQUIRED_IN_STOCK`, one popover entry (expected; verifier V3). Description is in General Information and Stock in Pricing & Stock: both are on the one page but not always in one view, so the user who typed Stock sees Stock red and reads the text there; the popover entry navigates to Description. The text is therefore written to read naturally on Stock as well ("Enter a description. Products in stock are visible to customers."). Typing a description and leaving the field clears both; setting Stock to 0 clears both and removes the marker.
- At Save the message is on Description only (first target).
- Alternative the user can choose (Q1): a single-target constraint on `description` (D8 alternative). Then typing Stock marks Description but shows no message; the message appears when Description itself is left empty after being touched, and at Save. That is the conventional "required field, checked at Save" behaviour of a Fiori form; the recommended two-target form is the showcase of the inter-field dependency the FE document describes, and it explains on the spot why Stock made Description required.
- R7 (optional): a description that only repeats the name (` backpack ` on the product `Backpack 2`; case and padding ignored) turns Description red with `PRODUCTS_DESCRIPTION_EQUALS_NAME` when the field is left. R6 and R7 cannot fire together (one needs an empty, the other a filled description). R7 fires while editing only when Description is touched; a rename that makes Name equal to the description is reported at Save.

### R8: required details

- Marker: on the label of each required attribute of the product's subcategory, edit mode only.
- TEXT, INTEGER, DECIMAL, LIST: the user empties a required field (clears Screen Size on Laptop Pro 15) and leaves it. The input turns red with `PRODUCTS_DETAIL_VALUE_REQUIRED`; the row message is also written on the product, so the message survives the reads that other field changes trigger. The popover entry is expected under the Details group with the attribute name as subtitle; the framework derives both from the control's place in the page, and the verifier records what appears (V8). Entering a value clears it when the field is left.
- Save with an empty required detail is refused; the activation error targets `in/details(ID=...,IsActiveEntity=false)/numberValue`. Expected: the same input shows the Error state and the popover entry navigates to it. The plan's fallback, if the activation error stays popover-only, is a client validation message of the B6 shape added at commit; the user's view is the same except for the moment the red state appears.
- MULTI_LIST: the rule targets `attribute_code`, which no control of the form binds. The message appears in the popover only, without a field highlight and without navigation on click; the marker on the label is what points the user to the field. With D6 as proposed no MULTI_LIST attribute is required, so this case is not reachable on the screen (Q3).
- The counter badge "Filled N of M" stays Warning while any field, required or not, is empty; it is a completeness indicator, not a validation indicator, and is unchanged.

### R9: text pattern (optional)

The user types a text that does not match the attribute's pattern in a TEXT field that has one (Dimensions of Monitor Stand, `30 by 20`) and leaves the field. The `PATCH` is refused (400): the field keeps the typed text and turns red with `PRODUCTS_DETAIL_TEXT_PATTERN`, whose `{0}` is the attribute's localized description ("length x width x height in cm, for example 30x20x10"); the stored value is unchanged (Discard Draft shows the old value); Save is refused until the text is corrected (`30x20x10` or `30 x 20 x 10` are accepted). Expected rendering of a refused `PATCH` on a bound input of the custom form (verifier V14): the V4 model reports the error as a bound message on the row's `textValue`, and the Input bound to it gets the state. No placeholder on the field: the hint lives in the message.

### Save and the second round

- Save refused on the client: when a client validation message exists (R3 expected; type errors; the list message "Select a value from the list." of #9), the popover opens with the entry and no request is sent (measured in #9).
- Save refused by the server (400 on `draftActivate`): for `@mandatory` and for every rule still violated. The user stays in edit mode, the draft keeps its values, each reported field is red with its text, the popover lists them (verifier V10 records whether the popover opens by itself after the 400 or on the footer button).
- Two rounds: when a Save carries an input-validation error (an empty mandatory field, a format error, a range error) together with a constraint violation that was never shown during this edit (its fields were not touched: an untouched empty required detail of a product created by the import, a description emptied through the API), the first Save reports the input errors only; the second Save, after they are fixed, reports the constraint. Draft messages the user already saw while editing stay visible through both rounds. In normal editing the second round does not occur, because every constraint message appears when its field is left.
- After a successful Save the page switches to display mode: no markers, no messages, no footer button.

### List Report and display mode

Nothing changes in the List Report: columns, filters, the draft and lock marker, the import action and the row count are as before. A draft that carries messages looks like any other draft in the list (UX risk 14). The Object Page in display mode shows no marker and no message (state messages are not supported in display mode, FE doc steps 1 and 8).

## Empty state and errors

- No messages: no footer message button, every field in the None state, markers as in the marker table. This is the state of every seeded product after Edit.
- Message popover (framework `sap.m.MessagePopover` behind the footer button): entries grouped by section title ("General Information", "Pricing & Stock"; the group of a Details message is verifier item V8), the entry title is the message text, the subtitle the field label; errors above warnings (framework); a click or Enter on an entry scrolls to the field and focuses it (FE doc step 8). The popover's severity filter stays (framework).
- How many at once: one entry per violated rule. A field carries two entries only when two rules of different kinds fail on it (a format error of the `PATCH` plus a constraint written at its commit), which no seeded case produces. A two-target message (R4, R6) is one entry (expected). The `@mandatory` entries after Save add one per empty field; the known #8 behaviour stays: with an empty Category the disabled Subcategory is listed too.
- After fixing one field: when the field is left, the message read of the same batch removes its entry and its red state; the footer count drops; at zero the button disappears. A message raised by a failed Save stays on the field and in the count until the next field change or Save triggers a read (measured in #8 for the subcategory).
- Discard Draft removes the draft with its messages; display mode shows the active values.
- Keep Draft and reopen: the state messages are persisted on the draft and appear again on the fields when the draft is opened for editing (expected; verifier V11).

## Texts

### Review of the architect's `en` texts

Against the Fiori UI text rules (stable guidance, not returned by MCP this session: say what to do first, one or two short sentences, no technical terms, no "please", sentence case, a period at the end): the architect's texts explain the reason well, but four lead with the problem instead of the action (R2, R6, R7, R8), one uses the technical term "minor units" (R4), and R6 appears on the Stock field too, so its text must read naturally there. The proposed values follow; the keys stay as named. Every `ru` value is given as code points (CLAUDE.md invariant 10): the bundle holds the plain word, the OPA `data/` file holds backslash-u escapes (`CategoryTexts.js` convention), `test-ui` converts.

| Key | `#XMSG` comment (for `_i18n/messages.properties`) | `en` proposed | `ru` (transliteration; code points per word in the glossary) |
|---|---|---|---|
| `PRODUCTS_NAME_TOO_SHORT` | Name shorter than 3 characters after trimming (@assert.format.message, ADR-0028 decision 1) | Enter a product name with at least 3 characters. | Vvedite nazvanie tovara dlinoy ne menee 3 simvolov. |
| `PRODUCTS_NAME_DUPLICATE` | A product with the same name exists, case and padding ignored (@assert constraint over `namesakes`, ADR-0028 decision 2) | A product with this name already exists. Enter a different name. | Tovar s takim nazvaniem uzhe est v kataloge. Vvedite drugoe nazvanie. |
| `PRODUCTS_PRICE_POSITIVE` | Price of 0 or below (@assert.range.message, open bound, ADR-0028 decision 1); on the Object Page the client type shows the framework text first | Enter a price greater than 0. | Vvedite tsenu bolshe 0. |
| `PRODUCTS_PRICE_MINOR_UNIT` | Decimals in a currency without minor units; shown on price and currency (@assert constraint with two targets, ADR-0028 decision 3) | Enter the price as a whole number. This currency has no decimal places. | Vvedite tsenu tselym chislom. U etoy valyuty net drobnoy chasti. |
| `PRODUCTS_IMAGE_URL_HTTPS` | Image URL that is not https or contains whitespace (@assert.format.message) | Enter an address that starts with https:// and has no spaces. | Vvedite adres, kotoryy nachinaetsya s https:// i ne soderzhit probelov. |
| `PRODUCTS_DESCRIPTION_REQUIRED_IN_STOCK` | Empty description while the stock is above 0; shown on description and stock (@assert constraint with two targets, ADR-0028 decision 4) | Enter a description. Products in stock are visible to customers. | Vvedite opisanie. Tovary v nalichii vidny pokupatelyam. |
| `PRODUCTS_DESCRIPTION_EQUALS_NAME` | Description equal to the name, case and padding ignored (@assert constraint, R7, optional) | Enter a description that says more than the product name. | Vvedite opisanie, kotoroe ne prosto povtoryaet nazvanie tovara. |
| `PRODUCTS_DETAIL_VALUE_REQUIRED` | Empty value of a detail the subcategory requires (@assert constraint on the row, ADR-0028 decision 5); no placeholder, a constraint passes no arguments | Fill in this detail. It is required for products of this subcategory. | Zapolnite etu kharakteristiku. Ona obyazatelna dlya tovarov etoy podkategorii. |
| `PRODUCTS_DETAIL_TEXT_PATTERN` | Text detail that does not match the attribute's pattern (handler, R9, optional); {0} the attribute's localized description with the format hint | Enter the value as {0}. | Vvedite znachenie v formate: {0}. |

Rendered examples: R9 `en` "Enter the value as length x width x height in cm, for example 30x20x10."; the `ru` sentence ends with the `ru` description after the colon. R4 and R6 use the same text on both fields by design.

Labels (`_i18n/i18n.properties`, `#XFLD`, and `i18n_ru.properties`):

| Key | Comment | `en` | `ru` (transliteration) |
|---|---|---|---|
| `Products.namesakes` | Other products with the same name, case and padding ignored (ADR-0028 decision 2); visible in $metadata only | Products with the Same Name | Tovary s takim zhe nazvaniem |
| `SubcategoryAttributes.required` | Whether the subcategory requires a value for the attribute (ADR-0028 decision 5) | Required | Obyazatelnaya |
| `DetailAttributes.pattern` (R9 only) | Regular expression a text value must match (R9) | Value Format | Format znacheniya |

Seed text for R9 (`db/data/my.catalog-DetailAttributes.csv` and `.texts.csv`, `descr` of `DIMENSIONS`; it is the `{0}` of the message, so it must read as the end of the sentence): `en` "length x width x height in cm, for example 30x20x10"; `ru` "dlina x shirina x vysota v sm, naprimer 30x20x10" (code points per word in the glossary; the Latin `x` and the digits stay Latin).

Framework texts that appear on the screen and need no key: "Provide the missing value." (cds `ASSERT_MANDATORY`, `en` and `ru` in the cds bundle); the `Decimal` type texts for R3 (expected), decimals and non-numbers (UI5 core bundle, both locales); the footer button, popover title and filter (sap.m and sap.fe bundles). No `webapp/i18n` key is added: the marker is a label property, the messages come from `_i18n`. The global `ASSERT_FORMAT` and `ASSERT_RANGE` keys are not overridden (ADR-0028 decision 1).

Glossary of the `ru` words (one row per distinct word, no letter yo, spelled with U+0435, the convention of the project's `ru` bundles):

| Transliteration | Code points |
|---|---|
| Vvedite | U+0412 U+0432 U+0435 U+0434 U+0438 U+0442 U+0435 |
| nazvanie | U+043D U+0430 U+0437 U+0432 U+0430 U+043D U+0438 U+0435 |
| nazvaniem | U+043D U+0430 U+0437 U+0432 U+0430 U+043D U+0438 U+0435 U+043C |
| tovara | U+0442 U+043E U+0432 U+0430 U+0440 U+0430 |
| tovarov | U+0442 U+043E U+0432 U+0430 U+0440 U+043E U+0432 |
| Tovar | U+0422 U+043E U+0432 U+0430 U+0440 |
| Tovary | U+0422 U+043E U+0432 U+0430 U+0440 U+044B |
| dlinoy | U+0434 U+043B U+0438 U+043D U+043E U+0439 |
| ne | U+043D U+0435 |
| menee | U+043C U+0435 U+043D U+0435 U+0435 |
| simvolov | U+0441 U+0438 U+043C U+0432 U+043E U+043B U+043E U+0432 |
| s | U+0441 |
| takim | U+0442 U+0430 U+043A U+0438 U+043C |
| zhe | U+0436 U+0435 |
| uzhe | U+0443 U+0436 U+0435 |
| est | U+0435 U+0441 U+0442 U+044C |
| v | U+0432 |
| kataloge | U+043A U+0430 U+0442 U+0430 U+043B U+043E U+0433 U+0435 |
| drugoe | U+0434 U+0440 U+0443 U+0433 U+043E U+0435 |
| tsenu | U+0446 U+0435 U+043D U+0443 |
| bolshe | U+0431 U+043E U+043B U+044C U+0448 U+0435 |
| tselym | U+0446 U+0435 U+043B U+044B U+043C |
| chislom | U+0447 U+0438 U+0441 U+043B U+043E U+043C |
| U | U+0423 |
| etoy | U+044D U+0442 U+043E U+0439 |
| etu | U+044D U+0442 U+0443 |
| valyuty | U+0432 U+0430 U+043B U+044E U+0442 U+044B |
| net | U+043D U+0435 U+0442 |
| drobnoy | U+0434 U+0440 U+043E U+0431 U+043D U+043E U+0439 |
| chasti | U+0447 U+0430 U+0441 U+0442 U+0438 |
| adres | U+0430 U+0434 U+0440 U+0435 U+0441 |
| kotoryy | U+043A U+043E U+0442 U+043E U+0440 U+044B U+0439 |
| kotoroe | U+043A U+043E U+0442 U+043E U+0440 U+043E U+0435 |
| nachinaetsya | U+043D U+0430 U+0447 U+0438 U+043D U+0430 U+0435 U+0442 U+0441 U+044F |
| i | U+0438 |
| soderzhit | U+0441 U+043E U+0434 U+0435 U+0440 U+0436 U+0438 U+0442 |
| probelov | U+043F U+0440 U+043E U+0431 U+0435 U+043B U+043E U+0432 |
| opisanie | U+043E U+043F U+0438 U+0441 U+0430 U+043D U+0438 U+0435 |
| nalichii | U+043D U+0430 U+043B U+0438 U+0447 U+0438 U+0438 |
| vidny | U+0432 U+0438 U+0434 U+043D U+044B |
| pokupatelyam | U+043F U+043E U+043A U+0443 U+043F U+0430 U+0442 U+0435 U+043B U+044F U+043C |
| prosto | U+043F U+0440 U+043E U+0441 U+0442 U+043E |
| povtoryaet | U+043F U+043E U+0432 U+0442 U+043E U+0440 U+044F U+0435 U+0442 |
| Zapolnite | U+0417 U+0430 U+043F U+043E U+043B U+043D U+0438 U+0442 U+0435 |
| kharakteristiku | U+0445 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0443 |
| Ona | U+041E U+043D U+0430 |
| obyazatelna | U+043E U+0431 U+044F U+0437 U+0430 U+0442 U+0435 U+043B U+044C U+043D U+0430 |
| Obyazatelnaya | U+041E U+0431 U+044F U+0437 U+0430 U+0442 U+0435 U+043B U+044C U+043D U+0430 U+044F |
| dlya | U+0434 U+043B U+044F |
| podkategorii | U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438 |
| znachenie | U+0437 U+043D U+0430 U+0447 U+0435 U+043D U+0438 U+0435 |
| znacheniya | U+0437 U+043D U+0430 U+0447 U+0435 U+043D U+0438 U+044F |
| formate | U+0444 U+043E U+0440 U+043C U+0430 U+0442 U+0435 |
| Format | U+0424 U+043E U+0440 U+043C U+0430 U+0442 |
| dlina | U+0434 U+043B U+0438 U+043D U+0430 |
| shirina | U+0448 U+0438 U+0440 U+0438 U+043D U+0430 |
| vysota | U+0432 U+044B U+0441 U+043E U+0442 U+0430 |
| sm | U+0441 U+043C |
| naprimer | U+043D U+0430 U+043F U+0440 U+0438 U+043C U+0435 U+0440 |

Existing `ru` labels used by the scenarios are referenced by key (`Products.name`, `Products.description`, `Products.price`, `Products.currency`, `Products.stock` in `_i18n/i18n_ru.properties`; `ProductsObjectPage.details.title` in `webapp/i18n/i18n_ru.properties`; attribute names in `my.catalog-DetailAttributes.texts.csv`), never spelled here.

## Accessibility

Checklist of the `ui5-best-practices-accessibility` skill (topics 2 labeling, 4 focus and keyboard, 6 invisible messaging, 7 reading order apply; 1 landmarks, 3 headings, 5 shortcuts, 8 target size are unaffected by this feature):

- Labels and the required marker: the FE fields keep their framework labels with `labelFor`; a required label gives the labelled control `aria-required="true"` (UI5 `LabelEnablement`, framework), so a screen reader announces "required" for Name, Price, Currency, Stock, Category, the enabled Subcategory, and Description while Stock is above 0. In the Details form `labelFor` is set in edit mode only (ADR-0027 amendment), so `setRequired(true)` on the row label gives the input `aria-required` in edit mode and nothing in display mode, where no marker is shown either: consistent with the FE sections. Expected, verifier V15 (DOM check).
- Value state: `sap.m.InputBase` renders `aria-invalid="true"` on an Error and announces the value state text as the field's description (`aria-describedby` to the hidden value-state text) and shows it in the pop-up on focus; framework behaviour, the only custom part is the text. No custom `valueStateText` is set by the Details module for these rules (the rule of #9: never a `valueStateText` without an Error state).
- Keyboard and focus: the footer message button is in the Tab order; Enter opens the popover; arrow keys move through the entries; Enter on an entry navigates and focuses the field (framework, FE doc step 8); Esc closes. After a refused Save focus must land in the popover or stay on Save, never be lost (verifier V12).
- Invisible messaging: no custom announcement is added. A value state change on a field that is not focused is announced when the field is focused next; the two-target messages put the text on the field the user is on (Stock, Currency), which covers the dependent field without an announcement. The marker switch on Description changes `aria-required` on an unfocused field silently; the R6 message is the audible counterpart (with Q1's alternative there would be none until Save).
- Reading order: unchanged DOM order; a message on Stock about Description relies on the popover navigation, which is keyboard-reachable.
- Headings: unchanged; each section title is one H2 (measured in #9).
- Contrast and colour: the Error state is framework-rendered (red border, icon and text, not colour alone); the marker is a text character.

## Theme and tokens

Standard controls only, `sap_horizon`: the required marker, the value states, the message popover, the footer button and the Details inputs are framework-rendered. No custom CSS, no custom colour, no style class is needed or allowed; the one custom module touched (`DetailsForm.js`) sets a label property and keeps the controls it already has. Guideline reference: `mcp__ui5-mcp-server__get_guidelines` (data binding, no globals, keys in every locale; section 4 form rules already met by the existing `Form` + `ColumnLayout`).

## Verifier scenarios

Design-level scenarios for `ui-verifier`, in addition to the acceptance criteria of `PLAN.md`; each in `en` (`sap-ui-language=en`) and `ru` (`sap-ui-language=ru`) unless marked locale-neutral, user `alice`, a new isolated browser context (LESSONS 2026-10-12). "Record" means the finding goes into `VERIFICATION.md` with a screenshot and the exact text seen; a scenario marked "expected" has no MCP source and may refute this design, in which case the finding, not this file, is right and the file is reconciled in the same step.

| # | Scenario | Expected | Proof |
|---|---|---|---|
| V1 | Create a product; before typing anything, inspect the markers of General Information, Pricing & Stock and the Details hint | Name, Price, Currency, Stock, Category marked; Subcategory disabled without marker; Description, Image URL, Rating unmarked; "Select a subcategory to fill in the details." | screenshot `en` and `ru` |
| V2 | Choose Electronics and Laptops | Details rows appear; Screen Size marked, Memory (RAM) and Storage not; after Save (with valid data) and in display mode no Details label carries a marker, like the FE labels | screenshots edit and display, `en` |
| V3 | On the same draft leave Description empty, type `5` in Stock, Tab | Description marker appears at once; then Description and Stock both red with the R6 text; the popover shows one entry (two-field highlight of a two-target message, plan step 8); type a description, Tab: both clear; set Stock `0`: marker gone | screenshot both fields, `en` and `ru`; record whether one or two popover entries |
| V4 | Price `10.50`, Currency `JPY`, Tab | both red with the R4 text, one popover entry; Price `11`: both clear in one step | screenshot `en` and `ru` |
| V5 | Price `0`, Tab; then `-1`, Tab | which text appears (framework `EnterNumberMinExclusive` or project `PRODUCTS_PRICE_POSITIVE`), whether a `PATCH` is sent (network), whether Save opens the popover with it; record the `ru` text too | record and screenshot; feeds Q2 |
| V6 | Name `AB`, Tab; Image URL `http://example.com/a.png`, Tab | project texts of R1 and R5 in the `PATCH` response (network: `DraftMessages` in the batch), fields red, two entries under General Information | screenshot `en` |
| V7 | Name `backpack ` (lower case, trailing space), Tab; then `Backpack 2`, Tab; separately Edit of Backpack, retype `Backpack`, Tab, Save | R2 text after the first Tab, cleared after the second; the own name gives no message and Save succeeds | screenshot `en` and `ru` |
| V8 | Edit Laptop Pro 15, clear Screen Size, Tab; press Save | after Tab: the input red with the R8 text and a popover entry (record its group and subtitle); after Save: refused, the entry present, click it: where focus goes; whether the input carries the Error state from the activation error (plan risk) | screenshot `en` and `ru`; record |
| V9 | MULTI_LIST required detail | only if D6 gets a MULTI_LIST assignment (Q3): clear the tokens, Tab, Save: the entry is in the popover without a field highlight; otherwise write "not reachable with the seed" | record |
| V10 | New Laptop with Name, Category, Subcategory, Currency `USD`, Stock `5`, Description filled, Screen Size left untouched, Price empty; Save; then Price `10`; Save | first Save: only "Provide the missing value." on Price (the untouched R8 constraint is not reported); second Save: R8 on Screen Size; record whether the popover opens by itself after each 400 | screenshot of both rounds, `en` |
| V11 | On a draft with an R4 message press Keep Draft (shell Back), reopen the draft from the list, Edit | the fields show the message again; the list row shows the plain draft marker only | record |
| V12 | Keyboard only: Tab to the footer message button, Enter, arrows, Enter on an entry, Esc | popover opens, entry navigation focuses the field, Esc closes, focus is never lost | record, locale-neutral |
| V13 | Fix every message of V3 and V4 one by one | each fix removes its entry and red state on Tab; the footer count drops; at zero the button disappears | record |
| V14 | [R9] Monitor Stand, Edit, Dimensions `30 by 20`, Tab; Discard; Edit, `30x20x10`, Save | after Tab: field red with the R9 text including the hint, the typed text still in the field, network shows the 400 `PATCH`; Discard shows the old value; `30x20x10` is saved and shown as "30x20x10 cm" | screenshot `en` and `ru` |
| V15 | DOM: Description input with Stock `5`; Screen Size input in edit mode; Screen Size label in display mode | `aria-required="true"` on both inputs in edit mode; no asterisk and no `aria-required` in display mode; `aria-invalid="true"` on a red field | record, locale-neutral |
| V16 | Console after V1-V14 | no message that is new against the console section of the latest `VERIFICATION.md` on `main` | record |

## UX risks

1. R3 shows two different texts for one rule: the framework's client text on the Object Page (expected) and the project text in the API and the import. Notice: V5 records a text that is not in `_i18n`. If the user wants the project text on the screen, the only declarative way is to state R3 as an `@assert` constraint instead of `@assert.range` (then no `Validation.Exclusive`, no client check, the message comes with the `DraftMessages` read like R2, and the import needs a per-row pre-check): Q2.
2. Two entries on one field: a format error (in the `PATCH` response) and a constraint message (written at the same commit) can coexist on Name or Price. Notice: two popover entries with the same subtitle. Not reachable with the seed; acceptable when it occurs, both texts are true.
3. Marker timing on Description: the marker switches when Stock is committed, so with the keyboard the user sees it change on Tab, not while typing; it switches before the server message arrives, so two visual changes follow each other (marker, then red state). Notice: V3; acceptable, both are immediate.
4. A message on a field the user has not reached yet: in the create flow the R6 text appears on Description (above, possibly out of view) the moment Stock is left; the Stock field itself is red with the same text, which is why the text names the description. With Q1's alternative this risk disappears and the message moves to Save.
5. The MULTI_LIST required message cannot highlight or navigate to its field; only the label marker points to it. Mitigation if Q3 adds such an assignment: the architect checks whether `error()` can pass the attribute's localized name as `{0}` (research section 2 names `args`), so the entry at least names the field; otherwise the popover entry reads "Fill in this detail..." with no field reference.
6. The activation error of R8 may stay in the popover without a red input (plan risk): the user sees the entry, clicks it, and may not land on the field. Fallback in the plan (client validation message at commit). V8 decides.
7. A two-target message may be rendered on one field only (plan risk): then R4 and R6 look like single-field rules while editing; the texts still name both fields implicitly. V3 and V4 decide; the OPA5 cases adapt.
8. The second Save round (research P8d) surprises a user who edits a product created by the import or the API: the first Save shows only the mandatory or format errors, the second one the constraints. Notice: V10. Mitigation is documentation (this file, TESTING); no mechanism changes the cds order.
9. A message raised by a failed Save stays on the field after the user fixes the value, until the next read (measured in #8): the field may look red a moment longer than the user expects. Notice: V13 after V10.
10. The group and subtitle of a Details message in the popover are framework-derived from a custom control's position and may read "General" with an empty subtitle. Notice: V8. Acceptable; the entry still navigates when the target binds.
11. Mixed authorship of texts in one popover: the cds text "Provide the missing value.", the UI5 text for R3 and the project texts of this feature. All are imperative single sentences in both locales, so the mix is consistent; notice any `ru` text in the popover that is English (an untranslated framework key).
12. With an empty Category the disabled Subcategory is still listed as missing (#8 F1, accepted behaviour); unchanged by this feature.
13. R2 is not seen between two concurrent drafts until the first Save (plan risk); the second user gets the message at Save, not while typing.
14. A draft with errors is indistinguishable from any other draft in the List Report (the marker says "Draft" only); the user finds the errors on opening it. Standard Fiori Elements, no change proposed.
15. The Stock field turns red for a rule about Description, and Currency for a rule about Price: a user may try to "fix" Stock. The shared text names the field to fill ("Enter a description", "Enter the price as a whole number"), which is why the proposed texts lead with that action.

## Open questions for the user

- Q1 R6 timing (the question the plan names): keep the two-target message that appears on Description and Stock as soon as Stock is committed above 0 with an empty description (recommended: the showcase of an inter-field dependency, the FE document's intended form, immediate feedback with the reason), or the single-target form (D8 alternative) where only the marker follows Stock live and the message appears when Description is left empty or at Save (the conventional required-field behaviour, no message on an unvisited field, UX risks 4 and 15 disappear, the showcase loses the two-field highlight for R6; R4 keeps it).
- Q2 R3 on the Object Page: accept the framework's client text for a price of 0 (expected "Enter a number greater than 0", immediate, no request, the project text `PRODUCTS_PRICE_POSITIVE` reaches the API and the import), or require the project text on the screen, which means R3 as an `@assert` constraint instead of `@assert.range` (UX risk 1). Recommended: accept the client text; V5 records what actually appears and the plan gate confirms.
- Q3 Showcase of the popover-only case: D6 contains numeric attributes only, so no MULTI_LIST (and no TEXT or LIST) required detail is visible on the screen. Add one MULTI_LIST assignment to D6 for the showcase, for example Seating / Material (Office Chair has values; the architect confirms the seed and the journeys never save Seating with an empty Material), or leave the MULTI_LIST branch API-only (recommended if the architect cannot confirm). If added: V9 runs and UX risk 5 applies.
- Q4 Texts: approve the proposed `en` and `ru` values (table in "Texts"), in particular the action-first rewrites of R2, R4, R6, R7, R8 and the R9 hint "length x width x height in cm, for example 30x20x10".

For the architect, not a user decision: whether `error()` (research section 2, `args`) can carry the attribute's localized name into `PRODUCTS_DETAIL_VALUE_REQUIRED` as `{0}` for the MULTI_LIST branch (UX risk 5); to be measured only if Q3 adds a MULTI_LIST assignment.
