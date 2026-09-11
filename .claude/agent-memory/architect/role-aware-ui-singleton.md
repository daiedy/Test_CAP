---
name: role-aware-ui-singleton
description: How a Fiori Elements V4 List Report learns "may this user edit" in this project - permission singleton, not a per-row element; measured contract cost
metadata:
  type: project
---

Role-aware standard actions in the FE V4 app are driven by a read-only OData **singleton**, not by a virtual element on the entity.

**Why:** `UI.CreateHidden` on a List Report is evaluated for the toolbar, which has no row context (and an empty list has no row at all), so a per-row Boolean cannot answer "may I create". `Capabilities.InsertRestrictions` has the same limitation — the Fiori docs bind it to "a Boolean property on the root entity". CAP documents exactly one alternative ("Serving SAP Fiori UIs > Role-based Visibility"): `@odata.singleton @cds.persistence.skip` entity + `on READ` handler returning `req.user.is(<role>)` + `UI.*Hidden` as `{ $edmJson: { $Not: { $Path: '/<Service>.EntityContainer/<Singleton>/<flag>' } } }`.

**How to apply:** when a future feature needs runtime-role-driven UI, extend `CatalogService.Permissions` with another Boolean instead of inventing a second mechanism (ADR-0013 part 8, PATTERNS row "Role-aware UI visibility"). Layering: the singleton is service API (`srv/catalog-service.cds`), the `UI.*Hidden` annotations are presentation (`app/products/annotations/`), per ADR-0004.

Measured on cds 10.0.6, 2026-09-10 (scratchpad copy, project untouched):

- Contract cost of the singleton plus three `Hidden` annotations: **+50 EDMX lines, 0 removed**. The `Hidden` annotations render twice, on `<Service>.Products` and on `<Service>.EntityContainer/Products`.
- Runtime: `GET /Permissions` gives `isEditor` true for editors, false for a reader and for an authenticated user without a catalog role, 401 anonymous, 405 on `PATCH`. Drafts unaffected. `cds lint` clean. The startup log confirms the handler with `impl: 'srv/catalog-service.js'`.
- A **keyless** singleton compiles, serves identically and costs 11 lines less, but yields a non-abstract `EntityType` without `<Key>`, which OData V4 CSDL forbids. Keep `key ID : String`.
- `mockdata/Permissions.json` is needed, otherwise `sap-fe-mockserver` (`generateMockData: true`) invents the flag and mock mode may hide every action.
- Not measurable without a browser: whether FE resolves the long `$Path`. Fallback documented by CAP: the short form `/Permissions/isEditor`.

Method note: `node -e "console.log(require('@sap/cds').resolve('*'))"` shows which files the model really pulls in. A scratchpad copy of `app/<app>/annotations/` without `app/<app>/annotations.cds` silently compiles the service **without any** `@UI.*`, which looks like "the annotations vanished".

Related: [[cds10-draft-behavior]], [[fe-v4-semantic-key-marker]], [[codelist-valuelist-autogen]].
