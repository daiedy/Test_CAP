# Project state

Dashboard of the project, kept in this shape (ADR-0018): `## Now` holds only the six labeled lines, `## Open debt` only table rows, `## What works` only list items. The SessionStart hook prints `Now` and `Open debt` whole, every agent reads them at protocol step 2. Narrative belongs in `docs/CHANGELOG.md` and in the feature `SUMMARY.md`, not here. Updated by `docs-keeper` at the end of every task and by the `/feature` orchestrator after every phase gate.

## Now

- Date: YYYY-MM-DD
- Branch: main
- Feature: none
- Phase: none
- Last commit: <hash> <subject>
- Next: <one sentence: the next step for the next session>

## Open debt

| Item | Resolution | Who |
|---|---|---|
| <what is known and not done> | <how it will be closed> | <user, architect, upstream-watcher> |

## What works

- <one line per verified capability, with the command or test that proves it>

## Decisions

See `docs/decisions/`; the accepted ways are rows in `docs/architecture/PATTERNS.md`.
