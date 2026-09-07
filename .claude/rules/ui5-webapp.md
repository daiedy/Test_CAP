---
paths:
  - "app/**/webapp/**/*.js"
  - "app/**/webapp/**/*.xml"
  - "app/**/webapp/manifest.json"
  - "app/**/webapp/**/*.html"
---
# UI5 application code (app/<app>/webapp/)

## Before editing
1. `manifest.json`: first `mcp__fiori-mcp__list_functionality` for the application. If a functionality exists, change it only through `get_functionality_details` → `execute_functionality`. Manual editing is allowed only when no functionality exists.
2. Controls, events, API: `mcp__plugin_ui5_ui5-mcp-server__get_api_reference`. Guidelines: the `ui5-best-practices` skill from the `ui5` plugin.
3. Fiori Elements extensions: `mcp__fiori-mcp__search_docs` for "controller extension", "custom section", "custom column".
4. `docs/registry/UI-ARTIFACTS.md`: existing extensions, fragments, formatters.

## Rules
- XML views only. `sap.ui.define` with a dependency list, no global `sap.*`, `jQuery.sap.*`, `sap.ui.getCore()`.
- FE controller extension: file `ext/controller/<Page>Ext.js`, without `.controller.` in the name. The module path in the manifest must match the file.
- Fragments: `ext/fragment/<Name>.fragment.xml`. Formatters: `model/formatter.js`, in XML through `core:require`.
- Texts only through `i18n`. Keys `<page>.<element>.<property>`.
- Bootstrap parameters in html in dashed notation (`data-sap-ui-compat-version`), `data-sap-ui-async="true"`.
- `Component.js`: inherits from `sap/fe/core/AppComponent`; it contains a deliberate keyboard handler for the shell button, do not remove it without a request from the user.
- Known debt: CSP inline scripts in `index.html` and `test/flpSandbox.html`. Removed by the `modernize-flp-sandbox` skill, as a separate task.

## After editing
- `mcp__plugin_ui5_ui5-mcp-server__run_ui5_linter` or `npx ui5lint <file>` in `app/<app>`: zero errors in the changed files.
- After editing `manifest.json`: `mcp__plugin_ui5_ui5-mcp-server__run_manifest_validation`. If the tool responds with a schema error (a defect of UI5 MCP 0.2.18, see LESSONS), `npx ui5lint` in the application directory is enough: it checks the manifest with its own rules.
- Test: QUnit for the formatter or extension (`tests-ui.md`).
- `npm run docs:registry`.

## Forbidden
- Creating an application or pages by hand. Only Fiori MCP `generate_fiori_app_cap` and `execute_functionality`.
- Using screen personalization instead of editing the code.
- TypeScript until ADR-0005 is revisited.
