/**
 * PostToolUse | PostToolUseFailure hook (matcher ^mcp__|^Skill$): appends every MCP and skill
 * attempt to the per-session audit log in .pipeline/ (gitignored). SubagentStop reads it (ADR-0014).
 * Never blocks, never prints.
 */
import { readStdinJson, repoRoot, truncate } from '../lib/hook-utils.mjs';
import { appendAudit, agentKey } from '../lib/mcp-audit.mjs';

try {
  const input = readStdinJson();
  const tool = input.tool_name || '';
  const isSkill = tool === 'Skill';
  if (!isSkill && !tool.startsWith('mcp__')) process.exit(0);
  const ti = input.tool_input || {};
  const subject = ti.name ?? ti.query ?? ti.functionalityId ?? ti.skill ?? ti.url ?? '';
  appendAudit(repoRoot(), input.session_id, {
    event: isSkill ? 'skill' : 'mcp',
    agent: agentKey(input),
    agentType: input.agent_type || 'main',
    tool: isSkill ? `Skill:${ti.skill || ''}` : tool,
    ok: input.hook_event_name !== 'PostToolUseFailure',
    subject: truncate(String(subject), 120),
  });
} catch {
  // advisory hook: never break the tool call on internal errors
}
process.exit(0);
