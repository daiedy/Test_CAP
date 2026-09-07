# ADR-0010: Codes of the project's own code lists

Date: 2026-09-07. Status: accepted (user, 2026-09-07, feature `categories-code-list`).

## Context
The `categories-code-list` feature (`docs/features/categories-code-list/`) introduces the project's first own code list `my.catalog.Categories : sap.common.CodeList` with the key `code`. The existing category values in `db/data/my.catalog-Products.csv` are display texts (`Electronics`, `Furniture`). ADR-0003 and `CONVENTIONS.md` require a CodeList with the key `code`, but do not define the format and length of the code; `UPPER_SNAKE` in CONVENTIONS applies only to `enum`. Without a rule the next code list (for example statuses or units of measure) would get a different code format. The template `templates/entity.cds` already uses `key code : String(20)`.

## Decision
The key of the project's own code lists is declared as `key code : String(20)`. Code values: upper-case Latin letters, digits and underscore (`ELECTRONICS`, `HOME_OFFICE`), stable for the whole lifetime of the data, not translated and not shown to the user: the interface shows `name` via `Common.Text` and `TextArrangement: #TextOnly` (ADR-0011). Display names live in `name` (en in the base CSV, translations in `<Entity>.texts.csv`). Code lists from `@sap/cds/common` and `@sap/cds-common-content` (`Currencies`, `Countries`, `Languages`) keep their ISO codes, the rule does not apply to them. In code and tests the codes are used as literals (`category_code eq 'KITCHEN'`). First application: `Categories` with the codes `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY`.

## Alternatives
| Option | Why rejected |
|---|---|
| Code equal to the display text (`Electronics`) | The code starts to look like text and invites showing and "editing" it; renaming a category would require replacing the key in all products and texts; diverges from `UPPER_SNAKE` for `enum`, although the role is the same |
| UUID via `cuid` | CodeList in CAP and Fiori is designed for a semantic `code`; CSV, URLs and `@assert.target` messages become unreadable; the value help shows the UUID when the text is missing |
| Numeric codes (`1`, `2`) | Say nothing in CSV and tests; the order of addition turns into meaning |
| No length or `String(10)` | CONVENTIONS require a length on strings; 10 characters are too few for compound codes like `HOME_OFFICE` |

## Consequences
- `CONVENTIONS.md`, section 3: the row about code lists is extended with the code format (done by `docs-keeper` in the documentation phase of the feature).
- `PATTERNS.md`, row "Code list with selection from a list": the `Categories` example, mention of the code format.
- `templates/entity.cds` matches the decision without changes.
- The `my.catalog-Products.csv` data is moved to codes at the first migration; subsequent code lists follow the rule without discussion.

## Sources
- https://cap.cloud.sap/docs/cds/common#code-lists
- https://cap.cloud.sap/docs/guides/domain/ (Domain Modeling)
- ADR-0003; `docs/features/categories-code-list/CONTEXT.md` and `PLAN.md` (user decisions of 2026-09-07)
