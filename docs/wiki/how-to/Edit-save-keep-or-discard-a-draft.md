---
title: Edit, save, keep or discard a draft
summary: Change an existing product through a draft, then save it, leave it for later or discard it.
tags: [products, draft, edit]
code:
  - srv/catalog-service.cds
  - app/products/annotations/Products.cds
verified: 1d1f813ca4b00860
---

# Edit, save, keep or discard a draft

## Goal

Change a product without showing half-finished work to others, and decide what happens to the change.

## Steps

1. Sign in as a CatalogEditor; see [Who may do what](Who-may-do-what.md).
2. Open the product and choose Edit. The catalog makes a **draft** from the saved product (see the [Glossary](../Glossary.md)). The saved, **active product** stays unchanged and visible to everyone while you work.
3. Change the fields. If you change the category, a subcategory that belongs to the old category is cleared without a message; choose a new one.
4. To keep the change, choose Save. The catalog checks the whole product; the draft replaces the active product only when every check passes.
5. To leave and come back later, just go back to the list. The draft stays; your row carries a Draft marker, and you can continue it with Edit.
6. To drop the change, choose Cancel and confirm. The draft is deleted and the active product is as it was.
7. While you hold a draft of a product, other users see the row as locked by you and cannot edit it.

To remove a whole product, choose Delete in the list (after selecting the row) or on the product page.

## Rules that apply

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md): a category change on a draft clears a foreign subcategory.
- [A product is created and changed through a draft](../rules/A-product-is-created-and-changed-through-a-draft.md): the values are checked when you save, not while you type, and a draft locks the product for other users.
- [Viewers read, editors change](../rules/Viewers-read-editors-change.md): a viewer cannot edit or delete.
