---
title: Product details are rows of reusable attributes
summary: A product holds detail rows, each pointing to an attribute that the product's subcategory offers, with at most one row per attribute (ADR-0026).
tags: [details, attributes, subcategory]
adr: ADR-0026
sources:
  - docs/decisions/ADR-0026-product-details-composition.md
---

# Product details are rows of reusable attributes

## Decision

A product owns a list of detail rows. Each row points to an attribute, such as Colour or Weight, which is a code list with an optional unit. A separate assignment record says which attribute belongs to which subcategory; the pair is unique, and an attribute that suits many subcategories is simply assigned to each of them. The rows are part of the product and follow its draft (see [Products are edited through drafts](Products-are-edited-through-drafts.md)).

The service exposes one entry per record kind. The detail rows carry the same access rights as the products, because the platform authorizes only the target of a request, and without them a viewer could create a row through a product or a user without a role could read the rows. The attributes and the assignments are read-only. Declarative guards in the semantic layer refuse a row whose attribute is not assigned to the product's subcategory and a second row for the same attribute of one product. The product's subcategory constraint also refuses a subcategory under which an existing row would not fit. No separate uniqueness constraint is placed on the detail rows, because the database answers a violation with a technical error on the active path.

When the subcategory of a draft changes while rows exist, nothing is deleted automatically: the user is told on the Subcategory field, saving is refused naming each row that does not fit, and the user deletes or changes those rows. The user accepted this on 2026-10-11, and the alternative of deleting foreign rows automatically was rejected. The first screen was a table of detail rows with a pick list of attributes; its presentation, the free-text value and the Save-time rejection were later replaced by the typed form of [Product details are typed and shown as a generated form](Product-details-are-typed-and-shown-as-a-generated-form.md). The record shape, the access rights and the guards stay.

## Why

Issue #9 asked for a Details section whose content depends on the product's subcategory. The user chose dynamic attributes over fixed typed fields, with attributes reusable across subcategories through an assignment, edited inside the product draft by an editor and read-only for a viewer.

## What it means for the catalog

- A product of a subcategory can hold only the attributes that subcategory offers, each once. See [An attribute is used once per product and belongs to the subcategory](../rules/An-attribute-is-used-once-per-product-and-belongs-to-the-subcategory.md).
- Changing the subcategory of a product that has detail rows does not silently delete data: [A subcategory change must not leave details that do not fit](../rules/A-subcategory-change-must-not-leave-details-that-do-not-fit.md).
- A list value must belong to the list of its attribute: [A list detail value belongs to the list of its attribute](../rules/A-list-detail-value-belongs-to-the-list-of-its-attribute.md).
- The records are described in [Product details](../domain/Product-details.md), [Detail attributes](../domain/Detail-attributes.md) and [Subcategory attributes](../domain/Subcategory-attributes.md). A user fills them as described in [Fill the details of a product](../how-to/Fill-the-details-of-a-product.md).

## Source

[ADR-0026: Product details as a composition of reusable attribute values](../../decisions/ADR-0026-product-details-composition.md)
