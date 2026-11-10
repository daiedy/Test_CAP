// Scratch measurement for the context-hygiene plan (architect, 2026-11-09): what a subagent's
// context consists of, by block kind, in characters; the token figures come from `message.usage`.
// Prints kinds, counts and sizes only, never content.
// Usage: node docs/features/context-hygiene/research/measure-context-composition.mjs <session-id> [agent-id...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);

const [session, ...only] = process.argv.slice(2);
const cwd = process.cwd();
const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const sub = path.join(dir, session, 'subagents');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const len = (v) => (typeof v === 'string' ? v.length : v == null ? 0 : JSON.stringify(v).length);
const textOf = (c) =>
  typeof c === 'string'
    ? c.length
    : Array.isArray(c)
      ? c.reduce((n, b) => n + (b.type === 'text' ? (b.text || '').length : 0), 0)
      : 0;

const grand = {};
for (const name of fs
  .readdirSync(sub)
  .filter((n) => /^agent-.+\.jsonl$/.test(n))
  .sort()) {
  const id = name.slice(6, -6);
  if (only.length && !only.includes(id)) continue;
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(sub, `agent-${id}.meta.json`), 'utf8'));
  } catch {
    // no meta
  }
  const sizes = {};
  const add = (kind, n) => {
    sizes[kind] = sizes[kind] || { n: 0, chars: 0 };
    sizes[kind].n++;
    sizes[kind].chars += n;
    grand[kind] = grand[kind] || { n: 0, chars: 0 };
    grand[kind].n++;
    grand[kind].chars += n;
  };
  const seen = new Set();
  const reqs = new Map();
  let out = 0;
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
    if (r.type === 'assistant') {
      const u = r.message?.usage;
      if (u && r.requestId) {
        const ctx =
          (u.input_tokens || 0) +
          (u.cache_read_input_tokens || 0) +
          (u.cache_creation_input_tokens || 0);
        const q = reqs.get(r.requestId) || { ts: Date.parse(r.timestamp), ctx: 0, out: 0 };
        q.ctx = Math.max(q.ctx, ctx);
        q.out = Math.max(q.out, u.output_tokens || 0);
        reqs.set(r.requestId, q);
      }
      for (const b of Array.isArray(content) ? content : []) {
        if (b.type === 'thinking') add('assistant thinking', len(b.thinking) + len(b.signature));
        else if (b.type === 'text') add('assistant text', len(b.text));
        else if (b.type === 'tool_use')
          add(
            `tool input ${['Write', 'Edit', 'Bash', 'Read'].includes(b.name) ? b.name : 'other'}`,
            len(b.input)
          );
      }
    } else if (r.type === 'user') {
      if (typeof content === 'string') add('user message', content.length);
      for (const b of Array.isArray(content) ? content : []) {
        if (b.type === 'tool_result') add('tool result', textOf(b.content));
        else if (b.type === 'text') add('user message', len(b.text));
      }
    } else if (r.type === 'attachment') {
      const a = r.attachment || {};
      add(
        `attachment ${a.type}${r.rendered ? ' (rendered)' : ''}`,
        r.rendered ? len(r.rendered) : len(a.content)
      );
    }
  }
  const q = [...reqs.values()].sort((a, b) => a.ts - b.ts);
  for (const x of q) out += x.out;
  const peak = Math.max(0, ...q.map((x) => x.ctx));
  print(
    `\n${meta.agentType || '?'} ${id}: startup ${k(q[0]?.ctx || 0)} tok, peak ${k(peak)} tok, last ${k(q.at(-1)?.ctx || 0)} tok, output ${k(out)} tok over ${q.length} requests`
  );
  for (const [kind, v] of Object.entries(sizes).sort((a, b) => b[1].chars - a[1].chars))
    print(`  ${k(v.chars).padStart(8)} ch  ${String(v.n).padStart(4)}x  ${kind}`);
}
print('\n== all selected agents');
const all = Object.values(grand).reduce((n, v) => n + v.chars, 0);
for (const [kind, v] of Object.entries(grand).sort((a, b) => b[1].chars - a[1].chars))
  print(
    `  ${k(v.chars).padStart(8)} ch  ${String(Math.round((v.chars / all) * 100)).padStart(3)}%  ${String(v.n).padStart(5)}x  ${kind}`
  );
