---
title: The subcategory belongs to the product's category
summary: A product carries only a subcategory of its own category, so a pair from two categories is never stored.
tags: [products, subcategory, category]
id: BR-PRODUCTS-001
status: active
since: 2026-10-09
code:
  - srv/annotations/Products.cds
  - app/products/annotations/Products.cds
  - srv/catalog-service.js
messages: [PRODUCTS_SUBCATEGORY_MISMATCH]
elements: [Products.subcategory]
sources:
  - docs/decisions/ADR-0024-dependent-value-help.md
  - docs/features/products-subcategories/SUMMARY.md
  - docs/decisions/ADR-0025-dynamic-field-control.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: 5ff680ee203a3f24
---

# The subcategory belongs to the product's category

## Rule

Every subcategory belongs to exactly one category: Laptops, Mice and Audio, for example, belong to Electronics. A product may carry only a subcategory of its own category, so a product in the category Furniture with the subcategory Laptops is rejected.

## Why

The subcategory refines the category. A pair from two categories would place a product in two branches of the catalog at once, and the lists, the filters and the details of the product, which come from its subcategory, would contradict each other. The decisions behind it are [A dependent field offers only the values of its parent field](../decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md) and [A field is disabled until the field it depends on is filled](../decisions/A-field-is-disabled-until-the-field-it-depends-on-is-filled.md).

## Where it fires

- Object Page, before anything is wrong: the Subcategory field stays disabled until a category is chosen, and its dropdown lists only the subcategories of that category (`app/products/annotations/Products.cds`).
- Draft, when the category changes: a subcategory of the old category is cleared without a message (`resetStaleSubcategory` in `srv/catalog-service.js`).
- Save, or a direct write through the API: a subcategory of another category is rejected with the message `PRODUCTS_SUBCATEGORY_MISMATCH` (the `@assert` constraint on `subcategory` in `srv/annotations/Products.cds`; the text is in [messages.properties](../../../_i18n/messages.properties)).
- Excel import: a row whose subcategory belongs to another category is reported with its row number and the column `subcategory` before any row is written (`subcategoryMismatches` in `srv/catalog-service.js`).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-09 | Introduced: the dropdown lists only the subcategories of the category, a category change on a draft clears a foreign subcategory, and saving a mismatched pair is rejected. | [products-subcategories](../../features/products-subcategories/SUMMARY.md), [ADR-0024](../../decisions/ADR-0024-dependent-value-help.md) |
| 2026-10-10 | The Subcategory field stays disabled until a category is chosen, and the Excel import checks the pair per row before writing. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md), [ADR-0025](../../decisions/ADR-0025-dynamic-field-control.md) |
