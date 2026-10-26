---
title: Fixed lists of values are chosen from a dropdown showing names
summary: A short stable list such as the categories appears as a dropdown with names, while long or growing lists keep a search dialog (ADR-0011).
tags: [code-list, value-help, category]
adr: ADR-0011
sources:
  - docs/decisions/ADR-0011-code-list-value-help.md
---

# Fixed lists of values are chosen from a dropdown showing names

## Decision

For a field that refers to a code list, the list of choices is not written by hand: the platform provides it from the list itself, and only the presentation is added on the screen: the name is shown instead of the code, and the code is hidden. A list that developers maintain from data files, has no maintenance screen and is a fixed stable set is shown as a dropdown: a multi-choice list in the filter bar and a single choice in the form. Lists that grow, are maintained by users or hold hundreds of values, such as currencies and countries, keep the search dialog. If a list ever gets a maintenance screen, it goes back to the dialog. A hand-written list of choices is allowed only when the target is not a code list or when extra links to other fields are needed. Radio buttons and a few other presentation options are not used. The first use is the category of a product.

## Why

The project had no rule for when to offer a dropdown and when a dialog, and an explicit hand-written list of choices duplicated what the platform already generates. For an own code list the screen would otherwise show the code instead of the name.

## What it means for the catalog

- The category field is a dropdown that lists the names Accessories, Electronics, Furniture, Kitchen, Sports and Stationery, and the category filter lets you tick several of them. See [Categories](../domain/Categories.md).
- The currency field opens a search dialog, because the list of currencies is long.
- A dependent list, such as the subcategories of a category, builds on this decision: see [A dependent field offers only the values of its parent field](A-dependent-field-offers-only-the-values-of-its-parent-field.md).
- How a user picks the values: [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md).

## Source

[ADR-0011: Value help for associations to a CodeList](../../decisions/ADR-0011-code-list-value-help.md)
