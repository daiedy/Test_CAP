# <Feature name>: context

Date: YYYY-MM-DD. Author: `architect`. Branch: `feature/<kebab-name>`.

This file is the brief for the implementers, so it holds only the sections below (ADR-0018). Each implementer and tester receives its slice of it with PLAN.md from the SubagentStart hook (ADR-0031, `scripts/feature-brief.mjs`); `reviewer` and `architect` read it whole. A section is for every reader, or is split into `### <Readers>: <title>` subsections, Readers a comma list of `All`, `Backend` (`cap-backend-dev`, `test-backend`) and `UI` (`fiori-app-dev`, `ui5-freestyle-dev`, `test-ui`); text before the first subsection is for every reader; `## Open questions` goes to no brief. Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts go to `research/<topic>.md`, read only by `architect` and `reviewer` unless a plan step names the file.

## Request
In one paragraph, in the user's words: what is needed and why.

## User decisions
Decisions the user made in the request or at the plan gate that shape the design. "None" if none.

## Affected entities and services
Result of `mcp__cds-mcp__search_model` and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Object | Exists now | What changes |
|---|---|---|
| `CatalogService.Products` | projection, fields ... | add ... |

### Backend: <topic>
Design that only `cap-backend-dev` and `test-backend` need: rules, message keys, seed data, the contract.

### UI: <topic>
Design that only `fiori-app-dev`, `ui5-freestyle-dev` and `test-ui` need: controls, annotations, fragments.

## What already exists and is reused
From `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md`. If nothing, state explicitly "nothing suitable exists" and why.

## Applicable patterns
Rows from `docs/architecture/PATTERNS.md` with the pattern name. If there is no pattern, note "ADR needed".

## Relevant lessons
Entries from `docs/LESSONS.md` that concern the task, one line each.

## Open questions
What the user has to decide before implementation starts.
