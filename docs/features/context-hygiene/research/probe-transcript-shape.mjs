// Scratch probe for the context-hygiene plan (architect, 2026-11-09): the structural shape of a
// subagent transcript. Prints record kinds, block kinds, key names and counts only, never content.
// Usage: node docs/features/context-hygiene/research/probe-transcript-shape.mjs <agent-file.jsonl>
import fs from 'node:fs';

const print = (s = '') => process.stdout.write(`${s}\n`);

const file = process.argv[2];
const count = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const kinds = new Map();
const blocks = new Map();
const attach = new Map();
const keys = new Map();
const resultShapes = new Map();
const hookKeys = new Map();
for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  let r;
  try {
    r = JSON.parse(line);
  } catch {
    continue;
  }
  count(kinds, r.type);
  for (const k of Object.keys(r)) count(keys, `${r.type}.${k}`);
  const content = r.message?.content;
  if (Array.isArray(content))
    for (const b of content) {
      count(blocks, `${r.type}:${b.type}`);
      if (b.type === 'tool_result') {
        const c = b.content;
        const shape =
          typeof c === 'string'
            ? 'string'
            : Array.isArray(c)
              ? 'array:' + c.map((x) => x.type).join('+')
              : typeof c;
        count(resultShapes, shape);
        for (const k of Object.keys(b)) count(keys, `tool_result.${k}`);
      }
      if (b.type === 'tool_use') for (const k of Object.keys(b)) count(keys, `tool_use.${k}`);
    }
  else if (typeof content === 'string') count(blocks, `${r.type}:string`);
  if (r.type === 'attachment') {
    count(attach, r.attachment?.type);
    if (/hook/i.test(r.attachment?.type || ''))
      for (const k of Object.keys(r.attachment))
        count(
          hookKeys,
          `${r.attachment.type}.${k}=${typeof r.attachment[k] === 'string' && k !== 'content' && k !== 'stdout' && k !== 'stderr' ? r.attachment[k].slice(0, 40) : typeof r.attachment[k]}`
        );
  }
  if (r.toolUseResult !== undefined && typeof r.toolUseResult === 'object' && r.toolUseResult)
    for (const k of Object.keys(r.toolUseResult)) count(keys, `toolUseResult.${k}`);
}
const show = (title, m) => {
  print(`\n${title}`);
  for (const [k, v] of [...m].sort()) print(`  ${String(v).padStart(5)}  ${k}`);
};
show('record kinds', kinds);
show('content blocks', blocks);
show('tool_result content shapes', resultShapes);
show('attachment types', attach);
show('hook attachment keys', hookKeys);
show('keys', keys);
