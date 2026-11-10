// Scratch measurement for the context-hygiene plan (architect, 2026-11-09): what fills a pipeline
// agent's context. Reads the subagent transcripts of one session and prints aggregates only:
// sizes, tool names, the leading program of a Bash command and repo-relative file paths. No prompt,
// thinking, tool output or file content is printed or stored.
// Usage: node docs/features/context-hygiene/research/measure-transcripts.mjs <session-id> [--top N]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);

const session = process.argv[2];
const top = Number(process.argv[process.argv.indexOf('--top') + 1]) || 6;
const cwd = process.cwd();
const dir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const sub = path.join(dir, session, 'subagents');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const rel = (p) => (p && p.startsWith(cwd + path.sep) ? p.slice(cwd.length + 1) : p);

function resultChars(c) {
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c))
    return c.reduce(
      (n, b) => n + (b.type === 'text' && typeof b.text === 'string' ? b.text.length : 0),
      0
    );
  return 0;
}
/** The leading program of a Bash command: after `cd ...;`, env assignments and `export`. */
function programOf(cmd) {
  const parts = String(cmd || '')
    .split(/&&|;|\n/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(cd|export|mkdir|echo|printf)\b/.test(s) && !/^[A-Z_]+=\S*$/.test(s));
  const first = (parts[0] || String(cmd || '').trim()).replace(/^(?:[A-Z_]+=\S+\s+)+/, '');
  const w = first.split(/\s+/);
  if (['npm', 'npx', 'git', 'node', 'gh'].includes(w[0])) {
    if (w[0] === 'npm' && w[1] === 'run') return `npm run ${w[2] || ''}`;
    if (w[0] === 'node')
      return `node ${rel(w[1] || '')
        .split('/')
        .slice(-2)
        .join('/')}`;
    return `${w[0]} ${w[1] || ''}`;
  }
  return w[0] || '?';
}

const files = fs
  .readdirSync(sub)
  .filter((n) => /^agent-.+\.jsonl$/.test(n))
  .sort();
