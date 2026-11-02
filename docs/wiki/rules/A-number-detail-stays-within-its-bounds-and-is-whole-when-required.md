---
title: A number detail stays within its bounds and is whole when required
summary: A number value respects the minimum and maximum of its attribute, and an INTEGER attribute takes a whole number.
tags: [products, details, number, range]
id: BR-DETAILS-004
status: active
since: 2026-10-12
code:
  - srv/annotations/ProductDetails.cds
messages: [PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE, PRODUCTS_DETAIL_VALUE_NOT_INTEGER]
elements: [ProductDetails.numberValue]
sources:
  - docs/decisions/ADR-0027-typed-product-details-form.md
  - docs/features/products-details-section/SUMMARY.md
verified: 67cd0aade310debd
---

# A number detail stays within its bounds and is whole when required

## Rule

A number attribute may define a minimum and a maximum; a value below the minimum or above the maximum is refused. An attribute of type INTEGER takes only a whole number. An attribute with no minimum or no maximum has no bound on that side.

## Why

The bounds say what a sensible value is, for example a screen size of at least 1 inch. Refusing the rest keeps the numbers of different products comparable and catches a slipped decimal point. The decision behind it is [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).

## Where it fires

- A value outside the bounds is refused with "Enter a value within the allowed range."; a fraction in an INTEGER attribute with "Enter a whole number." Both messages are on the Number value field.
- Draft: the form shows the allowed range and the unit of the attribute next to the input; the server check stays as the guard of the API.
- Planned with #10: [A detail number stays within the bounds of its subcategory](A-detail-number-stays-within-the-bounds-of-its-subcategory.md) will let a subcategory narrow these bounds for its own products.
- Something that is not a number, or a number with more than three decimals, is refused earlier by the framework with its own text. The number of decimals set on the attribute is checked on the screen only, not on the server.
- Which attribute holds a number is decided by its value type; see [A detail value matches the value type of its attribute](A-detail-value-matches-the-value-type-of-its-attribute.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-12 | Introduced with the typed details form: the bounds and the whole-number check on the number value. | [products-details-section](../../features/products-details-section/SUMMARY.md), [ADR-0027](../../decisions/ADR-0027-typed-product-details-form.md) |
