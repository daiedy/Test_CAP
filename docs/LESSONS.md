# Lessons learned

This file is an inbox, not an archive. A lesson lives here only until `/retro` turns it into something that acts on its own: a hook check, a test, a path rule, a PATTERNS row, a template, an ADR or a line in an agent prompt. Transferred lessons are removed; their destination is recorded in `docs/CHANGELOG.md`. The Stop hook asks for `/retro` when more than 10 entries remain. Format: date, title, status, why it is still here.

## Pending

- 2026-11-13. `agent-turn-budget` (#60), a probe fact on one Claude Code patch did not hold on the next: P4 (the transcript is current when the hook runs) was exact on 2.1.322 and one short on 2.1.323. Status: Pending; acts in `scripts/lib/turn-budget.mjs` (the batch `tool_use_id` completes the count, ADR-0032 decision 4) and a rule for any hook that depends on timing: check the timing in the hook itself, re-measure after a Claude Code bump.
- 2026-11-13. `agent-turn-budget` (#60), a hook rate measured from its own records understates silent misses (a missed note leaves no record). Status: Pending; acts in `VERIFICATION.md` practice: verify a threshold hook against the transcript's batches (check 4), not against its own `.pipeline/` records.
- 2026-11-13. `agent-turn-budget` (#60), moving code into `scripts/lib` brings it under the relay scan: `name.slice(0, -3)` failed "no relay cuts". Status: Pending; acts in `test/` relay scan and the `cap-backend-dev` prompt: write the slice without a `slice(0, -n)` shape or move it with its test.
- 2026-11-13. `agent-turn-budget` (#60), in a shared hook sandbox an `agent-start` without `agent-stop` defers later Stop-gate tests. Status: Pending; acts in `test/hooks-*.test.js` and `test/fixtures/hook-sandbox.mjs`: every test uses its own `session_id`.
- 2026-11-13. `agent-turn-budget` (#60), a kept report `.pipeline/logs/report-<type>-<id>.md` was overwritten by the agent's plain-text note written after its handback (a `cap-backend-dev` launch: 387 bytes instead of the report). Status: Pending; acts in the PostToolUse report keeper (`scripts/hooks/`): keep the handback report, append a later plain-text end separately; STATE open debt.
- 2026-11-13. `agent-turn-budget` (#60), launch sizing: the steps 2-3 launch was sized for 40 turns and reached 57 of 60; the hook note brought it home. Status: Pending; acts in the `feature` skill launch sizing: size from the step count with margin, the note is the safety net, not the plan.
- 2026-10-27. `business-rules-wiki` (#28), an ADR digest in `docs/wiki/decisions/` has no stamp over its ADR, so an amendment leaves it stale unnoticed. Status: Pending `scripts/wiki.mjs` (`confirm` writes a `sources` stamp, `audit` checks it); queued as #55 `wiki-digest-stamp` (P2); until then `docs-keeper` step 6 restates the digest by hand.

## Pending upstream

- 2026-09-07. `DRAFT_ALREADY_EXISTS` and `DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS` keep English values in `@sap/cds/_i18n/messages_ru.properties` (still so on 10.2.2). Status: Pending upstream `@sap/cds`; an application `_i18n/messages_ru.properties` could override them (capire "Localized messages", probe 2026-11-12), but the user decided against a local translation (2026-11-12).

- 2026-09-29. Positional `req.error(status, 'KEY', args)` keeps the numeric status as `code` in `details[]` (cds 10.0.6, still so on 10.2.2, re-measured 2026-11-12). Status: Pending upstream `@sap/cds`; workaround PATTERNS "Business logic error" (object form); report 1 in `docs/upstream/sap-reports.md` (SAP Community 14498999); re-check on the next minor.
- 2026-09-25. `fiori-mcp` 1.12.2 `list_functionality` has no id for a manifest `filterFields` entry or `liveMode`. Status: Pending upstream `@sap-ux/fiori-mcp-server`; set by hand under the ADR-0020 exception, STATE open debt; npm has 1.16.2 (2026-11-11), its changelog is unread until the next `/upstream-check`.

## Transferred

Transferred lessons are removed from this file; their destinations are recorded in `docs/CHANGELOG.md` under `pipeline` (2026-09-07, 2026-09-10, 2026-09-23, 2026-10-05, 2026-10-07, 2026-10-09, 2026-11-02, 2026-11-12, 2026-11-13).
