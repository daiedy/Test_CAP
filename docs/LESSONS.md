# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook asks for `/retro` when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-10-09. A prediction about layout behavior in a plan (SCREENS said Rating, then Subcategory pop in first on narrow screens) was approved without a measurement; `ui-verifier` measured the opposite (a column with no `UI.Importance` stays visible while Stock Quantity and Price pop in) and a review fix (`UI.Importance: #Low`) followed. Status: Pending #8; transfer to the `ux-designer` prompt as "measure a column pop-in claim in a scratch copy before the plan gate" (pop-in order inside one importance group is right to left, `sap.m.Table` source, not in MCP docs).
- 2026-10-09. In a worktree-isolated session the Bash guard refuses compound commands (`&&` chains, `git ... | ...`, heredocs mixed with `git`/`npx`) with "too complex to verify"; plain single commands or a scratch `.mjs` script run as `node <file>` pass. Status: Pending #8; transfer to `project-protocol` section 2 as a hint for agents running in a worktree.
- 2026-10-09. `cds add data --filter <Entity> --records N` (cds-dk 10.1.0) silently adds a facet to the protected `mta.yaml`; the diff showed it only because the agent looked. Status: Pending #8; transfer to the "New entity" PATTERNS row as "restore `mta.yaml` after `cds add data`", or generate the CSV by hand.

## Pending upstream

- 2026-09-29. The positional `req.error(status, 'KEY', args)` keeps the numeric status as `code` in `details[]` (cds 10.0.6; re-checked on 10.1.1 on 2026-10-07 with a throwaway service: `details[].code` is still `"409"`, the object form gives the key). Status: `Pending upstream @sap/cds`; the workaround is the object form (PATTERNS "Business logic error"); reported to SAP on 2026-10-07 as report 1 in `docs/upstream/sap-reports.md` (SAP Community question 14498999); re-check on the next minor.
- 2026-09-29. `sap-messages` header texts resolve only in `i18n.default_language`, never in `Accept-Language` (cds 10.0.6; re-checked on 10.1.1 on 2026-10-07: the header stays `en` under `Accept-Language: ru` while the error body localizes). Status: `Pending upstream @sap/cds`; the workaround is `cds.i18n.messages.at(key, req.locale, args)` (PATTERNS "Success message of an action"); reported to SAP on 2026-10-07 as report 2 in `docs/upstream/sap-reports.md` (SAP Community question 14498987); re-check on the next minor.
- 2026-09-25. `fiori-mcp` 1.12.2 `list_functionality` has no id for a manifest `filterFields` entry or `liveMode`. Status: `Pending upstream @sap-ux/fiori-mcp-server`; set by hand under the ADR-0020 exception, STATE open debt.
- 2026-09-07. `fiori-mcp` `search_docs` outages (embeddings 2026-09-07, disconnect 2026-09-16). Status: `Pending upstream @sap-ux/fiori-mcp-server`; the fallback is protocol section 3.
- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` are untranslated in `@sap/cds/_i18n/messages_ru.properties`. Status: `Pending upstream @sap/cds`; no local patch planned.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23, 2026-10-05, 2026-10-07, 2026-10-09).
