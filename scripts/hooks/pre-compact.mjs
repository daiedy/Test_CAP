/**
 * PreCompact hook: records a session checkpoint line in docs/STATE.md so context survives compaction.
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, changedFiles, currentBranch } from '../lib/hook-utils.mjs';

// Section of docs/STATE.md that collects the checkpoints. The second entry is the
// legacy Russian heading (escaped) still present in existing STATE.md files.
const HEADINGS = ['## Sessions', '## \u0421\u0435\u0441\u0441\u0438\u0438'];

try {
  const input = readStdinJson();
  const root = repoRoot();
  const state = path.join(root, 'docs', 'STATE.md');
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const changed = changedFiles(root).length;
  const branch = currentBranch(root) || 'unknown';
  const line = `- ${stamp} UTC: branch ${branch}, changed files ${changed}, compaction ${input.trigger || 'auto'}`;

  fs.mkdirSync(path.dirname(state), { recursive: true });
  let text = fs.existsSync(state) ? fs.readFileSync(state, 'utf8') : '# Project state\n';
  if (!HEADINGS.some((h) => text.includes(h))) {
    text = text.trimEnd() + `\n\n${HEADINGS[0]}\n`;
  }
  text = text.trimEnd() + '\n' + line + '\n';
  fs.writeFileSync(state, text);
} catch {
  // never block compaction
}
process.exit(0);
