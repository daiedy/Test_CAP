---
title: Home
summary: Entry page of the Product Catalog business-rules wiki, with its folders and how to read them.
tags: [home, index]
---

# Home

This wiki explains the business rules and decisions of the Product Catalog in plain language: what the catalog holds, which rules a product follows, why, and when each rule changed. It is written for anyone who works with the catalog, with or without the code.

## How to read it

Each page covers one topic and starts with a one-sentence summary. A rule page has a stable id such as `BR-PRODUCTS-001`, a status (`planned`, `active` or `retired`) and a history table with the date, the change and its source.

## Folders

- [Business rules](rules/Business-rules.md): one page per rule.
- [Domain model](domain/Domain-model.md): one page per entity of the catalog.
- [How-to](how-to/How-to.md): what a user does, step by step.
- [Decisions](decisions/Decisions.md): the decisions behind the rules.
- [API](api/API.md): the OData API, generated from the OpenAPI document.

## Rules

- [The subcategory belongs to the product's category](rules/The-subcategory-belongs-to-the-products-category.md)

## Where to edit

The source of this wiki is the folder `docs/wiki/` of the repository. The GitHub Wiki is a read-only mirror of it: a change made in the wiki is overwritten at the next sync.
