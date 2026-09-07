---
name: retro
description: Retrospective at the end of a session or feature: what the agents did wrong or non-obviously, and where each lesson must live so that it acts automatically (test, hook, rule, pattern, agent prompt). Keeps docs/LESSONS.md short. Use when the user says "retro", "sum up the session", "what to improve in the pipeline" (Russian: «ретро», «подведи итоги сессии», «что улучшить в конвейере»).
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git *), Bash(node *), Bash(npm *)
---

# Retrospective and lesson triage

`docs/LESSONS.md` is an inbox, not an archive. A lesson stays there only until it is turned into something that acts without anyone reading it. The Stop hook warns when more than 10 entries are still marked `Pending`.

## 1. Collect the facts

`git log --oneline -20`, `git diff --stat HEAD~5`, the agents' reports of this session, red checks, repeated rounds, hook blocks, entries in `docs/LESSONS.md` marked `Pending`.

## 2. Name the cause of each failure

Knowledge (documentation or MCP was insufficient), rules (a rule was missing or unclear), tools (hook, script, template), task (unclear plan). Skip retrospective narration: what worked goes to the feature SUMMARY, not to LESSONS.

## 3. Assign a destination to every lesson

| The lesson is about | Destination | Result |
|---|---|---|
| Something a machine can check (a file shape, a command, a version) | `scripts/hooks/post-edit.mjs`, `test/`, a step in `test-all` | the check runs on every edit or commit |
| How to do things in files of one type | `.claude/rules/<type>.md` or a row in `docs/architecture/PATTERNS.md` | loaded automatically when such a file is touched |
| A step of one role's procedure | the agent prompt in `.claude/agents/<role>.md` | the role does it every time |
| A decision between alternatives | ADR in `docs/decisions/` and a PATTERNS row | the choice is fixed |
| Waiting for an upstream fix | stays in LESSONS with `Pending upstream` and the package/version to watch | `upstream-check` reports when it changes |
| History only | `docs/CHANGELOG.md` or the feature SUMMARY | removed from LESSONS |

## 4. Apply the transfers

Edit the destination. `.claude/**` and `scripts/hooks/**` are protected: apply with `PIPELINE_ALLOW_PROTECTED=1` only when the user asked for the retro, otherwise show the diff and wait. After a hook change run the smoke test (pipe a sample JSON into the hook) and `node --check`.

## 5. Rewrite LESSONS

Remove every transferred entry. For each remaining entry write one line: date, title, status `Pending <destination>` or `Pending upstream <package>`, and the reason it is not transferred yet. Keep the file under ~40 lines.

## 6. Update STATE

Open debt and next step in `docs/STATE.md`; a line in `docs/CHANGELOG.md` under `pipeline` listing what was transferred where.

Summary for the user: how many lessons were transferred and where, what remains pending, and one action that saves the most time next time.
