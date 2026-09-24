# products-rating-column: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task.

Date: 2026-09-25. Issue #5. The design follows the architect's recommended defaults in `CONTEXT.md` "Open questions" (Integer 0..5, editor sets the rating on the Object Page through drafts, annotation column, no draft configuration change). What changes under the alternatives is listed only in "UX risks" and "Open questions for the user". The user task is one: see a product's rating in the list and set it on the product's page; the two pages are the existing List Report and Object Page of `Products`, so this file has one "Screen" section covering the column and the form field. A filter on the rating is a separate task (issue #6 `products-rating-filter`) and is out of scope here.

## Floorplan and duplication check

Floorplan: the existing List Report + Object Page of `Products` (`sap.fe.templates.ListReport` / `ObjectPage`, OData V4). Guideline: List Report floorplan, https://experience.sap.com/fiori-design-web/list-report-floorplan-sap-fiori-element/ (URL returned by `mcp__fiori-mcp__search_docs`, document "List Report Page"). Control guideline: Rating Indicator, https://experience.sap.com/fiori-design-web/rating-indicator/ (URL from the `references` of the `sap.m.RatingIndicator` API reference, UI5 1.136.5 via `mcp__ui5-mcp-server__get_api_reference`). No freestyle UI5: the column and the form field are annotation-driven, Fiori Elements renders the control.

Sources per decision (the reviewer expects a source for every non-standard choice; rows marked "expected" have no MCP document and are handed to `ui-verifier`):

| Decision | Source |
|---|---|
| Column shape: `UI.DataPoint #Rating` (`Value: rating`, `TargetValue: 5`, `Visualization: #Rating`) referenced by a `UI.DataFieldForAnnotation` with an explicit `Label`; `TargetValue` is the number of stars; decimals are rounded, x.25 to x.74 shows a half star | Fiori MCP "Add a Read-Only Rating Indicator (Stars) to a Fiori Elements Table"; "Rating Column - Add, Move, and Delete (Fiori Tools)" (the Page Editor creates exactly `Value`, `TargetValue: 5`, `Visualization: Rating`; column properties available afterwards: Label, Importance, Hidden, Target Value, Tooltip Source) |
| The same record in a `UI.FieldGroup` renders the rating through the Field building block | Fiori MCP "Rating Indicator" (Field building block, OData V4) |
| No header facet: a rating DataPoint in the Object Page header stays read-only in edit mode | Fiori MCP "Rating Indicator Facet for Fiori Elements Object Page Header", step 6 |
| Interactive stars in the Object Page edit form for the `FieldGroup` record | `CONTEXT.md` rendering facts (CDN 1.152.0 sources read by the architect; not covered by the MCP snapshot) |
| Responsiveness: `UI.Importance` High shows on phone, High or Medium on tablet, all on desktop; a new column has no importance by default | Fiori MCP "Responsiveness Options: Importance-Based Rendering"; "Table Columns - Add, Configure, and Annotation Behavior", step 4 (Importance defaults to None) |
| Pop-in order of the responsive table: Low moves to the pop-in first, Medium or None second, High last | UI5 API `sap.m.Table#autoPopinMode`, `sap.m.Column#importance` (1.136.5) |
| Control facts: `editable=false` keeps the control focusable and in the tab chain but not interactive; `displayOnly=true` removes it from the tab chain; `maxValue` default 5; `value` float default 0, `setValue(null)` resets to the default; `visualMode` default Half, half values cannot be selected by the user; `ariaLabelledBy` / `ariaDescribedBy` associations; implements `sap.ui.core.IFormContent`; XS icon size not recommended for an editable indicator (minimum touch size) | UI5 API `sap.m.RatingIndicator` (1.136.5) |
| Keyboard and ARIA of the stars (arrow keys change the value, slider-like value announcement) | Expected from the control; no document in the Fiori MCP snapshot (query "rating indicator keyboard ... accessibility" returned only the three rating documents above); verified by scenarios C and D |
| Accessibility checklist | `ui5-best-practices-accessibility` skill, eight topics |

Duplication check against `docs/registry/UI-ARTIFACTS.md` (generated 2026-09-23) and `app/products/annotations/Products.cds`:

