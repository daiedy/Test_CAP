---
title: A product is created and changed through a draft
summary: New and changed products are first kept as a private draft that is checked at Save, and a draft locks its product for other users and is marked in the list.
tags: [products, draft, locking]
id: BR-PRODUCTS-002
status: active
since: 2026-09-07
code:
  - srv/catalog-service.cds
  - app/products/annotations/Products.cds
messages: []
elements: []
sources:
  - docs/decisions/ADR-0012-products-draft-editing.md
  - docs/features/products-draft-edit/SUMMARY.md
  - docs/decisions/ADR-0015-list-report-draft-marker.md
  - docs/features/products-draft-marker/SUMMARY.md
verified: 1d1f813ca4b00860
---

# A product is created and changed through a draft

## Rule

An editor does not change a saved product directly. Create starts an empty draft and Edit starts a draft copy of the product. The draft is private to its author. It replaces the saved product, or becomes a new one, only when the editor saves and every check passes. Cancel throws the draft away. While a draft of a product exists, no other user can start a second draft of it.

## Why

A product is filled in over several steps, and half-finished data must not appear in the list that everyone reads. A draft lets the editor stop, come back later and be checked once, at Save. The lock prevents two editors from overwriting each other's work. The decisions behind it are [Products are edited through drafts](../decisions/Products-are-edited-through-drafts.md) and [A draft or locked product is marked in the list](../decisions/A-draft-or-locked-product-is-marked-in-the-list.md).

## Where it fires

- Create and Edit open the draft; Save checks the whole product and shows the message of each failed check next to its field, keeping the draft so it can be corrected.
- The product list marks a row with a Draft marker when its draft belongs to the signed-in user, and shows it as locked when another user holds the draft. The marker follows the product name, which is the semantic key of the list.
- A second Edit on a product that another user holds in draft is refused with the framework's HTTP 409 conflict. The lock expires after 15 minutes without activity.
- Through the API, a write that names the saved version explicitly changes the product directly and runs the same checks at once; a write that does not creates a draft, which is checked only at activation.

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-07 | Introduced: drafts are switched on for products, with Edit, Save, Cancel, Create and Delete in the Fiori application. | [products-draft-edit](../../features/products-draft-edit/SUMMARY.md), [ADR-0012](../../decisions/ADR-0012-products-draft-editing.md) |
| 2026-09-09 | The list marks own drafts, locked rows and unsaved changes next to the product name. | [products-draft-marker](../../features/products-draft-marker/SUMMARY.md), [ADR-0015](../../decisions/ADR-0015-list-report-draft-marker.md) |
