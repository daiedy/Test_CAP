---
title: A product needs a name, price, currency, stock, category and subcategory
summary: A product cannot be saved while its name, price, currency, stock, category or subcategory is empty.
tags: [products, mandatory]
id: BR-PRODUCTS-003
status: active
since: 2026-09-07
code:
  - srv/annotations/Products.cds
messages: []
elements:
  - Products.name
  - Products.price
  - Products.currency
  - Products.stock
  - Products.category
  - Products.subcategory
sources:
  - docs/decisions/ADR-0004-annotation-split.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: dbca884ae8598da1
---

# A product needs a name, price, currency, stock, category and subcategory

## Rule

Six facts are required for every product: its name, its price, the currency of the price, the stock, the category and the subcategory. The description, the rating, the image address and the details are optional.

## Why

Without a name there is nothing to find, without a price and currency there is nothing to sell, and without a stock, a category and a subcategory the product cannot be counted or placed in the catalog. The subcategory is required as well because the details of a product come from it.

## Where it fires

- Draft, at Save: each empty required field shows the message "Provide the missing value." next to the field, and the draft is kept. The Subcategory field shows the required marker once a category is chosen; see [The subcategory field stays disabled until a category is chosen](The-subcategory-field-stays-disabled-until-a-category-is-chosen.md).
- API, an active write that leaves one of the six out is refused with HTTP 400 and the same message for that field.
- Excel import: a row with an empty required cell is reported with its row number and column before anything is written. The text comes from the framework check; it is not a message of this wiki.

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-07 | Introduced: name, price, currency, stock and category are required, declared with the data semantics rather than on the screen. | [ADR-0004](../../decisions/ADR-0004-annotation-split.md) |
| 2026-10-10 | The subcategory becomes required too; its field is disabled until a category is chosen. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md) |
