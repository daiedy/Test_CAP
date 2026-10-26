---
title: A price is above zero
summary: A price will have to be above zero, so a free product is refused.
tags: [products, price, range]
id: BR-PRODUCTS-011
status: planned
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
verified: e0d6b58590ac81a7
---

# A price is above zero

## Rule

Once #10 is implemented, the price must be greater than zero. Zero will no longer be accepted; the upper bound of 99,999,999.99 stays.

## Why

A catalog has no free products, so a price of 0 is a data entry mistake. This tightens the lower bound of the price in the active rule [Price, stock and rating stay within their bounds](Price-stock-and-rating-stay-within-their-bounds.md). The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, in a draft: the price field will refuse 0 on the client at once, with the framework's own text and without a request to the server, because the open lower bound reaches the field as an exclusive minimum. The text that appears is recorded in the browser proof of #10.
- Save, or a direct write through the API: a price of 0 will be refused with HTTP 400 and a message that says the price must be above zero.
- Excel import: a row with a price of 0 will be reported with its row number and the column (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- Tightens the lower bound of [Price, stock and rating stay within their bounds](Price-stock-and-rating-stay-within-their-bounds.md).
- The price and the currency together: [A price in a currency without minor units has no decimals](A-price-in-a-currency-without-minor-units-has-no-decimals.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R3) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
