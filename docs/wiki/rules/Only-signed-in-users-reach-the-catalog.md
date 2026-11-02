---
title: Only signed-in users reach the catalog
summary: Every request to the catalog, including reading and the service description, needs a signed-in user.
tags: [access, authentication]
id: BR-ACCESS-001
status: active
since: 2026-09-16
code:
  - srv/catalog-service.cds
messages: []
elements: []
sources:
  - docs/decisions/ADR-0013-catalog-authorization.md
  - docs/features/catalog-authorization/SUMMARY.md
verified: 83c836a73a96ffd3
---

# Only signed-in users reach the catalog

## Rule

Nobody reads the catalog without signing in. This holds for every request: the product list, a single product, the lists of categories and subcategories, and the service description that applications fetch first.

## Why

The catalog is an internal tool, not a public shop window. Requiring a sign-in on the whole service, instead of protecting entity by entity, leaves no corner that a new entity could forget to close. See also [The catalog is open to signed-in users with a viewer or editor role](../decisions/The-catalog-is-open-to-signed-in-users-with-a-viewer-or-editor-role.md).

## Where it fires

- Any request without credentials is answered with HTTP 401 and a request to sign in; no page or API call shows data before that.
- In the browser the sign-in prompt appears when the application opens. In the development setup the users `alice`, `bob` and `viewer` sign in with an empty password.
- A signed-in user who lacks the role for an action is a different case; see [Viewers read, editors change](Viewers-read-editors-change.md).

## History

| Date | Change | Source |
|---|---|---|
| 2026-09-16 | Introduced: the whole service requires an authenticated user, the service description included. | [catalog-authorization](../../features/catalog-authorization/SUMMARY.md), [ADR-0013](../../decisions/ADR-0013-catalog-authorization.md) |
