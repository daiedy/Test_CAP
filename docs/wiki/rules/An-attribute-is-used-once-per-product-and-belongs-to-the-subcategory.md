---
title: An attribute is used once per product and belongs to the subcategory
summary: A detail row names an attribute that its product's subcategory offers, and a product has at most one row per attribute.
tags: [products, details, attributes, mandatory]
id: BR-DETAILS-002
status: active
since: 2026-10-12
code:
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED, PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE]
elements: [ProductDetails.attribute]
sources:
  - docs/decisions/ADR-0026-product-details-composition.md
  - docs/features/products-details-section/SUMMARY.md
verified: 67cd0aade310debd
---

# An attribute is used once per product and belongs to the subcategory

## Rule

Every detail row names an attribute, the attribute must be one that the product's subcategory offers, and a product has no second row for the same attribute.

## Why

The subcategory decides which facts are asked for. A row for an attribute it does not offer, or two rows for the same attribute, would give a product two answers or an answer to a question nobody asked. The decision behind it is [Product details are rows of reusable attributes](../decisions/Product-details-are-rows-of-reusable-attributes.md).

## Where it fires

- A row without an attribute is refused. An attribute that is not assigned to the subcategory is refused with "The attribute is not available for the subcategory of the product." A second row for the same attribute is refused with "The product already has a row for this attribute." The messages are on the Attribute field of the row.
- Draft: the rows are generated from the subcategory (see [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md)), so the screen cannot produce either mistake. The checks stay as the guard of the API, where rows are written directly.
- The attribute must also exist among the attributes; see [Detail attributes](../domain/Detail-attributes.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced with the details of a product: assignment and uniqueness are checked on every path, kept as the API guard once the draft generates the rows. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0026](../../decisions/ADR-0026-product-details-composition.md) |
