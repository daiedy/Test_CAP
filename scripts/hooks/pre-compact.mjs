/**
 * PreCompact hook: records a session checkpoint (time, branch, changed files, trigger) in
 * .pipeline/sessions.log, gitignored session state. It used to append to docs/STATE.md, which every
 * agent reads; the dashboard shape of STATE.md (ADR-0018) has no place for it.
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, changedFiles, currentBranch } from '../lib/hook-utils.mjs';

try {
  const input = readStdinJson();
  const root = repoRoot();
  const file = path.join(root, '.pipeline', 'sessions.log');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const line = `${stamp} UTC session ${input.session_id || 'unknown'}: branch ${currentBranch(root) || 'unknown'}, changed files ${changedFiles(root).length}, compaction ${input.trigger || 'auto'}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line);
} catch {
  // never block compaction
}
process.exit(0);
