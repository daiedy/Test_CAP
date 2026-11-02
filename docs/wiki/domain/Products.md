---
title: Products
summary: A product is the one thing the catalog holds, with a name, a price in a currency, a stock, a category, a subcategory and its details.
tags: [products, domain]
code:
  - db/schema.cds
  - srv/annotations/Products.cds
verified: 5d108315b067bf1e
---

# Products

## What it is

A product is an item sold in the catalog. Everyone who may read the catalog sees the saved version of a product in the list. A user with the CatalogEditor role creates and changes a product through a draft (see [Create a product through a draft](../how-to/Create-a-product-through-a-draft.md) and the [Glossary](../Glossary.md)). Every product also records who created it and who changed it last, and when. The full list of fields is in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Name**, **price**, **currency**, **stock**, **category** and **subcategory** are mandatory: a product without them cannot be saved.
- **Price** is a money amount between 0 and 99999999.99. It is given in the product's **currency**, which is a code such as USD taken from the standard SAP list of currencies (ISO 4217). The catalog does not keep its own currency list: it reuses the SAP code list, which is read-only, and shows each currency with its name in the user's language.
- **Stock** is the number of units in stock, a whole number from 0 to 1000000.
- **Rating** is optional, a whole number from 0 to 5.
- **Category** and **subcategory** place the product in the catalog. The subcategory must belong to the category; see [Categories](Categories.md) and [Subcategories](Subcategories.md).
- **Description** and **image URL** are optional free text.
- **Details** are the typed facts of the product, one per attribute of its subcategory; see [Product details](Product-details.md).

## Rules

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md) (BR-PRODUCTS-001).
- [A product is created and changed through a draft](../rules/A-product-is-created-and-changed-through-a-draft.md) (BR-PRODUCTS-002).
- [A product needs a name, price, currency, stock, category and subcategory](../rules/A-product-needs-a-name-price-currency-stock-category-and-subcategory.md) (BR-PRODUCTS-003).
- [Price, stock and rating stay within their bounds](../rules/Price-stock-and-rating-stay-within-their-bounds.md) (BR-PRODUCTS-004).
- [Category, subcategory and currency must exist](../rules/Category-subcategory-and-currency-must-exist.md) (BR-PRODUCTS-005).
- [The subcategory field stays disabled until a category is chosen](../rules/The-subcategory-field-stays-disabled-until-a-category-is-chosen.md) (BR-PRODUCTS-006).
- [Changing the category clears a subcategory that no longer fits](../rules/Changing-the-category-clears-a-subcategory-that-no-longer-fits.md) (BR-PRODUCTS-007).
- [A subcategory change must not leave details that do not fit](../rules/A-subcategory-change-must-not-leave-details-that-do-not-fit.md) (BR-PRODUCTS-008): a draft drops the rows with a warning, a direct write is refused.
- [Viewers read, editors change](../rules/Viewers-read-editors-change.md) (BR-ACCESS-002): only a CatalogEditor changes a product.
- [A product name has at least three characters](../rules/A-product-name-has-at-least-three-characters.md) (planned with #10).
- [A product name is unique in the catalog](../rules/A-product-name-is-unique-in-the-catalog.md) (planned with #10).
- [A price is above zero](../rules/A-price-is-above-zero.md) (planned with #10).
- [A price in a currency without minor units has no decimals](../rules/A-price-in-a-currency-without-minor-units-has-no-decimals.md) (planned with #10).
- [An image address uses https and has no spaces](../rules/An-image-address-uses-https-and-has-no-spaces.md) (planned with #10).
- [A product in stock needs a description](../rules/A-product-in-stock-needs-a-description.md) (planned with #10).

## Related

- [Categories](Categories.md), [Subcategories](Subcategories.md), [Product details](Product-details.md)
- [Find a product](../how-to/Find-a-product.md), [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md), [Import products from Excel](../how-to/Import-products-from-Excel.md)
- [Who may do what](../how-to/Who-may-do-what.md)
- Why it is built this way: [The catalog data follows one set of modeling rules](../decisions/The-catalog-data-follows-one-set-of-modeling-rules.md) and [Products are edited through drafts](../decisions/Products-are-edited-through-drafts.md).
