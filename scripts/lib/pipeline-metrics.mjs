/**
 * Pipeline metrics (ADR-0022 decision 1): time, tokens, cost, phases and rework of a session or a
 * feature, the committed history line, the comparison and the Markdown card. Definitions D4-D12:
 * docs/features/pipeline-metrics/research/definitions.md. Pure functions over slim transcript
 * records (transcript-usage.mjs) and event-log records (metrics-log.mjs); scripts/metrics.mjs does
 * the I/O, except `loadPricing`, the one reader of the price table. Aggregates only: no text of a
 * prompt, a tool call or a response reaches a report.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  TOKEN_KINDS,
  SYNTHETIC_MODEL,
  scopeThreads,
  requests,
  usageByModel,
  timelinePoints,
  toolUses,
  costState,
  emptyTokens,
  contextOf,
} from './transcript-usage.mjs';
import { sections } from './doc-shapes.mjs';
import { ruleFor, editedFiles, mcpGaps } from './mcp-audit.mjs';
import { t } from './i18n.mjs';

/** D6: a turn gap counts up to 5 min, a tool gap up to 10 min (the Bash tool's maximum timeout). */
export const IDLE_MS = 5 * 60_000;
export const TOOL_MS = 10 * 60_000;
/**
 * Largest tolerated divergence of the pricing self-check (definitions section 5, user decisions
 * 2026-09-29 and 2026-10-02): how far cost-state's own costUSD may lie outside the interval of its
 * tokens priced with model-pricing.json, every cache write at the 5m rate up to all at the 1h rate.
 */
export const PRICING_TOLERANCE = 0.05;
/**
 * Largest tolerated difference between a live `agent-stop` aggregate and the re-parse of the same
 * transcript cut at the record's `lastTs` (SubagentStop fires before the agent's final message is
 * written, so the whole file always holds one request more than the live record).
 */
export const DRIFT_MAX = 0.01;
export const MAIN = 'main';
export const ORCHESTRATION = 'orchestration';
export const OTHER = 'other';
/** D11 fallback: the `/feature` phase an agent type belongs to; the main thread orchestrates. */
export const HOME_PHASE = Object.freeze({
  architect: 1,
  'ux-designer': 1,
  'cap-backend-dev': 2,
  'test-backend': 2,
  'fiori-app-dev': 3,
  'ui5-freestyle-dev': 3,
  'test-ui': 3,
  'ui-verifier': 4,
  reviewer: 5,
  'docs-keeper': 6,
  [MAIN]: ORCHESTRATION,
});

const MIN = 60_000;
const round = (x, digits) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(digits)));
const minutes = (ms) => round(ms / MIN, 1);
const usd = (x) => round(x, 4);

// ---------- D6, D8: time ----------

/** D6: Σ min(gap, cap) over sorted points; the cap depends on the point that opens the gap. */
export function activeTime(points, { idleMs = IDLE_MS, toolMs = TOOL_MS } = {}) {
  let ms = 0;
  for (let i = 1; i < points.length; i++)
    ms += Math.min(points[i].t - points[i - 1].t, points[i - 1].tool ? toolMs : idleMs);
  return ms;
}

/** D8: Σ of each thread's own active time (unmerged timelines). */
export function agentMinutes(threadPoints, caps) {
  return minutes(threadPoints.reduce((sum, points) => sum + activeTime(points, caps), 0));
}

// ---------- D4: cost ----------

/** Location of the dated price table, relative to the repo root. */
export const PRICING_FILE = path.join('scripts', 'lib', 'model-pricing.json');

/** The price table (`recordedAt`, `source`, `perMTok`); throws when it is missing or unparsable. */
export function loadPricing(root) {
  return JSON.parse(fs.readFileSync(path.join(root, PRICING_FILE), 'utf8'));
}

/** Price row of a model; a `[1m]`-style suffix (cost-state key) resolves to the base id. */
export function priceOf(model, pricing) {
  const table = pricing?.perMTok || {};
  return table[model] || table[String(model).replace(/\[[^\]]*\]$/, '')] || null;
}

export function tokensCost(tokens, price) {
  return TOKEN_KINDS.reduce((sum, k) => sum + ((tokens[k] || 0) * price[k]) / 1e6, 0);
}

/**
 * D4 over `usageByModel().byModel`: an unknown model gets `null` and a warning
 * `unknown-model:<name>`, never zero; the total is the sum of the priced models, `null` when none is.
 */
export function costOf(byModel, pricing) {
  const models = {};
  const warnings = [];
  let total = 0;
  let priced = 0;
  for (const [model, u] of Object.entries(byModel)) {
    const price = priceOf(model, pricing);
    if (!price) {
      models[model] = null;
      warnings.push(`unknown-model:${model}`);
      continue;
    }
    models[model] = tokensCost(u, price);
    total += models[model];
    priced++;
  }
  const empty = Object.keys(byModel).length === 0;
  return { costUSD: priced || empty ? total : null, byModel: models, warnings };
}

/**
 * D4 over parts (requests or threads), consistent with `costOf`: the priced parts summed, `partial`
 * when a part holds an unpriced model (`costUSD: null` or `costPartial`); `null` when no part is
 * priced, `0` only when nothing was requested. A part without calls (an empty thread) prices
 * nothing and is neutral. Never a silent zero for an unpriced model.
 */
export function sumCost(parts) {
  let costUSD = null;
  let partial = false;
  for (const p of parts) {
    if (p.calls === 0) continue;
    if (p.costPartial || p.costUSD == null) partial = true;
    if (p.costUSD != null) costUSD = (costUSD ?? 0) + p.costUSD;
  }
  return { costUSD: costUSD ?? (partial ? null : 0), partial };
}

// ---------- D11, D12: phases and rework ----------

/** First integer 0-7 of a `Phase:` value, else 'none' (`none (#7 done)` is phase 7 by design). */
export function phaseOf(value) {
  const m = String(value ?? '').match(/(?<!\d)([0-7])(?!\d)/);
  return m ? m[1] : 'none';
}

/** Feature name of a `Feature:` value: `pipeline-metrics (#14)` gives `pipeline-metrics`. */
export function featureNameOf(value) {
  return (
    String(value ?? 'none')
      .trim()
      .split(/\s+/)[0] || 'none'
  );
}

export function homePhase(agentType) {
  const p = HOME_PHASE[agentType];
  return p === undefined ? OTHER : String(p);
}

/**
 * `phase` records as sorted markers, consecutive duplicates dropped. With `feature`: the markers of
 * that feature, plus `none` markers after its first one (the completion marker).
 * @returns {{t:number, phase:string, feature:string}[]}
 */
export function phaseMarkers(events, feature = null) {
  const all = events
    .filter((e) => e.event === 'phase' && e.ts)
    .map((e) => ({
      t: Date.parse(e.ts),
      phase: String(e.phase ?? phaseOf(e.raw)),
      feature: featureNameOf(e.feature),
    }))
    .sort((a, b) => a.t - b.t);
  let started = !feature;
  const out = [];
  for (const m of all) {
    if (feature) {
      if (m.feature === feature) started = true;
      else if (!(started && m.feature === 'none')) continue;
    }
    const last = out.at(-1);
    if (last && last.phase === m.phase && last.feature === m.feature) continue;
    out.push(m);
  }
  return out;
}

/** D11: the phase of the latest marker at or before `t`; before the first marker: '0'. */
export function phaseAt(markers, t) {
  let phase = '0';
  for (const m of markers) {
    if (m.t > t) break;
    phase = m.phase;
  }
  return phase;
}

