/**
 * The only reader of Claude Code transcripts (ADR-0022 decision 2; definitions D1, D2, D5 in
 * docs/features/pipeline-metrics/research/definitions.md). The transcript format is internal to
 * Claude Code: every field read here is listed in `slim()`, and nothing else survives the parse of
 * a line, so no text, thinking, prompt or tool output is held in memory or passed on. No pricing,
 * no phases, no writes: aggregation lives in pipeline-metrics.mjs. Node built-ins only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJsonl } from './hook-utils.mjs';

export { readJsonl };

export const SYNTHETIC_MODEL = '<synthetic>';
/** Token kinds priced separately (D2); `thinking` is a detail of `output`, never priced. */
export const TOKEN_KINDS = ['input', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead', 'output'];
const USAGE_FIELDS = [...TOKEN_KINDS, 'cacheWrite', 'thinking'];
/** Tool uses whose wait is a turn gap, not a tool gap (D5). */
export const TURN_GAP_TOOLS = new Set(['AskUserQuestion', 'Agent', 'SendMessage']);

// ---------- files ----------

/** `~/.claude`, or `CLAUDE_CONFIG_DIR` when set. */
export function claudeHome(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

/**
 * Transcript directory of a working directory: `<home>/projects/<slug>`, slug = the cwd with every
 * character outside [A-Za-z0-9] replaced by `-` (measured: `/Users/a_b/Test_CAP` gives
 * `-Users-a-b-Test-CAP`).
 */
export function projectDir(cwd, home = claudeHome()) {
  return path.join(home, 'projects', String(cwd).replace(/[^A-Za-z0-9]/g, '-'));
}

/** Session ids with a main transcript in `dir`, newest first. */
export function listSessions(dir) {
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'));
  } catch {
    return [];
  }
  return names
    .map((n) => ({
      id: n.slice(0, -'.jsonl'.length),
      mtime: fs.statSync(path.join(dir, n)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((s) => s.id);
}

/**
 * The files of one session: the main transcript and every `subagents/agent-<id>.jsonl` with the
 * `agentType` and `toolUseId` of its `.meta.json` (the meta `description` is not read).
 * @returns {{sessionId:string, main:string|null, agents:{id:string, file:string, agentType:string, toolUseId:string|null}[]}}
 */
export function sessionFiles(dir, sessionId) {
  const main = path.join(dir, `${sessionId}.jsonl`);
  const subDir = path.join(dir, sessionId, 'subagents');
  const agents = [];
  let names = [];
  try {
    names = fs.readdirSync(subDir);
  } catch {
    // no subagents
  }
  for (const name of names) {
    const m = name.match(/^agent-(.+)\.jsonl$/);
    if (!m) continue;
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(subDir, `agent-${m[1]}.meta.json`), 'utf8'));
    } catch {
      // meta missing: type unknown
    }
    agents.push({
      id: m[1],
      file: path.join(subDir, name),
      agentType: meta.agentType || 'unknown',
      toolUseId: meta.toolUseId || null,
    });
  }
  return { sessionId, main: fs.existsSync(main) ? main : null, agents };
}

// ---------- records ----------

function usageOf(u) {
  if (!u || typeof u !== 'object') return null;
  return {
    input: u.input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    cacheWrite5m: u.cache_creation?.ephemeral_5m_input_tokens || 0,
    cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    output: u.output_tokens || 0,
    thinking: u.output_tokens_details?.thinking_tokens || 0,
  };
}

function toolOf(c) {
  const t = { name: c.name };
  if (c.name === 'Agent') {
    t.id = c.id;
    t.subagentType = c.input?.subagent_type;
  }
  if (c.name === 'SendMessage' && typeof c.input?.to === 'string') t.to = c.input.to;
  return t;
}

const COST_STATE_FIELDS = [
  'startTime',
  'totalCostUSD',
  'totalAPIDuration',
  'totalToolDuration',
  'totalDuration',
  'totalLinesAdded',
  'totalLinesRemoved',
  'hasUnknownModelCost',
];
const MODEL_USAGE_FIELDS = [
  'inputTokens',
  'outputTokens',
  'thinkingTokens',
  'cacheReadInputTokens',
  'cacheCreationInputTokens',
  'costUSD',
];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj?.[f] !== undefined) out[f] = obj[f];
  return out;
}

/**
 * One raw transcript record reduced to the fields the metrics use (definitions section 1).
 * `lastTool` is the name of the last content block when that block is a `tool_use`; `prompt` marks
 * a user record that is neither a tool result nor structured content (the prototype's rule).
 */
