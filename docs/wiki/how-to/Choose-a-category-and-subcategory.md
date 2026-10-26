---
title: Choose a category and subcategory
summary: Pick the category first, then a subcategory that belongs to it.
tags: [products, category, subcategory]
code:
  - app/products/annotations/Products.cds
  - app/products/annotations/Subcategories.cds
  - srv/catalog-service.js
verified: 2876d3919dbf53ec
---

# Choose a category and subcategory

## Goal

Place a product in the right branch of the catalog.

## Steps

1. Open a product in edit mode or a new draft; see [Edit, save, keep or discard a draft](Edit-save-keep-or-discard-a-draft.md).
2. Choose the category from the dropdown: Accessories, Electronics, Furniture, Kitchen, Sports or Stationery. The names appear in your language.
3. Open the Subcategory field. It is disabled until a category is chosen. Then it lists only the subcategories of that category, for example Laptops, Mice and Audio for Electronics.
4. Choose one subcategory. Both fields are mandatory.
5. If you change the category later, the subcategory is cleared because it belonged to the old category. Choose a new one.
6. If the product already has details, a new subcategory on a draft keeps the details that also apply to it and removes the others; the catalog shows a warning with the number of removed values. A direct write through the API with details that do not fit is refused until they are deleted or changed. See [Fill the details of a product](Fill-the-details-of-a-product.md).

Terms: [Glossary](../Glossary.md), **category** and **subcategory**. The lists are described in [Categories](../domain/Categories.md) and [Subcategories](../domain/Subcategories.md).

## Rules that apply

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md).
- [The subcategory field stays disabled until a category is chosen](../rules/The-subcategory-field-stays-disabled-until-a-category-is-chosen.md).
- [Changing the category clears a subcategory that no longer fits](../rules/Changing-the-category-clears-a-subcategory-that-no-longer-fits.md).
- [Category, subcategory and currency must exist](../rules/Category-subcategory-and-currency-must-exist.md).
- [A subcategory change must not leave details that do not fit](../rules/A-subcategory-change-must-not-leave-details-that-do-not-fit.md): the draft drops the rows with a warning, a direct write is refused.
- Why the dropdowns behave this way: [A dependent field offers only the values of its parent field](../decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md), [Fixed lists of values are chosen from a dropdown showing names](../decisions/Fixed-lists-of-values-are-chosen-from-a-dropdown-showing-names.md) and [A field is disabled until the field it depends on is filled](../decisions/A-field-is-disabled-until-the-field-it-depends-on-is-filled.md).