/** Cells of a Markdown table row, split on unescaped pipes. */
function cellsOf(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/**
 * D12 plan assignment: the (phase, agent type) pairs of the `## Steps` table of a PLAN.md text, as
 * a Map from agent type to its set of phases. Phase = D11's first integer 0-7 of the `Phase` cell;
 * agent types = the backticked `HOME_PHASE` keys of the `Agent` cell (not `main`; prose, file names
 * and `orchestrator` are ignored). Null, the home-phase fallback, when there is no text, no Steps
 * section, no `Phase` or `Agent` header column, or no row with both.
 * @returns {Map<string, Set<string>>|null}
 */
export function planAssignments(text) {
  if (!text) return null;
  const steps = sections(text).find((s) => s.heading === '## Steps');
  const rows = (steps?.lines || []).filter((l) => l.trim().startsWith('|')).map(cellsOf);
  const phaseCol = rows[0]?.indexOf('Phase') ?? -1;
  const agentCol = rows[0]?.indexOf('Agent') ?? -1;
  if (phaseCol < 0 || agentCol < 0) return null;
  const plan = new Map();
  for (const cells of rows.slice(1)) {
    const phase = phaseOf(cells[phaseCol]);
    if (phase === 'none') continue;
    for (const [, type] of String(cells[agentCol] ?? '').matchAll(/`([^`]+)`/g)) {
      if (type === MAIN || !Object.hasOwn(HOME_PHASE, type)) continue;
      if (!plan.has(type)) plan.set(type, new Set());
      plan.get(type).add(phase);
    }
  }
  return plan.size ? plan : null;
}

/**
 * D12: whether a PLAN.md text is the plan as approved at the plan gate: its first `Status:` value
 * begins with `approved`, optionally in backticks (`draft`, `proposed` and a later `done` status
 * that mentions the approval do not qualify). The status line decides, never a commit message.
 */
export function planApproved(text) {
  const m = String(text ?? '').match(/Status:[ \t]*([^\n]*)/);
  return !!m && /^`?approved\b/i.test(m[1]);
}

/**
 * The commit a pruned feature's final documents (`criteria`, `review`) are read at, from the
 * `## Full record` section of its SUMMARY.md: the `tree/<sha>/` segment of the permalink, else
 * the backticked short sha that `prune-feature.mjs` writes; null without that section.
 */
export function permalinkCommit(summary) {
  const record = sections(summary ?? '').find((s) => s.heading === '## Full record');
  if (!record) return null;
  const body = record.lines.join('\n');
  return (
    body.match(/\/tree\/([0-9a-f]{40})\//)?.[1] ?? body.match(/`([0-9a-f]{7,40})`/)?.[1] ?? null
  );
}

/**
 * D12 on launches sorted by `ts` (`{ agentType, ts }`), plan first: a launch whose agent type the
 * plan (`planAssignments`) lists for the phase of the launch is never rework. Otherwise, with
 * markers, a launch whose phase at launch time differs from its home phase; a launch before the
 * first marker is in its home phase and never rework (user decision 2026-09-29). Without markers
 * the phase is unknown but at least `H`, the highest home phase launched before it: planned when
 * the plan lists its type in a phase >= `H`, else rework when its home phase is lower than `H`.
 * Types without a home phase are never rework.
 * @returns {boolean[]} rework flag per launch
 */
export function reworkOf(launches, markers, plan = null) {
  const planned = (type, test) => [...(plan?.get(type) ?? [])].some(test);
  let highest = 0;
  return launches.map((l) => {
    const home = HOME_PHASE[l.agentType];
    if (typeof home !== 'number') return false;
    if (markers.length) {
      if (l.ts == null || l.ts < markers[0].t) return false;
      const phase = phaseAt(markers, l.ts);
      return !planned(l.agentType, (p) => p === phase) && phase !== String(home);
    }
    const before = highest;
    highest = Math.max(highest, home);
    return !planned(l.agentType, (p) => Number(p) >= before) && home < before;
  });
}

/**
 * D13 over main-thread records (copies already dropped, D5): turn inputs by their `input` kind.
 * @returns {{prompts:number, handbacks:number, notifications:number}}
 */
export function turnInputs(records) {
  const n = { human: 0, peer: 0, 'task-notification': 0 };
  for (const r of records) if (r.input in n) n[r.input]++;
  return { prompts: n.human, handbacks: n.peer, notifications: n['task-notification'] };
}

// ---------- D10: feature scope ----------

/**
 * Windows `[from, to)` opened by a `prompt` marker `{ command: 'spec' | 'feature', arg }` naming
 * the feature (kebab name or `#N`) and closed by the next command marker.
 */
export function promptWindows(events, name, issue = null) {
  const cmds = events
    .filter((e) => e.event === 'prompt' && e.command && e.ts)
    .map((e) => ({ t: Date.parse(e.ts), command: e.command, arg: e.arg }))
    .sort((a, b) => a.t - b.t);
  const names = new Set([name, issue ? `#${issue}` : null].filter(Boolean));
  const windows = [];
  cmds.forEach((c, i) => {
    if ((c.command === 'spec' || c.command === 'feature') && names.has(c.arg))
      windows.push([c.t, cmds[i + 1]?.t ?? Infinity]);
  });
  return windows;
}

/**
 * D10 for one session: records on branch `feature/<name>` or inside a prompt window. Events and
 * the MCP audit are kept inside the session's first..last in-scope record. `agentFiles` keeps the
 * ids of every agent transcript on disk, so an agent filtered out of scope is not mistaken for one
 * whose transcript is gone (the live `agent-stop` fallback of `buildReport`).
 */
export function featureRecords(session, name, { issue = null } = {}) {
  const branch = `feature/${name}`;
  const windows = promptWindows(session.events || [], name, issue);
  const inScope = (r) =>
    r.gitBranch === branch || (r.ts != null && windows.some(([a, b]) => r.ts >= a && r.ts < b));
  const main = session.main.filter(inScope);
  const agents = session.agents
    .map((a) => ({ ...a, records: a.records.filter(inScope) }))
    .filter((a) => a.records.length);
  const ts = [...main, ...agents.flatMap((a) => a.records)]
    .map((r) => r.ts)
    .filter(Number.isFinite);
  const from = Math.min(...ts);
  const to = Math.max(...ts);
  const within = (e) => {
    const x = Date.parse(e.ts);
    return x >= from && x <= to;
  };
  return {
    sessionId: session.sessionId,
    main,
    agents,
    agentFiles: agentFilesOf(session),
    // Every record the filter can judge kept: the session's processes lie wholly in scope
    // (`processShare`, definitions section 5).
    complete: branchRecords({ main, agents }) === branchRecords(session),
    events: (session.events || []).filter(within),
    audit: (session.audit || []).filter(within),
    specAttributed: windows.length > 0,
  };
}

/**
 * Records that carry a `gitBranch`, the ones the scope filter can judge: `cost-state` and the
 * other records without a branch never make a scope incomplete (definitions section 5).
 */
function branchRecords(s) {
  const n = (records) => records.filter((r) => r.gitBranch != null).length;
  return n(s.main) + s.agents.reduce((sum, a) => sum + n(a.records), 0);
}

/** Transcript cost of sessions after D1 (requests deduplicated over all their files). */
export function transcriptCost(sessions, pricing) {
  let total = 0;
  for (const th of scopeThreads(sessions))
    for (const q of th.requests) {
      const price = q.model && q.model !== SYNTHETIC_MODEL ? priceOf(q.model, pricing) : null;
      if (price) total += tokensCost(q.usage, price);
    }
  return total;
}

/**
 * Claude Code processes found in the sessions' main files (definitions section 5): per
 * `startTime` the largest, that is the last, `cost-state` record and every session holding one.
 * @returns {{startTime:number|null, record:object, sessionIds:string[]}[]}
 */
export function processesOf(sessions) {
  const byStart = new Map();
  for (const s of sessions)
    for (const cs of costState(s.main)) {
      const key = String(cs.startTime ?? `unknown:${s.sessionId}`);
      const p = byStart.get(key);
      if (!p) {
        byStart.set(key, {
          startTime: cs.startTime ?? null,
          record: cs,
          sessionIds: [s.sessionId],
        });
        continue;
      }
      if (!p.sessionIds.includes(s.sessionId)) p.sessionIds.push(s.sessionId);
      if ((cs.totalCostUSD ?? 0) > (p.record.totalCostUSD ?? 0)) p.record = cs;
    }
  return [...byStart.values()];
}

/**
 * The processes touching `scopeIds`, each with `wholeCostUSD`: the transcript cost (D1) of all its
 * sessions whole, the denominator of the proportional share. `sessions` are the full sessions.
 */
export function scopeProcesses(sessions, scopeIds, pricing) {
  const byId = new Map(sessions.map((s) => [s.sessionId, s]));
  return processesOf(sessions)
    .filter((p) => p.sessionIds.some((id) => scopeIds.includes(id)))
    .map((p) => ({
      ...p,
      wholeCostUSD: transcriptCost(p.sessionIds.map((id) => byId.get(id)).filter(Boolean), pricing),
    }));
}

/**
 * Definitions section 5, for the card and `reconcile` alike: the share of a process's last total
 * that a scope carries. A process whose records are all in scope carries 1, whatever is priced.
 * Otherwise the scope's priced transcript cost over the process's (`transcriptCost`), at most 1.
 * With nothing priced in the process's sessions and records outside the scope there is no basis
 * for a split: null, so the caller reports the cost-state figure as n/a with a warning (D4: never a
 * silent 0; a request-count split would be a second rule next to the cost one).
 */
export function processShare(whollyInScope, scopedUSD, wholeUSD) {
  if (whollyInScope) return 1;
  return wholeUSD > 0 ? Math.min(1, (scopedUSD ?? 0) / wholeUSD) : null;
}

/**
 * Distance of `cost` outside the interval `[low, high]` (definitions section 5): relative to `low`
 * below it, relative to `high` above it, 0 inside. A zero price against a non-zero cost, or the
 * reverse, gives 1; both zero give 0.
 */
function intervalDivergence(cost, low, high) {
  if (cost < low) return (low - cost) / low;
  if (cost > high) return high > 0 ? (cost - high) / high : 1;
  return 0;
}

/**
 * Pricing self-check per model (definitions section 5, interval rule): over the last record of
 * each process, cost-state's own tokens priced with the table twice, every cache write at the 5m
 * rate (`lowUSD`) and every cache write at the 1h rate (`highUSD`), against its `costUSD`; the
 * `divergence` is the distance outside that interval. The transcript's 5m/1h share is not used:
 * cost-state also holds tokens that are in no transcript (H1). An unpriced model: `null`s.
 * @returns {Record<string, {costUSD:number|null, lowUSD:number|null, highUSD:number|null,
 *   divergence:number|null}>}
 */
export function pricingCheck(processes, pricing) {
  const acc = {};
  const fields = [
    'inputTokens',
    'cacheCreationInputTokens',
    'cacheReadInputTokens',
    'outputTokens',
    'costUSD',
  ];
  for (const p of processes)
    for (const [model, u] of Object.entries(p.record.modelUsage || {})) {
      const m = (acc[model] ??= Object.fromEntries(fields.map((f) => [f, 0])));
      for (const f of fields) m[f] += u[f] || 0;
    }
  const out = {};
  for (const [model, m] of Object.entries(acc)) {
    const price = priceOf(model, pricing);
    if (!price) {
      out[model] = { costUSD: usd(m.costUSD), lowUSD: null, highUSD: null, divergence: null };
      continue;
    }
    const rest =
      m.inputTokens * price.input +
      m.cacheReadInputTokens * price.cacheRead +
      m.outputTokens * price.output;
    const low = (rest + m.cacheCreationInputTokens * price.cacheWrite5m) / 1e6;
    const high = (rest + m.cacheCreationInputTokens * price.cacheWrite1h) / 1e6;
    out[model] = {
      costUSD: usd(m.costUSD),
      lowUSD: usd(low),
      highUSD: usd(high),
      divergence: round(intervalDivergence(m.costUSD, low, high), 4),
    };
  }
  return out;
}

// ---------- the report ----------

function threadOf(st, pricing, caps) {
  const reqs = st.requests.filter((q) => q.model && q.model !== SYNTHETIC_MODEL);
  const skipped = st.requests.length - reqs.length;
  for (const q of reqs) {
    const price = priceOf(q.model, pricing);
    q.costUSD = price ? tokensCost(q.usage, price) : null;
  }
  const points = timelinePoints(st.records);
  const tools = {};
  for (const u of toolUses(st.records)) tools[u.name] = (tools[u.name] || 0) + 1;
  const usage = usageByModel(reqs);
  const cost = costOf(usage.byModel, pricing);
  return {
    sessionId: st.sessionId,
    agent: st.agent,
    agentType: st.agentType,
    toolUseId: st.toolUseId,
    records: st.records,
    reqs,
    calls: reqs.length,
    skipped,
    points,
    tools,
    toolCalls: Object.values(tools).reduce((s, n) => s + n, 0),
    activeMs: activeTime(points, caps),
    byModel: usage.byModel,
    // D4: the priced part, `null` when nothing is priced; `costPartial` marks an unpriced model.
    costUSD: cost.costUSD,
    costPartial: cost.warnings.length > 0,
    warnings: cost.warnings,
    first: points[0]?.t ?? null,
  };
}

/** Ids of the agent transcripts on disk (`featureRecords` keeps them before its scope filter). */
function agentFilesOf(session) {
  return session.agentFiles ?? session.agents.map((a) => a.id);
}

/** The latest `agent-stop` per agent over sessions (the transcript is cumulative), with its session. */
function lastAgentStops(sessions) {
  const out = new Map();
  for (const s of sessions)
    for (const e of s.events || []) {
      if (e.event !== 'agent-stop' || !e.agent) continue;
      const prev = out.get(e.agent);
      if (!prev || !(Date.parse(e.ts) < Date.parse(prev.ts)))
        out.set(e.agent, { ...e, sessionId: s.sessionId });
    }
  return out;
}

/**
 * Fallback thread of an agent whose transcript file is gone (data-flow section 3: the re-parse is
 * the source whenever the file exists): the last live `agent-stop` aggregate, its tokens under the
 * record's `model` priced with the current table (D4), its own active time. It adds no timeline
 * point, so lead time and merged active time stay transcript-only; its context peak is unknown (0).
 */
function liveThread(e, pricing) {
  const u = { calls: e.requests || 0, ...emptyTokens(), context: 0, ctxPeak: 0 };
  for (const k of TOKEN_KINDS) u[k] = e.tokens?.[k] || 0;
  u.context = contextOf(u);
  const byModel = e.model && u.calls ? { [e.model]: u } : {};
  const cost = costOf(byModel, pricing);
  const first = Date.parse(e.firstTs);
  const ts = Number.isFinite(first) ? first : Date.parse(e.ts);
  return {
    live: true,
    sessionId: e.sessionId,
    agent: e.agent,
    agentType: e.agentType,
    toolUseId: null,
    records: [],
    // One request-like entry carrying the aggregate, so phase rows get its calls and cost.
    reqs: e.model && u.calls ? [{ model: e.model, ts, calls: u.calls, costUSD: cost.costUSD }] : [],
    calls: u.calls,
    skipped: 0,
    points: [],
    tools: {},
    toolCalls: e.toolCalls || 0,
    activeMs: (e.activeMin || 0) * MIN,
    byModel,
    costUSD: cost.costUSD,
    costPartial: cost.warnings.length > 0,
    warnings: cost.warnings,
    first: ts,
  };
}

function phaseRow() {
  return { rounds: null, activeMs: 0, waitingMs: 0, calls: 0, reqs: [], reworkReqs: [] };
}

function phaseOrder(a, b) {
  const rank = (k) => (/^\d+$/.test(k) ? Number(k) : ({ none: 8, [ORCHESTRATION]: 9 }[k] ?? 10));
  return rank(a) - rank(b) || a.localeCompare(b);
}

function tokenSum(tokens) {
  return TOKEN_KINDS.reduce((s, k) => s + (tokens?.[k] || 0), 0);
}

/**
 * MCP-first compliance from the audit log (ADR-0014): queries, failed and unjustified skips, and
 * per agent type the edits under an `MCP_RULES` rule and how many of them had a query before.
 */
export function mcpCompliance(audit) {
  const queries = audit.filter((r) => r.event === 'mcp');
  const byAgentType = {};
  for (const agent of new Set(audit.filter((r) => r.event === 'edit').map((r) => r.agent))) {
    const type = audit.find((r) => r.agent === agent && r.agentType)?.agentType || agent;
    const ruled = editedFiles(audit, agent).filter((f) => ruleFor(f)).length;
    const row = (byAgentType[type] ??= { ruledEdits: 0, withQuery: 0 });
    row.ruledEdits += ruled;
    row.withQuery += ruled - mcpGaps(audit, agent).length;
  }
  const rows = Object.values(byAgentType);
  return {
    queries: queries.length,
    failed: queries.filter((r) => r.ok === false).length,
    justified: audit.filter((r) => r.event === 'justification').length,
    unjustified: audit.filter((r) => r.event === 'skipped-unjustified').length,
    ruledEdits: rows.reduce((s, r) => s + r.ruledEdits, 0),
    withQuery: rows.reduce((s, r) => s + r.withQuery, 0),
    byAgentType,
  };
}

/**
 * A report over sessions already cut to the scope. Each session:
 * `{ sessionId, main, agents: [{ id, agentType, toolUseId, records }], events, audit,
 * specAttributed }`; `processes` from `scopeProcesses`; `plan` from `planAssignments` (D12, null:
 * home-phase fallback). `extras`: `{ review, criteria, lines, maxTurns: { type: n }, compactions,
 * planCommit }`.
 */
export function buildReport({
  scope,
  feature = null,
  issue = null,
  sessions,
  processes = [],
  pricing,
  plan = null,
  idleMs = IDLE_MS,
  toolMs = TOOL_MS,
  extras = {},
}) {
  const caps = { idleMs, toolMs };
  const warnings = new Set();
  const threads = [];
  const events = sessions.flatMap((s) => s.events || []);
  const audit = sessions.flatMap((s) => s.audit || []);
  // D1, D5, D8: one thread per main file and per agent id, copies dropped, requests counted once.
  for (const st of scopeThreads(sessions)) threads.push(threadOf(st, pricing, caps));
  // The transcript re-parse is the source; the live aggregate only stands in for a gone file. A
  // record without requests stands in for nothing (its file never existed: an internal agent).
  const lastStop = lastAgentStops(sessions);
  const onDisk = new Set(sessions.flatMap(agentFilesOf));
  for (const [agent, e] of lastStop)
    if (!onDisk.has(agent) && e.requests > 0) {
      threads.push(liveThread(e, pricing));
      warnings.add(`agent-transcript-missing:${agent}`);
    }
  threads.forEach((th) => th.warnings.forEach((w) => warnings.add(w)));

  // D9: launches are the agent threads, timed by their Agent tool_use; resumes are SendMessage.
  const launchTs = new Map();
  const resumesTo = new Map();
  let resumes = 0;
  let toolCalls = 0;
  for (const th of threads) {
    toolCalls += th.toolCalls;
    if (th.agent !== MAIN) continue;
    for (const u of toolUses(th.records)) {
      if (u.name === 'Agent' && u.id) launchTs.set(u.id, u.ts);
      if (u.name === 'SendMessage' && u.to) {
        resumes++;
        resumesTo.set(u.to, (resumesTo.get(u.to) || 0) + 1);
      }
    }
  }
  const launches = threads
    .filter((th) => th.agent !== MAIN)
    .map((th) => ({
      thread: th,
      agentType: th.agentType,
      ts: launchTs.get(th.toolUseId) ?? th.first,
    }))
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  // D11, D12
  const markers = phaseMarkers(events, scope === 'feature' ? feature : null);
  const phaseSource = markers.length ? 'markers' : 'home-phase';
  // D12: an agent launched before the first marker takes its home phase (not D11's '0') for all
  // its time and requests; the main thread before the first marker stays in '0' (D11).
  const launchOf = new Map(launches.map((l) => [l.thread, l.ts]));
  const beforeMarkers = (th) =>
    th.agent !== MAIN && (launchOf.get(th) == null || launchOf.get(th) < markers[0].t);
  const phaseFor = (th, time) =>
    !markers.length || beforeMarkers(th) ? homePhase(th.agentType) : phaseAt(markers, time);
  reworkOf(launches, markers, plan).forEach((flag, i) => (launches[i].thread.rework = flag));

  const phases = {};
  const row = (k) => (phases[k] ??= phaseRow());
  const merged = threads
    .flatMap((th) => th.points.map((p) => ({ t: p.t, tool: p.tool, phase: phaseFor(th, p.t) })))
    .sort((a, b) => a.t - b.t);
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1];
    const gap = merged[i].t - prev.t;
    const counted = Math.min(gap, prev.tool ? toolMs : idleMs);
    row(prev.phase).activeMs += counted;
    row(prev.phase).waitingMs += gap - counted;
  }
  for (const th of threads)
    for (const q of th.reqs) {
      const r = row(phaseFor(th, q.ts));
      r.calls += q.calls ?? 1;
      r.reqs.push(q);
      if (th.rework) r.reworkReqs.push(q);
    }
  // Rounds exist only with markers; the home-phase fallback leaves them n/a (further-metrics.md).
  for (const m of markers) row(m.phase).rounds = (row(m.phase).rounds || 0) + 1;

  // Tokens, D3
  const tokens = emptyTokens();
  const byModel = {};
  let calls = 0;
  let context = 0;
  let ctxPeak = 0;
  for (const th of threads)
    for (const [model, u] of Object.entries(th.byModel)) {
      const m = (byModel[model] ??= { calls: 0, ...emptyTokens(), costUSD: 0 });
      m.calls += u.calls;
      for (const k of Object.keys(tokens)) {
        m[k] += u[k];
        tokens[k] += u[k];
      }
      calls += u.calls;
      context += u.context;
      ctxPeak = Math.max(ctxPeak, u.ctxPeak);
    }
  for (const th of threads)
    for (const q of th.reqs) if (byModel[q.model]) byModel[q.model].costUSD += q.costUSD ?? 0;
  for (const [model, m] of Object.entries(byModel))
    m.costUSD = priceOf(model, pricing) ? usd(m.costUSD) : null;
  if (!calls) warnings.add('zero-requests');

  // Reference total (definitions section 5): per process in scope its last total, or its
  // proportional share when its sessions also hold records outside the scope.
  const total = sumCost(threads);
  const costUSD = total.costUSD;
  const scopeIds = sessions.map((s) => s.sessionId);
  const inScope = processes.filter((p) => p.sessionIds.some((id) => scopeIds.includes(id)));
  // Shares and the attributed sum go by priced cost, like `transcriptCost` (the denominator); the
  // share's numerator counts transcript threads only, since the denominator has no live fallback.
  const costBySession = new Map();
  const transcriptBySession = new Map();
  for (const th of threads) {
    const add = (m) => m.set(th.sessionId, (m.get(th.sessionId) || 0) + (th.costUSD ?? 0));
    add(costBySession);
    if (!th.live) add(transcriptBySession);
  }
  // A session of the scope is whole unless `featureRecords` cut records out of it.
  const complete = new Map(sessions.map((s) => [s.sessionId, s.complete !== false]));
  let costStateUSD = null;
  let shareUnknown = false;
  const covered = new Set();
  for (const p of inScope) {
    const scoped = p.sessionIds.reduce((sum, id) => sum + (transcriptBySession.get(id) || 0), 0);
    const wholly = p.sessionIds.every((id) => complete.get(id) === true);
    const share = processShare(wholly, scoped, p.wholeCostUSD ?? scoped);
    if (share == null) {
      shareUnknown = true;
      warnings.add(`cost-state-share-unknown:${p.startTime ?? 'unknown'}`);
    } else costStateUSD = (costStateUSD ?? 0) + p.record.totalCostUSD * share;
    p.sessionIds.forEach((id) => covered.add(id));
    if (p.record.hasUnknownModelCost) warnings.add('cost-state-unknown-model-cost');
  }
  // One process without a share leaves the reference total unknown: n/a, not a smaller figure.
  if (shareUnknown) costStateUSD = null;
  const attributed = [...covered].reduce((sum, id) => sum + (costBySession.get(id) || 0), 0);
  // D4: nothing priced gives no recovered ratio (as in `reconcile`), never 0%.
  const recovered = costStateUSD && costUSD != null ? attributed / costStateUSD : null;
  const pricing5 = pricingCheck(inScope, pricing);
  for (const [model, c] of Object.entries(pricing5)) {
    if (c.divergence == null) warnings.add(`unknown-model:${model}`);
    else if (c.divergence > PRICING_TOLERANCE) warnings.add(`pricing-check:${model}`);
  }

  // Live self-check: SubagentStop fires before the agent's final message reaches its transcript,
  // so the last live aggregate per agent is compared with the re-parse cut at the record's
  // `lastTs` (like with like); a difference above DRIFT_MAX then signals a changed format.
  for (const [agent, e] of lastStop) {
    const th = threads.find((x) => x.agent === agent && !x.live);
    if (!th) continue;
    const cut = Date.parse(e.lastTs);
    const upTo = Number.isFinite(cut) ? th.records.filter((r) => !(r.ts > cut)) : th.records;
    const parsed = Object.values(usageByModel(requests(upTo)).byModel).reduce(
      (s, u) => s + tokenSum(u),
      0
    );
    const live = tokenSum(e.tokens);
    if (Math.max(parsed, live) > 0 && Math.abs(parsed - live) / Math.max(parsed, live) > DRIFT_MAX)
      warnings.add(`agent-stop-drift:${agent}`);
  }

  // Agent rows, per type; main first.
  const types = [MAIN, ...new Set(launches.map((l) => l.agentType))];
  const agents = types.map((type) => {
    const mine = threads.filter((th) => th.agentType === type);
    const cost = sumCost(mine);
    const rework = sumCost(mine.filter((th) => th.rework));
    return {
      agentType: type,
      launches: type === MAIN ? null : mine.length,
      resumes: type === MAIN ? null : mine.reduce((s, th) => s + (resumesTo.get(th.agent) || 0), 0),
      activeMin: minutes(mine.reduce((s, th) => s + th.activeMs, 0)),
      calls: mine.reduce((s, th) => s + th.calls, 0),
      maxTurns: extras.maxTurns?.[type] ?? null,
      costUSD: usd(cost.costUSD),
      costPartial: cost.partial,
      reworkLaunches: mine.filter((th) => th.rework).length,
      reworkUSD: usd(rework.costUSD),
      reworkPartial: rework.partial,
      tools: mine.reduce((acc, th) => {
        for (const [k, n] of Object.entries(th.tools)) acc[k] = (acc[k] || 0) + n;
        return acc;
      }, {}),
    };
  });
  const rework = sumCost(threads.filter((th) => th.rework));
  const reworkUSD = rework.costUSD;
  // Priced rework over priced cost; n/a when either is not priced at all.
  const reworkShare =
    costUSD == null || reworkUSD == null ? null : costUSD ? round(reworkUSD / costUSD, 3) : 0;
  const relaunches = types
    .filter((x) => x !== MAIN)
    .reduce((s, x) => s + Math.max(0, launches.filter((l) => l.agentType === x).length - 1), 0);

  const activeMs = activeTime(merged, caps);
  const first = merged[0]?.t ?? null;
  const last = merged.at(-1)?.t ?? null;
  const leadMs = first == null ? 0 : last - first;
  const agentMs = threads.reduce((s, th) => s + th.activeMs, 0);

  // Gate blocks: `gate` records of the event log; history fallback: Stop hook summaries whose
  // hookErrors is not empty (the Stop gate only, reason not recorded).
  let gateBlocks = null;
  let gateSource = null;
  const stopSummaries = threads
    .filter((th) => th.agent === MAIN)
    .flatMap((th) => th.records.filter((r) => r.subtype === 'stop_hook_summary'));
  if (events.length) {
    gateSource = 'events';
    gateBlocks = {};
    for (const g of events.filter((e) => e.event === 'gate'))
      gateBlocks[g.reason || 'unknown'] = (gateBlocks[g.reason || 'unknown'] || 0) + 1;
  } else if (stopSummaries.length) {
    gateSource = 'stop-hook-summary';
    const blocked = stopSummaries.filter((r) => r.stopHookBlocked).length;
    gateBlocks = blocked ? { 'stop-gate': blocked } : {};
  }
  // D13: from the transcript for history and live alike; `prompt` events are command markers only.
  const inputs = turnInputs(threads.filter((th) => th.agent === MAIN).flatMap((th) => th.records));
  // Session lines from cost-state, only when no process is shared with another session.
  const csLines = inScope.every((p) => p.sessionIds.length === 1)
    ? inScope.map((p) => p.record).filter((cs) => cs.totalLinesAdded != null)
    : [];
  const lines =
    extras.lines ??
    (scope === 'session' && csLines.length
      ? {
          added: csLines.reduce((s, cs) => s + cs.totalLinesAdded, 0),
          removed: csLines.reduce((s, cs) => s + (cs.totalLinesRemoved || 0), 0),
        }
      : null);

  return {
    scope,
    feature,
    issue,
    sessionIds: sessions.map((s) => s.sessionId),
    sessions: sessions.length,
    firstTs: first == null ? null : new Date(first).toISOString(),
    lastTs: last == null ? null : new Date(last).toISOString(),
    versions: [
      ...new Set(threads.flatMap((th) => th.records.map((r) => r.version)).filter(Boolean)),
    ].sort(),
    idleMin: idleMs / MIN,
    toolMin: toolMs / MIN,
    pricingDate: pricing?.recordedAt ?? null,
    phaseSource,
    reworkSource: plan ? 'plan' : 'home-phase',
    // The commit the approved plan was read at (null: the working tree, or no plan).
    planCommit: plan ? (extras.planCommit ?? null) : null,
    specAttributed: sessions.some((s) => s.specAttributed),
    leadMin: minutes(leadMs),
    activeMin: minutes(activeMs),
    waitingMin: minutes(leadMs - activeMs),
    agentMin: minutes(agentMs),
    parallelism: activeMs ? round(agentMs / activeMs, 2) : null,
    costUSD: usd(costUSD),
    costPartial: total.partial,
    costStateUSD: usd(costStateUSD),
    costStateProcesses: inScope.length,
    recovered: round(recovered, 3),
    pricingCheck: pricing5,
    pricingOk: inScope.length
      ? Object.values(pricing5).every(
          (c) => c.divergence != null && c.divergence <= PRICING_TOLERANCE
        )
      : null,
    unattributedUSD: costStateUSD == null ? null : usd(costStateUSD - attributed),
    tokens,
    cacheHit: context ? round(tokens.cacheRead / context, 3) : null,
    ctxAvg: calls ? Math.round(context / calls) : null,
    ctxPeak,
    calls,
    skipped: threads.reduce((s, th) => s + th.skipped, 0),
    byModel,
    launches: launches.length,
    resumes,
    relaunches,
    reworkUSD: usd(reworkUSD),
    reworkPartial: rework.partial,
    reworkShare,
    toolCalls,
    phases: Object.fromEntries(
      Object.keys(phases)
        .sort(phaseOrder)
        .map((k) => {
          const cost = sumCost(phases[k].reqs);
          const reworkCost = sumCost(phases[k].reworkReqs);
          return [
            k,
            {
              rounds: phases[k].rounds,
              activeMin: minutes(phases[k].activeMs),
              waitingMin: minutes(phases[k].waitingMs),
              calls: phases[k].calls,
              costUSD: usd(cost.costUSD),
              costPartial: cost.partial,
              reworkUSD: usd(reworkCost.costUSD),
              reworkPartial: reworkCost.partial,
            },
          ];
        })
    ),
    agents,
    gateBlocks,
    gateSource,
    review: extras.review ?? null,
    criteria: extras.criteria ?? null,
    mcp: audit.length ? mcpCompliance(audit) : null,
    compactions: extras.compactions ?? null,
    ...inputs,
    lines,
    warnings: [...warnings].sort(),
  };
}

/**
 * One whole session: `{ sessionId, main, agents, events?, audit? }`; `opts.related` are the full
 * sessions that share one of its processes (for the proportional share).
 */
export function sessionReport(session, { related = [], ...opts }) {
  return buildReport({
    ...opts,
    scope: 'session',
    sessions: [session],
    processes: scopeProcesses([session, ...related], [session.sessionId], opts.pricing),
  });
}

/** D10 over every loaded (full) session; sessions without an in-scope record drop out. */
export function featureReport(sessions, name, opts) {
  const scoped = sessions
    .map((s) => featureRecords(s, name, { issue: opts.issue }))
    .filter((s) => s.main.length || s.agents.length);
  return buildReport({
    ...opts,
    scope: 'feature',
    feature: name,
    sessions: scoped,
    processes: scopeProcesses(
      sessions,
      scoped.map((s) => s.sessionId),
      opts.pricing
    ),
  });
}

// ---------- figures outside the transcript ----------

function listItems(lines) {
  return lines.filter((l) => /^[-*] \S/.test(l) && !/^[-*] none\b/i.test(l)).length;
}

/** The finding headings of the reviewer's result format (.claude/agents/reviewer.md). */
export const REVIEW_HEADINGS = ['## Blocking', '## Important', '## Minor'];

/** `review` of the history line: list items under the reviewer's three finding headings. */
export function reviewCounts(text) {
  if (!text) return null;
  const secs = sections(text);
  // A review written before the reviewer's result format has no such headings: n/a, never 0.
  if (!REVIEW_HEADINGS.every((h) => secs.some((s) => s.heading === h))) return null;
  const count = (h) =>
    secs.filter((s) => s.heading === h).reduce((n, s) => n + listItems(s.lines), 0);
  const blocking = count('## Blocking');
  return { blocking, total: blocking + count('## Important') + count('## Minor') };
}

/** `criteria` of the history line: ticked and all checkboxes under `## Acceptance criteria`. */
export function criteriaCounts(text) {
  if (!text) return null;
  const sec = sections(text).find((s) => s.heading === '## Acceptance criteria');
  if (!sec) return null;
  return {
    closed: sec.lines.filter((l) => /^- \[[xX]\]/.test(l)).length,
    total: sec.lines.filter((l) => /^- \[[ xX]\]/.test(l)).length,
  };
}

// ---------- history ----------

/** The committed history of finished features, one `historyLine` per line (ADR-0022 decision 4). */
export const HISTORY_FILE = path.join('docs', 'metrics', 'history.jsonl');

/** The committed aggregate of a feature report (research/data-flow.md section 4). */
export function historyLine(r, recordedAt) {
  return {
    feature: r.feature,
    issue: r.issue,
    recordedAt,
    sessions: r.sessions,
    leadMin: r.leadMin,
    activeMin: r.activeMin,
    waitingMin: r.waitingMin,
    agentMin: r.agentMin,
    costUSD: r.costUSD,
    // D4: always written; true only through `record --force` (metrics.mjs refuses otherwise).
    costPartial: !!r.costPartial,
    costStateUSD: r.costStateUSD,
    recovered: r.recovered,
    tokens: Object.fromEntries(TOKEN_KINDS.map((k) => [k, r.tokens[k]])),
    cacheHit: r.cacheHit,
    ctxAvg: r.ctxAvg,
    ctxPeak: r.ctxPeak,
    calls: r.calls,
    launches: r.launches,
    resumes: r.resumes,
    reworkShare: r.reworkShare,
    gateBlocks: r.gateBlocks,
    review: r.review,
    criteria: r.criteria,
    prompts: r.prompts,
    handbacks: r.handbacks,
    notifications: r.notifications,
    lines: r.lines,
    phases: Object.fromEntries(
      Object.entries(r.phases).map(([k, p]) => [
        k,
        { rounds: p.rounds, activeMin: p.activeMin, costUSD: p.costUSD },
      ])
    ),
    pricingDate: r.pricingDate,
    idleMin: r.idleMin,
    toolMin: r.toolMin,
    phaseSource: r.phaseSource,
    reworkSource: r.reworkSource,
    gateSource: r.gateSource,
  };
}

function gateTotal(g) {
  return g ? Object.values(g).reduce((s, n) => s + n, 0) : null;
}

const delta = (a, b, digits) => (a == null || b == null ? null : round(a - b, digits));

/** One row per history line with the delta against the previous line of the file. */
export function compareLines(lines) {
  return lines.map((l, i) => {
    const prev = lines[i - 1];
    const gates = gateTotal(l.gateBlocks);
    const comparable = !!prev && !!l.gateSource && l.gateSource === prev.gateSource;
    // D4: a partial cost (`record --force`) is a lower bound, so no cost delta next to it.
    const costComparable = !!prev && !l.costPartial && !prev.costPartial;
    return {
      feature: l.feature,
      issue: l.issue ?? null,
      recordedAt: l.recordedAt,
      costUSD: l.costUSD,
      costPartial: !!l.costPartial,
      dCostUSD: costComparable ? delta(l.costUSD, prev.costUSD, 2) : null,
      costComparable: prev ? costComparable : null,
      activeMin: l.activeMin,
      dActiveMin: prev ? delta(l.activeMin, prev.activeMin, 1) : null,
      reworkShare: l.reworkShare,
      dReworkShare: prev ? delta(l.reworkShare, prev.reworkShare, 3) : null,
      gateBlocks: gates,
      gateSource: l.gateSource ?? null,
      // Counts of different sources are not comparable (data-flow section 4): no delta.
      dGateBlocks: comparable ? delta(gates, gateTotal(prev.gateBlocks), 0) : null,
      gatesComparable: prev ? comparable : null,
      // D13 turn inputs, shown without a delta; null for a line that lacks the field.
      prompts: l.prompts ?? null,
      handbacks: l.handbacks ?? null,
      notifications: l.notifications ?? null,
    };
  });
}

// ---------- reconciliation (definitions section 5) ----------

/**
 * Per model and kind: transcript sum (D1) against the cost-state of the session's processes, plus
 * the dollar totals and the pricing self-check. A process shared with other sessions (`related`,
 * full sessions) is apportioned by transcript cost, its tokens scaled by the same share.
 */
export function reconcileSession(session, pricing, related = []) {
  const processes = scopeProcesses([session, ...related], [session.sessionId], pricing);
  const reqs = scopeThreads([session]).flatMap((th) => th.requests);
  const { byModel, skipped } = usageByModel(reqs);
  // D4: the priced part, `null` when nothing is priced (n/a, never zero).
  const sessionCost = costOf(byModel, pricing);
  const sessionUSD = sessionCost.costUSD;
  const csModels = {};
  let costStateUSD = null;
  let shareUnknown = false;
  for (const p of processes) {
    const wholly = p.sessionIds.every((id) => id === session.sessionId);
    const share = processShare(wholly, sessionUSD, p.wholeCostUSD);
    if (share == null) {
      shareUnknown = true;
      continue;
    }
    costStateUSD = (costStateUSD ?? 0) + p.record.totalCostUSD * share;
    for (const [model, u] of Object.entries(p.record.modelUsage || {})) {
      const m = (csModels[model.replace(/\[[^\]]*\]$/, '')] ??= {});
      for (const [k, v] of Object.entries(u)) m[k] = (m[k] || 0) + (v || 0) * share;
    }
  }
  // As on the card: one process without a share leaves the cost-state side n/a.
  if (shareUnknown) {
    costStateUSD = null;
    for (const k of Object.keys(csModels)) delete csModels[k];
  }
  const models = [...new Set([...Object.keys(byModel), ...Object.keys(csModels)])].sort();
  const rows = [];
  for (const model of models) {
    const u = byModel[model] || { calls: 0, ...emptyTokens() };
    const c = csModels[model];
    const price = priceOf(model, pricing);
    const cost = price ? tokensCost(u, price) : null;
    const int = (x) => (x == null ? null : Math.round(x));
    const kinds = [
      ['input', u.input, int(c?.inputTokens)],
      ['cacheWrite5m', u.cacheWrite5m, null],
      ['cacheWrite1h', u.cacheWrite1h, null],
      ['cacheWrite', u.cacheWrite5m + u.cacheWrite1h, int(c?.cacheCreationInputTokens)],
      ['cacheRead', u.cacheRead, int(c?.cacheReadInputTokens)],
      ['output', u.output, int(c?.outputTokens)],
      ['thinking', u.thinking, int(c?.thinkingTokens)],
      ['costUSD', usd(cost), usd(c?.costUSD ?? null)],
    ];
    for (const [kind, transcript, state] of kinds)
      rows.push({
        model,
        kind,
        transcript,
        costState: state ?? null,
        ratio: state ? round(transcript / state, 3) : null,
      });
  }
  const check = pricingCheck(processes, pricing);
  return {
    sessionId: session.sessionId,
    hasCostState: processes.length > 0,
    processes: processes.map((p) => ({
      startTime: p.startTime,
      totalCostUSD: usd(p.record.totalCostUSD),
      sessions: p.sessionIds.length,
    })),
    shared: processes.some((p) => p.sessionIds.length > 1),
    rows,
    transcriptUSD: usd(sessionUSD),
    transcriptPartial: sessionCost.warnings.length > 0,
    costStateUSD: usd(costStateUSD),
    recovered: costStateUSD && sessionUSD != null ? round(sessionUSD / costStateUSD, 3) : null,
    pricingCheck: check,
    pricingOk: processes.length
      ? Object.values(check).every((c) => c.divergence != null && c.divergence <= PRICING_TOLERANCE)
      : null,
    skipped,
    contextTokens: Object.values(byModel).reduce((s, u) => s + u.context, 0),
    requests: reqs.length - skipped,
    pricingDate: pricing?.recordedAt ?? null,
  };
}

