---
title: The import file is an xlsx workbook with product rows within the size limits
summary: The file must be a readable .xlsx workbook with at least one product row, at most 1,000 rows, and not more than 10 MB of unpacked data.
tags: [import, excel, limits]
id: BR-IMPORT-003
status: active
since: 2026-09-29
code:
  - srv/lib/products-import.js
  - srv/catalog-service.js
messages: [PRODUCTS_IMPORT_NOT_XLSX, PRODUCTS_IMPORT_EMPTY, PRODUCTS_IMPORT_TOO_MANY_ROWS, PRODUCTS_IMPORT_TOO_LARGE]
elements: []
sources:
  - docs/decisions/ADR-0021-products-excel-import.md
  - docs/features/products-excel-upload/SUMMARY.md
verified: 5ac44903751a96d7
---

# The import file is an xlsx workbook with product rows within the size limits

## Rule

The file must be an Excel workbook in the .xlsx format. The first sheet must hold at least one product row below the header. A file has at most 1,000 product rows, and its content must not unpack to more than 10 MB. Blank rows are skipped and do not count as products.

## Why

A file that is not a workbook, or has no rows, cannot be imported meaningfully. The limits keep one request bounded: a small upload can unpack into gigabytes, so the size is measured on the unpacked data, before the workbook is read. The decision behind it is [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).

## Where it fires

- Not a workbook: "The file is not an Excel workbook. Choose an .xlsx file." The upload dialog also accepts only the .xlsx media type.
- No product rows, or no sheet data: "The file contains no product rows. Add rows below the header row."
- More than 1,000 rows: "The file has {0} product rows; at most {1} can be imported at once. Split the file."
- Too much unpacked data: "The file contains more than {0} MB of data and cannot be imported at once. Keep only the product sheet and split the file."
- A request body above 1 MB is refused by the server before the import starts. The messages are part of the report described in [An import creates all products or none](An-import-creates-all-products-or-none.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-29 | Introduced: workbook format, at least one row, at most 1,000 rows. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
| 2026-09-29 | Added in the review of the same feature: the unpacked size is limited to 10 MB and checked before the workbook is read. | [products-excel-upload](../../features/products-excel-upload/SUMMARY.md), [ADR-0021](../../decisions/ADR-0021-products-excel-import.md) |
