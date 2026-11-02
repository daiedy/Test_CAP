---
title: Who may do what
summary: Which actions each of the two catalog roles may use, and what an unsigned user gets.
tags: [access, roles, authorization]
code:
  - srv/catalog-service.cds
  - app/products/annotations/Products.cds
verified: 1d1f813ca4b00860
---

# Who may do what

## Goal

Know which actions you can expect to see, based on your role.

## Steps

1. Sign in. The catalog needs a signed-in user for everything, including reading; an unsigned request is refused.
2. A user with the CatalogViewer role (see the [Glossary](../Glossary.md)) can read: the product list, the filters, the product page with its details, and the lists of categories and subcategories. The buttons Create, Edit, Delete and Import from Excel are hidden.
3. A user with the CatalogEditor role can read and also create, edit, delete and import products; see [Create a product through a draft](Create-a-product-through-a-draft.md), [Edit, save, keep or discard a draft](Edit-save-keep-or-discard-a-draft.md) and [Import products from Excel](Import-products-from-Excel.md).
4. Nobody changes categories, subcategories, attributes or list values through the catalog: they are read-only for every role.
5. The catalog application asks the catalog, with a read-only call named Permissions, whether you may edit. The answer is a single yes or no for the signed-in user (editor or not), and the screen hides or shows the editor buttons from it.
6. In the development setup the users `alice` and `bob` are editors, and `viewer` is a viewer. Any password works there.

Hiding a button is a convenience. The catalog refuses a forbidden action from any client, so a viewer who calls the API directly is refused too.

## Rules that apply

- [Only signed-in users reach the catalog](../rules/Only-signed-in-users-reach-the-catalog.md): an unsigned request is refused.
- [Viewers read, editors change](../rules/Viewers-read-editors-change.md): reading needs the CatalogViewer or the CatalogEditor role, every change needs the CatalogEditor role, and the editor buttons are hidden from a viewer.
- [Code lists are readable by every signed-in user](../rules/Code-lists-are-readable-by-every-signed-in-user.md): the lists are read-only for every role.
- Why the roles are these: [The catalog is open to signed-in users with a viewer or editor role](../decisions/The-catalog-is-open-to-signed-in-users-with-a-viewer-or-editor-role.md).