- Pages: `ProductsList` (List Report, `/Products`, `variantManagement="Page"`, `initialLoad=true`) and `ProductsObjectPage` (`editableHeaderContent=false`). Both are reused; no new page, no new route.
- Extensions and fragments: none. This feature adds none (annotation way); `manifest.json` stays byte-unchanged.
- `UI.LineItem` today: `name`, `category_code`, `price`, `stock` (4 columns). `UI.SelectionFields`: `name`, `category_code`, `price` (3 of the 5 allowed). `UI.HeaderInfo`: Title `name`, Description `category_code`, ImageUrl `imageUrl`. `UI.Facets`: GeneralInfo, PricingStock, AdminData. `UI.FieldGroup #GeneralInfo`: `name`, `description`, `category_code`, `imageUrl`. No `UI.HeaderFacets`, no `UI.DataPoint` anywhere in the app. `Common.SemanticKey: [ name ]` renders the draft/lock marker (ADR-0015). `UI.CreateHidden` / `UpdateHidden` / `DeleteHidden` follow `Permissions/isEditor` (ADR-0013).
- Nothing in the app shows a rating; `UI.DataPoint #Rating` is the first DataPoint of the app. Reused: the single `annotate CatalogService.Products with @( ... )` block, the `GeneralInfo` field group, the `_i18n` key convention `Products.<element>`, the draft edit flow, the framework texts of the control. Nothing is written for the stars themselves: no fragment, no formatter, no controller extension, no webapp i18n key.

## Screen: Products (List Report column and Object Page field)

- Title and subtitle: unchanged. List Report: shell title "Product Catalog" (`appTitle`), table header "Products (15)" from `Products.typeNamePlural`. Object Page: title = product name, subtitle = category name (`UI.HeaderInfo` Description on `category_code` with `#TextOnly`), product image. No new title, no new subtitle.
- Filters (no more than 5 by default): unchanged: Product Name, Category, Price, plus the framework's Editing Status. No rating filter: out of scope, issue #6 `products-rating-filter`. Expected side effect, not a design element: the "Adapt Filters" dialog lists every filterable property, so `Rating` may appear there as a plain integer field; the verifier records it (scenario A), issue #6 decides the star-based filter.
- Table columns in order of importance (no more than 7): five columns, the new one last.
  1. Product Name (`name`, `UI.DataField`, semantic key with the draft/lock marker) - existing.
  2. Category (`category_code`, text only) - existing.
  3. Price (`price` with currency) - existing.
  4. Stock Quantity (`stock`) - existing.
  5. Rating - new: `UI.DataFieldForAnnotation`, `Label: '{i18n>Products.rating}'`, `Target: '@UI.DataPoint#Rating'`, `![@UI.Importance]: #Low`. Header text "Rating". Rendered as a read-only `sap.m.RatingIndicator`, five whole stars (`maxValue` 5 from `TargetValue`), no numeric text next to the stars (the DataPoint carries no `Title` and no `Description`; the record `Label` is the single source of the header and the form label). Default width and alignment, no `@HTML5.CssDefaults`.
  Order: identity, classification, commercial value, availability, quality signal. The stars are a glance attribute, not a decision driver like price or stock, so they yield first when the width shrinks: `#Low` moves the column into the pop-in first, while the four existing columns without importance behave as Medium (API `sap.m.Table#autoPopinMode`). On desktop nothing changes. Alternative in Open question 1.
  Sortable: yes, by `rating` through the column header menu and the table settings (Sort); no default sort is added. Column key expected `DataFieldForAnnotation::DataPoint::Rating` (not verified; OPA5 matches by header text, `research/fe-rating-column.md`).
  Cell states: 5 = five filled stars; 3 = three filled, two empty; 0 = five empty; `null` (never rated) = five empty as well, because `setValue(null)` resets the control to 0 (API). "Unrated" and "zero" are therefore indistinguishable in the row: UX risk 1, Open question 2. Draft rows show the draft's value like every other column. Tooltip: the framework text `T_COMMON_RATING_INDICATOR_TITLE_LABEL` of `sap.fe.macros`, translated, no project key.
