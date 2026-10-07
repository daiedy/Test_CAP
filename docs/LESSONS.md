# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook asks for `/retro` when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-10-07. `ui-verifier`: the Basic Auth priming XHR for :4004 returns 401 when sent from `about:blank`; navigate to a same-origin page first (`http://localhost:4004/favicon.ico`), then prime. Status: `Pending /retro`; candidate: the `ui-verifier` memory topic `fe-v4-basic-auth-session-priming.md`.
- 2026-10-07. WebFetch summarises a long GitHub CHANGELOG and stops early (the `fiori-mcp-server` changelog ended at 1.12.2, the raw file at `raw.githubusercontent.com` gave the entries up to 1.15.6). Status: `Pending /retro`; candidate: the raw URL in `upstream-check` step 3 for the Fiori MCP changelog.

## Pending upstream

- 2026-09-29. The positional `req.error(status, 'KEY', args)` keeps the numeric status as `code` in `details[]` (cds 10.0.6; re-checked on 10.1.1 on 2026-10-07 with a throwaway service: `details[].code` is still `"409"`, the object form gives the key). Status: `Pending upstream @sap/cds`; the workaround is the object form (PATTERNS "Business logic error"); reported to SAP on 2026-10-07 as report 1 in `docs/upstream/sap-reports.md` (SAP Community question 14498999); re-check on the next minor.
- 2026-09-29. `sap-messages` header texts resolve only in `i18n.default_language`, never in `Accept-Language` (cds 10.0.6; re-checked on 10.1.1 on 2026-10-07: the header stays `en` under `Accept-Language: ru` while the error body localizes). Status: `Pending upstream @sap/cds`; the workaround is `cds.i18n.messages.at(key, req.locale, args)` (PATTERNS "Success message of an action"); reported to SAP on 2026-10-07 as report 2 in `docs/upstream/sap-reports.md` (SAP Community question 14498987); re-check on the next minor.
- 2026-09-25. `fiori-mcp` 1.12.2 `list_functionality` has no id for a manifest `filterFields` entry or `liveMode`. Status: `Pending upstream @sap-ux/fiori-mcp-server`; set by hand under the ADR-0020 exception, STATE open debt.
- 2026-09-16. UI5 1.152.0 logs a `$select` TypeError for the container-qualified `$edmJson` `$Path` of ADR-0013 (unguarded `_Helper.aggregateExpandSelect`); unchanged on 1.153.0 (2026-10-07, `ui-verifier`: once when the Object Page opens, not on the List Report, both roles). Status: `Pending upstream sapui5`; the unproven local fix (short path `/Permissions/isEditor`) is STATE open debt.
- 2026-09-07. `sap.ushell.Container.createRenderer` is deprecated since 1.120 without a successor. Status: `Pending upstream migration` to the New Sandbox (`modernize-flp-sandbox`, UI5 >= 1.147), STATE open debt.
- 2026-09-07. `fiori-mcp` `search_docs` outages (embeddings 2026-09-07, disconnect 2026-09-16). Status: `Pending upstream @sap-ux/fiori-mcp-server`; the fallback is protocol section 3.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated in `@sap/cds/_i18n/messages_ru.properties`. Status: `Pending upstream @sap/cds`; no local patch planned.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23, 2026-10-05, 2026-10-07).
