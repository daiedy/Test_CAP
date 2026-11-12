---
title: An image address uses https and has no spaces
summary: The image address of a product has to start with https and contain no spaces.
tags: [products, image, format]
id: BR-PRODUCTS-013
status: active
since: 2026-10-14
aliases: [R5]
code:
  - srv/annotations/Products.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_IMAGE_URL_HTTPS]
elements: [Products.imageUrl]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: 1481ff0feae3a5a0
---

# An image address uses https and has no spaces

## Rule

If a product has an image address, it must start with https:// and must not contain a space or another blank character. An address with http:// or with a space is refused. An empty address stays allowed.

## Why

The browser loads the header image straight from the address. A page served over https blocks an image from an http address, and a space breaks the address. Refusing both at entry keeps the image from silently not appearing. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

What the user sees:

- Object Page, in a draft: right after the address is changed, the Image URL field turns red with a message that names the https requirement. There is no input control for a text pattern, so this rule is a validation only.
- Save, or a direct write through the API: a wrong address is refused with HTTP 400 and the same message.
- Excel import: a row with a wrong address is reported with its row number and the column (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R5). | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
| 2026-11-12 | Implemented and verified in `en` and `ru` (alias R5). | [Feature summary](../../features/products-validations/SUMMARY.md), [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
