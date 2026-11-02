---
title: Product detail selections
summary: A selection is one chosen value of a detail row whose attribute allows several choices.
tags: [details, selections, domain]
code:
  - db/schema.cds
  - srv/annotations/ProductDetails.cds
verified: 1df104c6439638cc
---

# Product detail selections

## What it is

Some attributes let a product carry several values from a list, for example the Connectivity or the Material of a product. The detail row of such an attribute then holds one selection for each chosen value. Selections are written only through the product's draft, like the rows themselves. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Detail**: the detail row the selection belongs to; see [Product details](Product-details.md).
- **Value**: the chosen list value. It is mandatory, it must be one of the values of the row's attribute, and it can be chosen once per row; see [Detail list values](Detail-list-values.md).

## Rules

- [A value of a multi-choice detail is selected once and belongs to its list](../rules/A-value-of-a-multi-choice-detail-is-selected-once-and-belongs-to-its-list.md): the value must belong to the attribute's list and is chosen once per row.
- [A detail value matches the value type of its attribute](../rules/A-detail-value-matches-the-value-type-of-its-attribute.md): selections exist only for an attribute that allows several choices.
- [A list detail value belongs to the list of its attribute](../rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md): the same list rule applies to a single-choice row.

## Related

- [Product details](Product-details.md), [Detail list values](Detail-list-values.md), [Detail value types](Detail-value-types.md)
- [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md)
