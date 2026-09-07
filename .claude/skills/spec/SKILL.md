---
name: spec
description: Research and feature plan only, without implementation: architect writes CONTEXT.md and PLAN.md, for a UI ux-designer adds the "Screens" section. Use when the user says "plan", "estimate", "what would it take to ...", "write a specification" (Russian: «спланируй», «оцени», «что потребуется для ...», «напиши спецификацию»).
argument-hint: <feature description>
disable-model-invocation: true
---

# Specification: $ARGUMENTS

1. Come up with a kebab-name and create `docs/features/<name>/`.
2. Delegate to `architect` via Agent: CONTEXT.md and PLAN.md following the templates in `templates/feature/`. Pass the description verbatim.
3. If the feature touches the UI, delegate the "Screens" section in CONTEXT.md to `ux-designer`.
4. Show the user: a brief summary of the plan (steps, agents, files), decisions requiring an ADR, open questions, an assessment of the duplication risk.
5. Do not write code and do not create a branch. The implementation is started separately with the command `/feature <name>`.
