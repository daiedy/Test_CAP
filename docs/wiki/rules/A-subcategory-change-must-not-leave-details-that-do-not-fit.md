---
title: A subcategory change must not leave details that do not fit
summary: A product is never stored with detail rows for attributes its subcategory does not offer; a draft drops them with a warning and a direct write is refused.
tags: [products, subcategory, details]
id: BR-PRODUCTS-008
status: active
since: 2026-10-12
code:
  - srv/annotations/Products.cds
  - srv/catalog-service.js
messages: [PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS]
elements: [Products.subcategory]
sources:
  - docs/decisions/ADR-0026-product-details-composition.md
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: dfab20cb0972ed9f
---

# A subcategory change must not leave details that do not fit

## Rule

The detail rows of a product are the attributes of its subcategory and no others. When the subcategory changes, the product may not keep a detail row whose attribute the new subcategory does not offer.

## Why

The details come from the subcategory: laptops have a screen size, chairs do not. A row for an attribute of the old subcategory would be a fact the new kind of product cannot have, and it would show up in lists and exports as if it were true. The decisions behind it are [Product details are rows of reusable attributes](../decisions/Product-details-are-rows-of-reusable-attributes.md) and [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- Draft: the catalog removes the rows that do not fit, keeps the rows that also belong to the new subcategory, adds empty rows for the new attributes, and shows a warning with the number of removed values and the names of their attributes when a removed row held a value. Nothing is refused.
- Direct write through the API, on a saved product: a subcategory that leaves such rows is refused with the message "Some detail rows do not fit the new subcategory. Delete or change them before saving." The message is on the product's Subcategory field; the API caller deletes or changes the rows first. The text is in [messages.properties](../../../_i18n/messages.properties).
- The same rows are also refused one by one by the checks of [the details themselves](An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md), so the two paths never disagree.
- The draft generates and removes the rows itself; see [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced: the root constraint refuses a subcategory that leaves rows with unassigned attributes, on every path including a draft Save. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0026](../../decisions/ADR-0026-product-details-composition.md) |
| 2026-10-12 | A draft now reconciles the rows itself and warns about removed values; the root constraint remains the guard of the direct write. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
