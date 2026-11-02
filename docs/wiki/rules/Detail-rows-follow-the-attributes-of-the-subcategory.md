---
title: Detail rows follow the attributes of the subcategory
summary: A draft keeps one detail row per attribute of the product's subcategory and tells the user which filled values were dropped when the subcategory changes.
tags: [products, details, subcategory, draft]
id: BR-DETAILS-001
status: active
since: 2026-10-12
code:
  - srv/catalog-service.js
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAILS_VALUES_REMOVED]
elements: []
sources:
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: 2e2567da9094caa2
---

# Detail rows follow the attributes of the subcategory

## Rule

A product in a draft has exactly one detail row for each attribute assigned to its subcategory, in the order the subcategory gives. Nobody adds or removes rows by hand. When the subcategory is set or changed, the rows follow it, and the user is told when filled values were dropped.

## Why

The details of a product come from its subcategory. If the user had to build the rows, a row could be missing or could belong to another kind of product. Generating the rows keeps every product of a subcategory comparable, and the warning stops a filled value from disappearing without notice. The decision behind it is [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- Draft, when a subcategory is chosen or changed: rows of attributes the new subcategory also offers keep their values and selections and take the new order; rows of other attributes are deleted; each missing attribute gets an empty row. If a deleted row held a value, a warning on the Subcategory field says "Values removed: {0}. These details do not apply to the new subcategory: {1}." with the number of values and the names of their attributes. If the category change clears the subcategory, the rows stay as they are until a new subcategory is chosen; see [Changing the category clears a subcategory that no longer fits](Changing-the-category-clears-a-subcategory-that-no-longer-fits.md).
- Edit of a saved product that has no detail rows (one created by the Excel import or through the API): the new draft gets an empty row for each attribute of its subcategory.
- A write to a saved product through the API is never adjusted. A subcategory that would leave rows of unassigned attributes is refused instead; see [A subcategory change must not leave details that do not fit](A-subcategory-change-must-not-leave-details-that-do-not-fit.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced: the draft reconciles the rows with the subcategory, fills an edited product that has none, and warns about removed values. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
