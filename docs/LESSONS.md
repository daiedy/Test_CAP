# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook warns when more than 10 entries remain. Format: date, title, status, why it is still here.

## New on 2026-09-07 (`products-draft-edit`)

- A `POST` to a draft-enabled entity without `IsActiveEntity: true` creates a draft (201, `IsActiveEntity: false`) and skips `@mandatory`/`@assert.target`; address active data explicitly. Source: `test-backend`, ADR-0012.
- `DELETE /Entity(<id>)` (addressed as active) of a record that has an open draft answers 403 `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS`; discard with `DELETE /Entity(ID=<id>,IsActiveEntity=false)` instead. Source: `test-backend`.
- `@assert.*` violations on a draft `PATCH` surface as `DraftMessages` with HTTP 200 and are only enforced (400) on `draftActivate`; the `target` on activation is prefixed `in/<field>` (e.g. `in/name`) except `ASSERT_TARGET` on a new draft, which stays a plain field path (e.g. `category_code`) — match by a suffix regex, assert `code` exactly. Source: `test-backend`.
- The registry generator (`scripts/gen-registry.mjs`) renders the contained `DraftAdministrativeData` entity type as a CRUD projection in `SERVICES.md`, although it has no `EntitySet`. Not fixed in this feature (`scripts/` is code, needs a user request); recorded as debt in `docs/STATE.md`. Source: `reviewer`, `docs-keeper`.
- FE V4 1.152: shell/browser Back navigation with a persisted (PATCHed) draft change opens a "Warning" dialog (Save / Keep Draft / Discard Draft), not a silent keep as the CAP draft principle alone would suggest. Source: `ui-verifier`, corrected in `CONTEXT.md`.
- Chrome DevTools MCP: clearing a required `sap.m.Input` with `fill("")` or `Ctrl+A`+`Backspace` immediately before a button click may not reliably fire the `change` event UI5 needs to mark the bound property dirty, so a subsequent Save can read the last committed (non-empty) value. Blur the field and confirm the PATCH landed in `$batch` before pressing the button. Source: `ui-verifier`, `VERIFICATION.md` scenario 7.
- Pipeline: a contract (OData model) change must schedule `npx vitest -u` and the `metadata.xml` regeneration in the same phase as the model change, not a later one; PLAN steps 4 and 6 had to be rewritten mid-run when the phase-2 gate needed `npm test` green before the UI phase started. Source: orchestrator, `PLAN.md` step 4 note.
- Pipeline: accepting an ADR must replace the whole `Status:` sentence, not append to it — an earlier edit left a concatenated, self-contradicting sentence ("accepted ... decision by the user pending"). Source: `reviewer` finding, fixed in ADR-0012 by `docs-keeper`.
- Pipeline: `ui-verifier` needed three 80-turn sessions to cover 10 scenarios end to end; write `VERIFICATION.md` incrementally (a table row per scenario as it completes) and budget turns per scenario up front rather than discovering the shortfall mid-run. Source: `ui-verifier`, `VERIFICATION.md`.

## Pending upstream

- 2026-09-07. `run_manifest_validation` of UI5 MCP 0.2.18 fails with "schema with key or id http://json-schema.org/draft-06/schema already exists". Status: `Pending upstream @ui5/mcp-server`. Workaround in `.claude/rules/ui5-webapp.md` (ui5lint checks the manifest); `upstream-check` reports new versions.
- 2026-09-07. `sap.ushell.Container.createRenderer` is deprecated since 1.120 without a successor; the replacement is the New Sandbox (`SandboxBootTask`). Status: `Pending upstream migration`, tracked as open debt in `docs/STATE.md` (`modernize-flp-sandbox` skill, UI5 >= 1.147). The two calls carry `ui5lint-disable-next-line` with this reason.
- 2026-09-07. `fiori-mcp` `search_docs` hit an embeddings outage during `products-draft-edit`, affecting `architect`, `ux-designer` and `test-ui`. Fallback used: CDN `-dbg.js` sources of the loaded UI5 version (`sap-ui-version.json`), findings marked "not verified by MCP". Status: `Pending upstream @sap-ux/fiori-mcp-server` (pinned 1.12.2); `upstream-check` reports new versions.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated (English) in `@sap/cds/_i18n/messages_ru.properties`, unlike `ASSERT_MANDATORY`/`ASSERT_RANGE`/`ASSERT_TARGET`, which are translated. Status: `Pending upstream @sap/cds`; not a project defect, no local patch planned.

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
