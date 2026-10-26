---
title: Subcategories
summary: A subcategory refines one category and decides which details a product offers.
tags: [subcategory, category, domain, code-list]
code:
  - db/schema.cds
  - srv/annotations/Subcategories.cds
verified: d97c40c842ed3b79
---

# Subcategories

## What it is

A subcategory is a narrower group inside exactly one category: Laptops, Mice and Audio belong to Electronics, for example. Like the categories, the list comes with the catalog and is read-only for every role. Every product has exactly one subcategory, and the subcategory decides which attributes the product's details offer. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Code**: the short stable identifier, up to 20 characters.
- **Name** and **description**: shown in the user's language.
- **Category**: the one category the subcategory belongs to. The product form uses it to offer only the matching subcategories.

## Rules

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md) (BR-PRODUCTS-001).
- [A subcategory change must not leave details that do not fit](../rules/A-subcategory-change-must-not-leave-details-that-do-not-fit.md): a draft drops the rows that do not fit, with a warning; a direct write with such rows is refused.
- [Changing the category clears a subcategory that no longer fits](../rules/Changing-the-category-clears-a-subcategory-that-no-longer-fits.md).
- [Code lists are readable by every signed-in user](../rules/Code-lists-are-readable-by-every-signed-in-user.md): the list is read-only for every role.

## Related

- [Categories](Categories.md), [Products](Products.md), [Subcategory attributes](Subcategory-attributes.md)
- [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md)
- Why it is built this way: [A dependent field offers only the values of its parent field](../decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md).
