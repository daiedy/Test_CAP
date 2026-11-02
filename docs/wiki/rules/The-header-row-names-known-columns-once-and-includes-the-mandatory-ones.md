---
title: The header row names known columns once and includes the mandatory ones
summary: The first row of the workbook may name only the supported columns, each once, and must include name, price, currency, stock, category and subcategory.
tags: [import, excel, columns]
id: BR-IMPORT-002
status: active
since: 2026-09-29
code:
  - srv/lib/products-import.js
  - _i18n/messages.properties
messages: [PRODUCTS_IMPORT_UNKNOWN_COLUMN, PRODUCTS_IMPORT_DUPLICATE_COLUMN, PRODUCTS_IMPORT_MISSING_COLUMN]
elements: []
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: 9de3a1665a6a7215
---

# The header row names known columns once and includes the mandatory ones

## Rule

The first row of the first sheet is a header. Its cells may be `name`, `description`, `price`, `currency`, `stock`, `category`, `subcategory`, `rating` and `imageUrl`, in any order and any letter case. A column may appear only once, and the six columns `name`, `price`, `currency`, `stock`, `category` and `subcategory` must all be present. Empty header cells are ignored.

## Why

The columns decide which product field each cell fills. An unknown name is probably a typing mistake, a repeated column would silently overwrite one set of values with another, and a missing mandatory column would make every row invalid. The decision behind it is [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- Unknown column: "Column "{0}" is not supported. Allowed columns: name, description, price, currency, stock, category, rating, imageUrl." The list in this text omits `subcategory`, which the import does accept and require; this is a known defect of the message recorded in the open debt of the project state.
- Repeated column: "The header row names column "{0}" more than once." It is reported once per column, at its second occurrence.
- Missing column: "The header row has no column "{0}"." with one message for each missing mandatory column.
- All three are checked before any row is read, together with the other structural problems of the file; see [An import creates all products or none](An-import-creates-all-products-or-none.md). The workbook format is also described in [Import products from Excel](../how-to/Import-products-from-Excel.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-29 | Introduced: known columns and the mandatory ones, with the column list name, description, price, currency, stock, category, rating, imageUrl. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
| 2026-09-29 | Added in the review of the same feature: a repeated column is refused instead of letting the right-most cell win. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
| 2026-10-10 | The `subcategory` column is added and made mandatory. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
