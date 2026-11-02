---
title: An import creates all products or none
summary: An Excel import writes every row as an active product, or writes nothing and lists every problem of the file at once.
tags: [import, excel, products]
id: BR-IMPORT-001
status: active
since: 2026-09-29
code:
  - srv/catalog-service.js
  - srv/lib/products-import.js
messages: [PRODUCTS_IMPORT_NOTHING_IMPORTED, PRODUCTS_IMPORT_DONE]
elements: []
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
verified: 5ac44903751a96d7
---

# An import creates all products or none

## Rule

An import either creates a product for every row of the file or creates none. If anything in the file is wrong, nothing is written, and the answer lists every problem found, not only the first one. A clean file creates its rows as active products, without a draft and without detail rows.

## Why

A half-imported file is hard to repair: the user would not know which rows are already in the catalog, and importing the corrected file again would create duplicates. Reporting all problems together lets the user fix the file once. The decision behind it is [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- Failure: the answer starts with "No products were imported. Correct the rows listed below and import the file again." and then lists each problem with its row number and column, with no cap on their number. The problems come from [The header row names known columns once and includes the mandatory ones](The-header-row-names-known-columns-once-and-includes-the-mandatory-ones.md), [The import file is an xlsx workbook with product rows within the size limits](The-import-file-is-an-xlsx-workbook-with-product-rows-within-the-size-limits.md), [An imported product name must be new](An-imported-product-name-must-be-new.md) and [Every imported row follows the rules of a product](Every-imported-row-follows-the-rules-of-a-product.md).
- Success: the answer says "Products imported: {0}." with the number of created products, and the list refreshes.
- Only an editor can import; see [Viewers read, editors change](Viewers-read-editors-change.md). To add details to an imported product, edit it; see [Detail rows follow the attributes of the subcategory](Detail-rows-follow-the-attributes-of-the-subcategory.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-29 | Introduced: one insert per row inside one transaction, all-or-nothing, a complete row report. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
