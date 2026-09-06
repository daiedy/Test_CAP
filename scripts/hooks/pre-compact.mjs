/**
 * PreCompact hook: records a session checkpoint line in docs/STATE.md so context survives compaction.
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, changedFiles, currentBranch } from '../lib/hook-utils.mjs';

try {
  const input = readStdinJson();
  const root = repoRoot();
  const state = path.join(root, 'docs', 'STATE.md');
  const heading = '## Сессии';
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const changed = changedFiles(root).length;
  const branch = currentBranch(root) || 'unknown';
  const line = `- ${stamp} UTC: ветка ${branch}, изменённых файлов ${changed}, компакция ${input.trigger || 'auto'}`;

  fs.mkdirSync(path.dirname(state), { recursive: true });
  let text = fs.existsSync(state) ? fs.readFileSync(state, 'utf8') : '# Состояние проекта\n';
  if (!text.includes(heading)) {
    text = text.trimEnd() + `\n\n${heading}\n`;
  }
  text = text.trimEnd() + '\n' + line + '\n';
  fs.writeFileSync(state, text);
} catch {
  // never block compaction
}
process.exit(0);
