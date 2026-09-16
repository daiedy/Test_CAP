# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook warns when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-09-16 (`test-backend`/`ui-verifier`, `catalog-authorization` phases 3-4). **Verify a mock fixture on the path the application actually uses, not on the path a manual test happens to try.** A plain `curl GET /Permissions` and FE's real `GET Permissions?$select=isEditor` **inside a `$batch`** gave opposite verdicts on the same fixture file: the array form `[{ "ID": "me", "isEditor": true }]` returns an empty body on the plain `GET` but the correct body inside `$batch`; the object form `{ "ID": "me", "isEditor": true }` looks correct on the plain `GET` but throws `tenantJsonData.forEach is not a function` in `@sap-ux/fe-mockserver-core` on the `$batch` path. The object form was committed on the strength of the wrong test (`4e443e1`) and the defect reached `ui-verifier` (scenario 6) before being caught and fixed (`d3a4db0`). Generalizes beyond mock fixtures: any manual smoke check (`curl`, a raw request) must exercise the same wire shape the framework actually sends, not a shape that is merely convenient to type.
- 2026-09-16 (`architect`, `catalog-authorization` phases 1-2). **A plan figure measured on a scratchpad copy of the repo can describe the feature's end state, not the phase being planned.** The 2026-09-07 architect measurement "+50 EDMX lines" was taken on a scratchpad copy that already carried the phase-3 UI annotations; it is correct for the whole feature but was initially read as the phase-2 contract delta, where the real number is +20 (the `Permissions` singleton alone). Caught in `PLAN.md` before the phase-2 gate, not after. When a measurement comes from a scratchpad or a look-ahead copy, the plan must say explicitly which phase it describes, not just the final number.
- 2026-09-16 (`ui-verifier`, `catalog-authorization` phase 4). **A silent-hiding mechanism can fail asymmetrically across pages.** When the `Permissions` singleton genuinely did not resolve (the mock-mode 500 above), the List Report kept Create and Delete while the Object Page lost Edit - the same unresolved `$Not` `$edmJson` expression defaulted to "not hidden" on one page and "hidden" on the other. So a screenshot proving "the buttons look right on the List Report" proves nothing about the Object Page, and vice versa; both must be checked whenever a `UI.*Hidden` mechanism might be unresolved.

Transferred into `docs/architecture/TESTING.md` (rule 5, "cds 10 specifics") and `templates/service.test.js` in this same change (`catalog-authorization` step 15): the EDMX pretty-printing whitespace trap and the `@requires`-also-protects-`$metadata` rule, both raised by `test-backend` on 2026-09-11.

The Bash write blind spot of 2026-09-09 was decided by the user on 2026-09-10 and transferred to ADR-0016, the shared hook libraries under `scripts/lib/`, the new PreToolUse Bash guard, the extended SubagentStop and Stop gates, rule `pipeline-config.md` and `test/hooks-protect-bash.test.js`.

## Pending upstream

- 2026-09-07. `run_manifest_validation` of UI5 MCP 0.2.18 fails with "schema with key or id http://json-schema.org/draft-06/schema already exists". Status: `Pending upstream @ui5/mcp-server`. Workaround in `.claude/rules/ui5-webapp.md` (ui5lint checks the manifest); `upstream-check` reports new versions.
- 2026-09-07. `sap.ushell.Container.createRenderer` is deprecated since 1.120 without a successor; the replacement is the New Sandbox (`SandboxBootTask`). Status: `Pending upstream migration`, tracked as open debt in `docs/STATE.md` (`modernize-flp-sandbox` skill, UI5 >= 1.147). The two calls carry `ui5lint-disable-next-line` with this reason.
- 2026-09-07. `fiori-mcp` `search_docs` hit an embeddings outage during `products-draft-edit`, affecting `architect`, `ux-designer` and `test-ui`. Fallback used: CDN `-dbg.js` sources of the loaded UI5 version (`sap-ui-version.json`), findings marked "not verified by MCP". Status: `Pending upstream @sap-ux/fiori-mcp-server` (pinned 1.12.2); `upstream-check` reports new versions.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated (English) in `@sap/cds/_i18n/messages_ru.properties`, unlike `ASSERT_MANDATORY`/`ASSERT_RANGE`/`ASSERT_TARGET`, which are translated. Status: `Pending upstream @sap/cds`; not a project defect, no local patch planned.

## Transferred on 2026-09-07 (kept for one release as a pointer, then delete)

| Lesson | Now lives in |
|---|---|
| Protected-file follow-ups of the `products-draft-edit` retro: incremental `VERIFICATION.md` and turn budget, blur before click; contract change in the same phase and ADR status replace; MCP-unavailable fallback; `IsActiveEntity` for draft-enabled entities (applied 2026-09-09 on the user's request) | agent `ui-verifier`; agent `architect` and skill `feature`; protocol section 3; rule `tests-backend.md` |
| Draft-enabled entity: `POST` without `IsActiveEntity: true` creates a draft and skips `@mandatory`; `DELETE` of a record with a draft is 403 `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS`; `@assert.*` on a draft `PATCH` are `DraftMessages` (200), enforced on `draftActivate` (400) with `in/`-prefixed targets except `ASSERT_TARGET` | `docs/architecture/TESTING.md` "cds 10 specifics"; PATTERNS "Service test", "Drafts"; `templates/service.test.js`; ADR-0012 |
| FE V4: Back navigation with a persisted draft change opens Save / Keep Draft / Discard Draft; no row marker without `Common.SemanticKey` | PATTERNS "Drafts" (the missing-marker half resolved 2026-09-09 by feature `products-draft-marker`, ADR-0015; the `docs/STATE.md` open-debt row it pointed to is closed) |
| Contract change: `npx vitest -u` and `metadata.xml` in the same phase as the model change | `templates/feature/PLAN.md` contract rule; PATTERNS "OData contract" |
| ADR acceptance replaces the whole `Status:` sentence | `templates/adr.md` |
| `ui-verifier`: incremental `VERIFICATION.md`, turn budget per scenario, `$batch` evidence, blur before click | `templates/feature/VERIFICATION.md` |
| Registry rendered the contained `DraftAdministrativeData` as a CRUD projection | `scripts/gen-registry.mjs` (entities from `DRAFT.*` labelled "contained, no EntitySet") |
| Agent memory files ride in phase commits | `docs/architecture/CONVENTIONS.md` section 7 |
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
