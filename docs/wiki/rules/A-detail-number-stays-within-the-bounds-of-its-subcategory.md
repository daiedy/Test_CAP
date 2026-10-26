---
title: A detail number stays within the bounds of its subcategory
summary: A subcategory will be able to narrow the bounds of a number attribute for its own products.
tags: [products, details, number, range, subcategory]
id: BR-DETAILS-008
status: planned
since: 2026-10-14
aliases: [R10]
code:
  - srv/annotations/ProductDetails.cds
  - db/schema.cds
  - app/products/webapp/ext/fragment/DetailsForm.js
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DETAIL_VALUE_OUT_OF_SUBCATEGORY_RANGE]
elements: [ProductDetails.numberValue]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 19aaf72ce352aa0d
---

# A detail number stays within the bounds of its subcategory

## Rule

Once #10 is implemented, the assignment of a number attribute to a subcategory will be able to carry its own minimum and maximum. They narrow the bounds of the attribute for the products of that subcategory only. A laptop screen, for example, will be between 10 and 18 inches, although the attribute allows 1 to 100 for any product.

## Why

The bounds of an attribute must suit every product it is used for, so they stay wide. A kind of product has its own sensible range, and a value outside it is almost always a typo. The attribute's own bounds remain the first guard, and this rule is a tighter second one. It tightens [A number detail stays within its bounds and is whole when required](A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md). The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, before anything is wrong: the empty number line will show its range as a placeholder, for example 10-18, with the unit in the line description, and the line will refuse a value outside the range on the client, with the framework's text.
- Object Page, in a draft, at Save and on a direct API write: a value outside the range of the subcategory will be refused with its own message, so a test or an API client can tell it from the global bounds.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- Tightens [A number detail stays within its bounds and is whole when required](A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md).
- Other rules on the same number: [Storage is not below memory](Storage-is-not-below-memory.md), [Memory is a power of two](Memory-is-a-power-of-two.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R10) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