export function slim(r) {
  const out = { type: r.type, ts: r.timestamp ? Date.parse(r.timestamp) : null };
  if (r.uuid) out.uuid = r.uuid;
  if (r.requestId) out.requestId = r.requestId;
  if (r.agentId) out.agentId = r.agentId;
  if (r.gitBranch) out.gitBranch = r.gitBranch;
  if (r.version) out.version = r.version;
  const m = r.message || {};
  const blocks = Array.isArray(m.content) ? m.content : [];
  if (r.type === 'assistant') {
    out.model = m.model || null;
    out.usage = usageOf(m.usage);
    out.tools = blocks.filter((c) => c?.type === 'tool_use').map(toolOf);
    const last = blocks.at(-1);
    out.lastTool = last?.type === 'tool_use' ? last.name : null;
  } else if (r.type === 'user') {
    out.toolResult = r.toolUseResult !== undefined;
    out.prompt = !out.toolResult && typeof m.content === 'string';
  } else if (r.type === 'system') {
    out.subtype = r.subtype || null;
    // History fallback of the gate metric: a Stop hook that blocked (count only, errors unread).
    if (r.subtype === 'stop_hook_summary')
      out.stopHookBlocked = Array.isArray(r.hookErrors) && r.hookErrors.length > 0;
  } else if (r.type === 'cost-state') {
    out.costState = pick(r, COST_STATE_FIELDS);
    out.costState.modelUsage = {};
    for (const [model, u] of Object.entries(r.modelUsage || {}))
      out.costState.modelUsage[model] = pick(u, MODEL_USAGE_FIELDS);
  }
  return out;
}

/** A transcript file as slim records; [] when the file is missing. */
export function readTranscript(file) {
  return file ? readJsonl(file, slim) : [];
}

/**
 * A whole session: main records and every agent's records, all slim.
 * @returns {{sessionId, main:object[], agents:{id, agentType, toolUseId, file, records:object[]}[]}|null}
 */
export function loadSession(dir, sessionId) {
  const files = sessionFiles(dir, sessionId);
  if (!files.main && !files.agents.length) return null;
  return {
    sessionId,
    mainFile: files.main,
    main: readTranscript(files.main),
    agents: files.agents.map((a) => ({ ...a, records: readTranscript(a.file) })),
  };
}

// ---------- D1, D2 ----------

/**
 * D1: one request per `requestId`; its usage is the per-field maximum across its records (the
 * stream writes one record per content block and, in subagent files, a growing usage snapshot).
 * Given the records of every file of a scope, a request id seen in several files counts once, and
 * a record whose `uuid` was already read (a copy) is skipped. A record without `requestId` is a
 * request of its own (`anonymous: true`, never merged). When the 5m/1h split is missing or short of
 * `cache_creation_input_tokens`, the remainder counts as a 5-minute write.
 * @returns {{requestId:string, anonymous?:boolean, model:string|null, ts:number|null, usage:object}[]}
 */
export function requests(records) {
  const byId = new Map();
  const seen = new Set();
  let anonymous = 0;
  for (const r of records) {
    if (r.type !== 'assistant' || !r.usage) continue;
    if (r.uuid) {
      if (seen.has(r.uuid)) continue;
      seen.add(r.uuid);
    }
    const key = r.requestId || `no-request-id-${anonymous++}`;
    let q = byId.get(key);
    if (!q) {
      q = {
        requestId: key,
        model: r.model,
        ts: r.ts,
        usage: Object.fromEntries(USAGE_FIELDS.map((f) => [f, 0])),
      };
      if (!r.requestId) q.anonymous = true;
      byId.set(key, q);
    }
    mergeUsage(q, r.usage, r.ts, r.model);
  }
  return [...byId.values()].map(finalizeSplit);
}

function mergeUsage(q, usage, ts, model) {
  for (const f of USAGE_FIELDS) q.usage[f] = Math.max(q.usage[f], usage[f] || 0);
  if (ts != null && (q.ts == null || ts < q.ts)) q.ts = ts;
  if (!q.model && model) q.model = model;
}

function finalizeSplit(q) {
  const split = q.usage.cacheWrite5m + q.usage.cacheWrite1h;
  if (q.usage.cacheWrite > split) q.usage.cacheWrite5m += q.usage.cacheWrite - split;
  q.usage.cacheWrite = q.usage.cacheWrite5m + q.usage.cacheWrite1h;
  return q;
}

