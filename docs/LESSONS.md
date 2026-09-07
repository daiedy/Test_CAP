# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook warns when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending upstream

- 2026-09-07. `run_manifest_validation` of UI5 MCP 0.2.18 fails with "schema with key or id http://json-schema.org/draft-06/schema already exists". Status: `Pending upstream @ui5/mcp-server`. Workaround in `.claude/rules/ui5-webapp.md` (ui5lint checks the manifest); `upstream-check` reports new versions.
- 2026-09-07. `sap.ushell.Container.createRenderer` is deprecated since 1.120 without a successor; the replacement is the New Sandbox (`SandboxBootTask`). Status: `Pending upstream migration`, tracked as open debt in `docs/STATE.md` (`modernize-flp-sandbox` skill, UI5 >= 1.147). The two calls carry `ui5lint-disable-next-line` with this reason.

## Transferred on 2026-09-07 (kept for one release as a pointer, then delete)

| Lesson | Now lives in |
|---|---|
| Sandbox bootstrap tag needs `id="sap-ushell-bootstrap"`, app url relative, tiles in `appconfig/fioriSandboxConfig.json` | PostToolUse checks `checkSandboxHtml`, `checkSandboxConfig`; rule `ui5-webapp.md`; agent `ui-verifier` opens `#Shell-home` |
| ui5.yaml middleware without its package or `ui5.dependencies` entry | PostToolUse check `checkUi5Yaml` |
| CDS templates need unique namespaces (cds-mcp compiles them) | PostToolUse check `checkTemplateNamespace`; `test-all` step 7 |
| metadata.xml snapshot from the whole model (`cds compile '*'`) | `test/metadata.test.js` sync test; all commands fixed |
| `Common.Text` on the key of an own CodeList; DataField paths on the foreign key; delete the old explicit ValueList | rule `ui-annotations.md`; ADR-0011; `templates/annotations-ui.cds` |
| `cds.test` errors carry `code` and `target` | rule `tests-backend.md`; `test/catalog-service.test.js` |
| OPA5: generator scaffold only for page objects, intent in `iStartMyApp`, teardown as the last test, dropdown is a typeahead table | rule `tests-ui.md`; page object `CategoryDropdown.js` |
| `$filter` of FE V4 multi-select is inside `$batch` | agent `ui-verifier` |
| `ui5lint --fix` rewrites code, review the diff | rule `ui5-webapp.md`; agent `fiori-app-dev` |
| Titles live on the projection, not the db entity | rule `srv-services.md`; registry generator |
| `cds-serve --watch` crashes on cds 10 | `package.json` `watch` = `cds watch` |
| MockServer/Sinon cannot mock OData V4 | ADR-0008, `ui5-mock.yaml` |
| Controller extension file without `.controller.` | rule `ui5-webapp.md` |
| First-run retro (turn limits, STATE per phase, smoke step, draft decision before planning) | agents' `maxTurns`; skills `feature`, `test-all`; agent `architect` |
| `cds add lint` reformats `mta.yaml`; keyboard hack in `Component.js` | history: CHANGELOG 2026-09-07 and `docs/STATE.md` open debt |
