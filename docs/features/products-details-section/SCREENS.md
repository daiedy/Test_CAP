# products-details-section: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task: a `CatalogEditor` maintains the attribute values of one product inside its draft; a `CatalogViewer` reads them. Issue #9, PLAN step 1, decisions D1-D9 as recommended in `PLAN.md` (D6 confirmed below). Date: 2026-10-11.

Language rule: `ru` values are given as Latin transliteration plus `U+XXXX` code points (invariant 10; the bundles hold the plain words, OPA5 `data/` files hold backslash-u escapes as `data/SubcategoryTexts.js` does).

## Floorplan and duplication check

- Floorplan: the existing List Report + Object Page of `CatalogService.Products` (`docs/registry/UI-ARTIFACTS.md`: pages `ProductsList`, `ProductsObjectPage`, three `UI.Facets` `GeneralInfo`, `PricingStock`, `AdminData`, side effect `#CategoryChanged`, one fragment `RatingRangeFilter`). No new application, page, route, fragment, controller extension or `manifest.json` change: the feature is one new `UI.ReferenceFacet` on `Products` plus the presentation annotations of the child `ProductDetails`. Nothing in the registry shows `ProductDetails`, a table section or a composition yet, so nothing is duplicated.
- Not freestyle: a to-many composition edited inside a draft is exactly the Fiori Elements Object Page table section (inline creation, Create and Delete in the toolbar, draft messages on rows); every alternative (field group, custom section) was rejected in ADR-0026.
- Position (D6 confirmed): `GeneralInfo`, `PricingStock`, **`Details`**, `AdminData`. The Object Page guideline orders sections by relevance to the user's task and keeps technical data last; the attribute values describe the product (relevance next to the general and pricing forms), while "Administrative Data" (created/modified) is audit data and stays the last anchor. Guideline: Object Page, https://experience.sap.com/fiori-design-web/object-page/ (stable URL; not re-verified in this session, see the sources table).
- Out of scope, separate screens if ever wanted (ADR-0026 follow-ups): maintenance of `DetailAttributes` and `SubcategoryAttributes` (today CSV only), details in the Excel import, a List Report column or filter on details.

### Sources used for this design

`mcp__fiori-mcp__search_docs` answered every query of this session with "Search is currently unavailable. The embeddings service failed to initialize" (five queries, one retry; same outage the architect hit). Rows marked "architect, MCP" quote the fiori-mcp documents the architect fetched before the outage (`research/framework-facts.md` section 1); rows marked "not verified by MCP" are expected behaviour handed to `ui-verifier`.

| Topic | Source | Status |
|---|---|---|
| Inline creation is the default creation mode of an Object Page table in OData V4; Create and Delete appear only in edit mode; `Common.SideEffects` with `TargetEntities: [ details ]` refreshes the table | fiori-mcp "Create Mode Options for Object Page", "Enabling Inline Creation Mode and Empty Row Mode for Table Entries", "Generic Action Buttons in Object Page Tables", "Side Effects" | architect, MCP |
| The In parameter `product/subcategory_code` is read late from the row context; a draft row's `product` is the draft parent | `research/framework-facts.md` section 2 (CDN `ValueHelpDelegate-dbg.js` 1.153.0) and section 4 | not verified by MCP; measured on the API |
| Draft messages: written on a `PATCH`, not on the row `POST`; shown on the child and the root; messages of a failed Save stay until the element is touched or Save succeeds | `research/framework-facts.md` section 4 (cds 10.1.1 scratch matrix) | measured |
| Column pop-in order on narrow screens (`High` moved last, `None` second, `Low` first) | `mcp__ui5-mcp-server__get_api_reference` `sap.m.Table#autoPopinMode`, `sap.m.Column#importance` | verified this session |
| Message popover behaviour and guideline URL https://experience.sap.com/fiori-design-web/message-popover/ | `get_api_reference sap.m.MessagePopover` (`references` field) | verified this session |
| Section title heading level: `titleLevel` `Auto`, rendered as `aria-level` | `get_api_reference sap.uxap.ObjectPageSectionBase#titleLevel` | verified this session |
| Responsive table and combo box guidelines, https://experience.sap.com/fiori-design-web/responsive-table/ and https://experience.sap.com/fiori-design-web/combo-box/ | stable guideline URLs (the combo box URL was read from the `sap.m.ComboBox` API `references` on 2026-10-09) | not re-verified this session |
| Accessibility checklist | skill `ui5-best-practices-accessibility` on disk (SKILL.md topics 2, 3, 4, 6, 7, 8) | read this session |
| Coding guidelines (binding, all locales, no globals, no inline CSS) | `mcp__ui5-mcp-server__get_guidelines` | verified this session |
| `sap.fe.macros.Table` API | `get_api_reference` resolves this project against OpenUI5 1.136.5, which has no `sap.fe`; no API text available | not available |