// ---------- rendering (texts: scripts/i18n/pipeline*.properties, metrics.*) ----------

export function fmtDuration(min, bundle) {
  if (min == null) return t(bundle, 'metrics.card.na');
  const m = Math.round(min);
  const [d, h, mm] = [Math.floor(m / 1440), Math.floor((m % 1440) / 60), m % 60];
  const u = (k) => t(bundle, `metrics.unit.${k}`);
  if (d) return `${d}${u('day')} ${h}${u('hour')}`;
  if (h) return `${h}${u('hour')} ${mm}${u('minute')}`;
  return `${mm}${u('minute')}`;
}

export function fmtTokens(n) {
  if (n == null) return '-';
  if (n >= 1e8) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e5) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

const fmtUSD = (x) => (x == null ? '-' : `$${x.toFixed(2)}`);
/** A cost cell (D4): n/a when nothing is priced; `≥` marks a priced part (a model has no price). */
const fmtCost = (x, partial, bundle) =>
  x == null ? t(bundle, 'metrics.card.na') : `${partial ? '≥' : ''}${fmtUSD(x)}`;
const fmtPct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);
const fmtInt = (n) => (n == null ? '-' : n.toLocaleString('en-US'));
const signed = (x, f) => (x == null ? '-' : `${x > 0 ? '+' : x < 0 ? '-' : '±'}${f(Math.abs(x))}`);
const day = (iso) => (iso ? iso.slice(0, 10) : '-');

