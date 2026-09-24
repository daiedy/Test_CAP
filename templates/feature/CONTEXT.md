# <Feature name>: context

Date: YYYY-MM-DD. Author: `architect`. Branch: `feature/<kebab-name>`.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts go to `research/<topic>.md`, read only by `architect` and `reviewer` unless a plan step names the file.

## Request
In one paragraph, in the user's words: what is needed and why.

## User decisions
Decisions the user made in the request or at the plan gate that shape the design. "None" if none.

## Affected entities and services
Result of `mcp__cds-mcp__search_model` and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Object | Exists now | What changes |
|---|---|---|
| `CatalogService.Products` | projection, fields ... | add ... |

## What already exists and is reused
From `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md`. If nothing, state explicitly "nothing suitable exists" and why.

## Applicable patterns
Rows from `docs/architecture/PATTERNS.md` with the pattern name. If there is no pattern, note "ADR needed".

## Relevant lessons
Entries from `docs/LESSONS.md` that concern the task, one line each.

## Open questions
What the user has to decide before implementation starts.
