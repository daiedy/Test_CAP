# Product Catalog

Full-stack application on SAP CAP (Node.js, OData V4) with an SAP Fiori Elements V4 user interface. At the same time a testbed for an agentic pipeline for developing CAP applications with Claude Code (see `docs/ai-pipeline-plan.md` and `CLAUDE.md`).

## Requirements

- Node.js 22 LTS, npm 10
- `@sap/cds-dk` 10 globally: `npm i -g @sap/cds-dk@10`

## Quick start

```bash
npm install
cd app/products && npm install && cd ../..
npm run watch
```

Open http://localhost:4004/products/webapp/test/flpSandbox.html#products-display. Service: http://localhost:4004/odata/v4/catalog/, metadata: `/odata/v4/catalog/$metadata`.

## UI run modes

| Mode | Command | Address |
|---|---|---|
| Through CAP | `npm run watch` in the root | http://localhost:4004/products/webapp/test/flpSandbox.html |
| UI5 tooling with proxy to CAP | `npm start` in `app/products` while `npm run watch` is running | http://localhost:8080/test/flpSandbox.html |
| Without backend (mock) | `npm run start-mock` in `app/products` | http://localhost:8080/test/flpSandbox.html |

Mock mode uses `@sap-ux/ui5-middleware-fe-mockserver` with `webapp/localService/metadata.xml` and `webapp/localService/mockdata/*.json`. After a model change update the snapshot: `cds compile srv --to edmx-v4 -l en > app/products/webapp/localService/metadata.xml`.

## Commands

Root:

| Command | What it does |
|---|---|
| `npm run watch` | CAP server with auto restart, SQLite in-memory |
| `npm test` | Backend tests (Vitest + @cap-js/cds-test) |
| `npm run lint` | `cds lint` |
| `npm run docs:registry` | Regenerate `docs/registry/*.md` from the model and sources |
| `npm run build` | `cds build --production` |

`app/products`:

| Command | What it does |
|---|---|
| `npm start` | UI5 dev server with proxy to :4004 |
| `npm run start-mock` | UI5 dev server with mock server |
| `npm run lint` | `ui5lint` |
| `npm run build` | Build into `dist/` |

## Structure

```
db/            data model (my.catalog) and CSV test data
srv/           CatalogService service, semantic annotations, handlers
app/products/  Fiori Elements application and its UI annotations
_i18n/         backend texts (en, ru)
test/          backend tests
docs/          architecture, patterns, registry, decisions, state
templates/     reference files for new artifacts
scripts/       pipeline scripts (registry, hooks, release watcher)
.claude/       Claude Code agents, skills, rules, hooks
```

Details in `docs/architecture/`, working rules in `CLAUDE.md`.

## Deployment

`mta.yaml` and `xs-security.json` are drafts for Cloud Foundry and are not yet usable for deployment. See `docs/architecture/ARCHITECTURE.md`.
