/**
 * PostToolUse hook (Edit|Write|MultiEdit): advisory quality checks on the edited file.
 * The checks themselves live in scripts/lib/file-checks.mjs, shared with the git-based
 * gates so that a file written through Bash is checked as well (ADR-0016).
 * Always exits 0; findings are returned as additionalContext.
 * Metrics (ADR-0022): an edit of docs/STATE.md appends `{ event: 'phase', feature, phase, raw }`
 * from the `## Now` lines `- Feature:` and `- Phase:` (phase = first integer 0-7, else `none`).
 */
import path from 'node:path';
import {
  readStdinJson,
  repoRoot,
  rel,
  insideRepo,
  emitJson,
  exists,
  readSection,
} from '../lib/hook-utils.mjs';
import { appendAudit, agentKey } from '../lib/mcp-audit.mjs';
import { appendMetric } from '../lib/metrics-log.mjs';
import { runFileChecks } from '../lib/file-checks.mjs';

const STATE = 'docs/STATE.md';
const MARKER_MAX = 80;

/** The phase marker of docs/STATE.md; best effort, a failure never reaches the edit. */
async function recordPhase(root, sessionId) {
  try {
    // Loaded lazily: only a STATE edit pays for it, and a broken metrics lib cannot break the hook.
    const { phaseOf } = await import('../lib/pipeline-metrics.mjs');
    const now = readSection(path.join(root, STATE), '## Now');
    const value = (label) =>
      now
        .match(new RegExp(`^- ${label}:[ \\t]*(.*)$`, 'm'))?.[1]
        .trim()
        .slice(0, MARKER_MAX);
    const raw = value('Phase');
    appendMetric(root, sessionId, {
      event: 'phase',
      feature: value('Feature'),
      phase: phaseOf(raw),
      raw,
    });
  } catch {
    // metrics are best effort
  }
}

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
  if (r === STATE) await recordPhase(root, input.session_id);

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
