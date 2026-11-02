---
title: An imported product name must be new
summary: A row is refused when its name equals the name of an active product or of an earlier row of the same file.
tags: [import, excel, name, duplicates]
id: BR-IMPORT-004
status: active
since: 2026-09-29
code:
  - srv/catalog-service.js
messages: [PRODUCTS_IMPORT_DUPLICATE_NAME]
elements: []
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
verified: 55aea3974a21e469
---

# An imported product name must be new

## Rule

The name of an imported row may not equal, ignoring letter case and surrounding spaces, the name of a product already in the catalog or the name of an earlier row of the same file. The first row with a name is accepted; later rows with the same name are refused.

## Why

Importing the same file twice, or a file with a repeated line, would double the catalog. The catalog itself does not forbid equal names, so this protection exists only for the import. The decision behind it is [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- Each refused row gets "Row {0}, column "name": a product named "{1}" already exists in the catalog or earlier in the file." The check runs before any row is written and is reported together with the other problems; see [An import creates all products or none](An-import-creates-all-products-or-none.md).
- Only saved products count; a product that is still a draft does not. A product created on the screen or through the API can still take a name that already exists.

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-29 | Introduced: duplicate names are row errors, checked against the catalog and the file. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
