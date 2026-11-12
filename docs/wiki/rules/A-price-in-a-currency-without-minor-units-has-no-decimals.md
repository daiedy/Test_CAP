---
title: A price in a currency without minor units has no decimals
summary: A price in a currency without minor units, such as JPY or KRW, has to be a whole amount.
tags: [products, price, currency]
id: BR-PRODUCTS-012
status: active
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
verified: e84e970165a0304a
---

# A price in a currency without minor units has no decimals

## Rule

When the currency of a product has no minor units (the Japanese yen and the Korean won are examples), the price must have no decimals. 1,500 JPY is accepted, 10.50 JPY is refused.

## Why

A currency without a minor unit has no coins below the whole unit, so a fraction cannot be paid. The price column keeps two decimals for every currency, so the catalog has to guard this case itself. The currency list of the catalog carries the number of minor units. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, before anything is wrong: the currency list tells the price field the minor units of the chosen currency, so the field itself refuses 10.50 with JPY on the client, with the framework text "Enter a number without decimals." and without a request to the server.
- Object Page, when the currency is changed to one without minor units after a price with decimals was entered, and on every direct API write: a message ("Enter the price as a whole number. This currency has no decimal places.") is shown on both the Price and the Currency fields, or returned with HTTP 400 for the price.
- Excel import: each row is checked before anything is written, and a row that breaks the rule is reported with its row number (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- The price must also be above zero: [A price is above zero](A-price-is-above-zero.md).
- The currency must exist: [Category, subcategory and currency must exist](Category-subcategory-and-currency-must-exist.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R4). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R4). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
