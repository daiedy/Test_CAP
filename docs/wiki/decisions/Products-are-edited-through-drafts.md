---
title: Products are edited through drafts
summary: A product is created and changed in a private draft that becomes the product only on Save, with the standard Edit, Save and Cancel buttons (ADR-0012).
tags: [products, draft, editing]
adr: ADR-0012
sources:
  - docs/decisions/ADR-0012-products-draft-editing.md
---

# Products are edited through drafts

## Decision

The product list is draft-enabled. Edit, Save and Cancel (with a confirmation before a draft is thrown away) on the product page, and Create and Delete on the list, are the standard behaviour of the platform's screens and are accepted as they are. Editing the saved product field by field without a draft ("inline edit") is not switched on in this feature and may be added later as a complement. The draft setting is part of the service definition, because it changes the contract for every client, not only the screen. Tests, scripts and any client that is not the Fiori screen say explicitly whether they mean the saved product or a draft. The platform's draft settings (locks, timeouts, messages) stay at their defaults, the standard draft indicators stay visible, and no extra code is written for drafts: validation stays declarative and runs when a draft is saved and on direct writes to the saved product.

## Why

The product page had no edit mode, because the platform shows Edit, Save and Cancel only for a draft-enabled list. The project had no rule on whether an editable screen uses drafts or inline edit.

## What it means for the catalog

- Nobody changes a product directly: Edit opens a private draft, Save checks every rule and publishes it, Cancel throws it away. See [A product is created and changed through a draft](../rules/A-product-is-created-and-changed-through-a-draft.md).
- While one person has a draft, another person cannot start a second one; the row shows that the product is locked. See [The draft and lock marker](A-draft-or-locked-product-is-marked-in-the-list.md).
- Step by step: [Create a product through a draft](../how-to/Create-a-product-through-a-draft.md) and [Edit, save, keep or discard a draft](../how-to/Edit-save-keep-or-discard-a-draft.md).
- A draft is not checked as strictly as a saved product: the full check happens on Save.

## Source

[ADR-0012: Editing Products in the Fiori app through drafts on CatalogService.Products](../../decisions/ADR-0012-products-draft-editing.md)
