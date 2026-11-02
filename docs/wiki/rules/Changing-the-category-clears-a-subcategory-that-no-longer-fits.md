---
title: Changing the category clears a subcategory that no longer fits
summary: When the category of a draft changes, a subcategory that belongs to the old category is cleared at once and without a message.
tags: [products, category, subcategory, draft]
id: BR-PRODUCTS-007
status: active
since: 2026-10-09
code:
  - srv/catalog-service.js
  - app/products/annotations/Products.cds
messages: []
elements:
  - Products.category
  - Products.subcategory
sources:
  - docs/decisions/ADR-0024-dependent-value-help.md
  - docs/features/products-subcategories/SUMMARY.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: f73bc4bb84eb2fde
---

# Changing the category clears a subcategory that no longer fits

## Rule

When an editor changes the category of a product that is open as a draft, and the chosen subcategory does not belong to the new category, the subcategory is emptied. A subcategory that does belong to the new category stays, for example one chosen before the category on a new draft.

## Why

The old subcategory would be refused at Save anyway, because it belongs to another category. Clearing it right away removes a value the editor can no longer see as valid and saves a failed Save. The editor simply picks a new one from the shortened list. The decision behind it is [A dependent field offers only the values of its parent field](../decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md).

## Where it fires

- Object Page, on a draft: after the category changes, the Subcategory field becomes empty and its dropdown lists the subcategories of the new category. No message, no confirmation.
- Draft only. An active write through the API is never cleared; there a subcategory of another category is refused, see [The subcategory belongs to the product's category](The-subcategory-belongs-to-the-products-category.md).
- When the cleared subcategory leaves the product without one, the Subcategory field is required again at Save; see [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-09 | Introduced: a category change on a draft clears a subcategory of the old category, and the screen re-reads the field. | [products-subcategories](../../features/products-subcategories/SUMMARY.md), [ADR-0024](../../decisions/ADR-0024-dependent-value-help.md) |
| 2026-10-10 | The subcategory becomes required and is disabled while no category is chosen; the clearing itself is unchanged. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md) |
