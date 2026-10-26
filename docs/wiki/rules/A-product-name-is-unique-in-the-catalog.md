---
title: A product name is unique in the catalog
summary: A product name will have to be new in the catalog, ignoring capital letters and spaces at both ends.
tags: [products, name, unique]
id: BR-PRODUCTS-010
status: planned
since: 2026-10-14
aliases: [R2]
code:
  - srv/annotations/Products.cds
  - db/schema.cds
  - _i18n/messages.properties
  - _i18n/messages_ru.properties
messages: [PRODUCTS_NAME_DUPLICATE]
elements: [Products.name]
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
verified: c45d03ff2a141221
---

# A product name is unique in the catalog

## Rule

Once #10 is implemented, no two products may have the same name. The comparison ignores capital letters and spaces at both ends, so "Backpack" and "backpack " count as the same name.

## Why

Two listings with the same name cannot be told apart in the list or in a search. The Excel import already refuses a duplicate name; the Object Page and the API do not, so this rule closes the gap. The decision behind it is [Validation rules follow one toolkit and prevent before they refuse](../decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md).

## Where it fires

This rule is planned with #10 and is not in the code yet. What the user will see:

- Object Page, in a draft: after the name is changed, the Name field will show that the name is taken. The check cannot be made by the browser alone, so there is no preventing control; the message appears when the draft messages are read after the change.
- Save, or a direct write through the API: a name that already belongs to another product will be refused with HTTP 400.
- Excel import: unchanged. [An imported product name must be new](An-imported-product-name-must-be-new.md) already covers it.

See also:

- The same check on the import path: [An imported product name must be new](An-imported-product-name-must-be-new.md).
- The length of the name: [A product name has at least three characters](A-product-name-has-at-least-three-characters.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-10-14 | Planned: the rule was approved in the specification of #10 (alias R2) and is not implemented yet. | [ADR-0028](../../decisions/ADR-0028-validation-toolkit.md) |