## Screen: Products Object Page, section "Details"

- Title and subtitle: the page header is unchanged (`UI.HeaderInfo` of `Products`). The section anchor reads "Details" (`Products.facet.details`); the table header reads "Details (n)" with the live row count, from `UI.HeaderInfo.TypeNamePlural` of `ProductDetails` (`ProductDetails.typeNamePlural`). Rule for `fiori-app-dev`: the facet `Label` and `TypeNamePlural` are the same word in both locales, so the user sees one title whichever the framework renders (which one is rendered, and that it is rendered once, is verifier scenario 1). No subtitle. The count comes with the table header by default (responsive table guideline: show the item count in the title); nothing to annotate.
- Filters: none. An Object Page table has no filter bar; the framework's table personalization (Settings) is left at its default.
- Table columns in order of importance (three, all from `UI.LineItem` of `ProductDetails`):

  | # | Column | Annotation | Display mode | Edit mode | Importance |
  |---|---|---|---|---|---|
  | 1 | Attribute | `attribute_code` with `Common.Text: attribute.name`, `#TextOnly`, `ValueListWithFixedValues`, the hand-written `Common.ValueList` (ADR-0026 decision 4) | localized attribute name, never the code | dropdown (combo box, fixed values) of the attributes assigned to the product's subcategory, names only; mandatory | `![@UI.Importance]: #High` (the row's identity, moved to the pop-in last) |
  | 2 | Value | `value` (`String(100)`) | text as typed | input, mandatory (D4) | default |
  | 3 | Unit | `attribute.unit` (`String(10)` through the association) | unit symbol of the chosen attribute (`GB`, `kg`, `in`), empty when the attribute has none | read-only text; fills after the attribute is chosen (`Common.SideEffects #AttributeChanged`) | default |

  Widths are not set by hand: the framework derives them from the types (the Value column is the widest, Unit the narrowest). No `Common.SemanticKey` on `ProductDetails` (no draft marker per row and no link-like `ObjectIdentifier` in the cells; the product's own marker in the List Report is enough). No row navigation: there is no route for `ProductDetails`, so rows render without a chevron.
- Actions and their placement:
  - Table toolbar, edit mode only (framework standard, no annotation, no project text): **Create** adds one empty inline row at the top of the table and moves the focus into its Attribute cell; the row exists in the draft from that moment (child `POST`). **Delete** is enabled once at least one row is selected and removes the selected rows (framework confirmation dialog, framework text). Multi-selection checkboxes appear in edit mode only; in display mode there is no selection column (expected framework behaviour, scenario 2 and 8 record it).
  - Table toolbar, both modes: whatever the framework shows by default (table Settings, possibly Export). Keep the defaults: removing them is a `manifest.json` `controlConfiguration` change through Fiori MCP, which this plan excludes (acceptance criterion "no `manifest.json` diff"). Scenario 8 lists the buttons that are present.
  - Page header: unchanged. Edit, Delete and Create of the product keep their ADR-0013 visibility (`UI.UpdateHidden` etc.), so a viewer never reaches edit mode and never sees Create or Delete of the table.
  - Row: no inline actions, no `DataFieldForAction`.
  - Footer: the standard Save / Cancel of the draft and the message button when messages exist.
- Object Page sections: `GeneralInfo` (form), `PricingStock` (form), `Details` (this table, `UI.ReferenceFacet` `ID: 'Details'`, `Target: 'details/@UI.LineItem'`), `AdminData` (form). One subsection per section as today.
- Empty state and errors:
  - Empty table, display mode (8 of the 15 seeded products, D7): the framework's no-data text of an Object Page table (expected "No items available." in `en`, the framework's `ru` translation in `ru`; the exact strings are recorded by scenario 1, no project key). Nothing else: no illustration, no custom text (a custom no-data text is not expressible by annotation in FE V4 and would need a manifest change).
  - Empty table, edit mode: the same text; the call to action is the Create button directly above it. No hint text is added.
  - Product without a subcategory yet (D5; only a product being created, because ADR-0025 makes the subcategory mandatory): Create works, the Attribute dropdown lists all 20 attributes (the In parameter is empty, so the value help is unfiltered), the server checks the rows at Save. As soon as a subcategory is chosen, `Common.SideEffects #SubcategoryChanged` re-reads the rows and the next dropdown opens narrowed; a row that does not fit the chosen subcategory triggers the D1 message on the Subcategory field at once (measured, research section 4 last row).
  - Message placement and what the user does next (all messages are server messages from `_i18n/messages*`; FE V4 shows draft messages on the field or cell they target and in the message popover of the footer button; a failed Save opens the popover):

    | Situation | Where it appears, when | Next step for the user |
    |---|---|---|
    | D1: the subcategory of a product with rows changes to one where some rows do not fit (Laptop Pro 15 to Mice) | `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` on the **Subcategory field** (error state and text) as soon as the dropdown value changes (draft `PATCH` of the root writes it; the `alwaysFetchMessages` side effect brings it), and as one entry in the message popover. The rows stay unchanged and unmarked at this point | Delete the rows that do not fit (select, Delete), or change their attribute (the dropdown is already narrowed to the new subcategory after the `#SubcategoryChanged` re-read), or set the subcategory back |
    | D1, Save pressed anyway | 400 `MULTIPLE_ERRORS`: the popover lists the Subcategory message plus one `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED` per row that does not fit; each such row's Attribute cell gets the error state (targets end in `/attribute_code`); pressing a message title moves the focus to that cell | As above. Measured: the per-row messages stay on the rows until the row is touched or Save succeeds, and the Subcategory message stays until the field is touched; Save re-validates everything, so a Save after the fix succeeds despite a stale message (known behaviour, #8 F1, not a defect; scenario 5 records it) |
    | D2: a row gets an attribute another row of the product already has | `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` on the **Attribute cell of the row just changed**, right after the choice (the choice is a draft `PATCH`), and in the popover; at Save the popover names both rows | Choose another attribute or delete the row. The dropdown does not hide attributes that are already used (see UX risks) |
    | Membership rule on a row (`PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`) outside D1 | Only reachable through the API or the D5 flow: a foreign attribute chosen while the subcategory was empty gives no message at the choice (the guard is null-safe); the message comes on the Subcategory field when the subcategory is chosen, and on the row at Save | Change the row's attribute (narrowed dropdown) or delete it |
    | Empty inline row left behind (Create pressed, nothing chosen) | At Save: `ASSERT_MANDATORY` on the row's Attribute and Value cells (two popover entries per empty row, framework texts) | Fill the row or select and delete it. The "Create twice" case is a UX risk below |
    | Unknown value typed into the Attribute combo box | Client-side value state of the combo box (framework text), nothing is sent | Pick an entry from the list |

  - Side effects that keep the screen consistent (annotations only, no handler): `#AttributeChanged` on `ProductDetails` (`SourceProperties: [ attribute_code ]`, `TargetProperties: [ 'attribute/name', 'attribute/unit' ]`) fills the Attribute text and the Unit cell after the choice; `#SubcategoryChanged` on `Products` (`SourceProperties: [ subcategory_code ]`, `TargetEntities: [ details ]`) and `details` added to `#CategoryChanged` re-read the rows so the next dropdown open uses the current subcategory (a category change first empties the subcategory, ADR-0024, and the D1 message appears when the new subcategory is chosen).
