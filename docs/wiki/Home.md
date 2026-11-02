---
title: Home
summary: Entry page of the Product Catalog business-rules wiki, with its folders and how to read them.
tags: [home, index]
---

# Home

This wiki explains the Product Catalog in plain language: what the catalog holds, which rules a product follows, why each rule exists and when it changed. It is written for anyone who works with the catalog, with or without the code.

## How to read it

Each page covers one topic and starts with a one-sentence summary. Words you may not know are explained in the [Glossary](Glossary.md). Start with the folder that matches your question:

- You want to do something in the catalog: read a [how-to page](how-to/How-to.md).
- You want to know why the catalog refuses a value: read a [rule page](rules/Business-rules.md).
- You want to know what a record holds: read a [domain page](domain/Domain-model.md).
- You want to know why the catalog works the way it does: read a [decision page](decisions/Decisions.md).
- You connect another system to the catalog: read the [API page](api/API.md).

A rule page has a stable id such as `BR-PRODUCTS-001`, a status (`planned`, `active` or `retired`) and a history table with the date, the change and its source. The id never changes, so it can be quoted in a ticket.

## Folders

- [Business rules](rules/Business-rules.md): one page per rule.
- [Domain model](domain/Domain-model.md): one page per entity of the catalog.
- [How-to](how-to/How-to.md): what a user does, step by step.
- [Decisions](decisions/Decisions.md): the decisions behind the rules.
- [API](api/API.md): the OData API, generated from the OpenAPI document.
- [Glossary](Glossary.md): the words this wiki uses.

## How-to pages

- [Find a product](how-to/Find-a-product.md)
- [Create a product through a draft](how-to/Create-a-product-through-a-draft.md)
- [Edit, save, keep or discard a draft](how-to/Edit-save-keep-or-discard-a-draft.md)
- [Choose a category and subcategory](how-to/Choose-a-category-and-subcategory.md)
- [Fill the details of a product](how-to/Fill-the-details-of-a-product.md)
- [Import products from Excel](how-to/Import-products-from-Excel.md)
- [Who may do what](how-to/Who-may-do-what.md)

## Decision pages

The decisions that shape the product, in plain language. The [decisions folder](decisions/Decisions.md) lists them all, and [Pipeline decisions](decisions/Pipeline-decisions.md) lists the decisions about tooling and documentation.

- [The catalog data follows one set of modeling rules](decisions/The-catalog-data-follows-one-set-of-modeling-rules.md)
- [Code lists use stable upper-case codes](decisions/Code-lists-use-stable-upper-case-codes.md)
- [Fixed lists of values are chosen from a dropdown showing names](decisions/Fixed-lists-of-values-are-chosen-from-a-dropdown-showing-names.md)
- [Products are edited through drafts](decisions/Products-are-edited-through-drafts.md)
- [The catalog is open to signed-in users with a viewer or editor role](decisions/The-catalog-is-open-to-signed-in-users-with-a-viewer-or-editor-role.md)
- [A draft or locked product is marked in the list](decisions/A-draft-or-locked-product-is-marked-in-the-list.md)
- [A custom filter field replaces the standard field of its property](decisions/A-custom-filter-field-replaces-the-standard-field-of-its-property.md)
- [Products are imported from an Excel workbook](decisions/Products-are-imported-from-an-Excel-workbook.md)
- [A dependent field offers only the values of its parent field](decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md)
- [A field is disabled until the field it depends on is filled](decisions/A-field-is-disabled-until-the-field-it-depends-on-is-filled.md)
- [Product details are rows of reusable attributes](decisions/Product-details-are-rows-of-reusable-attributes.md)
- [Product details are typed and shown as a generated form](decisions/Product-details-are-typed-and-shown-as-a-generated-form.md)
- [Validation rules follow one toolkit and prevent before they refuse](decisions/Validation-rules-follow-one-toolkit-and-prevent-before-they-refuse.md)
- [Documentation descriptions live in doc comments and the API document is generated](decisions/Documentation-descriptions-live-in-doc-comments-and-the-API-document-is-generated.md)

