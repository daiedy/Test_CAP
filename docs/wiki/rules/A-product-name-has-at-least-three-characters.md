---
title: A product name has at least three characters
summary: A product name needs at least three characters once leading and trailing spaces are removed.
tags: [products, name, format]
id: BR-PRODUCTS-009
status: active
since: 2026-10-14
aliases: [R1]
code:
  - srv/annotations/Products.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_NAME_TOO_SHORT]
elements: [Products.name]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 1481ff0feae3a5a0
---

# A product name has at least three characters

## Rule

A product name must have at least three characters after the spaces at both ends are removed. A name of one or two letters, or of spaces only, is refused.

## Why

A one- or two-letter name is not a name a customer or a colleague can search for. Requiring three characters keeps the catalog searchable. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, in a draft: right after the name is changed, the Name field turns red with a message that names the minimum length. The framework offers no input control for a minimum length, so this rule is a validation only.
- Save, or a direct write through the API: a name that is too short is refused with HTTP 400 and the same message.
- Excel import: a row with a short name is reported with its row number and the column before anything is written (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

See also:

- The name is mandatory already: [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).
- A name must also be new: [A product name is unique in the catalog](A-product-name-is-unique-in-the-catalog.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R1). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R1). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
