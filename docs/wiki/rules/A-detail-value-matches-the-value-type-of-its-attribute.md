---
title: A detail value matches the value type of its attribute
summary: "A value goes only in the place its attribute's value type allows: text for TEXT, a number for INTEGER and DECIMAL, one list value for LIST, selections for MULTI_LIST."
tags: [products, details, value-type]
id: BR-DETAILS-003
status: active
since: 2026-10-12
code:
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH]
elements: [ProductDetails.textValue]
sources:
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: 67cd0aade310debd
---

# A detail value matches the value type of its attribute

## Rule

Each attribute has a value type, and the value of a row goes in the matching place: free text only for a TEXT attribute, a number only for INTEGER and DECIMAL, a list value only for LIST, selected values only for MULTI_LIST. A value in another place is refused.

## Why

A row carries one kind of fact. A text in a weight attribute, or a number in a colour attribute, cannot be compared, sorted or shown correctly, so the mismatch is stopped where it is entered. Values stay optional: an empty row is valid. The decision behind it is [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- Any write of a row with a value in the wrong place is refused with "The value does not match the type of this detail." The message is on the field that holds the wrong value: the text value, the number value, the list value, or the selected value.
- Draft: the form shows the input that fits the type, so a mismatch comes only from a changed attribute or the API.
- The value types are described in [Detail value types](../domain/Detail-value-types.md). The bounds of a number are in [A number detail stays within its bounds and is whole when required](A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced with the typed details form: each value column is checked against the value type of the attribute. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
