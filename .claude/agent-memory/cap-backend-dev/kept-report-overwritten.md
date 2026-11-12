---
name: kept-report-overwritten
description: .pipeline/logs/report-<type>-<id>.md can hold a later plain-text note of the agent, not its delivered report; derive exports from the code then
metadata:
  type: project
---

`.pipeline/logs/report-cap-backend-dev-ab48cfd9654506e7f.md` (#60 steps 2-3) held only a 387-byte post-handback note ("My report is already delivered..."), not the report the coordinator pointed to (2026-11-13).

**Why:** the agent wrote plain text after its SubagentHandback (a background `npm test` finished), and the hook kept that last message under the same report path.

**How to apply:** when a launch says "read section X of the previous report" and the file is tiny or lacks the section, do not stop; take exports, signatures and record shapes from `git diff` and the new files, and say so in the report. Related: [[claude-code-hook-runtime-facts]].
