---
title: Categories
summary: A category is the broad group a product belongs to, kept in a read-only list.
tags: [category, domain, code-list]
code:
  - db/schema.cds
  - srv/annotations/Categories.cds
verified: aed00709548302f9
---

# Categories

## What it is

A category is the broad group of the catalog: Accessories, Electronics, Furniture, Kitchen, Sports or Stationery. It is a list that comes with the catalog. No role changes it through the catalog, and every signed-in user may read it. Every product has exactly one category. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Code**: the short stable identifier of the category, up to 20 characters. A product refers to its category by this code.
- **Name** and **description**: shown to the user in the user's language (English or Russian).

## Rules

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md) (BR-PRODUCTS-001) uses the category to decide which subcategories a product may carry.
- [Code lists are readable by every signed-in user](../rules/Code-lists-are-readable-by-every-signed-in-user.md): the list is read-only for every role.
- [Category, subcategory and currency must exist](../rules/Category-subcategory-and-currency-must-exist.md).

## Related

- [Subcategories](Subcategories.md), [Products](Products.md)
- [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md)
- Why it is built this way: [Code lists use stable upper-case codes](../decisions/Code-lists-use-stable-upper-case-codes.md) and [Fixed lists of values are chosen from a dropdown showing names](../decisions/Fixed-lists-of-values-are-chosen-from-a-dropdown-showing-names.md).