/** The pricing self-check as one phrase: within the tolerance, or the models off by more. */
function pricingText(check, ok, bundle) {
  const tol = fmtPct(PRICING_TOLERANCE);
  if (ok) return t(bundle, 'metrics.card.pricing.ok', tol);
  const off = Object.entries(check || {})
    .filter(([, c]) => c.divergence == null || c.divergence > PRICING_TOLERANCE)
    .map(([m, c]) => `${m} ${c.divergence == null ? '?' : fmtPct(c.divergence)}`)
    .join(', ');
  return t(bundle, 'metrics.card.pricing.warn', off, tol);
}

function summaryLine(r, bundle) {
  const na = t(bundle, 'metrics.card.na');
  const total = gateTotal(r.gateBlocks);
  let gates = na;
  if (total != null && r.gateSource === 'stop-hook-summary')
    gates = t(bundle, 'metrics.card.gates.history', total);
  else if (total)
    gates = t(
      bundle,
      'metrics.card.gates',
      total,
      Object.entries(r.gateBlocks)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(', ')
    );
  else if (total === 0) gates = t(bundle, 'metrics.card.gates.zero');
  const mcp = r.mcp
    ? t(
        bundle,
        'metrics.card.mcp',
        r.mcp.queries,
        r.mcp.unjustified,
        r.mcp.failed,
        r.mcp.withQuery,
        r.mcp.ruledEdits
      )
    : na;
  let line = t(
    bundle,
    'metrics.card.summary',
    gates,
    r.review ? t(bundle, 'metrics.card.review', r.review.blocking, r.review.total) : na,
    r.criteria ? `${r.criteria.closed}/${r.criteria.total}` : na,
    mcp,
    r.prompts,
    r.handbacks,
    r.notifications,
    r.lines ? `+${r.lines.added} / -${r.lines.removed}` : na
  );
  if (r.compactions != null) line += `; ${t(bundle, 'metrics.card.compactions', r.compactions)}`;
  return line;
}

