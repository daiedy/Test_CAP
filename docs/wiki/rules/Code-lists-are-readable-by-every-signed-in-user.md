---
title: Code lists are readable by every signed-in user
summary: Categories, subcategories, currencies and the other fixed lists are open to reading for any signed-in user, and no role changes them.
tags: [access, code-list, read-only]
id: BR-ACCESS-003
status: active
since: 2026-09-16
code:
  - srv/catalog-service.cds
messages: []
elements: []
sources:
  - docs/decisions/ADR-0013-catalog-authorization.md
  - docs/features/catalog-authorization/SUMMARY.md
  - docs/decisions/ADR-0010-code-list-codes.md
verified: 83c836a73a96ffd3
---

# Code lists are readable by every signed-in user

## Rule

The fixed lists of the catalog are readable by every signed-in user, whichever role the user has: the categories, the subcategories, the currencies, the detail attributes with their value types and list values, and the assignment of attributes to subcategories. Nobody changes them through the catalog, not even a CatalogEditor.

## Why

Both roles need the lists as dropdowns when they look at or fill in a product, and the lists hold nothing sensitive: public currency codes and a handful of category names. Restricting them would add nothing but a second set of role checks. They are maintained outside the running catalog, in the project's data files. See also [The catalog is open to signed-in users with a viewer or editor role](../decisions/The-catalog-is-open-to-signed-in-users-with-a-viewer-or-editor-role.md) and [Code lists use stable upper-case codes](../decisions/Code-lists-use-stable-upper-case-codes.md).

## Where it fires

- The dropdowns for category, subcategory, currency and the detail attribute fill for a viewer as well as an editor.
- An attempt to create, change or delete a list entry through the API is refused, because these lists are read-only in the service.
- A request without sign-in is refused first; see [Only signed-in users reach the catalog](Only-signed-in-users-reach-the-catalog.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-16 | Introduced: the lists are readable by any authenticated user, without a role check of their own. | [catalog-authorization](../../features/catalog-authorization/SUMMARY.md), [ADR-0013](../../decisions/ADR-0013-catalog-authorization.md) |
