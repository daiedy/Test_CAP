---
title: Subcategory attributes
summary: An assignment says which attribute a subcategory offers and in which position its field appears.
tags: [details, subcategory, attributes, domain]
code:
  - db/schema.cds
  - srv/annotations/SubcategoryAttributes.cds
verified: 0dc4e525061a5e32
---

# Subcategory attributes

## What it is

An assignment links one attribute to one subcategory, so that every product of the subcategory offers a detail row for it. The list comes with the catalog and is read-only for every role. The same pair appears only once. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Subcategory**: see [Subcategories](Subcategories.md).
- **Attribute**: see [Detail attributes](Detail-attributes.md).
- **Position**: where the attribute's field stands among the details of a product; it is copied to the detail row.

## Rules

- [An attribute is used once per product and belongs to the subcategory](../rules/An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md): a product's detail rows may only use attributes assigned to its subcategory.
- One assignment per subcategory and attribute pair is a constraint of the model, not a rule page.
- [A detail that the subcategory requires must be filled](../rules/A-detail-that-the-subcategory-requires-must-be-filled.md) (planned with #10).
- [A detail number stays within the bounds of its subcategory](../rules/A-detail-number-stays-within-the-bounds-of-its-subcategory.md) (planned with #10).

## Related

- [Subcategories](Subcategories.md), [Detail attributes](Detail-attributes.md), [Product details](Product-details.md)
- [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md)