/** The Markdown card of a session or feature report. */
export function renderCard(r, bundle) {
  const dur = (m) => fmtDuration(m, bundle);
  const title =
    r.scope === 'feature'
      ? t(bundle, 'metrics.card.title.feature', r.feature, r.issue ? ` (#${r.issue})` : '')
      : t(bundle, 'metrics.card.title.session', r.sessionIds[0]);
  let time = t(
    bundle,
    'metrics.card.time',
    r.sessions,
    day(r.firstTs),
    day(r.lastTs),
    dur(r.leadMin),
    dur(r.activeMin),
    dur(r.waitingMin),
    dur(r.agentMin),
    r.parallelism == null ? '-' : r.parallelism.toFixed(1),
    r.idleMin,
    r.toolMin,
    t(
      bundle,
      r.phaseSource === 'markers' ? 'metrics.card.phases.markers' : 'metrics.card.phases.fallback'
    ),
    t(
      bundle,
      r.reworkSource === 'plan' ? 'metrics.card.rework.plan' : 'metrics.card.rework.fallback'
    ),
    r.pricingDate ?? '-',
    r.versions.join(', ') || '-'
  );
  if (r.scope === 'feature' && !r.specAttributed)
    time += `; ${t(bundle, 'metrics.card.spec.none')}`;
  // No cost-state record in scope, or records whose share of the scope is unknown (nothing priced).
  const csNone = r.costStateProcesses
    ? 'metrics.card.costState.shareUnknown'
    : 'metrics.card.costState.none';
  const cs =
    r.costStateUSD == null
      ? t(bundle, csNone)
      : t(
          bundle,
          'metrics.card.costState',
          fmtUSD(r.costStateUSD),
          fmtPct(r.recovered),
          pricingText(r.pricingCheck, r.pricingOk, bundle)
        );
  const cost = t(
    bundle,
    'metrics.card.cost',
    fmtCost(r.costUSD, r.costPartial, bundle),
    cs,
    fmtTokens(r.tokens.input),
    fmtTokens(r.tokens.cacheWrite5m + r.tokens.cacheWrite1h),
    fmtTokens(r.tokens.cacheRead),
    fmtTokens(r.tokens.output),
    fmtPct(r.cacheHit),
    fmtTokens(r.ctxAvg),
    fmtTokens(r.ctxPeak)
  );
  const money = (x, partial) => fmtCost(x, partial, bundle);
  const phaseRows = Object.entries(r.phases).map(
    ([k, p]) =>
      `| ${k} | ${p.rounds ?? '-'} | ${dur(p.activeMin)} | ${dur(p.waitingMin)} | ${p.calls} | ${money(p.costUSD, p.costPartial)} | ${money(p.reworkUSD, p.reworkPartial)} |`
  );
  const agentRows = r.agents.map(
    (a) =>
      `| ${a.agentType} | ${a.launches ?? '-'} | ${a.resumes ?? '-'} | ${dur(a.activeMin)} | ${a.calls} / ${a.maxTurns ?? '-'} | ${money(a.costUSD, a.costPartial)} | ${a.reworkLaunches ? `${a.reworkLaunches} (${money(a.reworkUSD, a.reworkPartial)})` : '0'} |`
  );
  if (r.unattributedUSD != null)
    agentRows.push(
      `| ${t(bundle, 'metrics.card.unattributed')} | | | | | ${fmtUSD(r.unattributedUSD)} | |`
    );
  const out = [
    `## ${title}`,
    '',
    time,
    '',
    cost,
    '',
    t(bundle, 'metrics.card.phaseHeader'),
    '|---|---|---|---|---|---|---|',
    ...phaseRows,
    '',
    t(bundle, 'metrics.card.agentHeader'),
    '|---|---|---|---|---|---|---|',
    ...agentRows,
    '',
    summaryLine(r, bundle),
  ];
  if (r.warnings.length) out.push('', t(bundle, 'metrics.card.warnings', r.warnings.join(', ')));
  return out.join('\n');
}

