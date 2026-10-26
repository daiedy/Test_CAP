---
title: Find a product
summary: Narrow the list of products by name, category, price or rating, and read the draft markers in the list.
tags: [products, list, filter]
code:
  - app/products/annotations/Products.cds
  - app/products/webapp/ext/fragment/RatingRangeFilter.fragment.xml
verified: 5ff37f05d760e0d3
---

# Find a product

## Goal

See only the products you need in the product list, and open one of them.

## Steps

1. Open the product list (the List Report). It shows every product with its name, category, subcategory, price, stock and rating.
2. Use the filter bar above the table. You can filter by name, category and price. The rating filter is a slider from 0 to 5: move both ends to choose a range. The list updates as you change a filter; there is no Go button.
3. Choose a category from the dropdown. It shows the category names in your language, not codes.
4. Open the Editing Status filter if you want to see products with an unsaved draft. See the [Glossary](../Glossary.md) for **draft**.
5. Read the marker after a product name: it tells you that the row is your own draft, or that another user is editing it and the product is locked for you.
6. Select a row to open the product page (the Object Page).

## Rules that apply

- What a product holds: [Products](../domain/Products.md).
- Every product has one category and one subcategory; see [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md).
- Reading the list is allowed for every signed-in user, viewers included; see [Who may do what](Who-may-do-what.md).
- Why the filter and the marker look this way: [A custom filter field replaces the standard field of its property](../decisions/A-custom-filter-field-replaces-the-standard-field-of-its-property.md) and [A draft or locked product is marked in the list](../decisions/A-draft-or-locked-product-is-marked-in-the-list.md).
