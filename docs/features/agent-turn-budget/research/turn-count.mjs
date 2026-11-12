/**
 * Scratch measurement for agent-turn-budget (#60), PLAN step 0 (architect, 2026-11-13).
 * Usage: node docs/features/agent-turn-budget/research/turn-count.mjs <session dir> [agent id]
 * Prints per subagent file: type, maxTurns, distinct requestIds of `assistant` records (all and
 * per run, a run starting at the launch or at a `coordinator` resume), tool_use blocks, whether a
 * `SubagentHandback` was used, the kinds of the last records. With an agent id it also times the
 * whole-file parse against a tail read. Prints counts and kinds only, never text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { readTranscript, requests } from '../../../../scripts/lib/transcript-usage.mjs';

const dir = process.argv[2];
const only = process.argv[3];
const agentsDir = path.resolve(import.meta.dirname, '../../../../.claude/agents');
const out = (s) => process.stdout.write(`${s}\n`);

function maxTurnsOf(type) {
  try {
    const text = fs.readFileSync(path.join(agentsDir, `${type}.md`), 'utf8');
    return Number(text.match(/^maxTurns:\s*(\d+)/m)?.[1]) || null;
  } catch {
    return null;
  }
}

function raw(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function analyse(file) {
  const recs = raw(file);
  const runs = [new Set()];
  let tools = 0;
  let handback = 0;
  for (const r of recs) {
    if (r.type === 'user' && r.origin?.kind === 'coordinator') runs.push(new Set());
    if (r.type !== 'assistant') continue;
    if (r.requestId) runs.at(-1).add(r.requestId);
    for (const b of Array.isArray(r.message?.content) ? r.message.content : []) {
      if (b.type === 'tool_use') {
        tools++;
        if (b.name === 'SubagentHandback') handback++;
      }
    }
  }
  const all = new Set(runs.flatMap((s) => [...s]));
  const tail = recs
    .slice(-4)
    .map((r) => [r.type, r.subtype, r.attachment?.type, r.message?.stop_reason].filter(Boolean).join('/'))
    .join(' | ');
  return { records: recs.length, requests: all.size, runs: runs.map((s) => s.size), tools, handback, tail };
}

function timeIt(file) {
  const t0 = performance.now();
  const n = requests(readTranscript(file).filter((r) => r.type === 'assistant')).length;
  const t1 = performance.now();
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r');
  const len = Math.min(size, 256 * 1024);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len);
  fs.closeSync(fd);
  const ids = new Set(buf.toString('utf8').match(/"requestId":"[^"]+"/g) || []);
  const t2 = performance.now();
  const t3 = performance.now();
  const whole = new Set(fs.readFileSync(file, 'utf8').match(/"requestId":"[^"]+"/g) || []);
  const t4 = performance.now();
  out(
    `timing ${path.basename(file)} ${size} bytes: parse ${n} requests ${(t1 - t0).toFixed(1)} ms; ` +
      `tail 256K ${ids.size} ids ${(t2 - t1).toFixed(1)} ms; whole-file regex ${whole.size} ids ${(t4 - t3).toFixed(1)} ms`
  );
}

const files = fs.readdirSync(path.join(dir, 'subagents')).filter((f) => f.endsWith('.jsonl'));
for (const f of files) {
  const id = f.slice('agent-'.length, -'.jsonl'.length);
  if (only && id !== only) continue;
  const file = path.join(dir, 'subagents', f);
  let type = '?';
  try {
    type = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType;
  } catch {
    // no meta
  }
  const a = analyse(file);
  out(
    `${id} ${type} max=${maxTurnsOf(type)} size=${fs.statSync(file).size} req=${a.requests} runs=[${a.runs}] ` +
      `tools=${a.tools} handback=${a.handback} tail: ${a.tail}`
  );
  if (only) timeIt(file);
}
