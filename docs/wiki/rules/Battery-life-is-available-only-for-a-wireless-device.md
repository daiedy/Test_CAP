---
title: Battery life is available only for a wireless device
summary: The battery life of a product will be enabled only while the product has a wireless connection value selected.
tags: [products, details, dependent, control]
id: BR-DETAILS-010
status: planned
since: 2026-10-14
aliases: [R12]
code:
  - srv/annotations/ProductDetails.cds
  - db/schema.cds
  - app/products/webapp/ext/fragment/DetailsForm.js
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DETAIL_VALUE_NOT_ENABLED]
elements: [ProductDetails.numberValue]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 19aaf72ce352aa0d
---

# Battery life is available only for a wireless device

## Rule

Once #10 is implemented, a value of a list attribute will be able to enable another attribute. The Battery Life line of a product will be enabled only while the Connectivity line has a wireless value selected (Bluetooth 5.0, Bluetooth 5.3, 2.4 GHz wireless or Wi-Fi). Without one, the line is disabled and empty.

## Why

A battery life makes sense only for a wireless device. Instead of letting the user enter a value and then refusing it, the form removes the possibility. This is a control rather than a validation; the server keeps a check as a guard for the API only. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, before anything is wrong: the Battery Life line will be disabled and will show a placeholder that names the attribute it depends on. It becomes enabled, empty, as soon as a wireless value is selected.
- Object Page, when the last wireless value is deselected: the filled Battery Life value will be cleared and a short message will say so. A disabled line is not counted in the count of filled lines.
- Direct write through the API: a battery life on a product with no wireless value will be refused with HTTP 400. This guard is not meant to be seen by users of the form, which never sends a value of a disabled line.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- The line belongs to the subcategory: [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md).
- The form is described in the how-to page [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R12) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