/** The `compare` table. */
export function renderCompare(rows, bundle) {
  const dur = (m) => fmtDuration(m, bundle);
  const pp = (x) => `${Math.round(x * 100)} ${t(bundle, 'metrics.unit.pp')}`;
  const na = t(bundle, 'metrics.card.na');
  const inputs = (r) => [r.prompts, r.handbacks, r.notifications].map((n) => n ?? na).join(' / ');
  return [
    t(bundle, 'metrics.compare.header'),
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.feature}${r.issue ? ` (#${r.issue})` : ''} | ${r.recordedAt} | ${fmtCost(r.costUSD, r.costPartial, bundle)} | ${r.costComparable === false ? na : signed(r.dCostUSD, fmtUSD)} | ${dur(r.activeMin)} | ${signed(r.dActiveMin, dur)} | ${fmtPct(r.reworkShare)} | ${signed(r.dReworkShare, pp)} | ${r.gateBlocks ?? '-'} | ${r.gatesComparable === false ? na : signed(r.dGateBlocks, String)} | ${inputs(r)} |`
    ),
  ].join('\n');
}

/** The SessionStart briefing line of a history line (data-flow section 6); no regression logic in v1. */
export function renderBriefingLine(l, bundle) {
  return t(
    bundle,
    'metrics.briefing',
    l.feature,
    l.issue ? ` (#${l.issue})` : '',
    fmtCost(l.costUSD, l.costPartial, bundle),
    fmtDuration(l.activeMin, bundle),
    fmtPct(l.reworkShare)
  );
}

