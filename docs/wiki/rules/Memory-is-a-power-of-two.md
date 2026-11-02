---
title: Memory is a power of two
summary: The memory of a laptop will have to be a power of two.
tags: [products, details, number, laptops]
id: BR-DETAILS-011
status: planned
since: 2026-10-14
aliases: [R13]
code:
  - srv/annotations/ProductDetails.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DETAIL_VALUE_NOT_POWER_OF_TWO]
elements: [ProductDetails.numberValue]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 622516bc0195056f
---

# Memory is a power of two

## Rule

Once #10 is implemented, the Memory value of a product must be a power of two: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512 or 1024. A value such as 12 will be refused.

## Why

Memory comes in powers of two, so 12 is almost certainly a typo for 8 or 16. The rule is a showcase of a check on one named attribute. For laptops the bounds of the subcategory already limit the memory to 4 to 128. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, in a draft: after the Memory line is changed, a message will appear on it if the value is not a power of two. There is no suggestion list; the bounds and the message are enough.
- Save, or a direct write through the API: a value that is not a power of two will be refused with HTTP 400.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- Storage must not be below memory: [Storage is not below memory](Storage-is-not-below-memory.md).
- Bounds of the same line: [A detail number stays within the bounds of its subcategory](A-detail-number-stays-within-the-bounds-of-its-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R13) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
