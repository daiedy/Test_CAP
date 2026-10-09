/**
 * Metrics event log of the hooks (ADR-0022 decision 3): `.pipeline/metrics-<session>.jsonl`,
 * gitignored, pruned after 30 days by SessionStart. Same layout, `ts` stamp and helpers as the MCP
 * audit (scripts/lib/mcp-audit.mjs); record shapes in
 * docs/metrics/data-flow.md section 2. A record never carries prompt
 * text, tool output, file content or a transcript excerpt.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot, readJsonl, exists } from './hook-utils.mjs';
import { TOOL_MS } from './pipeline-metrics.mjs';
import {
  AUDIT_DIR,
  agentKey,
  sessionLogFile,
  appendSessionLog,
  pruneSessionLogs,
} from './mcp-audit.mjs';

export const METRICS_PREFIX = 'metrics';
export const METRICS_RETENTION_DAYS = 30;
/** The id of the running session, written by SessionStart; a CLI default only. */
export const CURRENT_SESSION_FILE = path.join(AUDIT_DIR, 'current-session');
/** `reason` values of a `gate` record. */
export const GATE_REASONS = [
  'lint',
  'mcp',
  'protected',
  'registry',
  'docs',
  'tests',
  'tests-timeout',
  'state-shape',
  'state-budget',
];

export function metricsFile(root, sessionId) {
  return sessionLogFile(root, METRICS_PREFIX, sessionId);
}

export function appendMetric(root, sessionId, record) {
  appendSessionLog(metricsFile(root, sessionId), record);
}

export function readMetrics(root, sessionId) {
  return readJsonl(metricsFile(root, sessionId));
}

export function pruneMetrics(root, maxAgeDays = METRICS_RETENTION_DAYS) {
  pruneSessionLogs(root, METRICS_PREFIX, maxAgeDays);
}

/**
 * The agent id of a metrics record: the hook's `agent_id` without a leading `agent-`, else 'main'.
 * The hooks reference shows `agent-abc123` for SubagentStart and `def456` for SubagentStop, and the
 * transcript file is `agent-<id>.jsonl`; the bare id joins all three.
 */
export function metricsAgent(input) {
  return agentKey(input || {}).replace(/^agent-/, '');
}

/** The SubagentStop `agent_transcript_path` with a leading `~/` expanded; '' when absent. */
export function agentTranscriptPath(input) {
  return String(input?.agent_transcript_path || '').replace(/^~(?=\/)/, os.homedir());
}

/**
 * A Claude Code internal agent at SubagentStop (prompt suggestions, `/btw`): an
 * `agent_transcript_path` is given and no file exists there (seen with an empty `agent_type` and
 * with `agent_type: "claude"`), or neither an `agent_type` nor a transcript file exists. A typed
 * agent without the path field (older Claude Code) is still metered. Not a pipeline agent, so
 * subagent-stop.mjs writes neither `agent-stop` nor `gate` for it (pipeline-metrics
 * docs/metrics/data-flow.md section 2).
 */
export function internalAgent(input) {
  const p = agentTranscriptPath(input);
  return p ? !exists(p) : !input?.agent_type;
}

/**
 * The agent types of the session's subagents still at work when the main thread stops: the last
 * record of the agent in the event log is `agent-start` (a launch or a resume), and its transcript
 * `<session>/subagents/agent-<id>.jsonl` next to the hook's `transcript_path` (the start itself
 * while the file does not exist yet) was written within TOOL_MS, the longest tool call. An agent
 * killed without a SubagentStop stops counting once its file is that old. Never throws.
 * @param {object} input Stop hook input (session_id, transcript_path)
 */
export function runningAgents(root, input, now = Date.now()) {
  try {
    const open = new Map();
    for (const r of readMetrics(root, input?.session_id)) {
      if (r.event === 'agent-start' && r.agentType !== 'main') open.set(r.agent, r);
      else if (r.event === 'agent-stop') open.delete(r.agent);
    }
    const main = String(input?.transcript_path || '').replace(/^~(?=\/)/, os.homedir());
    const dir = main && path.join(path.dirname(main), path.basename(main, '.jsonl'), 'subagents');
    const types = [];
    for (const [agent, r] of open) {
      let last = Date.parse(r.ts) || 0;
      try {
        if (dir) last = Math.max(last, fs.statSync(path.join(dir, `agent-${agent}.jsonl`)).mtimeMs);
      } catch {
        // no transcript yet: the start time stands
      }
      if (now - last <= TOOL_MS) types.push(r.agentType);
    }
    return types;
  } catch {
    return [];
  }
}

/**
 * The `gate` record of a blocking hook exit; never throws, a hook must not fail on its metrics.
 * @param {object} input hook input (session_id, agent_id, agent_type)
 */
export function recordGate(input, hook, reason, root = repoRoot()) {
  try {
    appendMetric(root, input?.session_id, {
      event: 'gate',
      hook,
      agent: metricsAgent(input),
      agentType: input?.agent_type || 'main',
      reason,
    });
  } catch {
    // best effort
  }
}

/** The session id in `.pipeline/current-session`, or null. */
export function currentSession(root = repoRoot()) {
  try {
    return fs.readFileSync(path.join(root, CURRENT_SESSION_FILE), 'utf8').trim() || null;
  } catch {
    return null;
  }
}
