---
title: Create a product through a draft
summary: Create a product by filling a private draft and saving it, so it appears in the catalog only when complete.
tags: [products, draft, create]
code:
  - srv/annotations/Products.cds
  - app/products/annotations/Products.cds
verified: cd17f8f8027a7ad1
---

# Create a product through a draft

## Goal

Add a new product to the catalog.

## Steps

1. Sign in as a user with the CatalogEditor role. Other users do not see the Create button; see [Who may do what](Who-may-do-what.md).
2. In the product list, choose Create. The catalog opens an empty **draft** of a product, a private working copy that nobody else sees (see the [Glossary](../Glossary.md)).
3. Fill the mandatory fields: name, price, currency, stock, category and subcategory. Description, rating and image address are optional. Choose the subcategory after the category; see [Choose a category and subcategory](Choose-a-category-and-subcategory.md).
4. Fill the details of the product if you want to; see [Fill the details of a product](Fill-the-details-of-a-product.md).
5. Choose Save. The catalog checks the whole product. If something is wrong it shows a message next to the field and keeps the draft, so you can fix it and save again.
6. After a successful save the draft becomes an active product and shows in the list.

To create many products at once, see [Import products from Excel](Import-products-from-Excel.md).

## Rules that apply

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md).
- [A product is created and changed through a draft](../rules/A-product-is-created-and-changed-through-a-draft.md).
- [A product needs a name, price, currency, stock, category and subcategory](../rules/A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).
- [Price, stock and rating stay within their bounds](../rules/Price-stock-and-rating-stay-within-their-bounds.md): the price is between 0 and 99,999,999.99, the stock between 0 and 1,000,000, the rating between 0 and 5.
- [Category, subcategory and currency must exist](../rules/Category-subcategory-and-currency-must-exist.md).
- [A product name has at least three characters](../rules/A-product-name-has-at-least-three-characters.md) (planned with #10).
- [A product name is unique in the catalog](../rules/A-product-name-is-unique-in-the-catalog.md) (planned with #10).
- [A price is above zero](../rules/A-price-is-above-zero.md) (planned with #10).
- [A price in a currency without minor units has no decimals](../rules/A-price-in-a-currency-without-minor-units-has-no-decimals.md) (planned with #10).
- [An image address uses https and has no spaces](../rules/An-image-address-uses-https-and-has-no-spaces.md) (planned with #10).
- [A product in stock needs a description](../rules/A-product-in-stock-needs-a-description.md) (planned with #10).
- Why a draft: [Products are edited through drafts](../decisions/Products-are-edited-through-drafts.md).
