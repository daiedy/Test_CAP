---
title: Detail attributes
summary: An attribute is a kind of fact a product can carry, with its value type, unit and limits.
tags: [details, attributes, domain, code-list]
code:
  - db/schema.cds
  - srv/annotations/DetailAttributes.cds
verified: cf17b555eda7e9d6
---

# Detail attributes

## What it is

An attribute is a kind of fact about a product, such as Colour or Weight. One attribute can be offered for several subcategories. The list comes with the catalog and is read-only for every role. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Code**, **name**, **description**: the identifier and the texts shown in the user's language.
- **Value type**: what kind of value the attribute takes; see [Detail value types](Detail-value-types.md).
- **Unit**: the unit of measure shown with the value, such as kg.
- **Minimum**, **maximum**: the lowest and highest allowed number of a whole-number or decimal attribute.
- **Scale**: the number of decimal places of a decimal attribute.
- **Subcategories**: where the attribute is offered; see [Subcategory attributes](Subcategory-attributes.md).
- **Values**: the allowed choices of a list attribute; see [Detail list values](Detail-list-values.md).

## Rules

- [Code lists are readable by every signed-in user](../rules/Code-lists-are-readable-by-every-signed-in-user.md): the list is read-only for every role.
- [A number detail stays within its bounds and is whole when required](../rules/A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md): a number outside the minimum and maximum is refused.
- [Storage is not below memory](../rules/Storage-is-not-below-memory.md) (planned with #10).
- [Battery life is available only for a wireless device](../rules/Battery-life-is-available-only-for-a-wireless-device.md) (planned with #10).
- [Memory is a power of two](../rules/Memory-is-a-power-of-two.md) (planned with #10).

## Related

- [Detail value types](Detail-value-types.md), [Detail list values](Detail-list-values.md), [Subcategory attributes](Subcategory-attributes.md), [Product details](Product-details.md)
- [Glossary](../Glossary.md)
