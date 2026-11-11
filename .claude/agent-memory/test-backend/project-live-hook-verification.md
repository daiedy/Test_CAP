---
name: project-live-hook-verification
description: How to prove the ADR-0031 hooks (brief, read gate) live from your own launch; own agent id, transcript path, PIPELINE_LANG for CLI evidence
metadata:
  type: project
---

Proving the context-hygiene hooks live in a verification launch (#44 phase 4, 2026-11-11):

- Own agent id: the newest `agent-start` record of your type in `.pipeline/metrics-<session>.jsonl`; transcript `~/.claude/projects/-Users-anton-straltsou-github-Test-CAP/<session>/subagents/agent-<id>.jsonl`. The SubagentStart brief is record 3 (`attachment.type: hook_additional_context`), record 2 is the `hook_success` twin with empty content. Some attachments have no `content` key: guard before `.slice`.
- Read gate: whole Read twice of an unchanged file, the second is denied (`PreToolUse:Read hook error: Read gate ...`), the third passes. Ledger `.pipeline/read-ledger-<session>.jsonl` holds `read` then `deny`; the passing third read adds no line. Metrics get one `gate` record `reread`.
- Hooks were hot-reloaded mid-session: evidence is the `.pipeline/logs/report-*.md` mtimes after the `.claude/settings.json` mtime, no restart needed.
- `scripts/metrics.mjs` prints in PIPELINE_LANG (`ru` here): rerun with `PIPELINE_LANG=en` before quoting into an English doc.

**Why:** the phase 4 criteria say "a session started after the settings change"; the orchestrator accepted this session-local evidence instead.
**How to apply:** for any later live-hook check, budget about 3 calls per hook; see [[project-claude-code-hook-runtime]].
