/**
 * Metrics event log of the hooks (ADR-0022 decision 3): `.pipeline/metrics-<session>.jsonl`,
 * gitignored, pruned after 30 days by SessionStart. Same layout, `ts` stamp and helpers as the MCP
 * audit (scripts/lib/mcp-audit.mjs); record shapes in
 * docs/features/pipeline-metrics/research/data-flow.md section 2. A record never carries prompt
 * text, tool output, file content or a transcript excerpt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, readJsonl } from './hook-utils.mjs';
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
 * The `gate` record of a blocking hook exit; never throws, a hook must not fail on its metrics.
 * @param {object} input hook input (session_id, agent_id, agent_type)
 */
export function recordGate(input, hook, reason, root = repoRoot()) {
  try {
    appendMetric(root, input?.session_id, {
      event: 'gate',
      hook,
      agent: agentKey(input || {}),
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
