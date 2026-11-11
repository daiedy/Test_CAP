/**
 * PreCompact hook: records a session checkpoint (time, branch, changed files, trigger) in
 * .pipeline/sessions.log, gitignored session state. It used to append to docs/STATE.md, which every
 * agent reads; the dashboard shape of STATE.md (ADR-0018) has no place for it.
 * Metrics (ADR-0022): also appends `{ event: 'compact', trigger }` to the event log; the user's
 * `/compact` instructions are never read.
 * Read gate (ADR-0031 decision 3): appends `{ event: 'reset', agent }` to the read ledger, so the
 * compacted thread's next whole read of a file it read before passes (`agent` is 'main' unless the
 * input names an agent id).
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, changedFiles, currentBranch } from '../lib/hook-utils.mjs';
import { appendMetric, metricsAgent } from '../lib/metrics-log.mjs';
import { appendLedger } from '../lib/read-ledger.mjs';

try {
  const input = readStdinJson();
  const root = repoRoot();
  try {
    appendMetric(root, input.session_id, { event: 'compact', trigger: input.trigger });
  } catch {
    // metrics are best effort
  }
  try {
    appendLedger(root, input.session_id, { event: 'reset', agent: metricsAgent(input) });
  } catch {
    // an unwritten reset costs one denied read, which the retry passes
  }
  const file = path.join(root, '.pipeline', 'sessions.log');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const line = `${stamp} UTC session ${input.session_id || 'unknown'}: branch ${currentBranch(root) || 'unknown'}, changed files ${changedFiles(root).length}, compaction ${input.trigger || 'auto'}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line);
} catch {
  // never block compaction
}
process.exit(0);
