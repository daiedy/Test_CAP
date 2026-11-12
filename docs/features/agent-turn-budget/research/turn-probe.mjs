/**
 * Live probe of agent-turn-budget (#60), PLAN step 1; procedure in research/hook-probe.md.
 * `build <dir> <variant>` writes a throwaway Claude Code project outside the repository;
 * `hook <dir> <variant>` is the hook runtime the temp settings call; `analyze <dir>` prints the
 * facts P1-P7 from the hook logs and the agent transcripts. Prints counts, kinds and probe tokens
 * only, never prompt or tool text. Variants: `deliver`, `limit`, `limit-last`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../../..');
const MAX_TURNS = { deliver: 12, limit: 6, 'limit-last': 6 };
const out = (s) => process.stdout.write(`${s}\n`);

/**
 * Raw JSONL records of a file, [] when it is missing.
 * @param {string} file path
 * @returns {object[]} records
 */
function jsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

/**
 * Requests of the current run of an agent file: distinct `requestId` of `assistant` records after
 * the last `coordinator` delivery.
 * @param {object[]} recs raw records
 * @returns {string[]} request ids in order
 */
function runRequests(recs) {
  let ids = [];
  for (const r of recs) {
    if (r.type === 'user' && r.origin?.kind === 'coordinator') ids = [];
    if (r.type === 'assistant' && r.requestId && !ids.includes(r.requestId)) ids.push(r.requestId);
  }
  return ids;
}

/**
 * The subagent file of a hook input (#44 F3, F7).
 * @param {object} input hook input
 * @returns {string} path
 */
function agentFile(input) {
  const main = String(input.transcript_path || '').replace(/^~(?=\/)/, os.homedir());
  return path.join(main.replace(/\.jsonl$/, ''), 'subagents', `agent-${input.agent_id}.jsonl`);
}

/**
 * The probe context of one hook call, or null for silence.
 * @param {string} variant probe variant
 * @param {object} input hook input
 * @param {number} n requests of the run at hook time
 * @returns {string|null} context
 */
function contextOf(variant, input, n) {
  const ev = input.hook_event_name;
  const m = MAX_TURNS[variant];
  if (variant === 'deliver') {
    if (ev === 'PostToolBatch') return `PROBE-BATCH-N${n}-K${(input.tool_calls || []).length}`;
    const tool = String(input.tool_name || '').startsWith('mcp__') ? 'mcp' : input.tool_name;
    return `PROBE-${ev === 'PostToolUse' ? 'POST' : 'FAIL'}-${tool}-N${n}`;
  }
  if (ev !== 'PostToolBatch') return null;
  if (variant === 'limit' && n >= m - 2)
    return `Turn ${n} of ${m}: start no new item, hand back your report through SubagentHandback now.`;
  if (variant === 'limit-last' && n === m - 1)
    return `Turn ${n} of ${m}: your next turn is your last; call SubagentHandback in it.`;
  return null;
}

function hook(dir, variant) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  const n = input.agent_id ? runRequests(jsonl(agentFile(input))).length : null;
  const ctx = input.agent_id ? contextOf(variant, input, n) : null;
  const log = {
    ts: new Date().toISOString(),
    event: input.hook_event_name,
    agentId: input.agent_id || null,
    agentType: input.agent_type || null,
    tool: input.tool_name || null,
    toolUseId: input.tool_use_id || null,
    batch: (input.tool_calls || []).map((c) => [c.tool_name, c.tool_use_id]),
    keys: Object.keys(input).sort(),
    n,
    ctx,
  };
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  fs.appendFileSync(path.join(dir, 'logs', `${input.hook_event_name}.jsonl`), `${JSON.stringify(log)}\n`);
  if (ctx) {
    const hookSpecificOutput = { hookEventName: input.hook_event_name, additionalContext: ctx };
    process.stdout.write(JSON.stringify({ hookSpecificOutput }));
  }
}

const STEPS = {
  deliver: [
    'Turn 1: Read target.txt.',
    'Turn 2: call mcp__cds-mcp__search_docs with query "SELECT from entity" and maxResults 1.',
    'Turn 3: in ONE message, Read target.txt and Read other.txt (two parallel calls).',
    'Turn 4: run the Bash command `exit 3`.',
    'Turn 5: hand back through SubagentHandback a report that lists every string starting with PROBE- or Turn that you saw in a system reminder, each with the number of the turn after which you saw it.',
  ],
  limit: [
    'Every turn: Read target.txt, exactly one call per turn. Never stop or report on your own.',
    'When a system reminder tells you to hand back, do it exactly as it says, quoting the reminder.',
  ],
};
STEPS['limit-last'] = STEPS.limit;

