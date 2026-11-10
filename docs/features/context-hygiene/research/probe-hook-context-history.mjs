// Scratch probe for the context-hygiene plan (architect, 2026-11-09): which hook events have
// already delivered `additionalContext` into a transcript of this project, split by main thread
// and subagent, with the Claude Code versions. Reads `attachment` records of type
// `hook_additional_context` only; prints event names, hook names, counts and sizes, never content.
// Usage: node docs/features/context-hygiene/research/probe-hook-context-history.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);
const cwd = process.cwd();
const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const files = [];
for (const name of fs.readdirSync(dir)) {
  if (name.endsWith('.jsonl')) files.push({ file: path.join(dir, name), scope: 'main' });
  const sub = path.join(dir, name, 'subagents');
  if (fs.existsSync(sub))
    for (const a of fs.readdirSync(sub))
      if (a.endsWith('.jsonl')) files.push({ file: path.join(sub, a), scope: 'subagent' });
}
const rows = new Map();
for (const { file, scope } of files) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('"hook_additional_context"')) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    const a = r.attachment;
    if (r.type !== 'attachment' || a?.type !== 'hook_additional_context') continue;
    const c = Array.isArray(a.content) ? a.content.join('\n') : String(a.content || '');
    const key = `${scope} | ${a.hookEvent} | ${a.hookName}`;
    const e = rows.get(key) || { n: 0, max: 0, versions: new Set() };
    e.n++;
    e.max = Math.max(e.max, c.length);
    if (r.version) e.versions.add(r.version);
    rows.set(key, e);
  }
}
print(`${files.length} transcript files under ${dir.replace(os.homedir(), '~')}`);
for (const [key, e] of [...rows].sort())
  print(
    `  ${String(e.n).padStart(4)}x  max ${String(e.max).padStart(6)} ch  ${key}  (Claude Code ${[...e.versions].sort().join(', ')})`
  );
