---
title: An image address uses https and has no spaces
summary: The image address of a product will have to start with https and contain no spaces.
tags: [products, image, format]
id: BR-PRODUCTS-013
status: planned
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
verified: e0d6b58590ac81a7
---

# An image address uses https and has no spaces

## Rule

Once #10 is implemented, if a product has an image address, it must start with https:// and must not contain a space or another blank character. An address with http:// or with a space will be refused. An empty address stays allowed.

## Why

The browser loads the header image straight from the address. A page served over https blocks an image from an http address, and a space breaks the address. Refusing both at entry keeps the image from silently not appearing. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, in a draft: right after the address is changed, the Image URL field will turn red with a message that names the https requirement. There is no input control for a text pattern, so this rule is a validation only.
- Save, or a direct write through the API: a wrong address will be refused with HTTP 400 and the same message.
- Excel import: a row with a wrong address will be reported with its row number and the column (see [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md)).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R5) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