- Actions and their placement (toolbar, row, header): unchanged. List Report toolbar: Create, Delete (editors only). Object Page header: Edit (editors only). Object Page footer in edit mode: Save, Cancel. No new action: a "Rate" button was rejected because setting the rating is an ordinary field edit inside the existing Edit / Save flow (one task, one mechanism). The stars in the List Report cell are never interactive, for editors too; the rating is set on the Object Page only.
- Object Page sections: General Information (`UI.FieldGroup #GeneralInfo`) gains Rating as the fourth field: Product Name, Description, Category, Rating, Image URL (after `category_code`, before `imageUrl`: business attributes before the technical URL). Display mode: label "Rating", read-only stars (focusable, not interactive). Edit mode (draft, editors): label "Rating", interactive stars, whole stars only; a click on a star or the keyboard sets the value; the value goes into the draft with the same `PATCH` mechanism as the other fields. Not mandatory: no asterisk, no default value. Pricing & Stock and Administrative Data: unchanged. Header: unchanged, no `UI.HeaderFacets` rating (a header DataPoint stays read-only in edit mode, Fiori MCP step 6, and would be a second place for the same value; stars in the header are a separate backlog wish if wanted, Open question 3).
- Empty state and errors: List Report empty table: framework "No data found", unchanged. A `null` rating shows five empty stars, no placeholder dash (the control has no empty text); the display-mode form shows the same. Range errors: the UI cannot produce a value outside 0..5 (`maxValue` 5, the control does not go below 0), so `ASSERT_RANGE` is reachable only by injecting a value through the API: a draft `PATCH` with 6 answers 200 with a `DraftMessages` entry, shown in the Object Page message popover (footer message button, `Common.Messages: DraftMessages` with the `alwaysFetchMessages` side effect); Save (`draftActivate`) answers 400, Fiori Elements shows the message, the page stays in edit mode, Cancel discards the draft. The Rating field itself shows no error state: `sap.m.RatingIndicator` has no `valueState` property, so the message popover is the only place (UX risk 2). The message text is the CDS runtime's translated `ASSERT_RANGE` text, no project key. Authentication and network errors: unchanged.
- Criticality and statuses: none. The stars are neutral (no `Criticality` on the DataPoint), no colour by value, no threshold. The only status-like element in the row stays the draft/lock `ObjectMarker` in Product Name (ADR-0015).
- What is shown instead of a UUID (`TextArrangement`): not applicable to `rating` (Integer). Existing `category` `#TextOnly` unchanged; no UUID is shown anywhere.

## Texts

| Key | Files | en | ru | Used by |
|---|---|---|---|---|
| `Products.rating` | `_i18n/i18n.properties`, `_i18n/i18n_ru.properties` | Rating | `U+0420 U+0435 U+0439 U+0442 U+0438 U+043D U+0433` (transliteration "Reyting"; the bundle holds the plain Cyrillic word; this file lists its code points per CLAUDE.md invariant 10, and the OPA data file writes them as backslash-u escapes) | `@title` in `srv/annotations/Products.cds`; `Label` of both `UI.DataFieldForAnnotation` records (column header, form label) |

Placement and comment: after `Products.imageUrl` in both bundles, preceded by the line `#XFLD: Product rating, whole stars 0-5` (the `en` bundle; the `ru` bundle keeps its current style of one group comment). Alternative `ru` wording in Open question 4.

Framework texts, no project keys (rule `i18n.md`): the tooltip of the stars (`T_COMMON_RATING_INDICATOR_TITLE_LABEL`, `sap.fe.macros`), the ARIA value announcement of `sap.m.RatingIndicator` (`sap.m` bundle), the `ASSERT_RANGE` message (CDS runtime), "No data found", Edit, Save, Cancel. No webapp i18n key is needed in the annotation way. Under alternative 3 (custom column fragment) the header would need `app/products/webapp/i18n` keys `ProductsList.column.rating` in `en` and `ru`, a second key for the same label (UX risk 9).

For `test-ui`: the `ru` header for `iCheckColumns` is the word given by the code points above, written as backslash-u escapes in `data/` like `CategoryTexts.js` (PLAN row 4).

## Accessibility

Checklist of the `ui5-best-practices-accessibility` skill (eight topics), for a `sap.m.RatingIndicator` in a table cell and in a form. Nothing is added by hand: Fiori Elements and the control provide the semantics; the verifier confirms them with the Chrome DevTools accessibility tree (scenario D).

1. Landmarks: the List Report `DynamicPage` and the Object Page `ObjectPageLayout` come from Fiori Elements with their landmarks; unchanged.
2. Labeling: List Report cell: the column header "Rating" labels the cell content; `sap.m.Table` announces the column header together with the cell control (expected). Form: the `FormElement` label "Rating" is associated with the field; the control implements `IFormContent`, so the `sap.ui.layout.form.Form` wires the label (API; expected wiring). The control announces its own value (`aria-valuenow` / value text, expected slider semantics). Tooltip: the framework text, not the value. No icon-only button, no image, no `InvisibleText` needed. Not mandatory: no `required`.
3. Heading levels: no new heading. The section title "General Information" and its level are unchanged.
4. Focus and keyboard: display mode (List Report cell, Object Page display form): `editable=false`, so the stars are focusable and in the tab chain but not interactive (API); a click or a key press changes nothing (scenario E). Edit mode: expected keys Right / Up +1 star, Left / Down -1 star, Home / End minimum / maximum, digits 0..5 set the value directly; expected, not verified by MCP, scenario C. No `tabindex` above 0, no custom focus handling, no F6 change (each `ObjectPageSection` is already an F6 group).
5. Keyboard shortcuts: none new; Save and Cancel keep the Fiori Elements shortcuts.
6. Invisible messaging: a value change is announced by the control's own ARIA state; the range message is announced through the Fiori Elements message popover; nothing to add.
7. Reading order: DOM order equals visual order; Rating is the last column and the fourth form field; the label precedes the control in the form.
8. Target size: List Report cell: not interactive, not applicable. Object Page edit form: the star size follows the theme and the content density (API: "default value depends on the theme"; XS is not recommended as editable). In compact density (the FLP sandbox on desktop) the stars may render below 24 x 24 px (WCAG 2.5.8); scenario C measures the rendered star width and records it. This is an observation for `VERIFICATION.md`, not a blocker: the keyboard path exists and density is a shell setting, not an app decision; larger stars in edit mode would need a manifest or fragment change and are not part of this feature.

