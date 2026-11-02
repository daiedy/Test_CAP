---
title: The catalog data follows one set of modeling rules
summary: Every record has a generated identity and change tracking, lists of values are code lists, money and text have fixed shapes (ADR-0003).
tags: [modeling, code-list, price]
adr: ADR-0003
sources:
  - docs/decisions/ADR-0003-cds-modeling-rules.md
---

# The catalog data follows one set of modeling rules

## Decision

Every kind of record in the catalog gets a generated identity and records who created and last changed it and when. Only the small lists of codes and their translated texts use their own code as the identity. A list of values that a user picks from, such as categories, is a code list keyed by a code. A fixed enumeration is reserved for internal statuses that a user never picks. A price is stored with two decimals and sits next to a currency. Text fields always have a maximum length, and texts a user reads are translatable. The name space of the catalog stays as it is. The price had been kept as a historical exception with a narrower precision; the project withdrew that exception on 2026-10-09 and amended the decision.

## Why

Different working sessions had modelled the same situation in different ways: identity keys, enumerations against code tables, decimal precision. One way per situation keeps the catalog consistent.

## What it means for the catalog

- Every product, detail row and other record has a hidden generated identity plus "created" and "changed" information, which is why a record can be traced to a person and a time.
- A user picks a category, subcategory or currency from a list of values, never types free text for them. See [Categories](../domain/Categories.md) and [Subcategories](../domain/Subcategories.md).
- A price holds up to two decimals and always comes with a currency. See [Products](../domain/Products.md).
- Text values have a length limit, and category and subcategory names appear in the user's language.

## Source

[ADR-0003: CDS modeling rules](../../decisions/ADR-0003-cds-modeling-rules.md)
