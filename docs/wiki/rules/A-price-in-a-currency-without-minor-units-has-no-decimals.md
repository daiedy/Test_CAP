---
title: A price in a currency without minor units has no decimals
summary: A price in a currency without minor units, such as JPY or KRW, will have to be a whole amount.
tags: [products, price, currency]
id: BR-PRODUCTS-012
status: planned
since: 2026-10-14
aliases: [R4]
code:
  - srv/annotations/Products.cds
  - app/products/annotations/Products.cds
  - srv/lib/products-import.js
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_PRICE_MINOR_UNIT]
elements: [Products.price, Products.currency]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: e5c192f21561f408
---

# A price in a currency without minor units has no decimals

## Rule

Once #10 is implemented, when the currency of a product has no minor units (the Japanese yen and the Korean won are examples), the price must have no decimals. 1,500 JPY will be accepted, 10.50 JPY will not.

## Why

A currency without a minor unit has no coins below the whole unit, so a fraction cannot be paid. The price column keeps two decimals for every currency, so the catalog has to guard this case itself. The currency list of the catalog carries the number of minor units. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, before anything is wrong: the currency list will tell the price field the minor units of the chosen currency, so the field itself will refuse 10.50 with JPY on the client. The text that appears is recorded in the browser proof of #10.
- Object Page, when the currency is changed to one without minor units after a price with decimals was entered, and on every direct API write: a message will be shown on both the Price and the Currency fields, or returned with HTTP 400.
- Excel import: each row will be checked before anything is written, and a row that breaks the rule will be reported with its row number (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- The price must also be above zero: [A price is above zero](A-price-is-above-zero.md).
- The currency must exist: [Category, subcategory and currency must exist](Category-subcategory-and-currency-must-exist.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R4) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
