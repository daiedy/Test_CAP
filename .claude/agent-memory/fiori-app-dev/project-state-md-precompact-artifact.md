---
name: project-state-md-precompact-artifact
description: An unexplained one-line diff in docs/STATE.md "## Sessions" during an agent run is written by the PreCompact hook, not by the agent
metadata:
  type: project
---

A working-tree diff that only appends one line to the `## Sessions` section of `docs/STATE.md`
(format: `- <date> <time> UTC: branch <branch>, changed files <n>, compaction auto|manual`)
is produced by the PreCompact hook, not by whichever agent is running.

**Why:** `docs/STATE.md` declares in its own header that it is updated by `docs-keeper` and by the
PreCompact hook. Agents in a `/feature` run are usually told explicitly *not* to touch
`docs/STATE.md`, so this line looks like a rule violation or a stray edit when it appears in
`git diff --stat` at the end of a phase.

**How to apply:** Do not revert it and do not claim authorship of it. Report it as an
environment-produced diff in the phase report so the orchestrator can decide, then continue.
Verify by reading the diff: if it touches anything besides that one `## Sessions` bullet, it is a
real edit and needs investigation.
