// Scratch measurement for the context-hygiene plan (architect, 2026-11-09): which files fill the
// agents' contexts, summed over the subagent transcripts of one session. Routes: the Read tool and
// Bash commands that print a file (cat, sed, head, tail, awk, nl); a Bash result naming several
// files is split evenly (an estimate). Prints paths, counts and sizes only, never content.
// Usage: node docs/features/context-hygiene/research/measure-top-files.mjs <session-id> [N]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);

const [session, nArg] = process.argv.slice(2);
const N = Number(nArg) || 30;
const cwd = process.cwd();
const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const sub = path.join(dir, session, 'subagents');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const rel = (p) => (p && p.startsWith(cwd + path.sep) ? p.slice(cwd.length + 1) : p);
const PRINTERS = /^(cat|sed|head|tail|awk|nl|less)$/;
const chars = (c) =>
  typeof c === 'string'
    ? c.length
    : Array.isArray(c)
      ? c.reduce((n, b) => n + (b.type === 'text' ? (b.text || '').length : 0), 0)
      : 0;

function printedFiles(cmd) {
  const out = [];
  for (const seg of String(cmd || '').split(/&&|\|\||;|\n|\|/)) {
    const w = seg.trim().split(/\s+/);
    if (!PRINTERS.test(w[0])) continue;
    for (const tok of w.slice(1)) {
      const t = tok.replace(/^['"]|['"]$/g, '');
      if (!/[./]/.test(t) || t.startsWith('-')) continue;
      const abs = path.isAbsolute(t) ? t : path.join(cwd, t);
      try {
        if (fs.statSync(abs).isFile()) out.push(rel(abs));
      } catch {
        // not a file today (pruned feature folder, temp file)
      }
    }
  }
  return out;
}

const byFile = new Map();
let attributed = 0;
let total = 0;
let agents = 0;
for (const name of fs.readdirSync(sub).filter((n) => /^agent-.+\.jsonl$/.test(n))) {
  agents++;
  const uses = new Map();
  const seen = new Set();
  for (const line of fs.readFileSync(path.join(sub, name), 'utf8').split('\n')) {
    if (!line) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r.uuid) {
      if (seen.has(r.uuid)) continue;
      seen.add(r.uuid);
    }
    const content = r.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (r.type === 'assistant' && b.type === 'tool_use') {
        if (b.name === 'Read') uses.set(b.id, [rel(b.input?.file_path)]);
        else if (b.name === 'Bash') uses.set(b.id, printedFiles(b.input?.command));
        else uses.set(b.id, []);
      } else if (r.type === 'user' && b.type === 'tool_result') {
        const n = chars(b.content);
        total += n;
        const files = uses.get(b.tool_use_id) || [];
        if (!files.length) continue;
        attributed += n;
        for (const f of files) {
          const e = byFile.get(f) || { chars: 0, agents: new Set(), n: 0 };
          e.chars += Math.round(n / files.length);
          e.n++;
          e.agents.add(name);
          byFile.set(f, e);
        }
      }
    }
  }
}
print(
  `session ${session}: ${agents} agent files, tool results ${k(total)} ch, attributed to a printed file ${k(attributed)} ch (${Math.round((attributed / total) * 100)}%)`
);
const group = (f) =>
  f.startsWith('docs/features/')
    ? 'docs/features/** (feature documents)'
    : f.startsWith('docs/decisions/')
      ? 'docs/decisions/**'
      : f.startsWith('docs/architecture/')
        ? 'docs/architecture/**'
        : f.startsWith('docs/registry/')
          ? 'docs/registry/**'
          : f.startsWith('docs/wiki/')
            ? 'docs/wiki/**'
            : f.startsWith('docs/')
              ? 'docs/* (STATE, CHANGELOG, LESSONS, metrics, upstream)'
              : f.startsWith('scripts/')
                ? 'scripts/**'
                : f.startsWith('test/')
                  ? 'test/**'
                  : f.startsWith('.claude/')
                    ? '.claude/**'
                    : /^(db|srv|app|_i18n)\//.test(f)
                      ? 'db, srv, app, _i18n'
                      : f.startsWith('/')
                        ? 'outside the repo (temp, tool-results)'
                        : 'other';
const groups = new Map();
for (const [f, e] of byFile) {
  const g = groups.get(group(f)) || { chars: 0, n: 0 };
  g.chars += e.chars;
  g.n += e.n;
  groups.set(group(f), g);
}
print('\nby area:');
for (const [g, e] of [...groups].sort((a, b) => b[1].chars - a[1].chars))
  print(`  ${k(e.chars).padStart(8)} ch  ${String(e.n).padStart(4)} deliveries  ${g}`);
print(`\ntop ${N} files:`);
for (const [f, e] of [...byFile].sort((a, b) => b[1].chars - a[1].chars).slice(0, N))
  print(
    `  ${k(e.chars).padStart(8)} ch  ${String(e.n).padStart(3)} deliveries to ${String(e.agents.size).padStart(2)} agents  ${f}`
  );
