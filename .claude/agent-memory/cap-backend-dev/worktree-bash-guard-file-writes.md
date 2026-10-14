---
name: worktree-bash-guard-file-writes
description: In a worktree session the Bash guard refuses heredoc file writes and `VAR=... npx`; write files with Write/Edit, run npx plainly (node 22 is already on PATH)
metadata:
  type: feedback
---

In a worktree-isolated session the Bash guard refuses `cat > file <<'EOF'` heredocs and commands prefixed with a variable assignment (`PATH=... npx ...`) as "too complex to verify" (seen 2026-10-14, docs-toolchain step 2). Plain `npx cds ...`, `perl -0pi -e` one-liners and a redirect `npx cds compile ... > file` pass.

**Why:** the guard cannot prove such commands stay inside the worktree; the system prompt's "use Bash for edits" preference then has to fall back to the file tools.

**How to apply:** use Read + Write/Edit for multi-line file changes (they also fire the PostToolUse linters and the MCP edit audit); check `node --version` first instead of prefixing PATH (node 22 at /opt/homebrew/bin was enough). Related: [[cds-add-data-touches-mta]].
