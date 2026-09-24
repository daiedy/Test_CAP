---
name: backlog
description: Backlog in GitHub Issues (ADR-0019). Records a wish as a feature issue from a description, shows the queue by priority with the recommended next step, changes a priority or a blocker. Use when the user says "add to the backlog", "plan a feature for later", "what is next", "change the priority" (Russian: «добавь в бэклог», «запланируй фичу», «что дальше», «поменяй приоритет»).
argument-hint: (none) | <description> | #N prio P1..P3 | #N blocked-by #M ...
disable-model-invocation: true
---

# Backlog: $ARGUMENTS

The issue is the only store of a planned feature: no folder, no file in the repository, no STATE or CHANGELOG line. `docs/features/<name>/` appears at `/spec` or `/feature` time. Reply in `PIPELINE_LANG` (the SessionStart briefing prints it), otherwise in the user's language. Issue bodies are English.

## No argument: the queue

Run `node scripts/backlog.mjs briefing` and show its output as is (it is already in `PIPELINE_LANG`). Then offer the next command from the "Recommended now" line.

## `#N prio P1|P2|P3` and `#N blocked-by #M ...`

`node scripts/backlog.mjs prio N P1` or `node scripts/backlog.mjs blocked-by N 3 4` (no numbers: clears the blockers). Show the new queue with `node scripts/backlog.mjs list`.

## A description: a new issue

1. Duplicates first: `gh issue list --state all --search "<two or three key words>" --json number,title,state`, then `search_model` (cds-mcp) and `docs/registry/` for something already built. A match: show it and ask whether to continue, comment on the existing issue, or stop.
2. Kebab-name `<entity>-<what>` in the style of `docs/features/`. Title `<kebab-name>: <short English title>`.
3. Body in the shape of `.github/ISSUE_TEMPLATE/feature.yml`, written to `.pipeline/new-issue.md`:
   - `## Request`: the wish in the user's words, translated to English if needed, plus `<details><summary>Original</summary>...</details>` with the original wording;
   - `## Blocked by`: `#N, #M` or `none`;
   - `## Scope hints for architect`: only what the user said or what is visible without research (one look at the registry); the research belongs to `/spec`;
   - `## Questions for the plan gate`: one per line.
4. Ask once with AskUserQuestion: priority (default P2) and blockers (default none), unless the request already states them.
5. `node scripts/backlog.mjs create --title "<title>" --body-file .pipeline/new-issue.md --prio P2`; then `node scripts/backlog.mjs list` and tell the user the URL and the position in the queue.
6. `gh` unavailable or offline: stop and say so; do not fall back to a file.