const totals = {
  byTool: {},
  bash: {},
  dupReads: 0,
  dupChars: 0,
  dupUnchanged: 0,
  dupUnchangedChars: 0,
  stubs: 0,
};
const add = (o, key, chars) => {
  o[key] = o[key] || { n: 0, chars: 0 };
  o[key].n++;
  o[key].chars += chars;
};
const rows = [];
for (const name of files) {
  const id = name.slice('agent-'.length, -'.jsonl'.length);
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(sub, `agent-${id}.meta.json`), 'utf8'));
  } catch {
    // no meta
  }
  const uses = new Map(); // tool_use id -> { name, file, partial, program }
  const seen = new Set();
  const reqs = new Map(); // requestId -> { ts, ctx }
  const byTool = {};
  const bash = {};
  const results = [];
  const order = []; // sequence of { kind: 'read'|'write', file, chars, type }
  let firstPrompt = 0;
  let hookCtx = 0;
  let hookCtxChars = 0;
  const hookEvents = {};
  let version = '';
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
    if (r.version) version = r.version;
    const content = r.message?.content;
    if (r.type === 'assistant') {
      const u = r.message?.usage;
      if (u && r.requestId) {
        const ctx =
          (u.input_tokens || 0) +
          (u.cache_read_input_tokens || 0) +
          (u.cache_creation_input_tokens || 0);
        const q = reqs.get(r.requestId) || { ts: Date.parse(r.timestamp), ctx: 0 };
        q.ctx = Math.max(q.ctx, ctx);
        reqs.set(r.requestId, q);
      }
      for (const b of Array.isArray(content) ? content : []) {
        if (b.type !== 'tool_use') continue;
        const i = b.input || {};
        uses.set(b.id, {
          name: b.name,
          file: rel(i.file_path),
          partial: i.offset !== undefined || i.limit !== undefined,
          program: b.name === 'Bash' ? programOf(i.command) : undefined,
        });
        if (['Edit', 'Write', 'MultiEdit'].includes(b.name))
          order.push({ kind: 'write', file: rel(i.file_path) });
      }
    } else if (r.type === 'user') {
      if (
        !firstPrompt &&
        (typeof content === 'string' ||
          (Array.isArray(content) && content.some((b) => b.type === 'text')))
      )
        firstPrompt = typeof content === 'string' ? content.length : resultChars(content);
      for (const b of Array.isArray(content) ? content : []) {
        if (b.type !== 'tool_result') continue;
        const use = uses.get(b.tool_use_id) || { name: '?' };
        const chars = resultChars(b.content);
        add(byTool, use.name, chars);
        add(totals.byTool, use.name, chars);
        if (use.name === 'Bash') {
          add(bash, use.program, chars);
          add(totals.bash, use.program, chars);
        }
        results.push({
          chars,
          label:
            use.name === 'Bash' ? `Bash ${use.program}` : `${use.name} ${use.file || ''}`.trim(),
        });
        if (use.name === 'Read')
          order.push({
            kind: 'read',
            file: use.file,
            partial: use.partial,
            chars,
            type: r.toolUseResult?.type,
            hidden: !!r.toolUseResult?.contentNotInModelContext,
          });
      }
    } else if (r.type === 'attachment' && r.attachment?.type === 'hook_additional_context') {
      hookCtx++;
      const c = r.attachment.content;
      hookCtxChars += Array.isArray(c) ? c.join('\n').length : String(c || '').length;
      hookEvents[r.attachment.hookEvent] = (hookEvents[r.attachment.hookEvent] || 0) + 1;
    }
  }
  // Repeated reads: a whole-file Read of a path this agent already read whole, with no Edit/Write
  // of that path by the same agent in between (Bash writes and other agents are not visible here).
  const lastWhole = new Map();
  let dup = 0;
  let dupChars = 0;
  let dupUnchanged = 0;
  let dupUnchangedChars = 0;
  let stubs = 0;
  const types = {};
  for (const e of order) {
    if (e.kind === 'write') {
      const prev = lastWhole.get(e.file);
      if (prev) prev.edited = true;
      continue;
    }
    types[e.type || '?'] = (types[e.type || '?'] || 0) + 1;
    if (e.hidden) stubs++;
    if (e.partial) continue;
    const prev = lastWhole.get(e.file);
    if (prev) {
      dup++;
      dupChars += e.chars;
      if (!prev.edited) {
        dupUnchanged++;
        dupUnchangedChars += e.chars;
      }
    }
    lastWhole.set(e.file, { edited: false });
  }
  totals.dupReads += dup;
  totals.dupChars += dupChars;
  totals.dupUnchanged += dupUnchanged;
  totals.dupUnchangedChars += dupUnchangedChars;
  totals.stubs += stubs;
  const q = [...reqs.values()].sort((a, b) => a.ts - b.ts);
  const all = Object.values(byTool).reduce((n, v) => n + v.chars, 0);
  rows.push({ type: meta.agentType || '?', id, all });
  print(
    `\n${meta.agentType || '?'} ${id} (Claude Code ${version}): startup ${k(q[0]?.ctx || 0)} tok, peak ${k(Math.max(0, ...q.map((x) => x.ctx)))} tok, requests ${q.length}; ` +
      `delegation message ${k(firstPrompt)} ch; tool results ${k(all)} ch; hook additionalContext ${hookCtx} (${k(hookCtxChars)} ch, ${JSON.stringify(hookEvents)})`
  );
  print(
    '  by tool: ' +
      Object.entries(byTool)
        .sort((a, b) => b[1].chars - a[1].chars)
        .map(([t, v]) => `${t} ${v.n}x ${k(v.chars)}`)
        .join(', ')
  );
  print(
    '  Bash by program: ' +
      Object.entries(bash)
        .sort((a, b) => b[1].chars - a[1].chars)
        .slice(0, 8)
        .map(([t, v]) => `${t} ${v.n}x ${k(v.chars)}`)
        .join(', ')
  );
  print(
    `  Read result types ${JSON.stringify(types)}, contentNotInModelContext ${stubs}; repeated whole reads ${dup} (${k(dupChars)} ch), of them without an own Edit/Write in between ${dupUnchanged} (${k(dupUnchangedChars)} ch)`
  );
  print(
    '  largest: ' +
      results
        .sort((a, b) => b.chars - a.chars)
        .slice(0, top)
        .map((x) => `${x.label} ${k(x.chars)}`)
        .join('; ')
  );
}
print('\n== session totals over ' + files.length + ' agent files');
print(
  '  by tool: ' +
    Object.entries(totals.byTool)
      .sort((a, b) => b[1].chars - a[1].chars)
      .map(([t, v]) => `${t} ${v.n}x ${k(v.chars)}`)
      .join(', ')
);
print(
  '  Bash by program: ' +
    Object.entries(totals.bash)
      .sort((a, b) => b[1].chars - a[1].chars)
      .slice(0, 25)
      .map(([t, v]) => `${t} ${v.n}x ${k(v.chars)} (max avg ${k(Math.round(v.chars / v.n))})`)
      .join(', ')
);
print(
  `  repeated whole reads ${totals.dupReads} (${k(totals.dupChars)} ch); without an own Edit/Write in between ${totals.dupUnchanged} (${k(totals.dupUnchangedChars)} ch); Read results flagged contentNotInModelContext ${totals.stubs}`
);
