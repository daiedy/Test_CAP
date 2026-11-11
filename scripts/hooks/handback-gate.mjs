/**
 * PreToolUse and PostToolUse hook (matcher `SubagentHandback`, told apart by `hook_event_name`, as
 * mcp-audit.mjs serves two events): the hand-over gate of an auto-mode subagent (ADR-0031 decision
 * 8, probe facts F6, F8).
 * PreToolUse runs the hand-over checks of scripts/lib/handover-checks.mjs (lint, protected, mcp)
 * against `tool_input.message` and denies with their block text; the agent fixes and calls again
 * (a deny reason arrives whole, F6). Each deny appends `{ event: 'handback-deny', agent, agentType,
 * reason }` to the MCP audit log and `{ event: 'gate', hook: 'handback-gate', reason }` to the
 * metrics log. The `mcp` reason denies once per agent id (ADR-0014): the next attempt without the
 * section passes with `skipped-unjustified`. After HANDBACK_DENY_MAX denies of one agent id the next
 * attempt passes with a `gate` record `handback-limit`, so the report still leaves before the
 * platform stops retrying (F9), and the card shows it left with open findings.
 * PostToolUse writes `tool_input.message` whole to `.pipeline/logs/report-<agent_type>-<agent_id>.md`
 * (ADR-0031 decision 7 level 2, Q8); a later delivery of the same agent id overwrites it.
 * Allows without output: an unreadable input, a call without `agent_id` (the main thread has no
 * handback), any internal error. A Claude Code internal agent (`internalAgent()`) writes no `gate`
 * record; the deny count still lives in the audit log.
 */
import { readStdinJson, repoRoot, emitJson } from '../lib/hook-utils.mjs';
import { agentKey, appendAudit } from '../lib/mcp-audit.mjs';
import { recordGate, internalAgent } from '../lib/metrics-log.mjs';
import {
  handoverFindings,
  blockText,
  saveReport,
  HANDBACK_TOOL,
  HANDBACK_DENY,
  HANDBACK_DENY_MAX,
} from '../lib/handover-checks.mjs';

const HOOK = 'handback-gate';

function gate() {
  const input = readStdinJson();
  if (!input.agent_id || input.tool_name !== HANDBACK_TOOL) return;
  const root = repoRoot();
  const message = input.tool_input?.message;
  if (input.hook_event_name === 'PostToolUse') {
    if (typeof message === 'string') saveReport(root, input, message);
    return;
  }
  if (input.hook_event_name !== 'PreToolUse') return;
  const findings = handoverFindings(root, input, typeof message === 'string' ? message : '');
  if (!findings.reason) return;
  const agent = agentKey(input);
  const metered = !internalAgent(input);
  const denies = findings.route.records.filter(
    (r) => r.event === HANDBACK_DENY && r.agent === agent
  ).length;
  if (denies >= HANDBACK_DENY_MAX) {
    if (metered) recordGate(input, HOOK, 'handback-limit', root);
    return;
  }
  appendAudit(root, input.session_id, {
    event: HANDBACK_DENY,
    agent,
    agentType: input.agent_type || 'main',
    reason: findings.reason,
  });
  if (metered) recordGate(input, HOOK, findings.reason, root);
  emitJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: blockText(findings, `call ${HANDBACK_TOOL} again`),
    },
  });
}

try {
  gate();
} catch {
  // a hand-over gate that fails must not swallow the report: an internal error allows
}
