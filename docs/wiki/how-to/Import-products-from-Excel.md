---
title: Import products from Excel
summary: Create many products at once from an .xlsx workbook, all or nothing, with every bad row reported.
tags: [products, import, excel]
code:
  - srv/catalog-service.js
  - srv/annotations/Products.cds
verified: dfab20cb0972ed9f
---

# Import products from Excel

## Goal

Create many products in one step instead of one draft each.

## Steps

1. Sign in as a CatalogEditor; see [Who may do what](Who-may-do-what.md).
2. Prepare an Excel workbook (.xlsx). The data is on the first sheet. The first row is a header with these column names, in any order and in any letter case, each at most once: `name`, `description`, `price`, `currency`, `stock`, `category`, `subcategory`, `rating`, `imageUrl`.
3. Fill the columns `name`, `price`, `currency`, `stock`, `category` and `subcategory` in every row; they are mandatory. The others are optional.
4. Write codes, never the displayed names, in `category`, `subcategory` and `currency`: for example `ELECTRONICS`, `LAPTOPS` and `USD`. See [Choose a category and subcategory](Choose-a-category-and-subcategory.md) for the pairs that are allowed.
5. Keep the file within 1,000 product rows, and keep the unpacked workbook under 10 MB.
6. In the product list choose Import from Excel, pick the file in the field "Excel File (.xlsx)" and confirm.
7. On success the catalog tells you how many products were created. On failure nothing is written: the catalog lists every bad row with its row number and column (the header is row 1), and you fix the file and import it again.

The fields of a product are described in [Products](../domain/Products.md).

A sample file with three correct rows is `test/fixtures/products-import-valid.xlsx`. The products are created as active products without details; open one and edit it to fill the details.

## Rules that apply

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md): checked for every row before anything is written.
- [An import creates all products or none](../rules/An-import-creates-all-products-or-none.md): if anything is wrong, nothing is written and every problem is listed.
- [The import file is an xlsx workbook with product rows within the size limits](../rules/The-import-file-is-an-xlsx-workbook-with-product-rows-within-the-size-limits.md): an .xlsx workbook with at least one product row, at most 1,000 rows and 10 MB unpacked.
- [The header row names known columns once and includes the mandatory ones](../rules/The-header-row-names-known-columns-once-and-includes-the-mandatory-ones.md): unknown, repeated or missing columns are rejected.
- [An imported product name must be new](../rules/An-imported-product-name-must-be-new.md): a name already in the catalog or earlier in the file is rejected.
- [Every imported row follows the rules of a product](../rules/Every-imported-row-follows-the-rules-of-a-product.md): each row follows the rules of a product.
- [A price in a currency without minor units has no decimals](../rules/A-price-in-a-currency-without-minor-units-has-no-decimals.md) (planned with #10).
- [A product in stock needs a description](../rules/A-product-in-stock-needs-a-description.md) (planned with #10).
- Why the import works this way: [Products are imported from an Excel workbook](../decisions/Products-are-imported-from-an-Excel-workbook.md).
