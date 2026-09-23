# Architecture

## Purpose

Product Catalog: a product catalog with an OData V4 service and a Fiori Elements user interface (List Report + Object Page). At the same time the project serves as a testbed for the agentic pipeline for developing CAP applications described in `docs/ai-pipeline-plan.md`.

## Layers

```
app/products            Fiori Elements V4 application, presentation annotations
        │  OData V4 /odata/v4/catalog
srv/catalog-service     CatalogService: projections, actions, handlers, semantic annotations
        │  cds.ql
db/schema               my.catalog.Products (+ Currency from @sap/cds/common)
        │
SQLite in-memory (dev, test)   HANA Cloud (prod, not configured)
```

Rules between layers:

- `app` knows only the service, never `db`. UI annotations address `CatalogService.<Entity>`.
- `srv` exposes entities only through projections; clients never see `my.catalog.*` directly.
- Business rules first declaratively in annotations, then in handlers `srv/<name>-service.js`, shared logic in `srv/lib/`.
- Data semantics live in `srv/annotations/`, presentation in `app/<app>/annotations/`. Details in `CONVENTIONS.md`.

## Current model

One entity `Products : cuid, managed` with the fields name, description, price, currency, stock, category, imageUrl. The current schema, projections and annotations are always in the generated `docs/registry/DOMAIN-MODEL.md`, together with the diagram. This file describes only the principles.

## Development topology

| Mode | Command | Address | What happens |
|---|---|---|---|
| Full stack | `npm run watch` in the root | http://localhost:4004/products/webapp/test/flpSandbox.html | CAP serves the service and the application static files (`sapux` in package.json) |
| UI with proxy | `npm start` in `app/products` while CAP is running | http://localhost:8080/test/flpSandbox.html | UI5 tooling, live reload, `/odata` is proxied to :4004 |
| UI without backend | `npm run start-mock` in `app/products` | http://localhost:8080/test/flpSandbox.html | `sap-fe-mockserver` serves `localService/metadata.xml` and `mockdata/*.json` |
| Backend tests | `npm test` in the root | | `cds.test` starts the server in-process on a random port |

Authentication in development: `mocked` (users from `package.json`). `CatalogService` requires an authenticated user (ADR-0013): the browser raises its own Basic dialog (realm "Users") at the first OData request; there is no in-app login screen. Log in as `alice` or `bob` for full access, `viewer` for read-only, with any password (the mocked users have none configured). Productive authentication is not configured.

### Roles

`CatalogService` defines two roles (ADR-0013), both required by `@requires: 'authenticated-user'` on the service; an anonymous request gets 401 with the Basic challenge, including on `$metadata`.

| Role | May do on `Products` | Mock users | Future XSUAA scope |
|---|---|---|---|
| `CatalogViewer` | `READ` only | `viewer` | `$XSAPPNAME.CatalogViewer` |
| `CatalogEditor` | `*` (CRUD and the draft actions `draftEdit`, `draftPrepare`, `draftActivate`, discard) | `alice`, `bob` | `$XSAPPNAME.CatalogEditor` |

Code lists (`Categories`, `Currencies`) and `$metadata` are readable by any authenticated user, regardless of role. An authenticated user with neither role (e.g. the default mock user `carol`) gets 403 on `Products` but can still read the code lists. `xs-security.json` is not generated yet; `cds add xsuaa --for production` will derive the scope and role-template names above from these CDS role names.

The Fiori UI reflects the caller's role: `CatalogService.Permissions` is a read-only singleton (`isEditor: Boolean`) served by the project's first handler, `srv/catalog-service.js`, from `req.user.is('CatalogEditor')`. `app/products/annotations/Products.cds` reads it through `UI.CreateHidden`/`UI.UpdateHidden`/`UI.DeleteHidden` (`$edmJson`, ADR-0013 part 8), so a `CatalogViewer` never sees Create, Delete or Edit - enforcement itself stays fully declarative in `@restrict`, the singleton only drives what the UI shows.

## Extension points

| What to add | Where | How |
|---|---|---|
| New entity | `db/schema.cds`, `srv/catalog-service.cds`, `srv/annotations/`, `app/products/annotations/` | Pattern "New entity" in `PATTERNS.md` |
| New service | `srv/<name>-service.cds` + `.js` | Only if the service has a different audience or a different domain |
| New application | `app/<name>` | Fiori MCP `generate_fiori_app_cap` |
| External service | `srv/external/` via `cds import` | Skill `cap-add-remote-service`, start with an ADR |

## Deployment

`mta.yaml` and `xs-security.json` are drafts for Cloud Foundry with HANA and XSUAA. Production dependencies (`@cap-js/hana`, `@sap/xssec`, the `[production]` profile) are not installed. Deployment work starts with an ADR and is not mixed with features.

## Documentation

| File | Maintained by | Content |
|---|---|---|
| `docs/architecture/*.md` | human and the `architect` agent | principles, conventions, patterns, stack, tests |
| `docs/registry/*.md` | script `scripts/gen-registry.mjs` | what really exists in the code; not edited by hand |
| `docs/decisions/ADR-*.md` | `architect` | why a way was chosen |
| `docs/features/<name>/` | `architect`, `docs-keeper` | context, plan, summary, verification of a feature |
| `docs/STATE.md` | `docs-keeper` | where we are now, accumulated decisions, open debt |
| `docs/LESSONS.md` | all agents via `retro` | lessons learned |
| `docs/CHANGELOG.md` | `docs-keeper` | what changed |
| `docs/upstream/UPDATES.md` | `upstream-watcher` | upstream dependency update digest |
