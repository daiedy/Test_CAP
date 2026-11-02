---
title: Storage is not below memory
summary: The storage of a laptop will not be allowed to be below its memory.
tags: [products, details, number, laptops]
id: BR-DETAILS-009
status: planned
since: 2026-10-14
aliases: [R11]
code:
  - srv/annotations/ProductDetails.cds
  - db/schema.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DETAIL_VALUE_BELOW_OTHER]
elements: [ProductDetails.numberValue]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 13880a0e9e127e07
---

# Storage is not below memory

## Rule

Once #10 is implemented, an attribute can name another attribute whose value must not be larger. For laptops, the Storage value of a product must not be below its Memory value. The message names both attributes in the language of the user.

## Why

A laptop whose drive is smaller than its memory is a data entry error. The rule is a showcase of a check between two detail lines of one product. It is driven by data (the attribute names the other attribute), so the rule can be reused for another pair without new code. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, in a draft: when the Storage line is changed, a message will appear on it if the value is below the Memory value. There is no preventing control, because a comparison of two lines on the client would only repeat the server rule.
- Save: the check is repeated, and it also finds the case where only the Memory value was changed. A direct API write is checked the same way.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- Memory has its own rule: [Memory is a power of two](Memory-is-a-power-of-two.md).
- Bounds of the same lines: [A detail number stays within the bounds of its subcategory](A-detail-number-stays-within-the-bounds-of-its-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R11) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
