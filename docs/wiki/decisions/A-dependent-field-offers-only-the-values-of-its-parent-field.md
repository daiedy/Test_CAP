---
title: A dependent field offers only the values of its parent field
summary: The subcategory list shows only the subcategories of the chosen category, a mismatch is refused, and a changed category clears a foreign subcategory (ADR-0024).
tags: [subcategory, category, value-help, validation]
adr: ADR-0024
sources:
  - docs/decisions/ADR-0024-dependent-value-help.md
---

# A dependent field offers only the values of its parent field

## Decision

There are three parts.

1. **Choices.** On the dependent field, the screen configuration holds one hand-written list of choices: it shows the dependent list, filters it by the value of the parent field, and shows the name instead of the code. The field stays a dropdown, as for any fixed code list. While the parent field is empty, the list is not filtered. A filter-bar field on the dependent property follows the same configuration and gets its own test when it is first used.
2. **Consistency.** A rule between fields, including fields reached through another record, is a declarative constraint on the field in the semantic layer, with a message key and the texts in English and Russian, and no handler. Every value that may be empty is guarded explicitly, because an empty value would otherwise be compared as if it were a value; an empty parent is left to its own mandatory check. The product constraint compares the category of the chosen subcategory with the category of the product. It is checked after the write, in the same transaction: an active write is refused, a draft shows the message once the field is touched, and saving a draft is refused.
3. **Reset**, when the user chooses to clear automatically. A draft handler clears the dependent value when the parent changes, the request carries no dependent value and the stored one does not belong to the new parent. Active writes are not cleared: there the constraint refuses them. A side-effect setting makes the screen re-read the field and its text after the change.

The first use is the subcategory of a product.

## Why

A subcategory refines a category. Offering only fitting subcategories prevents the error before it can be made, and the constraint is the guard on every other path.

## What it means for the catalog

- The Subcategory dropdown lists only the subcategories of the chosen category. See [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md).
- A pair from two categories is never stored: [The subcategory belongs to the product's category](../rules/The-subcategory-belongs-to-the-products-category.md) (BR-PRODUCTS-001).
- Changing the category in a draft clears a subcategory that no longer fits, without a message. See [Changing the category clears a subcategory that no longer fits](../rules/Changing-the-category-clears-a-subcategory-that-no-longer-fits.md).
- The disabled-until-filled behaviour of the field builds on [A field is disabled until the field it depends on is filled](A-field-is-disabled-until-the-field-it-depends-on-is-filled.md). The domain pages are [Categories](../domain/Categories.md) and [Subcategories](../domain/Subcategories.md).

## Source

[ADR-0024: Dependent value help between code lists](../../decisions/ADR-0024-dependent-value-help.md)
