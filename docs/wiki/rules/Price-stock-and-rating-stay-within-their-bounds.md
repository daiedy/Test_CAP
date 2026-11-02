---
title: Price, stock and rating stay within their bounds
summary: The price is from 0 to 99,999,999.99, the stock from 0 to 1,000,000 and the rating from 0 to 5.
tags: [products, price, stock, rating, range]
id: BR-PRODUCTS-004
status: active
since: 2026-09-07
code:
  - srv/annotations/Products.cds
messages: []
elements:
  - Products.price
  - Products.stock
  - Products.rating
sources:
  - docs/decisions/ADR-0004-annotation-split.md
  - docs/features/products-rating-column/SUMMARY.md
  - docs/features/catalog-hygiene/SUMMARY.md
verified: dbca884ae8598da1
---

# Price, stock and rating stay within their bounds

## Rule

Three numbers have fixed bounds, both ends included:

- the price is between 0 and 99,999,999.99, with at most two decimals;
- the stock is a whole number between 0 and 1,000,000;
- the rating is a whole number between 0 and 5, and may be left empty.

## Why

A negative price or stock is a data entry mistake, and a rating outside the five-point scale would distort the average and the rating filter. The upper bounds keep the values inside what the price column and the lists can show. The price bound matches the column that stores it, so a price the bound allows is always stored exactly.

## Where it fires

- Draft, at Save: a value outside its bounds shows the message "Enter a value between 0 and 5." (with the bounds of that field) next to the field, and the draft is kept.
- API, an active write with a value outside the bounds is refused with HTTP 400 and the same message.
- Excel import: a row with such a value is reported with its row number and the column before anything is written.
- Planned with #10: [A price is above zero](A-price-is-above-zero.md) will make the lower bound of the price exclusive, so 0 is refused.
- The messages are the framework's own, so they are not keys of the catalog's message file.

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-07 | Introduced: bounds for the price and the stock. | [ADR-0004](../../decisions/ADR-0004-annotation-split.md) |
| 2026-09-25 | The rating is added as an optional whole number from 0 to 5. | [products-rating-column](../../features/products-rating-column/SUMMARY.md) |
| 2026-10-09 | The price column keeps two decimals, so the price bound is stored exactly. | [catalog-hygiene](../../features/catalog-hygiene/SUMMARY.md) |
