---
title: Code lists use stable upper-case codes
summary: The lists the catalog keeps itself identify each value by a short stable upper-case code, and the screen shows the name (ADR-0010).
tags: [code-list, category]
adr: ADR-0010
sources:
  - docs/decisions/ADR-0010-code-list-codes.md
---

# Code lists use stable upper-case codes

## Decision

Every list of values that the catalog keeps itself is identified by a code of up to 20 characters. A code is written with upper-case Latin letters, digits and the underscore, for example `ELECTRONICS` or `HOME_OFFICE`. It stays the same for the whole life of the data, it is not translated, and the user never sees it: the screen shows the name instead, in the user's language. The names live apart from the codes, in English in the base data and in other languages as translations. The standard lists that come with the platform, such as currencies, countries and languages, keep their international ISO codes. Code and tests refer to a value by its code.

## Why

The first own list, the categories, held display texts as values. Without a rule, the next list, such as statuses or units, would have received a different code format.

## What it means for the catalog

- A product refers to its category by a code such as `ELECTRONICS`; renaming a category name never breaks the products that use it.
- An Excel import expects codes, not names, in the columns `category`, `subcategory` and `currency`. See [Import products from Excel](../how-to/Import-products-from-Excel.md).
- The category list has the codes `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS` and `STATIONERY`. See [Categories](../domain/Categories.md).
- A value that does not exist in its list is refused. See [Category, subcategory and currency must exist](../rules/Category-subcategory-and-currency-must-exist.md).

## Source

[ADR-0010: Codes of the project's own code lists](../../decisions/ADR-0010-code-list-codes.md)
