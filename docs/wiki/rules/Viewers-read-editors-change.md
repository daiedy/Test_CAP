---
title: Viewers read, editors change
summary: A viewer only reads products, an editor also creates, changes, deletes and imports them, and the screen hides the buttons a viewer cannot use.
tags: [access, roles, authorization]
id: BR-ACCESS-002
status: active
since: 2026-09-16
code:
  - srv/catalog-service.cds
  - srv/catalog-service.js
  - app/products/annotations/Products.cds
messages: []
elements: []
sources:
  - docs/decisions/ADR-0013-catalog-authorization.md
  - docs/features/catalog-authorization/SUMMARY.md
  - docs/features/catalog-hygiene/SUMMARY.md
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
verified: 6b8ba77912379e2b
---

# Viewers read, editors change

## Rule

A user with the role CatalogViewer may read products, their details and the lists. A user with the role CatalogEditor may do everything with products: create, edit, delete and import them. The details of a product are changed only together with the product, so the same two roles apply to them.

## Why

Most people only need to look something up, and a few maintain the catalog. Two roles keep that split simple. Buttons that would only end in a refusal are hidden, so a viewer is not offered an action that cannot work. The decisions behind it are [The catalog is open to signed-in users with a viewer or editor role](../decisions/The-catalog-is-open-to-signed-in-users-with-a-viewer-or-editor-role.md) and, for the import button, [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- A viewer does not see Create, Delete and Import from Excel in the product list, nor Edit and Delete on the product page. The screen asks the catalog, through the read-only call Permissions, whether the signed-in user is an editor, and hides the buttons when the answer is no.
- Hiding is a convenience, not the protection. A viewer who calls the API directly to create, change or delete a product is refused with HTTP 403.
- A user with neither role is refused on every product request.

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-16 | Introduced: the roles CatalogViewer and CatalogEditor, and the buttons hidden from a viewer through the Permissions call. | [catalog-authorization](../../features/catalog-authorization/SUMMARY.md), [ADR-0013](../../decisions/ADR-0013-catalog-authorization.md) |
| 2026-09-25 | Import from Excel is hidden from a viewer like the other editor actions. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
| 2026-10-09 | The hiding reads the short path to the Permissions answer, which removes a browser console error on the product page; behavior unchanged. | [catalog-hygiene](../../features/catalog-hygiene/SUMMARY.md), [ADR-0013](../../decisions/ADR-0013-catalog-authorization.md) |
