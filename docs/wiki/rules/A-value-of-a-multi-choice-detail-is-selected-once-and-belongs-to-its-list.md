---
title: A value of a multi-choice detail is selected once and belongs to its list
summary: A several-choice row holds each chosen value once, every chosen value is required and belongs to the attribute's list.
tags: [products, details, selections, list]
id: BR-DETAILS-006
status: active
since: 2026-10-12
code:
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAIL_SELECTION_DUPLICATE]
elements: [ProductDetailSelections.value]
sources:
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: 67cd0aade310debd
---

# A value of a multi-choice detail is selected once and belongs to its list

## Rule

For an attribute of type MULTI_LIST, a row holds a set of selections. Each selection names a value, the value must belong to the attribute's list, and the same value is chosen only once in a row. Selections exist only for a MULTI_LIST attribute.

## Why

The choices of a row are a set: choosing "Wi-Fi" twice adds no information and would be counted twice in any list or export. A value of another attribute would answer another question. The decision behind it is [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- A selection without a value is refused as a missing value; a selection that repeats a value of its row is refused with "This value is already selected." on the Value field.
- A selection under an attribute that is not MULTI_LIST is refused with the type message of [A detail value matches the value type of its attribute](A-detail-value-matches-the-value-type-of-its-attribute.md); a value of another attribute with the message of [A list detail value belongs to the list of its attribute](A-list-detail-value-belongs-to-the-list-of-its-attribute.md).
- Draft: the form offers the values of the attribute as a multi-select, which cannot pick one twice; the checks guard the API. See [Product detail selections](../domain/Product-detail-selections.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced with the typed details form: selections of a several-choice row, unique per row. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
