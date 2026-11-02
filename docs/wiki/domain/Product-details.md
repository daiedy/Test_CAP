---
title: Product details
summary: A detail row holds one attribute of a product and its typed value, such as the colour Black.
tags: [details, products, domain]
code:
  - db/schema.cds
  - srv/annotations/ProductDetails.cds
verified: 1df104c6439638cc
---

# Product details

## What it is

A detail row is one fact about one product: an attribute (for example Colour) and its value (Black). A product has one row for each attribute of its subcategory, in a fixed order. The rows are created for you when you choose the subcategory on a draft, and you fill in the values; you do not add or remove rows. The values are optional. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Attribute**: which fact the row is about; see [Detail attributes](Detail-attributes.md). It must be one that the product's subcategory offers, and a product has it once.
- **Position**: the display order of the row, taken from the subcategory; nobody edits it.
- **Text value**, **number value**, **list value**: three places for the value. The attribute's value type (see [Detail value types](Detail-value-types.md)) says which one is used; a value in the wrong place is refused.
- **Selections**: for an attribute with several choices, the chosen values; see [Product detail selections](Product-detail-selections.md).

## Rules

- [An attribute is used once per product and belongs to the subcategory](../rules/An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md): the attribute must be assigned to the product's subcategory and used once per product.
- [A detail value matches the value type of its attribute](../rules/A-detail-value-matches-the-value-type-of-its-attribute.md): a value must fit the attribute's value type.
- [A number detail stays within its bounds and is whole when required](../rules/A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md): a number stays within the attribute's minimum and maximum, and a whole-number attribute takes no decimals.
- [A list detail value belongs to the list of its attribute](../rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md): a list value must belong to the attribute's list.
- [Detail rows follow the attributes of the subcategory](../rules/Detail-rows-follow-the-attributes-of-the-subcategory.md): the rows follow the subcategory.
- [A detail that the subcategory requires must be filled](../rules/A-detail-that-the-subcategory-requires-must-be-filled.md) (planned with #10).
- [A detail number stays within the bounds of its subcategory](../rules/A-detail-number-stays-within-the-bounds-of-its-subcategory.md) (planned with #10).
- [Storage is not below memory](../rules/Storage-is-not-below-memory.md) (planned with #10).
- [Battery life is available only for a wireless device](../rules/Battery-life-is-available-only-for-a-wireless-device.md) (planned with #10).
- [Memory is a power of two](../rules/Memory-is-a-power-of-two.md) (planned with #10).

## Related

- [Products](Products.md), [Detail attributes](Detail-attributes.md), [Detail list values](Detail-list-values.md), [Product detail selections](Product-detail-selections.md)
- [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md)
- Why it is built this way: [Product details are rows of reusable attributes](../decisions/Product-details-are-rows-of-reusable-attributes.md) and [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).
