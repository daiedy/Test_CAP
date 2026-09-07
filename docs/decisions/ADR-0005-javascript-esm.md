# ADR-0005: JavaScript for UI5, ESM for the backend, TypeScript postponed

Date: 2026-09-07. Status: accepted, to be revisited with the first freestyle UI5 application.

## Context
The existing `app/products` application is in JavaScript. SAP recommends TypeScript for new UI5 applications and provides a conversion plugin. The backend has no code; `cds init` in cds 10 creates ESM projects by default.

## Decision
- Backend: ESM (`"type": "module"`), handlers as classes `extends cds.ApplicationService`, pipeline scripts `.mjs`.
- UI: JavaScript with `sap.ui.define`, as in the existing application. One language for the whole `app/`, so that rules, templates and the linter are uniform.
- TypeScript for the UI is revisited when the first freestyle UI5 application (not Fiori Elements) appears: then conversion via the `ui5-typescript-conversion` plugin and a new ADR.

## Alternatives
| Option | Why rejected |
|---|---|
| TypeScript right away | A Fiori Elements application contains almost no code; converting the existing code for the sake of two files does not pay off |
| CommonJS on the backend | cds 10 and cds-test target ESM; `import.meta.dirname` is more convenient than `__dirname` |

## Consequences
- `templates/handler.js`, `lib.js`, `service.test.js` in ESM.
- `eslint.config.mjs` from `cds add lint` works without changes.
- The `templates/handler.js` template and the `ui5-webapp.md` rule forbid TypeScript until the revision.

## Sources
- https://cap.cloud.sap/docs/releases/2026/jun26
- https://github.com/UI5/plugins-coding-agents (ui5-typescript-conversion)
