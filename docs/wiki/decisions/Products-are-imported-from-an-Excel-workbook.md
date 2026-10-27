---
title: Products are imported from an Excel workbook
summary: An editor uploads an .xlsx file from the product list; every row is checked like a normal product and either all rows are created or none (ADR-0021).
tags: [products, import, excel]
adr: ADR-0021
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
---

# Products are imported from an Excel workbook

## Decision

The workbook is read on the server with a small read-only library for `.xlsx` files, and the reading and the column mapping live in a separate, unit-tested module. The import is one action on the product list that receives the uploaded file; it has the same access rights as the products, so only an editor may run it. Each row is created as an active product, one insert per row inside the one transaction of the action, so that the generic checks of the catalog run for every row and an error is tied to its row number. No draft is created. The import itself checks only what no annotation can say: the structure of the workbook, the row limit and duplicate names.

The import is all or nothing with a complete report: every row is checked, and if anything fails, one error lists every failure and nothing is written. A clean file creates all rows and reports how many products were created. A name that repeats inside the file, or equals the name of an existing active product (ignoring case and surrounding spaces), is a row error. The upload is shown by the platform's own action dialog with a button "Import from Excel" that is hidden for a viewer. The workbook contract, as amended on 2026-09-28 (a repeated column and an unpacked-size guard) and on 2026-10-10 (the `subcategory` column): the first sheet, a header row naming `name`, `description`, `price`, `currency`, `stock`, `category`, `subcategory`, `rating` and `imageUrl` in any order and letter case, each at most once; the mandatory columns are `name`, `price`, `currency`, `stock`, `category` and `subcategory`; currency, category and subcategory hold codes, never names; empty rows are skipped; at most 1,000 data rows and at most 10 MB of unpacked workbook, checked before the file is read; only `.xlsx` is accepted; the format hint appears only in the field label and the README. Because the catalog's rule that a subcategory belongs to the product's category is checked only when the transaction commits and names no row, the import also checks that pair for every row before the inserts, so a mismatch is reported with its row number; the catalog rule itself stays as the guard.

## Why

Creating many products one draft at a time is slow, and a partly imported file is hard to repair. Reusing the normal checks keeps an imported product to the same rules as a typed one.

## What it means for the catalog

- An editor can create many products in one step. See [Import products from Excel](../how-to/Import-products-from-Excel.md).
- The file is rejected as a whole when a header is wrong or a row is bad. See [An import creates all products or none](../rules/An-import-creates-all-products-or-none.md), [The header row names known columns once and includes the mandatory ones](../rules/The-header-row-names-known-columns-once-and-includes-the-mandatory-ones.md) and [The import file is an xlsx workbook with product rows within the size limits](../rules/The-import-file-is-an-xlsx-workbook-with-product-rows-within-the-size-limits.md).
- An imported row obeys every product rule and its name must be new. See [Every imported row follows the rules of a product](../rules/Every-imported-row-follows-the-rules-of-a-product.md) and [An imported product name must be new](../rules/An-imported-product-name-must-be-new.md).
- A viewer does not see the import button. See [Viewers read, editors change](../rules/Viewers-read-editors-change.md).

## Source

[ADR-0021: Import products from an Excel workbook](../../decisions/ADR-0021-products-excel-import.md)