function build(dir, variant) {
  const abs = path.resolve(dir);
  if (abs === REPO || abs.startsWith(`${REPO}${path.sep}`)) throw new Error('build outside the repository');
  if (!MAX_TURNS[variant]) throw new Error(`variant: ${Object.keys(MAX_TURNS).join(', ')}`);
  const cmd = { type: 'command', command: `node ${abs}/turn-probe.mjs hook ${abs} ${variant}`, timeout: 20 };
  const settings = {
    hooks: {
      PostToolUse: [{ matcher: '.*', hooks: [cmd] }],
      PostToolUseFailure: [{ matcher: '.*', hooks: [cmd] }],
      PostToolBatch: [{ hooks: [cmd] }],
    },
  };
  const agent = [
    '---',
    'name: turn-probe',
    'description: Probe agent of agent-turn-budget; follows its steps literally.',
    'tools: Read, Bash, mcp__cds-mcp__search_docs',
    'model: inherit',
    `maxTurns: ${MAX_TURNS[variant]}`,
    '---',
    'You are a probe. Follow these steps literally and do nothing else.',
    ...STEPS[variant],
    '',
  ].join('\n');
  const files = {
    '.claude/settings.json': JSON.stringify(settings, null, 2),
    '.claude/agents/turn-probe.md': agent,
    '.mcp.json': JSON.stringify({ mcpServers: { 'cds-mcp': { type: 'stdio', command: 'npx', args: ['-y', '@cap-js/mcp-server@0.0.5'] } } }, null, 2),
    'target.txt': 'line 1\nline 2\n',
    'other.txt': 'other 1\n',
    'turn-probe.mjs': fs.readFileSync(import.meta.filename, 'utf8'),
  };
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(abs, f)), { recursive: true });
    fs.writeFileSync(path.join(abs, f), text);
  }
  out(`built ${abs} (${variant}, maxTurns ${MAX_TURNS[variant]})`);
}

function analyze(dir) {
  const logs = Object.fromEntries(
    ['PostToolUse', 'PostToolUseFailure', 'PostToolBatch'].map((e) => [e, jsonl(path.join(dir, 'logs', `${e}.jsonl`))])
  );
  for (const [e, rows] of Object.entries(logs)) {
    out(`${e}: ${rows.length} calls, ${rows.filter((r) => r.agentId).length} in the subagent; keys ${rows.find((r) => r.agentId)?.keys.join(',') || '-'}`);
  }
  const sub = [...logs.PostToolUse, ...logs.PostToolBatch].find((r) => r.agentId);
  if (!sub) return out('no subagent hook call: P1 and P2 fail');
  // Project slug: every non-alphanumeric character of the real cwd becomes `-` (seen in #44's probe dirs).
  const proj = path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(dir).replace(/[^a-zA-Z0-9]/g, '-'));
  const file = fs.readdirSync(proj, { recursive: true }).find((f) => String(f).endsWith(`agent-${sub.agentId}.jsonl`));
  const recs = jsonl(path.join(proj, String(file)));
  const reqs = runRequests(recs);
  const turnOf = new Map();
  for (const r of recs) {
    if (r.type !== 'assistant') continue;
    for (const b of r.message?.content || []) if (b.type === 'tool_use') turnOf.set(b.id, { turn: reqs.indexOf(r.requestId) + 1, name: b.name });
  }
  for (const r of recs.filter((x) => x.attachment?.type === 'hook_additional_context')) {
    const a = r.attachment;
    out(`P1/P2/P3 context ${a.hookEvent} toolUseID ${a.toolUseID || '-'} (${turnOf.get(a.toolUseID)?.name || 'batch'}): ${JSON.stringify(a.content).slice(0, 160)}`);
  }
  for (const [e, rows] of Object.entries(logs)) {
    for (const r of rows.filter((x) => x.agentId)) {
      const ids = r.toolUseId ? [r.toolUseId] : r.batch.map((b) => b[1]);
      const t = turnOf.get(ids[0])?.turn;
      out(`P4 ${e} ${r.tool || `batch of ${r.batch.length}`}: count at hook time ${r.n}, true turn ${t ?? '?'}${r.ctx ? `, said "${r.ctx.slice(0, 60)}"` : ''}`);
    }
  }
  const handbacks = [...turnOf.entries()].filter(([, v]) => v.name === 'SubagentHandback');
  const results = new Map();
  for (const r of recs) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) if (b.type === 'tool_result') results.set(b.tool_use_id, !b.is_error);
  out(`P6/P7 requests in the run ${reqs.length}; SubagentHandback calls ${handbacks.map(([id, v]) => `turn ${v.turn} ${results.get(id) ? 'delivered' : 'not delivered'}`).join('; ') || 'none'}`);
}

const [cmd, dir, variant] = process.argv.slice(2);
if (cmd === 'build') build(dir, variant);
else if (cmd === 'hook') {
  try {
    hook(dir, variant);
  } catch {
    // a probe hook never breaks the tool call
  }
} else if (cmd === 'analyze') analyze(dir);
else out('usage: node turn-probe.mjs build|hook|analyze <dir> [variant]');