## Rules

- [The subcategory belongs to the product's category](rules/The-subcategory-belongs-to-the-products-category.md)
- [Only signed-in users reach the catalog](rules/Only-signed-in-users-reach-the-catalog.md)
- [Viewers read, editors change](rules/Viewers-read-editors-change.md)
- [Code lists are readable by every signed-in user](rules/Code-lists-are-readable-by-every-signed-in-user.md)
- [A product is created and changed through a draft](rules/A-product-is-created-and-changed-through-a-draft.md)
- [A product needs a name, price, currency, stock, category and subcategory](rules/A-product-needs-a-name-price-currency-stock-category-and-subcategory.md)
- [Price, stock and rating stay within their bounds](rules/Price-stock-and-rating-stay-within-their-bounds.md)
- [Category, subcategory and currency must exist](rules/Category-subcategory-and-currency-must-exist.md)
- [The subcategory field stays disabled until a category is chosen](rules/The-subcategory-field-stays-disabled-until-a-category-is-chosen.md)
- [Changing the category clears a subcategory that no longer fits](rules/Changing-the-category-clears-a-subcategory-that-no-longer-fits.md)
- [A subcategory change must not leave details that do not fit](rules/A-subcategory-change-must-not-leave-details-that-do-not-fit.md)
- [Detail rows follow the attributes of the subcategory](rules/Detail-rows-follow-the-attributes-of-the-subcategory.md)
- [An attribute is used once per product and belongs to the subcategory](rules/An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md)
- [A detail value matches the value type of its attribute](rules/A-detail-value-matches-the-value-type-of-its-attribute.md)
- [A number detail stays within its bounds and is whole when required](rules/A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md)
- [A list detail value belongs to the list of its attribute](rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md)
- [A value of a multi-choice detail is selected once and belongs to its list](rules/A-value-of-a-multi-choice-detail-is-selected-once-and-belongs-to-its-list.md)
- [An import creates all products or none](rules/An-import-creates-all-products-or-none.md)
- [The header row names known columns once and includes the mandatory ones](rules/The-header-row-names-known-columns-once-and-includes-the-mandatory-ones.md)
- [The import file is an xlsx workbook with product rows within the size limits](rules/The-import-file-is-an-xlsx-workbook-with-product-rows-within-the-size-limits.md)
- [An imported product name must be new](rules/An-imported-product-name-must-be-new.md)
- [Every imported row follows the rules of a product](rules/Every-imported-row-follows-the-rules-of-a-product.md)

### Planned with #10

These rules are approved and not in the code yet; each page says what the user will see.

- [A product name has at least three characters](rules/A-product-name-has-at-least-three-characters.md)
- [A product name is unique in the catalog](rules/A-product-name-is-unique-in-the-catalog.md)
- [A price is above zero](rules/A-price-is-above-zero.md)
- [A price in a currency without minor units has no decimals](rules/A-price-in-a-currency-without-minor-units-has-no-decimals.md)
- [An image address uses https and has no spaces](rules/An-image-address-uses-https-and-has-no-spaces.md)
- [A product in stock needs a description](rules/A-product-in-stock-needs-a-description.md)
- [A detail that the subcategory requires must be filled](rules/A-detail-that-the-subcategory-requires-must-be-filled.md)
- [A detail number stays within the bounds of its subcategory](rules/A-detail-number-stays-within-the-bounds-of-its-subcategory.md)
- [Storage is not below memory](rules/Storage-is-not-below-memory.md)
- [Battery life is available only for a wireless device](rules/Battery-life-is-available-only-for-a-wireless-device.md)
- [Memory is a power of two](rules/Memory-is-a-power-of-two.md)

## Where to edit

The source of this wiki is the folder `docs/wiki/` of the repository. The GitHub Wiki is a read-only mirror of it: a change made in the wiki is overwritten at the next sync.
