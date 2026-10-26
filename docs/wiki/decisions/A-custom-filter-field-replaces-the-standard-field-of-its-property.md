---
title: A custom filter field replaces the standard field of its property
summary: When the standard filter field does not fit, such as a range slider for the rating, a small custom control takes its place and sets the filter (ADR-0020).
tags: [filter, list, rating]
adr: ADR-0020
sources:
  - docs/decisions/ADR-0020-custom-filter-field.md
---

# A custom filter field replaces the standard field of its property

## Decision

A custom filter field is a small screen fragment registered in the configuration of the list page under the filter fields, named after the property it filters; it replaces the standard field of that property. The label is left out when the property's own label fits. The control shows the current filter condition and changes it only when the user changes the control: it never writes its own value back while it renders. A control that returns to its neutral position clears the condition. The translation of a control value into a filter condition is a small named function with its own unit test. The first use is the rating filter of the product list.

## Why

The project needed a way to add a filter control that the platform does not offer for a plain number, and one rule that every later custom filter follows. The tooling for the screen configuration had no entry for it, so the first one was set by hand as a recorded exception.

## What it means for the catalog

- The rating filter in the product list is a slider from 0 to 5; the user moves both ends to choose a range, and the list updates as the slider changes. See [Find a product](../how-to/Find-a-product.md).
- Other filters, such as name, category and price, keep their standard fields.

## Source

[ADR-0020: Custom filter field in the Fiori Elements V4 filter bar](../../decisions/ADR-0020-custom-filter-field.md)
