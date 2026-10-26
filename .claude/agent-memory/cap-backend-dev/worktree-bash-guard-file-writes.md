---
name: worktree-bash-guard-file-writes
description: The Bash guard refuses heredoc file writes, `VAR=... npx` and `rm -rf "$T"` of a mktemp variable; Write/Edit for files, plain npx, literal scratch paths
metadata:
  type: feedback
---

In a worktree-isolated session the Bash guard refuses `cat > file <<'EOF'` heredocs and commands prefixed with a variable assignment (`PATH=... npx ...`) as "too complex to verify" (seen 2026-10-14, docs-toolchain step 2). Plain `npx cds ...`, `perl -0pi -e` one-liners and a redirect `npx cds compile ... > file` pass.

**Why:** the guard cannot prove such commands stay inside the worktree; the system prompt's "use Bash for edits" preference then has to fall back to the file tools.

The built-in removal check also refuses `rm -rf "$T"` when `T=$(cd "$(mktemp -d ...)" && pwd -P)` (it cannot prove `$T` is not the cwd), with no approval possible (2026-10-26, wiki root fix). Use a literal folder such as `/tmp/<task>-check/` for the whole scratch tree and `rm -rf` that literal path at the end.

**How to apply:** use Read + Write/Edit for multi-line file changes (they also fire the PostToolUse linters and the MCP edit audit); check `node --version` first instead of prefixing PATH (node 22 at /opt/homebrew/bin was enough). Related: [[cds-add-data-touches-mta]].
