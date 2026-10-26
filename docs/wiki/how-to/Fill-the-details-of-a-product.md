---
title: Fill the details of a product
summary: Enter the typed details that the product's subcategory asks for, such as colour or weight.
tags: [products, details, attributes]
code:
  - app/products/webapp/ext/fragment/DetailsForm.fragment.xml
  - app/products/webapp/ext/fragment/DetailsForm.js
  - srv/annotations/ProductDetails.cds
verified: 8d05d526116df7e7
---

# Fill the details of a product

## Goal

Record the extra facts that describe a product of a given subcategory, so that products of the same kind can be compared.

## Steps

1. Open a product in edit mode or a new draft, with a subcategory chosen; see [Choose a category and subcategory](Choose-a-category-and-subcategory.md).
2. Go to the Details section. It shows one line for each **attribute** (see the [Glossary](../Glossary.md)) that the subcategory asks for, in a fixed order. You cannot add or remove lines yourself.
3. Fill the lines you know. Every value is optional. How a line is filled depends on its **value type**: free text, a whole number, a decimal number (with its unit and allowed range shown), one choice from a dropdown list, or several choices from a list.
4. Read the counter "Filled N of M" at the top of the section. It is green when every line is filled and orange otherwise; an incomplete product can still be saved.
5. Choose Save. Wrong values are shown next to their line and block the save until fixed.

Which attributes a subcategory offers is described in [Subcategory attributes](../domain/Subcategory-attributes.md).

Viewers see the details in the same section as read-only text; an empty line shows an empty indicator.

## Rules that apply

- [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md): the subcategory decides which lines appear.
- [A detail value matches the value type of its attribute](../rules/A-detail-value-matches-the-value-type-of-its-attribute.md): a value must fit its line (text in a text line, a number in a number line).
- [A number detail stays within its bounds and is whole when required](../rules/A-number-detail-stays-within-its-bounds-and-is-whole-when-required.md): a number must be inside the minimum and maximum of the attribute, and a whole-number line takes no fraction.
- [A list detail value belongs to the list of its attribute](../rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md) and [A value of a multi-choice detail is selected once and belongs to its list](../rules/A-value-of-a-multi-choice-detail-is-selected-once-and-belongs-to-its-list.md): a list choice must come from the list of that attribute, and the same choice cannot be selected twice.
- [An attribute is used once per product and belongs to the subcategory](../rules/An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md): a product has at most one line per attribute.
- [Detail rows follow the attributes of the subcategory](../rules/Detail-rows-follow-the-attributes-of-the-subcategory.md): the lines follow the subcategory; changing it can drop filled values, and a warning says which.
- [A detail that the subcategory requires must be filled](../rules/A-detail-that-the-subcategory-requires-must-be-filled.md) (planned with #10).
- [A detail number stays within the bounds of its subcategory](../rules/A-detail-number-stays-within-the-bounds-of-its-subcategory.md) (planned with #10).
- [Storage is not below memory](../rules/Storage-is-not-below-memory.md) (planned with #10).
- [Battery life is available only for a wireless device](../rules/Battery-life-is-available-only-for-a-wireless-device.md) (planned with #10).
- [Memory is a power of two](../rules/Memory-is-a-power-of-two.md) (planned with #10).