/** The `reconcile` table. */
export function renderReconcile(rec, bundle) {
  const cell = (row, v) => (row.kind === 'costUSD' ? fmtUSD(v) : fmtInt(v));
  const out = [`## ${t(bundle, 'metrics.reconcile.title', rec.sessionId)}`, ''];
  if (!rec.hasCostState) out.push(t(bundle, 'metrics.reconcile.none', rec.sessionId), '');
  if (rec.shared) out.push(t(bundle, 'metrics.reconcile.shared'), '');
  out.push(
    t(bundle, 'metrics.reconcile.header'),
    '|---|---|---|---|---|',
    ...rec.rows.map(
      (row) =>
        `| ${row.model} | ${row.kind} | ${cell(row, row.transcript)} | ${cell(row, row.costState)} | ${fmtPct(row.ratio)} |`
    ),
    '',
    t(
      bundle,
      'metrics.reconcile.total',
      fmtCost(rec.transcriptUSD, rec.transcriptPartial, bundle),
      fmtUSD(rec.costStateUSD),
      fmtPct(rec.recovered),
      rec.skipped,
      rec.pricingDate ?? '-'
    )
  );
  if (rec.hasCostState) {
    const models = Object.entries(rec.pricingCheck)
      .map(([m, c]) => `${m} ${c.divergence == null ? '?' : `${(c.divergence * 100).toFixed(1)}%`}`)
      .join(', ');
    out.push(
      t(
        bundle,
        rec.pricingOk ? 'metrics.reconcile.pricing' : 'metrics.reconcile.pricing.warn',
        fmtPct(PRICING_TOLERANCE),
        models
      )
    );
  }
  return out.join('\n');
}