- Criticality and statuses: none. Errors are conveyed by the field and cell value states and the message popover; no status column, no `UI.Criticality`.
- What is shown instead of a UUID (`TextArrangement`): the row key `ID` is never shown (not in `UI.LineItem`, no `HeaderInfo.Title` needed). `attribute_code` shows `attribute.name` only (`Common.TextArrangement: #TextOnly`), in the cell and in the dropdown (`SubcategoryAttributes.attribute` gets `Common.Text: attributeName #TextOnly`, `DetailAttributes.code` gets `Common.Text: name #TextOnly`, ADR-0011 rule for own code lists). `product` is not a column.

## Texts

Bundles: labels in `_i18n/i18n.properties` and `_i18n/i18n_ru.properties`, messages in `_i18n/messages.properties` and `_i18n/messages_ru.properties` (CONVENTIONS; nothing goes to `webapp/i18n`, because every text is a CDS label or a server message). Framework texts that need no key: Create, Delete, the delete confirmation, the no-data text, the mandatory message `ASSERT_MANDATORY`, the combo box value states, Save / Cancel / Discard Draft (rule `i18n.md`).

Code points of the `ru` words (no letter yo, U+0451: the existing `ru` bundles and CSVs do not use it, checked):

| Transliteration | Code points |
|---|---|
| Kharakteristiki | U+0425 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0438 |
| Kharakteristika | U+0425 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0430 |
| kharakteristiki (lower case, inside a phrase) | U+0445 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0438 |
| kharakteristikoy | U+0445 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+043E U+0439 |
| Znachenie | U+0417 U+043D U+0430 U+0447 U+0435 U+043D U+0438 U+0435 |
| Nazvanie | U+041D U+0430 U+0437 U+0432 U+0430 U+043D U+0438 U+0435 |
| Opisanie | U+041E U+043F U+0438 U+0441 U+0430 U+043D U+0438 U+0435 |
| Edinitsa | U+0415 U+0434 U+0438 U+043D U+0438 U+0446 U+0430 |
| izmereniya | U+0438 U+0437 U+043C U+0435 U+0440 U+0435 U+043D U+0438 U+044F |
| nedostupna | U+043D U+0435 U+0434 U+043E U+0441 U+0442 U+0443 U+043F U+043D U+0430 |
| dlya | U+0434 U+043B U+044F |
| podkategorii | U+043F U+043E U+0434 U+043A U+0430 U+0442 U+0435 U+0433 U+043E U+0440 U+0438 U+0438 |
| tovara | U+0442 U+043E U+0432 U+0430 U+0440 U+0430 |
| U (one letter) | U+0423 |
| uzhe | U+0443 U+0436 U+0435 |
| est | U+0435 U+0441 U+0442 U+044C |
| stroka | U+0441 U+0442 U+0440 U+043E U+043A U+0430 |
| s (one letter) | U+0441 |
| etoy | U+044D U+0442 U+043E U+0439 |
| Nekotorye | U+041D U+0435 U+043A U+043E U+0442 U+043E U+0440 U+044B U+0435 |
| ne | U+043D U+0435 |
| sootvetstvuyut | U+0441 U+043E U+043E U+0442 U+0432 U+0435 U+0442 U+0441 U+0442 U+0432 U+0443 U+044E U+0442 |
| novoy | U+043D U+043E U+0432 U+043E U+0439 |
| Udalite | U+0423 U+0434 U+0430 U+043B U+0438 U+0442 U+0435 |
| ili | U+0438 U+043B U+0438 |
| izmenite | U+0438 U+0437 U+043C U+0435 U+043D U+0438 U+0442 U+0435 |
| ikh | U+0438 U+0445 |
| pered | U+043F U+0435 U+0440 U+0435 U+0434 |
| sokhraneniem | U+0441 U+043E U+0445 U+0440 U+0430 U+043D U+0435 U+043D U+0438 U+0435 U+043C |
| Obyem | U+041E U+0431 U+044A U+0435 U+043C |
| Vremya | U+0412 U+0440 U+0435 U+043C U+044F |
| avtonomnoy | U+0430 U+0432 U+0442 U+043E U+043D U+043E U+043C U+043D U+043E U+0439 |
| raboty | U+0440 U+0430 U+0431 U+043E U+0442 U+044B |
| Moshchnost (PLAN D7, asserted by OPA5) | U+041C U+043E U+0449 U+043D U+043E U+0441 U+0442 U+044C |
| Tsvet | U+0426 U+0432 U+0435 U+0442 |
| Detali (D6 alternative, not recommended) | U+0414 U+0435 U+0442 U+0430 U+043B U+0438 |

