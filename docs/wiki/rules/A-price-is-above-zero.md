---
title: A price is above zero
summary: A price has to be above zero, so a free product is refused.
tags: [products, price, range]
id: BR-PRODUCTS-011
status: active
since: 2026-10-14
aliases: [R3]
code:
  - srv/annotations/Products.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_PRICE_POSITIVE]
elements: [Products.price]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 1481ff0feae3a5a0
---

# A price is above zero

## Rule

The price must be at least 0.01, the smallest amount the price column holds with its two decimals, so 0 and negative prices are refused; the upper bound of 99,999,999.99 stays.

## Why

A catalog has no free products, so a price of 0 is a data entry mistake. This tightens the lower bound of the price in the active rule [Price, stock and rating stay within their bounds](Price-stock-and-rating-stay-within-their-bounds.md). The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, in a draft: the price field refuses 0 on the client at once, with the framework text "Enter a number with a minimum value of 0.01" and without a request to the server. The bound is written closed at 0.01 because Fiori Elements ignores an open (exclusive) bound on the client; the user accepted this on 2026-11-12 (ADR-0028 amendment A).
- Save, or a direct write through the API: a price of 0 is refused with HTTP 400 and the message "Enter a price greater than 0."; an API value between 0 and 0.01 (for example 0.005) is refused too.
- Excel import: a row with a price of 0 is reported with its row number and the column (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- Tightens the lower bound of [Price, stock and rating stay within their bounds](Price-stock-and-rating-stay-within-their-bounds.md).
- The price and the currency together: [A price in a currency without minor units has no decimals](A-price-in-a-currency-without-minor-units-has-no-decimals.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R3). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R3). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
