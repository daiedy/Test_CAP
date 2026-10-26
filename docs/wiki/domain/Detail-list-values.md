---
title: Detail list values
summary: A list value is one allowed choice of an attribute that offers a list, with its display order.
tags: [details, list-values, domain, code-list]
code:
  - db/schema.cds
  - srv/annotations/DetailListValues.cds
verified: f862332b051ef747
---

# Detail list values

## What it is

A list value is one allowed choice of an attribute whose value comes from a list, such as Black for the attribute Colour. Each attribute has its own list, and the list is read-only for every role. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Code**, **name**, **description**: the identifier and the texts shown in the user's language.
- **Attribute**: the attribute whose list the value belongs to; see [Detail attributes](Detail-attributes.md).
- **Position**: the display order in the list.

## Rules

- [A list detail value belongs to the list of its attribute](../rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md): a product may carry only a value of its attribute's own list; [A value of a multi-choice detail is selected once and belongs to its list](../rules/A-value-of-a-multi-choice-detail-is-selected-once-and-belongs-to-its-list.md) covers several choices.
- [Battery life is available only for a wireless device](../rules/Battery-life-is-available-only-for-a-wireless-device.md) (planned with #10).

## Related

- [Detail attributes](Detail-attributes.md), [Product details](Product-details.md), [Product detail selections](Product-detail-selections.md)
- [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md)
