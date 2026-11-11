/**
 * The ledger of the read gate (ADR-0031 decision 3, Q1): `.pipeline/read-ledger-<session>.jsonl`,
 * a third session log in the layout of the MCP audit and the metrics event log (`sessionLogFile()`,
 * `appendSessionLog()`, `readJsonl()`), gitignored, pruned after LEDGER_RETENTION_DAYS by
 * SessionStart. Record shapes:
 *   { ts, event: 'read', agent, agentType, file, hash, bytes }   a whole-file Read passed with content
 *                                                               the agent had not read whole before
 *   { ts, event: 'deny', agent, agentType, file, hash, reason }   the gate denied it, reason `reread`
 *                                                               or `brief`
 *   { ts, event: 'reset', agent }                                 PreCompact: the agent's earlier
 *                                                               records no longer count
 * `agent` is `metricsAgent()` of the hook input (the bare agent id, or 'main'), so it joins the
 * `brief` record of the metrics log; `file` is repo-relative posix; `hash` the sha256 of the content.
 * A record never carries file content. `readVerdict()` is the rule, a pure function.
 */
import fs from 'node:fs';
import { readJsonl } from './hook-utils.mjs';
import { sessionLogFile, appendSessionLog, pruneSessionLogs } from './mcp-audit.mjs';

export const LEDGER_PREFIX = 'read-ledger';
/** Same retention as the MCP audit. */
export const LEDGER_RETENTION_DAYS = 14;

/**
 * Path of the session's ledger.
 * @param {string} root repo root
 * @param {string} sessionId the hook input's session_id (the main session's, also in a subagent: F3)
 * @returns {string} absolute path
 */
export function ledgerFile(root, sessionId) {
  return sessionLogFile(root, LEDGER_PREFIX, sessionId);
}

/**
 * Reads the session's ledger.
 * @param {string} root repo root
 * @param {string} sessionId the hook input's session_id
 * @returns {object[]|null} the records ([] for a missing file, unparsable lines skipped); null for
 *   a ledger that exists and cannot be read, which the gate answers by allowing the read
 */
export function readLedger(root, sessionId) {
  const file = ledgerFile(root, sessionId);
  try {
    if (!fs.statSync(file).isFile()) return null;
    fs.accessSync(file, fs.constants.R_OK);
  } catch (e) {
    return e?.code === 'ENOENT' ? [] : null;
  }
  return readJsonl(file);
}

/**
 * Appends one record with a leading `ts`; throws when the ledger cannot be written.
 * @param {string} root repo root
 * @param {string} sessionId the hook input's session_id
 * @param {object} record one of the shapes above, without `ts`
 */
export function appendLedger(root, sessionId, record) {
  appendSessionLog(ledgerFile(root, sessionId), record);
}

/**
 * Removes ledgers older than `maxAgeDays`; called by SessionStart.
 * @param {string} root repo root
 * @param {number} maxAgeDays age limit by mtime
 */
export function pruneLedger(root, maxAgeDays = LEDGER_RETENTION_DAYS) {
  pruneSessionLogs(root, LEDGER_PREFIX, maxAgeDays);
}

/**
 * The records of one agent that still count: those after its last `reset`.
 * @param {object[]} records the ledger
 * @param {string} agent `metricsAgent()` of the hook input
 * @returns {object[]} in ledger order
 */
export function liveRecords(records, agent) {
  const mine = records.filter((r) => r && r.agent === agent);
  return mine.slice(mine.findLastIndex((r) => r.event === 'reset') + 1);
}

/**
 * The verdict on a whole-file Read (no `offset`, `limit`, `pages`) of a repository file. Deny once
 * per agent and file with reason `brief` when the agent received a brief and the file is the active
 * feature's PLAN.md or CONTEXT.md; deny once per agent, file and content hash with reason `reread`
 * when the agent's latest whole read of the file had the same hash. A changed file, another agent
 * and the attempt after a deny pass.
 * @param {object[]} records the ledger
 * @param {{agent: string, file: string, hash: string, brief?: string|null}} read the agent, the
 *   repo-relative file, the sha256 of its content, and the brief path when the brief rule applies
 * @returns {{deny: 'brief'|'reread'|null, record: boolean, first?: object}} `deny` the gate reason
 *   of a deny, null for a pass; `record` whether the pass brings content to record as a `read`;
 *   `first` for `reread` the `read` record of the unchanged content
 */
export function readVerdict(records, { agent, file, hash, brief = null }) {
  const live = liveRecords(records, agent).filter((r) => r.file === file);
  const denied = (reason, h) =>
    live.some(
      (r) => r.event === 'deny' && r.reason === reason && (h === undefined || r.hash === h)
    );
  if (brief && !denied('brief')) return { deny: 'brief', record: false };
  const last = live.filter((r) => r.event === 'read').at(-1);
  if (last?.hash !== hash) return { deny: null, record: true };
  if (!denied('reread', hash)) return { deny: 'reread', record: false, first: last };
  return { deny: null, record: false };
}
