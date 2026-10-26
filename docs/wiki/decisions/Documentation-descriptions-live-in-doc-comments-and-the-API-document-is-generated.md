---
title: Documentation descriptions live in doc comments and the API document is generated
summary: One kind of doc comment describes every artefact, and the OpenAPI document, the code reference page and the JSDoc lint gate are generated or checked from it (ADR-0029).
tags: [documentation, api, tooling]
adr: ADR-0029
sources:
  - docs/decisions/ADR-0029-docs-toolchain.md
---

# Documentation descriptions live in doc comments and the API document is generated

## Decision

One project setting turns on doc comments for every command and test. A description is a doc comment, never a separate description annotation, so there is one way to write it. A table note in the database model is a developer note only. A service projection and its elements are described in the semantic layer next to their titles. The service, its actions and parameters, its types and its singleton are described where they are defined. A description is one English sentence written for a user of the API.

The service header states its protocol, the title "Product Catalog API" and a schema version that mirrors the package version. Descriptions are English: they are documentation for developers and tools, not screen labels, and this is the recorded exception to the rule that texts go through the translation files.

The registry generation also writes the OpenAPI document of the service, `docs/api/CatalogService.openapi3.json`, stamped with a source hash, and a separate command writes it alone; a test and the freshness check keep it equal to a fresh compile. The registry gets a JSDoc page for the server and screen-extension code. A Swagger UI shows the API in development only. A lint gate on JSDoc errors blocks code that lacks a description for its public functions and parameters, in the PostToolUse hook, in the subagent stop gate, in CI and in the test command. The registry shows the descriptions in the domain model.

The first use is the documentation toolchain feature.

## Why

Issue #27 asked that the documentation already written in the sources reaches its readers. The compiler dropped doc comments unless the setting is on, no API document existed, and JSDoc was required by the conventions but checked by nobody.

## What it means for the catalog

- The catalog API document is generated and is shown as a [page of this wiki](../api/API.md), so a person who connects another system reads it here.
- The descriptions in the [Catalog service API](../api/Catalog-service-API.md) come from the same comments as the registry, so they cannot drift from the code.
- Wiki rule and domain pages stay hand-written; this decision covers descriptions of code, not business rules. For the wiki itself see [Pipeline decisions](Pipeline-decisions.md).

## Source

[ADR-0029: Documentation toolchain: doc comments as the single source of descriptions, generated OpenAPI and JSDoc pages, JSDoc as a lint gate](../../decisions/ADR-0029-docs-toolchain.md)
