---
title: Every imported row follows the rules of a product
summary: Each row is written through the same checks as any product, and a row that breaks one is reported with its row number, column and reason.
tags: [import, excel, validation, products]
id: BR-IMPORT-005
status: active
since: 2026-09-29
code:
  - srv/catalog-service.js
  - srv/lib/products-import.js
messages: [PRODUCTS_IMPORT_ROW_INVALID]
elements: []
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
  - docs/features/products-subcategory-cascade/SUMMARY.md
verified: 5ac44903751a96d7
---

# Every imported row follows the rules of a product

## Rule

An imported row is held to the rules of any product: the required fields are filled, price, stock and rating are within their bounds, the category, subcategory and currency exist, and the subcategory belongs to the row's category. The category, subcategory and currency cells hold codes, not displayed names. A cell of a number column that reads as a number is taken as a number.

## Why

The import is another way to create a product, not a way around the rules. Using the checks of the product itself keeps one definition of what a valid product is. The decision behind it is [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- Each rejected column of a row gets "Row {0}, column "{1}": {2}", where the last part is the reason text of the check, for example the framework's text for a number that is not a number. That reason stays in English in a Russian session.
- The row number counts the header as row 1.
- The rules come from [A product needs a name, price, currency, stock, category and subcategory](A-product-needs-a-name-price-currency-stock-category-and-subcategory.md), [Price, stock and rating stay within their bounds](Price-stock-and-rating-stay-within-their-bounds.md) and [Category, subcategory and currency must exist](Category-subcategory-and-currency-must-exist.md).
- The subcategory-category pair of [The subcategory belongs to the product's category](The-subcategory-belongs-to-the-products-category.md) is checked for each row before the rows are written, because the product's own check reports no row; the mismatch is reported on the column `subcategory`.
- Empty cells are left out of the row; the report is part of [An import creates all products or none](An-import-creates-all-products-or-none.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-29 | Introduced: one insert per row through the service, so the product's checks report per row. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
| 2026-10-10 | The subcategory-category pair is checked per row before the inserts. | [products-subcategory-cascade](../../features/products-subcategory-cascade/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
