---
name: spec
description: Research and feature plan only, without implementation: architect writes CONTEXT.md and PLAN.md, for a UI ux-designer adds the "Screens" section. Use when the user says "plan", "estimate", "what would it take to ...", "write a specification" (Russian: «спланируй», «оцени», «что потребуется для ...», «напиши спецификацию»).
argument-hint: <feature description> | #<issue number>
disable-model-invocation: true
---

# Specification: $ARGUMENTS

1. Argument `#N`: `gh issue view N --json title,body` gives the kebab-name (the title before the colon) and the request; create `docs/features/<name>/` now, never at backlog time (ADR-0019). A plain description: come up with a kebab-name, create the folder, and remind the user that `/backlog` is where a wish is recorded.
2. Delegate to `architect` via Agent: CONTEXT.md and PLAN.md following the templates in `templates/feature/`. Pass the description verbatim; for an issue, its "Request", "Blocked by", "Scope hints" and "Questions" sections go into the brief unchanged.
3. If the feature touches the UI, delegate SCREENS.md to `ux-designer` (template `templates/feature/SCREENS.md`).
4. Run `node scripts/check-feature-docs.mjs <name>`; a red result goes back to `architect`. Then show the user: a brief summary of the plan (steps, agents, files), decisions requiring an ADR, open questions, an assessment of the duplication risk.
5. When the user approves the plan: `node scripts/backlog.mjs status N spec-ready` and `gh issue comment N --body "PLAN.md: docs/features/<name>/PLAN.md"`. Do not write code and do not create a branch. The implementation is started separately with `/feature #N`.
6. Reply in `PIPELINE_LANG` (the SessionStart briefing prints it), otherwise in the user's language.
