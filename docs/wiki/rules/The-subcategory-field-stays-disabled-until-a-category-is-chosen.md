---
title: The subcategory field stays disabled until a category is chosen
summary: On the product form the Subcategory field cannot be used until a category is chosen, and it is marked required from then on.
tags: [products, subcategory, category, field-control]
id: BR-PRODUCTS-006
status: active
since: 2026-10-10
code:
  - app/products/annotations/Products.cds
messages: []
elements: [Products.subcategory]
sources:
  - docs/decisions/ADR-0025-dynamic-field-control.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: d2045634c236e2ab
---

# The subcategory field stays disabled until a category is chosen

## Rule

While the category of a product is empty, the Subcategory field is disabled and carries no required marker. When a category is chosen, the field becomes editable and shows the required marker.

## Why

The subcategories on offer depend on the category, so before a category is chosen there is nothing sensible to pick. A disabled field makes the right order of steps, category first, the only possible one, instead of letting the editor choose a pair and then rejecting it. The decision behind it is [A field is disabled until the field it depends on is filled](../decisions/A-field-is-disabled-until-the-field-it-depends-on-is-filled.md).

## Where it fires

- Object Page of a new or edited product (draft): the field is greyed out and empty until the category is chosen, then it lists the subcategories of that category.
- The field switches in the browser as soon as the category changes; no message appears.
- This is a convenience of the screen only. The same requirement is enforced for every client by [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md), and the pair of category and subcategory is checked by [The subcategory belongs to the product's category](The-subcategory-belongs-to-the-products-category.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-10 | Introduced: the Subcategory field is disabled while the category is empty and required once a category is set. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md), [ADR-0025](../../decisions/ADR-0025-dynamic-field-control.md) |
