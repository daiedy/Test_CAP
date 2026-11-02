---
title: A product in stock needs a description
summary: A product with stock above zero will need a description.
tags: [products, description, stock]
id: BR-PRODUCTS-014
status: planned
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
verified: e5c192f21561f408
---

# A product in stock needs a description

## Rule

Once #10 is implemented, a product whose stock is above zero must have a description that is not empty or blank. A product with a stock of 0 may still have no description.

## Why

A product with stock is on sale and visible to customers, so it needs a description. A product with no stock may still be incomplete, so the description is not required for it. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, before anything is wrong: the Description field will be marked as required while the stock is above zero and will lose the marker when the stock is 0. Whether the Save is refused on the client for an empty marked field is part of the browser proof of #10.
- Object Page, in a draft: when the description or the stock is changed, a message will appear on both the Description and the Stock fields.
- Save, or a direct write through the API: an empty description with stock above zero will be refused with HTTP 400.
- Excel import: each row will be checked before anything is written, and a row that breaks the rule will be reported with its row number (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- The mandatory fields of a product: [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R6) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
