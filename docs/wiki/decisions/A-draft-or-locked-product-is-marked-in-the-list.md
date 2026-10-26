---
title: A draft or locked product is marked in the list
summary: The product list marks a row that has a draft or is locked by another user, through the name column and without any custom code (ADR-0015).
tags: [products, draft, list]
adr: ADR-0015
sources:
  - docs/decisions/ADR-0015-list-report-draft-marker.md
---

# A draft or locked product is marked in the list

## Decision

The marker in the product list is produced by one presentation setting: the product name is declared as the "semantic key" of the product. The platform then draws the draft or lock marker next to the name in the list and writes the text itself. No custom column, formatter or screen code is used. The name is deliberately not made unique: the platform only uses the semantic key to choose the marker column, while the identity of a product and the whole draft procedure run on the technical key. A uniqueness rule would be a new business rule, with its own tests, text and migration question, and would forbid legitimate duplicates; if a real business key is wanted, it is a separate feature. The marker of a draft is tested automatically; the "locked by another user" case is checked by hand, because one test session cannot create another user's draft.

## Why

Once products are edited through drafts, a user needs to see in the list which products have an unsaved draft or are being edited by somebody else.

## What it means for the catalog

- A product with a draft shows a draft marker beside its name, and a product that someone else is editing shows a lock marker. See [Edit, save, keep or discard a draft](../how-to/Edit-save-keep-or-discard-a-draft.md).
- At the time of this decision two products may still have the same name; a rule that forbids it is planned separately: [A product name is unique in the catalog](../rules/A-product-name-is-unique-in-the-catalog.md).
- The marker belongs to the draft procedure described in [Products are edited through drafts](Products-are-edited-through-drafts.md) and the rule [A product is created and changed through a draft](../rules/A-product-is-created-and-changed-through-a-draft.md).

## Source

[ADR-0015: Draft and lock marker in the List Report row via @Common.SemanticKey](../../decisions/ADR-0015-list-report-draft-marker.md)
