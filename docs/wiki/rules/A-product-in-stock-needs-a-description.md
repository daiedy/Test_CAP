---
title: A product in stock needs a description
summary: A product with stock above zero needs a description.
tags: [products, description, stock]
id: BR-PRODUCTS-014
status: active
since: 2026-10-14
aliases: [R6]
code:
  - srv/annotations/Products.cds
  - app/products/annotations/Products.cds
  - srv/lib/products-import.js
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_DESCRIPTION_REQUIRED_IN_STOCK]
elements: [Products.description, Products.stock]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: e84e970165a0304a
---

# A product in stock needs a description

## Rule

A product whose stock is above zero must have a description that is not empty or blank. A product with a stock of 0 may still have no description.

## Why

A product with stock is on sale and visible to customers, so it needs a description. A product with no stock may still be incomplete, so the description is not required for it. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, before anything is wrong: the Description field is marked as required while the stock is above zero and loses the marker when the stock is 0. Save with stock above zero and an empty description is refused with the message "Enter a description. Products in stock are visible to customers." on the Description field.
- Object Page, in a draft: when the description or the stock is changed, a message appears on both the Description and the Stock fields.
- Save, or a direct write through the API: an empty description with stock above zero is refused with HTTP 400.
- Excel import: each row is checked before anything is written, and a row that breaks the rule is reported with its row number (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- The mandatory fields of a product: [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R6). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R6). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
