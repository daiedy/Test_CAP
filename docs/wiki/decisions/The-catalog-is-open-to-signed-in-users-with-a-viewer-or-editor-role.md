---
title: The catalog is open to signed-in users with a viewer or editor role
summary: Every request needs a signed-in user, a viewer only reads, an editor does everything, and the screen hides the buttons a viewer cannot use (ADR-0013).
tags: [access, roles, authorization]
adr: ADR-0013
sources:
  - docs/decisions/ADR-0013-catalog-authorization.md
---

# The catalog is open to signed-in users with a viewer or editor role

## Decision

The whole service requires a signed-in user; an anonymous request is refused. There are two business roles, `CatalogViewer` and `CatalogEditor`. A viewer may read products; an editor may do everything with products, including the draft actions. The code lists (such as categories and currencies) and the service description are readable by every signed-in user, because both roles need them as choices and they hold nothing sensitive. There are no rules that depend on the single record and no administrator role: the lists are maintained from data files. The role names carry the audience as a prefix, because they become the names of the roles in the deployed application and renaming them later is a migration. In development, the users `alice` and `bob` are editors and `viewer` is a viewer, none with a password. The screen is role-aware: for a viewer the buttons Create, Delete and Edit are hidden, not disabled and not left to fail with an error. A small read-only "permissions" record of the service tells the screen whether the current user is an editor, and it is the first handler of the project; it only drives the display and never enforces anything, because enforcement stays declarative. The deployment descriptor is not changed by this decision.

## Why

The catalog had no access control. The user decided that a viewer must not see actions that would fail.

## What it means for the catalog

- A person who is not signed in sees nothing. See [Only signed-in users reach the catalog](../rules/Only-signed-in-users-reach-the-catalog.md).
- A viewer reads products and cannot create, change, delete or import; an editor can. See [Viewers read, editors change](../rules/Viewers-read-editors-change.md).
- Every signed-in user can open the lists of categories, subcategories and currencies. See [Code lists are readable by every signed-in user](../rules/Code-lists-are-readable-by-every-signed-in-user.md).
- A summary for readers of the screen: [Who may do what](../how-to/Who-may-do-what.md).

## Source

[ADR-0013: Authorization of CatalogService with the roles CatalogViewer and CatalogEditor](../../decisions/ADR-0013-catalog-authorization.md)
