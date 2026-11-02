---
title: A list detail value belongs to the list of its attribute
summary: The value of a LIST attribute must be one of the values defined for that attribute and no other.
tags: [products, details, list]
id: BR-DETAILS-005
status: active
since: 2026-10-12
code:
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAIL_VALUE_NOT_IN_LIST]
elements: [ProductDetails.listValue]
sources:
  - docs/decisions/ADR-0026-product-details-composition.md
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: 67cd0aade310debd
---

# A list detail value belongs to the list of its attribute

## Rule

The list value of a row must exist and must belong to the row's own attribute. A value of the Colour list cannot be used in a Material row. The same holds for each selected value of a several-choice attribute.

## Why

Each list attribute has its own closed set of choices. Without the check, a value could be correct as a code and still be an answer to another question. The decisions behind it are [Product details are rows of reusable attributes](../decisions/Product-details-are-rows-of-reusable-attributes.md) and [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- A list value that belongs to another attribute is refused with "Select a value from the list." on the List value field; a list value that does not exist in the code list is refused by the reference check of the field.
- The same message is shown on the selected value of a several-choice row; see [A value of a multi-choice detail is selected once and belongs to its list](A-value-of-a-multi-choice-detail-is-selected-once-and-belongs-to-its-list.md).
- Draft: the dropdown offers only the values of the row's attribute; the check is the guard of the API. The values are described in [Detail list values](../domain/Detail-list-values.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced with the typed details form: a list value must belong to the attribute of the row. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
