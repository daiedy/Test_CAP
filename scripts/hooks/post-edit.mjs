/**
 * PostToolUse hook (Edit|Write|MultiEdit): advisory quality checks on the edited file.
 * The checks themselves live in scripts/lib/file-checks.mjs, shared with the git-based
 * gates so that a file written through Bash is checked as well (ADR-0016).
 * Always exits 0; findings are returned as additionalContext.
 */
import path from 'node:path';
import { readStdinJson, repoRoot, rel, insideRepo, emitJson, exists } from '../lib/hook-utils.mjs';
import { appendAudit, agentKey } from '../lib/mcp-audit.mjs';
import { runFileChecks } from '../lib/file-checks.mjs';

try {
  const input = readStdinJson();
  const filePath = input.tool_input?.file_path;
  if (!filePath) process.exit(0);
  const root = repoRoot();
  const r = rel(filePath, root);
  if (!insideRepo(r) || !exists(path.resolve(root, r))) process.exit(0);

  // MCP audit (ADR-0014): record the edit per agent; SubagentStop compares it with the MCP attempts.
  try {
    appendAudit(root, input.session_id, {
      event: 'edit',
      agent: agentKey(input),
      agentType: input.agent_type || 'main',
      file: r,
    });
  } catch {
    // advisory
  }

  const notes = runFileChecks(root, r);
  if (notes.length) {
    emitJson({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n\n') },
    });
  }
} catch {
  // advisory hook
}
process.exit(0);
