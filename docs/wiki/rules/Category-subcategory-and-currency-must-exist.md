---
title: Category, subcategory and currency must exist
summary: A product can only name a category, a subcategory and a currency that exist in the catalog's lists.
tags: [products, category, subcategory, currency, code-list]
id: BR-PRODUCTS-005
status: active
since: 2026-09-07
code:
  - srv/annotations/Products.cds
messages: []
elements:
  - Products.category
  - Products.subcategory
  - Products.currency
sources:
  - docs/features/categories-code-list/SUMMARY.md
  - docs/decisions/ADR-0010-code-list-codes.md
  - docs/features/products-subcategories/SUMMARY.md
  - docs/features/catalog-hygiene/SUMMARY.md
verified: dbca884ae8598da1
---

# Category, subcategory and currency must exist

## Rule

The category, the subcategory and the currency of a product must be entries of their lists: the categories, the subcategories and the standard list of currencies. A code that is in none of them is refused.

## Why

The lists are the vocabulary of the catalog. A made-up category or currency code would never match a filter, a name in the user's language or a price format, and the product would look wrong or vanish from the lists. See also [Code lists use stable upper-case codes](../decisions/Code-lists-use-stable-upper-case-codes.md).

## Where it fires

- In the application the three fields are dropdowns, so a wrong value cannot be typed; see [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md).
- Draft, at Save, and an active write through the API: a code that is not in the list is refused with the message "Target with this key doesn't exist." for that field (HTTP 400 through the API). The message is the framework's own.
- Excel import: a row with an unknown category, subcategory or currency is reported with its row number and the column before anything is written.
- That a subcategory exists does not make it fit: see [The subcategory belongs to the product's category](The-subcategory-belongs-to-the-products-category.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-07 | Introduced for the category, which becomes a list of codes with names in the user's language. | [categories-code-list](../../features/categories-code-list/SUMMARY.md), [ADR-0010](../../decisions/ADR-0010-code-list-codes.md) |
| 2026-10-09 | The same check is added for the currency, whose value was not verified before. | [catalog-hygiene](../../features/catalog-hygiene/SUMMARY.md) |
| 2026-10-09 | The same check covers the new subcategory. | [products-subcategories](../../features/products-subcategories/SUMMARY.md) |
