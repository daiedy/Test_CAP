# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook asks for `/retro` when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-11-03. `@sap/cds` 10.1.1 → 10.2.1 (Dependabot PR #46): `sap-messages` texts arrived with raw `{0}` placeholders in 3 tests without an `Accept-Language` header. Cause: undocumented in the changelog; `@sap/cds/lib/i18n/locale.js` of 10.2.0 returns `req.locale = undefined` for a request without a language header (the fallback to `i18n.default_language` sits behind `cds.features.locale_fallback`, "remove fallback with cds^11"), and `cds.i18n.messages.at(key, locale, args)` treats a non-string locale as its args. Fix: `messageText(key, locale, args)` in `srv/catalog-service.js` passes `locale ?? cds.i18n.default_language` (PATTERNS "Success message of an action"). Check: `npm test` 246 passed on 10.2.1 and on the merged 10.2.2. Status: Pending upstream `@sap/cds`; the change is not in the changelog or the `req.locale` docs, report it after a duplicate search (`docs/upstream/sap-reports.md`).
- 2026-10-27. `business-rules-wiki` (#28), ADR digests. A digest in `docs/wiki/decisions/` carries no stamp over its ADR (`verified` covers `code` files only), so an amendment leaves the digest stale unnoticed. Status: Pending `scripts/wiki.mjs` (a `sources` stamp written by `confirm` and checked by `audit`, a `/backlog` wish); until then the `docs-keeper` step 6 line restates the digest by hand.

## Pending upstream

- 2026-09-29. Positional `req.error(status, 'KEY', args)` keeps the numeric status as `code` in `details[]` (cds 10.0.6, still so on 10.1.1). Status: Pending upstream `@sap/cds`; workaround PATTERNS "Business logic error" (object form); report 1 in `docs/upstream/sap-reports.md` (SAP Community 14498999); re-check on the next minor.
- 2026-09-29. `sap-messages` header texts resolve only in `i18n.default_language`, never in `Accept-Language` (cds 10.0.6, still so on 10.1.1). Status: Pending upstream `@sap/cds`; workaround PATTERNS "Success message of an action"; report 2 in `docs/upstream/sap-reports.md` (SAP Community 14498987); re-check on the next minor.
- 2026-09-25. `fiori-mcp` 1.12.2 `list_functionality` has no id for a manifest `filterFields` entry or `liveMode`. Status: Pending upstream `@sap-ux/fiori-mcp-server`; set by hand under the ADR-0020 exception, STATE open debt.
- 2026-09-07. `fiori-mcp` `search_docs` outages (embeddings 2026-09-07 and 2026-10-12, disconnect 2026-09-16). Status: Pending upstream `@sap-ux/fiori-mcp-server`; the fallback is protocol section 3, recorded once per feature.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated in `@sap/cds/_i18n/messages_ru.properties`. Status: Pending upstream `@sap/cds`; no local patch planned.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23, 2026-10-05, 2026-10-07, 2026-10-09, 2026-11-02).