/**
 * D1, D5 and D8 over a scope (a session with its subagent files, or the sessions of a feature):
 * files in the fixed order of D1 (session id, main file before subagent files, then file name); a
 * record whose `uuid` was read from an earlier file is a copy and dropped (not a second timeline
 * point); an `agent-<id>` file in several sessions is one thread; a request id in several files is
 * one request owned by the thread of the first file, its usage the per-field maximum.
 * @param {{sessionId:string, main:object[], agents:{id:string, agentType:string, toolUseId:string|null, records:object[]}[]}[]} sessions
 * @returns {{key:string, sessionId:string, agent:string, agentType:string, toolUseId:string|null, records:object[], requests:object[]}[]}
 */
export function scopeThreads(sessions) {
  const files = [];
  for (const s of [...sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId))) {
    files.push({
      key: 'main:' + s.sessionId,
      s,
      agent: 'main',
      agentType: 'main',
      records: s.main,
    });
    const agents = [...s.agents].sort((a, b) => `agent-${a.id}`.localeCompare(`agent-${b.id}`));
    for (const a of agents)
      files.push({
        key: 'agent:' + a.id,
        s,
        agent: a.id,
        agentType: a.agentType,
        a,
        records: a.records,
      });
  }
  const threads = new Map();
  const seen = new Set();
  for (const f of files) {
    let th = threads.get(f.key);
    if (!th) {
      th = {
        key: f.key,
        sessionId: f.s.sessionId,
        agent: f.agent,
        agentType: f.agentType,
        toolUseId: f.a?.toolUseId ?? null,
        records: [],
        requests: [],
      };
      threads.set(f.key, th);
    }
    for (const r of f.records) {
      if (r.uuid) {
        if (seen.has(r.uuid)) continue;
        seen.add(r.uuid);
      }
      th.records.push(r);
    }
  }
  const byId = new Map();
  for (const th of threads.values())
    for (const q of requests(th.records)) {
      const prev = !q.anonymous && byId.get(q.requestId);
      if (prev) {
        mergeUsage(prev, q.usage, q.ts, q.model);
        finalizeSplit(prev);
        continue;
      }
      if (!q.anonymous) byId.set(q.requestId, q);
      q.sessionId = th.sessionId;
      th.requests.push(q);
    }
  return [...threads.values()];
}

/** Context of a call (D3): everything the model read. */
export function contextOf(usage) {
  return usage.input + usage.cacheRead + usage.cacheWrite5m + usage.cacheWrite1h;
}

export function emptyTokens() {
  return { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0, thinking: 0 };
}

/**
 * D2 (and the D3 inputs): tokens by kind per model; `<synthetic>` or model-less requests are
 * skipped and counted.
 * @returns {{byModel:Record<string, {calls:number, input:number, cacheWrite5m:number, cacheWrite1h:number, cacheRead:number, output:number, thinking:number, context:number, ctxPeak:number}>, skipped:number}}
 */
export function usageByModel(reqs) {
  const byModel = {};
  let skipped = 0;
  for (const q of reqs) {
    if (!q.model || q.model === SYNTHETIC_MODEL) {
      skipped++;
      continue;
    }
    const u = (byModel[q.model] ??= { calls: 0, ...emptyTokens(), context: 0, ctxPeak: 0 });
    u.calls++;
    for (const k of [...TOKEN_KINDS, 'thinking']) u[k] += q.usage[k];
    const ctx = contextOf(q.usage);
    u.context += ctx;
    u.ctxPeak = Math.max(u.ctxPeak, ctx);
  }
  return { byModel, skipped };
}

// ---------- D5 and the rest ----------

/**
 * D5: timeline points of `assistant` and `user` records, sorted. `tool` marks a point whose
 * following gap is a tool gap: an assistant record ending in a `tool_use` other than
 * AskUserQuestion, Agent and SendMessage.
 * @returns {{t:number, tool:boolean}[]}
 */
export function timelinePoints(records) {
  return records
    .filter((r) => (r.type === 'assistant' || r.type === 'user') && Number.isFinite(r.ts))
    .map((r) => ({
      t: r.ts,
      tool: r.type === 'assistant' && !!r.lastTool && !TURN_GAP_TOOLS.has(r.lastTool),
    }))
    .sort((a, b) => a.t - b.t);
}

/** Every tool use with its timestamp: `{ ts, name, id?, subagentType?, to? }`. */
export function toolUses(records) {
  return records.flatMap((r) => (r.tools || []).map((t) => ({ ts: r.ts, ...t })));
}

/**
 * `cost-state` records of a file, the last one per `startTime` (definitions section 5: a cumulative
 * snapshot per Claude Code process, whose last record is the process total); [] when none.
 */
export function costState(records) {
  const byStart = new Map();
  for (const r of records)
    if (r.type === 'cost-state' && r.costState)
      byStart.set(r.costState.startTime ?? 'unknown', r.costState);
  return [...byStart.values()];
}
