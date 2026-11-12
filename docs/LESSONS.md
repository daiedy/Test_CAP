# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook asks for `/retro` when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-11-12. `products-validations` (#10), a rule between two child rows of a draft that starts at an entity outside the draft tree (a backlink from `DetailAttributes` to its rows) reads the active rows (lean draft), so a draft edit of the sibling row is invisible to the rule and no message appears while the user edits (research section 10.3). Status: Transferred to PATTERNS "Rule between two child rows" and TESTING "cds 10 specifics"; kept here until `/retro` decides on a test helper that asserts the draft form.
- 2026-11-12. `products-validations` (#10), in `srv/lib/*.js` a private helper with a JSDoc placed before an export gives that export the helper's summary in `docs/registry/REUSE-CATALOG.md` (the generator spans from the first `/**` to the next `export function`). Status: Pending `scripts/gen-registry.mjs` (take the JSDoc block adjacent to the export) or a CONVENTIONS line; until then export the helper or place it after the exports.
- 2026-11-12. `products-validations` (#10), a criterion added late is part of every brief of the docs-keeper (its brief contains all criteria) and pushed the brief over its ceiling; a step-row addition costs only the briefs of that step's agent. Status: Pending `architect` prompt (budget criterion growth against docs-keeper first).
- 2026-11-12. `products-validations` (#10), `JourneyRunner` runs with `autoWait: true`, so an OPA assertion never matches a disabled control (use `mustBeEnabled(false)`), and under `--split-opa` each QUnit module gets the 150 s `--page-timeout`, so a journey of about 9 Object Page cases is split in two modules. Status: Pending `test-ui` agent memory or TESTING.

- 2026-10-27. `business-rules-wiki` (#28), an ADR digest in `docs/wiki/decisions/` has no stamp over its ADR, so an amendment leaves it stale unnoticed. Status: Pending `scripts/wiki.mjs` (`confirm` writes a `sources` stamp, `audit` checks it); queued as #55 `wiki-digest-stamp` (P2); until then `docs-keeper` step 6 restates the digest by hand.

## Pending upstream

- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` keep English values in `@sap/cds/_i18n/messages_ru.properties` (still so on 10.2.2). Status: Pending upstream `@sap/cds`; an application `_i18n/messages_ru.properties` could override them (capire "Localized messages", probe 2026-11-12), but the user decided against a local translation (2026-11-12).

- 2026-09-29. Positional `req.error(status, 'KEY', args)` keeps the numeric status as `code` in `details[]` (cds 10.0.6, still so on 10.2.2, re-measured 2026-11-12). Status: Pending upstream `@sap/cds`; workaround PATTERNS "Business logic error" (object form); report 1 in `docs/upstream/sap-reports.md` (SAP Community 14498999); re-check on the next minor.
- 2026-09-25. `fiori-mcp` 1.12.2 `list_functionality` has no id for a manifest `filterFields` entry or `liveMode`. Status: Pending upstream `@sap-ux/fiori-mcp-server`; set by hand under the ADR-0020 exception, STATE open debt; npm has 1.16.2 (2026-11-11), its changelog is unread until the next `/upstream-check`.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23, 2026-10-05, 2026-10-07, 2026-10-09, 2026-11-02, 2026-11-12).
