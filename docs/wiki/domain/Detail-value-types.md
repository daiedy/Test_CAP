---
title: Detail value types
summary: "A value type says what kind of value an attribute takes: text, whole number, decimal, one choice or several choices."
tags: [details, value-types, domain, code-list]
code:
  - db/schema.cds
  - srv/annotations/DetailValueTypes.cds
verified: 71d8a751eaa9d04e
---

# Detail value types

## What it is

A value type is one of five kinds: TEXT, INTEGER, DECIMAL, LIST (one choice from a list) and MULTI_LIST (several choices from a list). Every attribute has one, and it decides where the value of a detail row is kept. The list is fixed and read-only. The fields are in the [domain model](../../registry/DOMAIN-MODEL.md).

## Fields that matter

- **Code**: TEXT, INTEGER, DECIMAL, LIST or MULTI_LIST.
- **Name** and **description**: shown in the user's language.

## Rules

- [A detail value matches the value type of its attribute](../rules/A-detail-value-matches-the-value-type-of-its-attribute.md): a value must fit the attribute's value type, so a text in a number attribute is refused.

## Related

- [Detail attributes](Detail-attributes.md), [Product details](Product-details.md), [Product detail selections](Product-detail-selections.md)
- Why it is built this way: [Product details are typed and shown as a generated form](../decisions/Product-details-are-typed-and-shown-as-a-generated-form.md).
