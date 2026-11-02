---
title: A field is disabled until the field it depends on is filled
summary: A field that makes sense only after another field is filled stays disabled until then, and shows the required marker once it is enabled (ADR-0025).
tags: [subcategory, field-control, ui]
adr: ADR-0025
sources:
  - docs/decisions/ADR-0025-dynamic-field-control.md
---

# A field is disabled until the field it depends on is filled

## Decision

A field that is editable only while another field of the same record has a value gets one dynamic field-control setting in the presentation layer, written as an expression on the field: disabled while the other field is empty, enabled otherwise. The values are the numeric codes of the field-control type: 0 for disabled, 1 for read-only, 3 for optional and 7 for mandatory. The condition reaches the other field through its association, never through the generated foreign key. This is presentation only: the server ignores a dynamic field control, so the data rule it reflects is enforced in the semantic layer by its own declarative means and, where the rule changes data, by the draft handler of the dependent-list decision. The setting does not go on a mandatory field unless the enabled branch yields 7, because the dynamic value would replace the static mandatory marker on the screen, while the server keeps enforcing it. No side effect is configured for the editability itself: the field switches on the client as soon as the other field changes. The first use is the subcategory, disabled until a category is chosen and mandatory once it is enabled.

## Why

At the plan gate on 2026-10-10 the user required that category and subcategory are both mandatory and that the subcategory field is disabled until a category is chosen.

## What it means for the catalog

- In edit mode the Subcategory field is greyed out until a category is chosen, then it shows the required marker. See [The subcategory field stays disabled until a category is chosen](../rules/The-subcategory-field-stays-disabled-until-a-category-is-chosen.md) and [Choose a category and subcategory](../how-to/Choose-a-category-and-subcategory.md).
- The server still refuses a missing subcategory on every path, including the API and the Excel import, because the screen setting is a convenience and not the rule. See [A product needs a name, price, currency, stock, category and subcategory](../rules/A-product-needs-a-name-price-currency-stock-category-and-subcategory.md).
- The choice list of the field is the subject of [A dependent field offers only the values of its parent field](A-dependent-field-offers-only-the-values-of-its-parent-field.md).

## Source

[ADR-0025: Field editable only when another field is filled (dynamic field control)](../../decisions/ADR-0025-dynamic-field-control.md)
