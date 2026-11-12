---
title: Battery life is available only for a wireless device
summary: The battery life of a product is enabled only while the product has a wireless connection value selected.
tags: [products, details, dependent, control]
id: BR-DETAILS-010
status: active
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
verified: b45ba9e346fe24a0
---

# Battery life is available only for a wireless device

## Rule

A value of a list attribute can enable another attribute. The Battery Life line of a product is enabled only while the Connectivity line has a wireless value selected (Bluetooth 5.0, Bluetooth 5.3, 2.4 GHz wireless or Wi-Fi). Without one, the line is disabled and empty.

## Why

A battery life makes sense only for a wireless device. Instead of letting the user enter a value and then refusing it, the form removes the possibility. This is a control rather than a validation; the server keeps a check as a guard for the API only. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, before anything is wrong: the Battery Life line is disabled and shows a placeholder that names the attribute it depends on. It becomes enabled, empty, as soon as a wireless value is selected.
- Object Page, when the last wireless value is deselected: the filled Battery Life value is cleared and a short message says so. A disabled line is not counted in the count of filled lines.
- Direct write through the API: a battery life on a product with no wireless value is refused with HTTP 400. This guard is not meant to be seen by users of the form, which never sends a value of a disabled line.
- Excel import: not affected, because the import creates products without detail rows.

See also:

- The line belongs to the subcategory: [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md).
- The form is described in the how-to page [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R12). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R12). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