Labels (`_i18n/i18n*.properties`; comment type `#XFLD`, `#XTIT` for the type names and the facet):

| Key | `en` | `ru` (transliteration; code points above) | Note |
|---|---|---|---|
| `Products.details` | Details | Kharakteristiki | `@title` of the composition in `srv/annotations/Products.cds`; not visible on the screen |
| `Products.facet.details` | Details | Kharakteristiki | facet `Label`; must equal `ProductDetails.typeNamePlural` |
| `ProductDetails.typeName` | Detail | Kharakteristika | `UI.HeaderInfo.TypeName` |
| `ProductDetails.typeNamePlural` | Details | Kharakteristiki | `UI.HeaderInfo.TypeNamePlural`, the table header |
| `ProductDetails.product` | Product | Tovar (the existing `Products.typeName` `ru` value) | backlink, not shown |
| `ProductDetails.attribute` | Attribute | Kharakteristika | column 1 header |
| `ProductDetails.value` | Value | Znachenie | column 2 header |
| `DetailAttributes.code` | Attribute | Kharakteristika | key of the code list |
| `DetailAttributes.name` | Attribute Name | Nazvanie kharakteristiki | |
| `DetailAttributes.descr` | Attribute Description | Opisanie kharakteristiki | |
| `DetailAttributes.unit` | Unit | Edinitsa izmereniya | column 3 header (the `attribute.unit` column takes the element's `@title`; without this key the header shows the technical name) |
| `SubcategoryAttributes.subcategory` | Subcategory | the existing `Products.subcategory` `ru` value | |
| `SubcategoryAttributes.attribute` | Attribute | Kharakteristika | |
| `SubcategoryAttributes.attributeName` | Attribute Name | Nazvanie kharakteristiki | dropdown display text |

D6 wording: **keep "Kharakteristiki"**. It is the heading every Russian product catalogue uses for an attribute-value table; "Detali" is a false friend (it means machine parts or components in a catalogue context). "Kharakteristika" for the column header and `typeName` follows.

Messages (`_i18n/messages*.properties`, `#XMSG`):

| Key | `en` | `ru` (transliteration) |
|---|---|---|
| `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED` | The attribute is not available for the subcategory of the product. | Kharakteristika nedostupna dlya podkategorii tovara. (as PLAN; asserted by the backend `ru` test) |
| `PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE` | The product already has a row for this attribute. | U tovara uzhe est stroka s etoy kharakteristikoy. (as PLAN) |
| `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` | Some detail rows do not fit the new subcategory. Delete or change them before saving. | Nekotorye kharakteristiki ne sootvetstvuyut novoy podkategorii. Udalite ili izmenite ikh pered sokhraneniem. (**refined**: "ne sootvetstvuyut" instead of PLAN's "ne podkhodyat", the usual wording for "do not match" in a UI message; open question 2) |

D7 attribute names (`db/data/my.catalog-DetailAttributes.texts.csv`): the PLAN D7 transliterations stand, with two refinements:

| `code` | `ru` as in PLAN | Proposal |
|---|---|---|
| `CAPACITY` | Obyom | Obyem, spelled with U+0435 (no yo, like every other `ru` text of the project): U+041E U+0431 U+044A U+0435 U+043C |
| `BATTERY_LIFE` | Vremya raboty ot batarei | Vremya avtonomnoy raboty (the term Russian electronics catalogues use for mice, speakers and laptops): U+0412 U+0440 U+0435 U+043C U+044F, space, U+0430 U+0432 U+0442 U+043E U+043D U+043E U+043C U+043D U+043E U+0439, space, U+0440 U+0430 U+0431 U+043E U+0442 U+044B |
| all others | as PLAN D7 | no change; `POWER` = Moshchnost and `RAM` = Operativnaya pamyat keep the code points PLAN gives, because OPA5 and the backend test assert them |

Units are not localized (`unit : String(10)`, user decision 2): `GB`, `kg`, `cm`, `l`, `h`, `W`, `in`, `lm`, `mm`, `dpi` show the same in `ru`. Confirmed at the plan gate (2026-10-11, questions 4 and 5): units stay Latin and the inch unit is `in`.

## Accessibility

Checklist of `ui5-best-practices-accessibility` applied to a Fiori Elements table section. Everything below is produced by the framework from the annotations; the list names what `ui-verifier` confirms in the DOM, and the two things `fiori-app-dev` must not do.

- Landmarks (topic 1): the Object Page and its sections carry the framework landmarks; nothing to add.
- Labeling (topic 2): the column headers come from `@title` of `ProductDetails.attribute`, `ProductDetails.value` and `DetailAttributes.unit`, so every cell control (combo box, input, text) is labelled by a real word through the table's column-header association; the required state of Attribute and Value is exposed from `Common.FieldControl` Mandatory. The table is labelled by its own header ("Details (n)"). Rule: no `Label` in the `UI.LineItem` records (the `@title` is the label; a `Label` only if a key were missing), and all three keys exist in both bundles before the first `cds compile`.
- Heading levels (topic 3): the new section title gets the same level as the three existing sections (`sap.uxap` `titleLevel: Auto`, rendered as `aria-level`), and the table header is one level below it. Verifier: read the `aria-level` of the "Details" section title and the heading tag of the table header; no level skipped between the page title, the section and the table header. Nothing to configure.
- Focus and keyboard (topic 4): F6 / Shift+F6 moves between sections (each `ObjectPageSection` is an F6 group); Tab reaches the table toolbar and its Create button; Enter or Space on Create adds the row and moves the focus into the new row's Attribute cell; F4 or Alt+Down opens the dropdown, Arrow keys and Enter choose, typing a prefix filters; Tab moves to Value; Space on a row selects it for Delete. Verifier scenario 10 walks this path without the mouse. No `tabindex`, no `initialFocus` to set.
- Keyboard shortcuts (topic 5): the framework's Save and Cancel shortcuts of the draft apply; no custom action, nothing to add.
- Invisible messaging (topic 6): nothing custom; the message popover and the value states are the framework's channel for errors. Verifier: after a failed Save the popover opens by itself and its message titles are active (Enter moves the focus to the cell or field the message targets, the message-popover guideline's navigation).
- Reading order (topic 7): DOM order equals the visual order (Attribute, Value, Unit; toolbar before rows); on narrow screens the pop-in lists Value and Unit under Attribute in the same order with their labels.
- Target size (topic 8): no `Link`, `ObjectIdentifier` or `ObjectMarker` in the rows, because `ProductDetails` gets **no `Common.SemanticKey`** and no navigation; the only interactive elements are the standard-sized toolbar buttons, checkboxes and cell inputs.

## Theme and tokens

Standard controls only, rendered by Fiori Elements from annotations: `sap.fe.macros.Table` (responsive `sap.m.Table` inside `sap.ui.mdc.Table`), `sap.m.ComboBox` for the fixed-value dropdown, `sap.m.Input` for the value, `sap.m.Text` for display cells, `sap.m.MessagePopover` and the table message strip for errors. Theme `sap_horizon` as the whole app; the error value states use the theme's semantic colours; no custom CSS, no colours, no icon, no fragment, no `Component.js` change (the `get_guidelines` rules apply by construction: no XML or JS is written in this feature).

## Verifier scenarios

Users: `alice` (CatalogEditor) and `viewer` (CatalogViewer) from `package.json`; `ru` through `sap-ui-language=ru` on the FLP sandbox URL. Record each as evidence in `VERIFICATION.md` (screenshot plus the quoted rendered text, Cyrillic allowed there). Leave no draft; end with 15 products and the seeded rows.

1. Display, `alice`, `en`: open Laptop Pro 15. Anchor bar order General Information, Pricing & Stock, Details, Administrative Data. Section "Details" shows a table titled "Details (3)" (record whether the title is rendered once or twice and which text it is), columns Attribute, Value, Unit in this order, rows "Screen Size | 15 | in", "Memory (RAM) | 16 | GB", "Storage | 512 | GB"; no attribute codes, no row chevron, no selection checkboxes, no Create or Delete in the toolbar (display mode); list the toolbar buttons present. Open a product without rows (8 of 15) and quote the no-data text.
2. Inline Create, `alice`, `en`: Wireless Mouse, Edit. Toolbar shows Create and Delete (Delete disabled). Create: an empty row appears at the top with the focus in its Attribute cell; the Attribute and Value headers show the required marker if the framework renders one (record either way). Open the Attribute dropdown: exactly Battery Life, Connectivity, Sensor Resolution, names only. Record the `$batch` of the open: the late read `GET .../details(...)?$expand=product($select=subcategory_code)` (or equivalent) and `GET SubcategoryAttributes?$filter=subcategory_code eq 'MICE'`. Choose Battery Life: the Unit cell shows "h" after the `#AttributeChanged` read (record the `GET` with `attribute/name` and `attribute/unit`). Type 12 in Value. Save: display mode shows three rows including "Battery Life | 12 | h", the title reads "Details (3)", the List Report shows no draft marker.
3. Delete and restore, `alice`, `en`: Wireless Mouse, Edit, select the Battery Life row (checkbox), Delete (quote the confirmation dialog), Save: the two seeded rows, "Details (2)". Fallback if the Delete key is tried: record whether the framework deletes a selected row on Delete.
4. Duplicate (D2), `alice`, `en`: Wireless Mouse, Edit, Create, choose Connectivity (already present). Expect the new row's Attribute cell in the error state with "The product already has a row for this attribute." and the footer message button showing 1 (record if the message only appears at Save instead). Save: blocked; the popover lists both rows. Cancel, Discard Draft; the two seeded rows remain.
5. Subcategory change (D1), `alice`, `en`: Laptop Pro 15, Edit, change Subcategory to Mice. At once: the Subcategory field shows the error state with "Some detail rows do not fit the new subcategory. Delete or change them before saving.", the message button shows 1, the three rows are unchanged. Open the Attribute dropdown of a seeded row: narrowed to Battery Life, Connectivity, Sensor Resolution (proves the `#SubcategoryChanged` re-read; record the `$batch`). Save: fails; the popover lists the Subcategory message plus three "The attribute is not available for the subcategory of the product."; the three Attribute cells show the error state; press one message title: the focus lands on that row's Attribute cell. Delete path: select the three rows, Delete; Save becomes possible (do not press it; Cancel, Discard Draft). Restore path: Edit again, Subcategory Mice, Save fails as before, set Subcategory back to Laptops, Save: succeeds with the three seeded rows intact; record that the per-row messages stayed visible until Save (known behaviour) and whether the Subcategory message cleared when the field was touched.
6. New product (D5), `alice`, `en`: List Report, Create. The Details section is empty with the no-data text; Create a row before choosing a category: the dropdown lists all 20 attributes; choose Colour, value Red. Fill name, price, currency, stock, Category Electronics, Subcategory Laptops: the Subcategory field shows the D1 message at once (Colour is not assigned to Laptops). Open the row's dropdown: narrowed to Screen Size, Memory (RAM), Storage. Change the row to Screen Size, value 14. Save: succeeds (record whether the stale Subcategory message was still shown before Save). Delete the product from its header Delete; the List Report shows 15 rows.
7. Russian, `alice`, `ru`: Coffee Maker. Section title Kharakteristiki (U+0425 U+0430 U+0440 U+0430 U+043A U+0442 U+0435 U+0440 U+0438 U+0441 U+0442 U+0438 U+043A U+0438), columns Kharakteristika, Znachenie, Edinitsa izmereniya, rows Moshchnost | 900 | W and Obyem | 1.2 | l (units stay Latin). Edit, Create, open the dropdown: Tsvet listed in Russian next to the two used attributes; Cancel, Discard Draft. Then Laptop Pro 15, Edit, Subcategory to Mice (the `ru` name of Mice): quote the Russian D1 message on the field; Cancel, Discard Draft.
8. Viewer, `viewer`, `en`: Laptop Pro 15. The Details section with the three rows in display mode; no Edit in the header, no Create or Delete in the table toolbar, no selection column; list the toolbar buttons that remain (Settings, Export if present). `ru` once for the section title.
9. Console: compare the browser console of scenarios 1-8 with the console section of `docs/features/products-subcategory-cascade/VERIFICATION.md` at `5ab8b02`; no new message; name the known noise, do not forbid substrings.
10. Keyboard and headings, `alice`, `en`: on Wireless Mouse in edit mode reach Create with Tab only, press Enter, confirm the focus is in the new row's Attribute cell, F4 opens the list, Arrow Down and Enter choose Battery Life, Tab reaches Value; Escape or Cancel and Discard Draft. Read the `aria-level` of the Details section title and the heading level of the table header from the DOM. In scenario 5, open the message popover with the keyboard and press Enter on a row message: the focus moves to the row cell.

## UX risks

- The dropdown is not narrowed (lists all 20 attributes on a product with a subcategory): the navigation-path In parameter is source-read in UI5 1.153.0 but not yet measured in a browser (PLAN risk 1). Detection: scenario 2. Fallback is the architect's (ADR-0026 alternatives), not a UI workaround.
- Title rendered twice ("Details" as subsection title and "Details (3)" as table header) or the count missing: scenario 1 records it; if doubled, `fiori-app-dev` checks the facet before touching anything else (the framework hides a subsection title that equals its single table's header in the usual configuration).
- Empty rows block Save: Create pressed twice (or a row abandoned) leaves an empty row that fails `ASSERT_MANDATORY` at Save with two messages per row; the user must find and delete it. The FE V4 mode `InlineCreationRows` (empty rows are not persisted until typed) would avoid it but is a `manifest.json` change through Fiori MCP, out of this plan; a follow-up issue if the behaviour annoys in practice.
- Stale messages after a failed Save stay on the rows until touched or saved (measured on the API, #8 F1 in the UI): the user may see error marks on rows that are already fine after the subcategory was set back. Known behaviour, recorded, not a defect.
- The dropdown offers attributes the product already has; the duplicate is reported right after the choice, not prevented. Acceptable for three attributes per subcategory; a filtered value help would need a second mechanism (review error).
- One extra request per dropdown open (the late read of `product/subcategory_code`): on a slow connection the list opens with a short delay and the busy indicator; after a subcategory or category change the rows are re-read, which is the price of a fresh In value.
- Units are not localized (confirmed, question 4) and the inch unit is `in` (question 5, 2026-10-11): no lone quotation mark in the Unit column and no CSV quoting; the bare-quote trap of research section 7 goes to LESSONS as a measured fact.
- Narrow screens: Value and Unit move to the pop-in under Attribute (`High` stays), so the unit is separated from the value by its label. Acceptable; the row stays readable because the labels are shown.
- The Unit column header falls back to the technical name `unit` if `DetailAttributes.unit` is missing from a bundle; the Texts table lists it in both locales.
- The toolbar carries framework defaults (Settings, possibly Export) that are of little use on a three-row table; kept to avoid a manifest change (open question 6).
- Mock mode (`npm run start-mock`) needs the four new JSON files and does not serve `ru`; not a gate.

## Open questions for the user

None open. Answered by the user at the plan gate on 2026-10-11 (recorded in `PLAN.md` "Decisions for the user" and `CONTEXT.md` "User decisions"):

1. D6 confirmed: `ru` "Kharakteristiki" for the section and table title, "Kharakteristika" for `TypeName` and the Attribute column.
2. Accepted: `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS` `ru` with "ne sootvetstvuyut novoy podkategorii".
3. Accepted: `BATTERY_LIFE` "Vremya avtonomnoy raboty", `CAPACITY` "Obyem" with U+0435; `POWER` and `RAM` unchanged.
4. Units stay Latin and are not localized.
5. The inch unit of `SCREEN_SIZE` is `in` (the asserted values read "15 in"; no CSV quoting).
6. The framework toolbar defaults stay; no `manifest.json` change.
7. `![@UI.Importance]: #High` on the Attribute column only, accepted (phase 3 EDMX expected 1274, the gate quotes the fresh count).
