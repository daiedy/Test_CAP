---
name: retro
description: Retrospective at the end of a session: what the agents did wrong or non-obviously, which rule, pattern or skill should be clarified. Writes to docs/LESSONS.md and proposes rule edits. Use when the user says "retro", "sum up the session", "what to improve in the pipeline" (Russian: «ретро», «подведи итоги сессии», «что улучшить в конвейере»).
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git *)
---

1. Collect the facts: `git log --oneline -20`, `git diff --stat HEAD~5`, the agents' reports in this session, red checks and repeated rounds.
2. For each failure answer: was the cause in knowledge (documentation or MCP was insufficient), in rules (a rule was missing or unclear), in tools (hook, script, template) or in the task (unclear plan).
3. Write the lessons to `docs/LESSONS.md` at the top: date, what happened, why, how to avoid it, source.
4. Propose concrete edits: a line in `PATTERNS.md`, a clarification in `.claude/rules/<file>.md`, a paragraph in a skill, a new template. Do not apply edits in `.claude/**` yourself, show the user a diff proposal (the files are protected).
5. Update `docs/STATE.md`: open debt and next step.

Summary: the three most important lessons and one action that will save the most time in the next session.
