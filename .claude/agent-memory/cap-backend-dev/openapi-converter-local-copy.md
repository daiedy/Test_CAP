---
name: openapi-converter-local-copy
description: cds compile --to openapi prefers a project-local @cap-js/openapi over the cds-dk bundled one; 1.7.0 breaks on draft runtime models (Swagger UI 500)
metadata:
  type: project
---

`@sap/cds-dk` loads the OpenAPI converter with `cds._local('@cap-js/openapi')`: a copy in the project's `node_modules` wins over the bundled one (cds-dk 10.1.0 bundles 1.6.0). `cds-swagger-ui-express` 0.11.0 brings `@cap-js/openapi ^1.0.4`, which resolved to 1.7.0 (2026-10-25, docs-toolchain step 3), so the committed `docs/api` document changed converter too (73 paths against 69 with 1.6.0).

1.7.0 added `csn = cds.clone(csn)` at its entry point. On the served model (`cds.compile.for.nodejs`, linked) of a draft-enabled service this makes `DraftAdministrativeData` an own virtual association, and the compiler throws, so `/$api-docs/.../openapi.json` answers 500. The CLI form (`cds.load('*')`) still compiles.

Resolution (user decision 2026-10-25): root devDependency `@cap-js/openapi` pinned exactly at `1.6.0`; npm dedupes the plugin's copy to it (no `overrides`), Swagger answers 200 and `docs/api` is back to 69 paths, 44 schemas.

**Why:** the plan assumed the bundled 1.6.0 and a working Swagger UI; neither held after the install.

**How to apply:** the pin is deliberate; a Dependabot or upstream bump to 1.7.x must re-run the Swagger curl first. After any install that touches `@cap-js/openapi`, curl `/$api-docs/odata/v4/catalog/openapi.json` under `cds watch` as `alice`, and check `npm ls @cap-js/openapi`. Do not rely only on `npm run docs:api`, which uses the CLI form. Related: [[worktree-bash-guard-file-writes]].
