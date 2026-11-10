// Scratch measurement for the context-hygiene plan (architect, 2026-11-09): how often the same
// file reaches the same agent, by any route: the Read tool, or a Bash command that prints a file
// (cat, sed, head, tail, awk, nl, less). Prints paths, routes and sizes only, never content.
// Usage: node docs/features/context-hygiene/research/measure-file-deliveries.mjs <session-id> [agent-id]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);

const [session, only] = process.argv.slice(2);
const cwd = process.cwd();
const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const sub = path.join(dir, session, 'subagents');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const rel = (p) => (p && p.startsWith(cwd + path.sep) ? p.slice(cwd.length + 1) : p);
const PRINTERS = /^(cat|sed|head|tail|awk|nl|less)$/;

function resultChars(c) {
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c))
    return c.reduce((n, b) => n + (b.type === 'text' ? (b.text || '').length : 0), 0);
  return 0;
}
/** Repo files a Bash command prints: path-like tokens of its cat/sed/head/tail/awk segments. */
function printedFiles(cmd) {
  const out = [];
  for (const seg of String(cmd || '').split(/&&|\|\||;|\n|\|/)) {
    const w = seg.trim().split(/\s+/);
    if (!PRINTERS.test(w[0])) continue;
    const whole = w[0] === 'cat';
    for (const tok of w.slice(1)) {
      const t = tok.replace(/^['"]|['"]$/g, '');
      if (!/[./]/.test(t) || t.startsWith('-')) continue;
      const abs = path.isAbsolute(t) ? t : path.join(cwd, t);
      try {
        if (fs.statSync(abs).isFile()) out.push({ file: rel(abs), whole });
      } catch {
        // not a file today
      }
    }
  }
  return out;
}

const totals = { files: 0, repeats: 0, repeatChars: 0, byRoute: {} };
for (const name of fs
  .readdirSync(sub)
  .filter((n) => /^agent-.+\.jsonl$/.test(n))
  .sort()) {
  const id = name.slice(6, -6);
  if (only && id !== only) continue;
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(sub, `agent-${id}.meta.json`), 'utf8'));
  } catch {
    // no meta
  }
  const uses = new Map();
  const seen = new Set();
  const events = [];
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
        const i = b.input || {};
        if (b.name === 'Read')
          uses.set(b.id, {
            route: 'Read',
            files: [
              { file: rel(i.file_path), whole: i.offset === undefined && i.limit === undefined },
            ],
          });
        else if (b.name === 'Bash')
          uses.set(b.id, { route: 'Bash', files: printedFiles(i.command) });
        else if (['Edit', 'Write', 'MultiEdit'].includes(b.name))
          events.push({ write: rel(i.file_path) });
      } else if (r.type === 'user' && b.type === 'tool_result') {
        const u = uses.get(b.tool_use_id);
        if (!u || !u.files.length) continue;
        const chars = resultChars(b.content);
        // A Bash result is shared by the files it prints; attribute it evenly (an estimate).
        for (const f of u.files)
          events.push({ ...f, route: u.route, chars: Math.round(chars / u.files.length) });
      }
    }
  }
  const byFile = new Map();
  for (const e of events) {
    if (e.write) {
      const f = byFile.get(e.write);
      if (f) f.editedSince = true;
      continue;
    }
    const f = byFile.get(e.file) || { deliveries: [], editedSince: false };
    f.deliveries.push({ route: e.route, whole: e.whole, chars: e.chars, afterEdit: f.editedSince });
    f.editedSince = false;
    byFile.set(e.file, f);
  }
  const repeated = [...byFile].filter(([, f]) => f.deliveries.length > 1);
  let repeatChars = 0;
  let unchangedChars = 0;
  for (const [, f] of repeated)
    for (const d of f.deliveries.slice(1)) {
      repeatChars += d.chars;
      if (!d.afterEdit) unchangedChars += d.chars;
      totals.byRoute[d.route] = (totals.byRoute[d.route] || 0) + d.chars;
    }
  totals.files += byFile.size;
  totals.repeats += repeated.length;
  totals.repeatChars += repeatChars;
  totals.unchangedChars = (totals.unchangedChars || 0) + unchangedChars;
  print(
    `${meta.agentType || '?'} ${id}: ${byFile.size} files delivered, ${repeated.length} more than once; repeat deliveries ${k(repeatChars)} ch, of them with no own Edit/Write in between ${k(unchangedChars)} ch`
  );
  if (only || process.argv.includes('--detail'))
    for (const [file, f] of repeated.sort(
      (a, b) => b[1].deliveries.length - a[1].deliveries.length
    ))
      print(
        `    ${file}: ` +
          f.deliveries
            .map(
              (d) =>
                `${d.route}${d.whole ? '' : ' part'} ${k(d.chars)}${d.afterEdit ? ' (after own edit)' : ''}`
            )
            .join(' | ')
      );
}
print(
  `\ntotal: ${totals.files} file deliveries by path, ${totals.repeats} files delivered more than once to the same agent; repeat deliveries ${k(totals.repeatChars)} ch (${JSON.stringify(totals.byRoute)}), with no own Edit/Write in between ${k(totals.unchangedChars || 0)} ch`
);
