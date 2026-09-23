# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook warns when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

None. The retro of 2026-09-23 transferred the three entries of the `catalog-authorization` run (a mock fixture verified on a path the application never uses, a scratchpad figure read as a phase figure, a silent-hiding mechanism failing asymmetrically across pages) and the pipeline findings of that run (the registry gate deadlock, work lost at turn limits, the orchestrator fixing instead of verifying). Destinations are listed in `docs/CHANGELOG.md`, 2026-09-23, `pipeline`.

## Pending upstream

- 2026-09-07. `run_manifest_validation` of UI5 MCP 0.2.18 fails with "schema with key or id http://json-schema.org/draft-06/schema already exists". Status: `Pending upstream @ui5/mcp-server`. Workaround in `.claude/rules/ui5-webapp.md` (ui5lint checks the manifest); `upstream-check` reports new versions.
- 2026-09-07. `sap.ushell.Container.createRenderer` is deprecated since 1.120 without a successor; the replacement is the New Sandbox (`SandboxBootTask`). Status: `Pending upstream migration`, tracked as open debt in `docs/STATE.md` (`modernize-flp-sandbox` skill, UI5 >= 1.147). The two calls carry `ui5lint-disable-next-line` with this reason.
- 2026-09-07. `fiori-mcp` `search_docs` hit an embeddings outage during `products-draft-edit`, affecting `architect`, `ux-designer` and `test-ui`; on 2026-09-16 the server disconnected mid-session during `catalog-authorization` and `reviewer` used the protocol fallback (CDN `-dbg.js` sources of the loaded UI5 version, findings marked "not verified by MCP"), which produced the root cause below. Status: `Pending upstream @sap-ux/fiori-mcp-server` (pinned 1.12.2); `upstream-check` reports new versions.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated (English) in `@sap/cds/_i18n/messages_ru.properties`, unlike `ASSERT_MANDATORY`/`ASSERT_RANGE`/`ASSERT_TARGET`, which are translated. Status: `Pending upstream @sap/cds`; not a project defect, no local patch planned.
- 2026-09-16. UI5 1.152.0 logs `Failed to read path /CatalogService.EntityContainer/Permissions/isEditor - TypeError: Cannot read properties of undefined (reading '$select')` once per page load for the container-qualified `$edmJson` `$Path` that CAP's role-based-visibility recipe prescribes (ADR-0013). Root cause (`reviewer`, static trace of the CDN debug sources): `_SingletonPropertyCache` takes the first path segment as the singleton, `_Helper.wrapChildQueryOptions` returns `undefined` for a `$kind: Singleton` segment and `aggregateExpandSelect` reads `$select` off it; the sibling call site in `ODataParentBinding` is guarded, this one is not. The actions still resolve correctly through the `MetaModelConverter` route (five measurements, both roles). Status: `Pending upstream sapui5` (1.152.0 from the unpinned CDN, ADR-0006); the unproven local fix is the short path `/Permissions/isEditor`, tracked in `docs/STATE.md` open debt; `upstream-check` reports the UI5 version change.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23).
