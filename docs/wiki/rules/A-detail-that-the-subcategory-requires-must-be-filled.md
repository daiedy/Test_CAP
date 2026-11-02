---
title: A detail that the subcategory requires must be filled
summary: A subcategory will be able to mark an attribute as required, and a product of that subcategory will need a value for it.
tags: [products, details, required, subcategory]
id: BR-DETAILS-007
status: planned
since: 2026-10-14
aliases: [R8]
code:
  - srv/annotations/ProductDetails.cds
  - db/schema.cds
  - app/products/webapp/ext/fragment/DetailsForm.js
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DETAIL_VALUE_REQUIRED]
elements: [ProductDetails.textValue, ProductDetails.numberValue, ProductDetails.listValue, ProductDetails.attribute]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 19aaf72ce352aa0d
---

# A detail that the subcategory requires must be filled

## Rule

Once #10 is implemented, the assignment of an attribute to a subcategory will say whether the attribute is required. A product of that subcategory must then have a value for the attribute, whatever its value type. Seven assignments are required: the screen size of laptops, the resolution of mice (DPI), the maximum load of seating, the power and the capacity of appliances, the capacity of drinkware and the thickness of fitness equipment.

## Why

A laptop with no screen size or a chair with no maximum load is an incomplete listing. Which attributes a kind of product cannot do without is a property of the subcategory, so it is kept with the assignment and read by the rule and by the form. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, before anything is wrong: the label of a required detail will carry the required marker. The Details form has no client check of its own, so an empty required line is reported by the server.
- Object Page, in a draft: after a required value is cleared, a message will appear on the line. At Save, an empty required line stops the Save with the same message.
- Direct write through the API: a required detail with no value will be refused with HTTP 400. A required multi-choice attribute is checked too, but no seeded assignment uses one.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- The rows come from the subcategory: [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md).
- The value must fit its type and bounds: [A number detail stays within its bounds and is whole when required](A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R8) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
