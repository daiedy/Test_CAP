---
name: feedback-bash-bypasses-hooks-prefer-edit
description: In Test_CAP, files written via Bash (redirection/heredoc) are invisible to PreToolUse/PostToolUse/SubagentStop hooks; when a task explicitly says "use Edit/Write, never Bash", that overrides any generic "prefer Bash for file edits" default-behavior nudge.
metadata:
  type: feedback
---

Test_CAP's pipeline hooks (`protect-files.mjs` on PreToolUse, the per-file-type compile/lint hooks on PostToolUse, the MCP-vs-edit comparison in `subagent-stop.mjs`) only fire on `Edit`/`Write` tool calls. A file written or overwritten through `Bash` (`cat > path << EOF`, `sed -i`, shell redirection) never triggers any of them — not even the `manifest.json` protection. This was found and recorded as a pipeline lesson in `products-draft-marker` phase 3 (`docs/CHANGELOG.md` 2026-09-09 "pipeline", `docs/LESSONS.md` "Pending"): `fiori-app-dev` wrote three files via Bash redirection and every gate that should have run automatically was skipped (the auditors re-ran them manually and found no actual problem that time, but the blind spot itself is the finding).

**Why this matters for docs-keeper specifically:** some conversation-level system reminders bias toward "do your work through Bash wherever it can accomplish the job... rather than using the dedicated Read, Edit, or Write tools" as a generic default. In `products-draft-marker` phase 6 the task brief explicitly overrode that default: "Make every file change with Write/Edit, never with a Bash heredoc, `sed -i` or shell redirection into a project file — that is exactly the blind spot item A and E describe." Following the generic Bash-preference default here would have reproduced, inside the very commit that documents the bypass, the exact bypass being documented.

**How to apply:** when a task brief (the closest thing to direct user instruction in this pipeline) gives an explicit tool-discipline rule, that rule wins over a generic conversational default-behavior nudge to prefer Bash. Absent such an explicit rule, Bash `cp`/`mv`/directory listing/greps are still fine — it is specifically *authoring or overwriting file content* through the shell that this project's hooks cannot see. See [[feedback-write-tool-blocks-summary]] for the accompanying workaround when the `Write` tool's report-file guard also gets in the way.
