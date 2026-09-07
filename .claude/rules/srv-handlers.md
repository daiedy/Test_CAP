---
paths:
  - "srv/**/*.js"
---
# Handlers and libraries (srv/*.js, srv/lib/*.js)

## Before editing
1. Make sure the task cannot be solved with an annotation: PATTERNS "Mandatory field", "Format or range check", "Read-only", "Authorization". A handler only when an annotation cannot express it.
2. `mcp__cds-mcp__search_model` for the entity and event, `mcp__cds-mcp__search_docs` for the API (`req.reject`, `srv.before`, `cds.ql`, `cds.log`).
3. `docs/registry/HANDLERS.md`: check whether a handler for this event already exists. One handler per event and entity.
4. `docs/registry/REUSE-CATALOG.md`: the function you need may already live in `srv/lib/`.

## Rules
- ESM. `import cds from '@sap/cds'`. Class `export default class <Service> extends cds.ApplicationService`, all registration in `async init()`, `return super.init()` at the end.
- Order in `init()`: `before` → `on` → `after`.
- Errors: `req.reject(<status>, '<MESSAGE_KEY>', [args])`, the key in `_i18n/messages.properties` and `_i18n/messages_ru.properties`.
- Logs: `const LOG = cds.log('<module>')` at module level. `console.*` is forbidden.
- Queries only through `cds.ql`. No manual transactions, do not open `cds.tx()` manually.
- Shared code: `srv/lib/<topic>.js`, named exports, JSDoc, no access to `req`.
- Templates: `templates/handler.js`, `templates/lib.js`.

## After editing
- `npx prettier --write <file>`, `npx eslint <file>`.
- A test for every handler in `test/<service>.test.js`, run `npm test`, the output goes into the report.
- `npm run docs:registry`.

## Forbidden
- Duplicating what the generic service provider does (CRUD, `@mandatory`, `@assert`).
- Hardcoded strings, URLs, credentials, tenant IDs.
- `await` inside `cds.on('served', ...)` without error handling; `process.chdir`.