## Theme and tokens

`sap_horizon` (the existing bootstrap), standard `sap.m.RatingIndicator` rendered by Fiori Elements. Default star icons (`iconSelected`, `iconUnselected`, `iconHovered` not set), default `iconSize`, theme colours for selected, unselected and hovered stars. No custom colour, no CSS, no `@HTML5.CssDefaults`, no icon override. Content density: unchanged (whatever the sandbox sets); the verifier checks at the default density only.

## Verifier scenarios

Design-level scenarios for `ui-verifier`, in addition to the acceptance criteria of `PLAN.md` ("Editor changes the rating", "Range is enforced on Save", "Viewer sees ratings", "Russian labels", "Mock mode"). Users: `alice` (`CatalogEditor`), `viewer` (`CatalogViewer`). Every scenario ends with the seed restored (`Laptop Pro 15` rating 5, 15 rows, no draft). Rendered `ru` texts are quoted in `VERIFICATION.md` as evidence, nowhere else.

| # | Scenario | Steps | Expected | Evidence | Restore |
|---|---|---|---|---|---|
| A | Column order and header (`en`) | As `alice` open the List Report, Go | 5 columns in the order Product Name, Category, Price, Stock Quantity, Rating; `Laptop Pro 15` shows five filled stars, the seeded 0 product five empty stars, no number next to the stars; hover on the stars shows the framework tooltip (text recorded). Open "Adapt Filters" and record whether Rating is listed (informational for issue #6) | Screenshot of the table, tooltip text | none |
| B | Sort by Rating | Column header Rating, Sort descending; then ascending | Descending: `Laptop Pro 15` first; ascending: the seeded 0 product first; `$batch` carries `$orderby=rating desc` / `asc`, no error | `$batch` request, screenshot | Remove the sort (table settings, Sort) or reload |
| C | Keyboard in edit mode | As `alice` open `Laptop Pro 15`, Edit; Tab from the Category field to the Rating stars (count the Tab stops); Left twice; Right twice; Home; End | Left twice shows 3 stars and the accessibility tree reports value 3; Right twice restores 5; Home and End behaviour recorded (expected 0 and 5); rendered star width in px recorded (compact density) | DevTools accessibility tree, screenshot | Cancel, confirm discard; no draft remains; value 5 |
| D | Screen reader name and value | DevTools accessibility tree of the Rating cell of `Laptop Pro 15` (List Report) and of the Rating field (Object Page display), in `en` and with `sap-ui-language=ru` | Role recorded (expected slider-like), accessible name contains the label "Rating" (`ru`: the `ru` label), value text contains the value (expected "5 of 5" wording, framework text, `ru` wording recorded) | Accessibility tree extracts quoted in `VERIFICATION.md` | none |
| E | Read-only stars are not interactive | As `viewer`: click the third star of `Laptop Pro 15` in the List Report cell and on the Object Page; as `alice` in display mode: click the third star in the List Report cell | The value stays 5; `$batch` carries no `PATCH` and no `draftEdit`; no draft is created; no Edit action for `viewer` | `$batch` log, screenshot | none |
| F | Unrated product (optional) | As `alice`: Create; fill Product Name "ZZ Unrated", Category, Price, Currency, Stock; leave Rating untouched; Save | The Object Page shows five empty stars in display mode; the List Report row shows five empty stars; the create `$batch` carries no `rating` value (absent or `null`) | `$batch`, screenshot | Delete "ZZ Unrated"; 15 rows again |
| G | Narrow width (optional) | Resize the window to about 700 px, then about 400 px, List Report as `alice` | Rating is the first column to leave the row (pop-in or Show Details) while Product Name, Category, Price, Stock Quantity stay longer; at 400 px the remaining columns are recorded | Screenshots at both widths | Restore the window width |
| H | Range error placement | Extends "Range is enforced on Save": after the injected draft `PATCH` with `rating: 6`, look at the Object Page; then Save | The message popover (footer message button) shows the `ASSERT_RANGE` text; the Rating field shows no error state (the control has none); Save answers 400, the message stays, the page stays in edit mode | `$batch`, screenshot of the popover | Cancel, confirm discard; `Laptop Pro 15` stays 5, no draft |

Mock mode: as in `PLAN.md`; the mock does not serve `ru` (STATE "Open debt"), so scenarios D and "Russian labels" run against the live stack only. Console: as in `PLAN.md`, no message that is new against the console section of the latest `VERIFICATION.md` on `main`.

## UX risks

| Risk | How to notice |
|---|---|
| 1. "Not rated" (`null`) and "zero stars" (0) look identical: five empty stars; a user reads an unrated product as rated zero | Scenario F next to the seeded 0 product; Open question 2 decides |
| 2. No field-level error: `sap.m.RatingIndicator` has no `valueState`, so a range violation is visible only in the message popover, not on the field | Scenario H |
| 3. The tooltip is a generic framework label, not the value; sighted users read the filled stars, assistive technology reads the ARIA value | Scenario D records the tooltip and value texts; an odd `ru` tooltip is a framework bundle matter, not a project key |
| 4. `#Low` importance: the column leaves the row first on narrower widths; if the user expects stars on tablets, `#Medium` or no importance is the alternative | Scenario G; Open question 1 |
| 5. Read-only stars are still focusable (`editable=false`), one tab stop per row if the table exposes cell content to Tab (expected: row navigation by arrow keys, cell content by F7; not verified) | Scenarios C and E record the tab sequence |
| 6. Half stars: `visualMode` Half is the default; an Integer never shows halves; under alternative 1 (`Decimal(2, 1)`) the display shows half stars but the edit control selects whole stars only (API), so 4.5 could not be set in the UI | Recommend Integer; if Decimal is chosen, "Editor changes the rating" must show that 4.5 cannot be entered |
| 7. Column header falls back to something other than "Rating" if `Label` is omitted on the `DataFieldForAnnotation` | PLAN risk; OPA5 header assertion |
| 8. Alternative 2 (read-only rating): the form shows read-only stars for everyone and no edit; risks 1, 3 and 5 remain; scenarios C, F and H drop | Plan rows 2b and 3b |
| 9. Alternative 3 (custom column fragment): the cell control must set `editable="false"` explicitly (the control default is `editable=true`, which would put 15 interactive sliders into the List Report tab chain with a change event that writes nothing); the header comes from a second i18n key (webapp bundle), so `en` / `ru` can drift between the column and the form label; sorting and personalization only with `properties: ["rating"]` | Plan row 3c; `ui5lint`; scenario A and B under that alternative |
| 10. The CDN UI5 version is unpinned (1.152.0 today): the edit style of a Rating DataPoint in a form is verified on that version only | PLAN risk; "Editor changes the rating"; `upstream-check` |
| 11. Star size below 24 px in compact density in the Object Page edit form (WCAG 2.5.8 target size) | Scenario C measures; observation, not a blocker |
| 12. `![@UI.Importance]: #Low` adds one EDMX line to the phase 3 contract delta (net +16 instead of the +15 measured in `research/contract-delta.md`) | The architect adjusts the figure in `PLAN.md` or the reviewer reads the diff for content |

## Open questions for the user

1. Importance of the Rating column: `#Low` (recommended: the stars leave the row first on narrow widths, nothing changes on desktop) or no importance (the column behaves like the other four)?
2. Unrated versus zero: accept that a never-rated product and a 0-star product both show five empty stars (recommended: accept; 0 stays a valid value because the edit control can produce it with the keyboard, and a 1..5 scale would let the UI select a value the backend rejects), or seed no 0 in the CSV (the architect seeds one 0 so that empty stars are visible)?
3. Object Page header: confirm no rating stars in the header (recommended: a header DataPoint is read-only in edit mode and duplicates the General Information field); if stars in the header are wanted, record it as a separate wish through `/backlog`.
4. `ru` label: `U+0420 U+0435 U+0439 U+0442 U+0438 U+043D U+0433` ("Reyting", recommended: matches the wording of issue #5) or `U+041E U+0446 U+0435 U+043D U+043A U+0430` ("Otsenka")?

The architect's four questions (type, who sets the rating, annotation column or fragment, drafts) stay in `PLAN.md`; this file adds no code decision beyond the column position, the importance and the field position.
