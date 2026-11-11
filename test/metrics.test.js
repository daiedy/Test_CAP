// Pipeline metrics (ADR-0022): the transcript parser, the aggregation and the CLI, pinned on the
// synthetic fixture of test/fixtures/transcript-fixture.mjs. Pure functions, no server, no real
// transcript: the fixture is written into a temp directory, and the CLI is pointed at it through
// CLAUDE_CONFIG_DIR. Every expected figure is computed by hand in the fixture file from
// docs/metrics/definitions.md, never copied from the code's output.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  readJsonl,
  projectDir,
  loadSession,
  costState,
  slim,
  requests,
  scopeThreads,
  usageByModel,
  timelinePoints,
  deliveredReports,
} from '../scripts/lib/transcript-usage.mjs';
import {
  IDLE_MS,
  TOOL_MS,
  PRICING_TOLERANCE,
  DRIFT_MAX,
  loadPricing,
  activeTime,
  priceOf,
  costOf,
  sumCost,
  phaseOf,
  phaseMarkers,
  planAssignments,
  planApproved,
  permalinkCommit,
  reworkOf,
  processesOf,
  processShare,
  scopeProcesses,
  buildReport,
  promptWindows,
  featureRecords,
  sessionReport,
  featureReport,
  reviewCounts,
  criteriaCounts,
  historyLine,
  compareLines,
  reconcileSession,
  renderCard,
  renderCompare,
  renderReconcile,
  renderContext,
} from '../scripts/lib/pipeline-metrics.mjs';
import { loadBundle } from '../scripts/lib/backlog.mjs';
import {
  SESSIONS,
  EXPECTED,
  VERSION,
  EVENT_LOG,
  DEMO_EVENTS,
  TIME_EVENTS,
  MISSING_AGENT_EVENTS,
  PLAN_STEPS,
  PLAN_NO_PHASE,
  PLAN_UNNUMBERED,
  OPUS,
  SONNET,
  SONNET_55,
  UNKNOWN_MODEL,
  ms,
  iso,
  writeFixture,
  CONTEXT_ROOT,
  CONTEXT_EXPECTED,
} from './fixtures/transcript-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const pricing = loadPricing(root);
const bundle = loadBundle('en', root);
const MIN = 60_000;

let home;
let dir;

beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-fixture-'));
  dir = writeFixture(projectDir(root, home));
});

afterAll(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

const load = (id) => loadSession(dir, id);
/** Timeline points between two minutes of a fixture day, both ends included. */
const between = (points, day, from, to) =>
  points.filter((p) => p.t >= ms(day, from) && p.t <= ms(day, to));
const minutesOf = (points, caps) => activeTime(points, caps) / MIN;

/**
 * scripts/metrics.mjs against the fixture: CLAUDE_CONFIG_DIR points the transcript lookup at the
 * temp home. `feature` and `record` always ask `gh` for the issues; with an empty GH_CONFIG_DIR and
 * no token it fails at once without a network call and the lookup falls back to the cache, so the
 * result does not depend on `gh`; the fixture feature names need no issue number.
 */
function cli(args) {
  const env = {
    ...process.env,
    CLAUDE_CONFIG_DIR: home,
    GH_CONFIG_DIR: path.join(home, 'gh'),
    PIPELINE_LANG: 'en',
  };
  for (const k of ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'])
    delete env[k];
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'metrics.mjs'), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

/** The keys of a history line (docs/metrics/data-flow.md section 4, fix round 1 fields included). */
const HISTORY_KEYS = [
  'feature',
  'issue',
  'recordedAt',
  'sessions',
  'leadMin',
  'activeMin',
  'waitingMin',
  'agentMin',
  'costUSD',
  'costPartial',
  'costStateUSD',
  'recovered',
  'tokens',
  'cacheHit',
  'ctxAvg',
  'ctxPeak',
  'calls',
  'launches',
  'resumes',
  'reworkShare',
  'gateBlocks',
  'review',
  'criteria',
  'prompts',
  'handbacks',
  'notifications',
  'lines',
  'context',
  'phases',
  'pricingDate',
  'idleMin',
  'toolMin',
  'phaseSource',
  'reworkSource',
  'gateSource',
];
/** The D13 figures of a report or a history line. */
const turnInputsOf = ({ prompts, handbacks, notifications }) => ({
  prompts,
  handbacks,
  notifications,
});

/** Allowed key paths of a transcript record (docs/metrics/data-flow.md section 5, definitions section 1). */
const TRANSCRIPT_KEYS = new Set([
  'type',
  'timestamp',
  'uuid',
  'requestId',
  'agentId',
  'gitBranch',
  'version',
  'subtype',
  'toolUseResult',
  'hookErrors',
  'message',
  'message.model',
  'message.usage',
  'message.usage.input_tokens',
  'message.usage.cache_creation_input_tokens',
  'message.usage.cache_creation',
  'message.usage.cache_creation.ephemeral_5m_input_tokens',
  'message.usage.cache_creation.ephemeral_1h_input_tokens',
  'message.usage.cache_read_input_tokens',
  'message.usage.output_tokens',
  'message.usage.output_tokens_details',
  'message.usage.output_tokens_details.thinking_tokens',
  'message.content',
  'message.content[].type',
  'message.content[].name',
  'message.content[].id',
  'message.content[].input',
  'message.content[].input.subagent_type',
  'message.content[].input.to',
  // D14-D18 (context-hygiene step 7): tool-use ids, Read/Edit/Write paths and ranges, the Bash
  // command (only its program class survives), tool results by id, length and error flag, the
  // hook context attachment; `compact_boundary` is a `subtype` value.
  'message.content[].input.file_path',
  'message.content[].input.offset',
  'message.content[].input.limit',
  'message.content[].input.pages',
  'message.content[].input.command',
  'message.content[].tool_use_id',
  'message.content[].content',
  'message.content[].is_error',
  'attachment.hookEvent',
  'attachment.content',
  // D13 (fix round 1): the kind of a turn input, on a `user` and a `queued_command` record.
  'origin',
  'origin.kind',
  'attachment',
  'attachment.type',
  'attachment.commandMode',
  'attachment.origin',
  'attachment.origin.kind',
  'startTime',
  'totalCostUSD',
  'modelUsage',
  'modelUsage.*',
  'modelUsage.*.inputTokens',
  'modelUsage.*.outputTokens',
  'modelUsage.*.thinkingTokens',
  'modelUsage.*.cacheReadInputTokens',
  'modelUsage.*.cacheCreationInputTokens',
  'modelUsage.*.costUSD',
  'totalAPIDuration',
  'totalToolDuration',
  'totalDuration',
  'totalLinesAdded',
  'totalLinesRemoved',
  'hasUnknownModelCost',
]);
const META_KEYS = new Set(['agentType', 'toolUseId']);
/** Allowed key paths of an event-log record (docs/metrics/data-flow.md section 2). */
const EVENT_KEYS = new Set([
  'ts',
  'event',
  'source',
  'transcriptPath',
  'branch',
  'command',
  'arg',
  'agent',
  'agentType',
  'model',
  'requests',
  'tokens',
  'tokens.input',
  'tokens.cacheWrite5m',
  'tokens.cacheWrite1h',
  'tokens.cacheRead',
  'tokens.output',
  'costUSD',
  'activeMin',
  'leadMin',
  'toolCalls',
  'firstTs',
  'lastTs',
  'hook',
  'reason',
  'feature',
  'phase',
  'raw',
  'trigger',
  'blocked',
]);

/** Every key path of a record (`a.b`, `a[].b`; the model names under `modelUsage` as `*`). */
function keyPaths(value, prefix = '', out = []) {
  if (Array.isArray(value)) {
    for (const v of value) keyPaths(v, `${prefix}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = prefix === 'modelUsage' ? 'modelUsage.*' : prefix ? `${prefix}.${k}` : k;
      out.push(p);
      keyPaths(v, p, out);
    }
  }
  return out;
}

/** Every string value of a record. */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function filesUnder(d) {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(d, e.name)) : [path.join(d, e.name)]));
}

describe('pipeline metrics (ADR-0022)', () => {
  it('counts one usage per request with the field maximum', () => {
    const E = EXPECTED.demo;
    const a = load('a-main');
    const b = load('b-resumed');

    // Within one file: identical records count once, a growing stream gives the per-field maximum.
    const main = requests(a.main);
    expect(main.find((q) => q.requestId === 'r-main-1').usage).toMatchObject(E.identical);
    const sub = requests(a.agents.find((x) => x.id === 'a1').records);
    expect(sub.find((q) => q.requestId === 'r-a1-1').usage).toMatchObject(E.growing);
    const nullStop = sub.filter((q) => q.requestId === 'r-a1-2');
    expect(nullStop).toHaveLength(1);
    expect(nullStop[0].usage).toMatchObject(E.nullStop);

    // Across the files of a scope: the request copied into b-resumed counts once and belongs to
    // the main thread of the first file in the D1 order.
    const threads = scopeThreads([b, a]);
    const all = threads.flatMap((th) => th.requests);
    expect(all).toHaveLength(E.requests);
    const copied = all.filter((q) => q.requestId === 'r-main-2');
    expect(copied).toHaveLength(1);
    expect(copied[0].sessionId).toBe('a-main');
    const owner = threads.find((th) => th.requests.includes(copied[0]));
    expect(owner).toMatchObject({ agent: 'main', sessionId: 'a-main' });

    // A copied record is one timeline point, not two.
    const points = threads.reduce((n, th) => n + timelinePoints(th.records).length, 0);
    expect(points).toBe(E.points);
    const resumed = threads.find((th) => th.key === 'main:b-resumed');
    expect(resumed.records.some((r) => r.uuid === 'a-m-a4')).toBe(false);
    expect(resumed.requests.map((q) => q.requestId).sort()).toEqual(['r-b-1', 'r-b-2']);
  });

  it('splits tokens by kind and model and skips synthetic records', () => {
    const E = EXPECTED.demo;
    const reqs = scopeThreads([load('a-main')]).flatMap((th) => th.requests);
    const { byModel, skipped } = usageByModel(reqs);

    expect(Object.keys(byModel).sort()).toEqual([OPUS, SONNET]);
    expect(byModel[OPUS]).toMatchObject(E.opus);
    expect(byModel[SONNET]).toMatchObject(E.sonnet);
    expect(skipped).toBe(E.skipped);
    // The 5m and 1h writes stay apart and add up to cache_creation_input_tokens.
    for (const q of reqs)
      expect(q.usage.cacheWrite5m + q.usage.cacheWrite1h).toBe(q.usage.cacheWrite);
  });

  it('caps idle and tool gaps on the merged timeline', () => {
    const E = EXPECTED.time;
    const threads = scopeThreads([load('c-time')]);
    const main = timelinePoints(threads.find((th) => th.agent === 'main').records);
    const sub = timelinePoints(threads.find((th) => th.agent === 'c1').records);
    const merged = [...main, ...sub].sort((x, y) => x.t - y.t);

    expect(IDLE_MS).toBe(5 * MIN);
    expect(TOOL_MS).toBe(10 * MIN);
    // A 12-minute Bash gap counts 10, a 40-minute turn gap 5, an 8-minute AskUserQuestion gap 5.
    expect(minutesOf(between(main, 1, 1, 13))).toBe(10);
    expect(minutesOf(between(main, 1, 14, 54))).toBe(5);
    expect(minutesOf(between(main, 1, 55, 63))).toBe(5);
    // The Agent wait: 6 minutes filled by the subagent on the merged timeline, 5 on main alone.
    expect(minutesOf(between(main, 1, 64, 70))).toBe(5);
    expect(minutesOf(between(merged, 1, 64, 70))).toBe(6);

    expect(minutesOf(merged)).toBeCloseTo(E.mergedMin, 6);
    expect(minutesOf(main)).toBeCloseTo(E.mainMin, 6);
    expect(minutesOf(sub)).toBeCloseTo(E.agentMin, 6);
    expect(minutesOf(merged, { idleMs: 5 * MIN, toolMs: 5 * MIN })).toBeCloseTo(
      E.mergedTool5Min,
      6
    );
  });

  it('reports lead, waiting, agent-minutes and parallelism', () => {
    const E = EXPECTED.time;
    const report = sessionReport(load('c-time'), { pricing });

    expect(report).toMatchObject({
      leadMin: E.leadMin,
      activeMin: E.mergedMin,
      waitingMin: E.waitingMin,
      agentMin: E.agentMinutes,
      parallelism: E.parallelism,
      launches: 1,
      resumes: E.resumes,
      idleMin: 5,
      toolMin: 10,
    });
    expect(report.agents).toEqual([
      expect.objectContaining({ agentType: 'main', activeMin: E.mainMin }),
      expect.objectContaining({
        agentType: 'cap-backend-dev',
        launches: 1,
        resumes: 1,
        activeMin: E.agentMin,
      }),
    ]);
  });

  it('prices tokens from model-pricing.json and warns on an unknown model', () => {
    const E = EXPECTED.demo;
    const reqs = scopeThreads([load('a-main')]).flatMap((th) => th.requests);
    const { byModel } = usageByModel(reqs);

    expect(priceOf(OPUS, pricing)).toEqual(pricing.perMTok[OPUS]);
    const cost = costOf(byModel, pricing);
    expect(cost.byModel[OPUS]).toBeCloseTo(E.opusUSD, 9);
    expect(cost.byModel[SONNET]).toBeCloseTo(E.sonnetUSD, 9);
    expect(cost.costUSD).toBeCloseTo(E.opusUSD + E.sonnetUSD, 9);
    expect(cost.warnings).toEqual([]);
    // 5m and 1h cache writes at their own rates, not every write at the 1h rate.
    expect(Math.abs(cost.byModel[OPUS] - E.opusAll1hUSD)).toBeGreaterThan(0.3);
    // The prices come from the table passed in: doubling the table doubles the cost.
    const doubled = {
      perMTok: {
        [OPUS]: Object.fromEntries(
          Object.entries(pricing.perMTok[OPUS]).map(([k, v]) => [k, 2 * v])
        ),
      },
    };
    expect(costOf({ [OPUS]: byModel[OPUS] }, doubled).costUSD).toBeCloseTo(2 * E.opusUSD, 9);

    // An unknown model: null for that model and a warning, never a silent zero.
    const f = load('f-unknown');
    const unknown = usageByModel(scopeThreads([f]).flatMap((th) => th.requests)).byModel;
    const fCost = costOf(unknown, pricing);
    expect(fCost.byModel[UNKNOWN_MODEL]).toBeNull();
    expect(fCost.warnings).toEqual([`unknown-model:${UNKNOWN_MODEL}`]);
    expect(fCost.costUSD).toBeCloseTo(EXPECTED.unknown.pricedUSD, 9);
    expect(costOf({ [UNKNOWN_MODEL]: unknown[UNKNOWN_MODEL] }, pricing).costUSD).toBeNull();
    const report = sessionReport(f, { pricing });
    expect(report.warnings).toContain(`unknown-model:${UNKNOWN_MODEL}`);
    expect(report.byModel[UNKNOWN_MODEL].costUSD).toBeNull();
    expect(report.pricingDate).toBe(pricing.recordedAt);
    // The D4 seed row of the model docs-keeper, ui-verifier and upstream-watcher resolve to (F2).
    expect(priceOf(SONNET_55, pricing)).toEqual({
      input: 2,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
      cacheRead: 0.2,
      output: 10,
    });

    // D4 partial cost over parts: the priced parts summed, partial when a part holds an unpriced
    // model, null when no part is priced, 0 only when nothing was requested.
    expect(sumCost([])).toEqual({ costUSD: 0, partial: false });
    expect(sumCost([{ calls: 1, costUSD: null }])).toEqual({ costUSD: null, partial: true });
    expect(
      sumCost([
        { calls: 1, costUSD: 0.5 },
        { calls: 1, costUSD: null },
      ])
    ).toEqual({
      costUSD: 0.5,
      partial: true,
    });
    expect(
      sumCost([
        { calls: 2, costUSD: 0.25, costPartial: true },
        { calls: 1, costUSD: 0.5 },
      ])
    ).toEqual({ costUSD: 0.75, partial: true });
    // A part without calls prices nothing and is neutral.
    expect(
      sumCost([
        { calls: 0, costUSD: null },
        { calls: 1, costUSD: 0.5 },
      ])
    ).toEqual({
      costUSD: 0.5,
      partial: false,
    });

    // A row that mixes a priced and an unpriced model is the priced part, printed `≥$`.
    expect(report).toMatchObject({ costUSD: EXPECTED.unknown.pricedUSD, costPartial: true });
    expect(report.agents).toEqual([
      expect.objectContaining({ agentType: 'main', costUSD: 0.1, costPartial: true }),
    ]);
    expect(report.phases.orchestration).toMatchObject({ costUSD: 0.1, costPartial: true });
    const mixed = renderCard(report, bundle);
    expect(mixed).toContain('Cost ≥$0.10 (no cost-state record)');
    expect(mixed).toMatch(/^\| orchestration \|.*\| ≥\$0\.10 \| \$0\.00 \|$/m);
    expect(mixed).toMatch(/^\| main \|.*\| ≥\$0\.10 \| 0 \|$/m);

    // Only an unpriced model: null and n/a, never a silent $0.00, and no rework share.
    const k = load('k-unpriced');
    const none = sessionReport(k, { pricing });
    expect(none).toMatchObject({ costUSD: null, costPartial: true, reworkShare: null });
    expect(none.agents).toEqual([
      expect.objectContaining({ agentType: 'main', costUSD: null, costPartial: true }),
    ]);
    // Card and reconcile agree on the process total: its only session is the scope (share 1).
    const U = EXPECTED.unknown;
    expect(none).toMatchObject({
      costStateUSD: U.unpricedCostStateUSD,
      recovered: null,
      unattributedUSD: U.unpricedCostStateUSD,
    });
    const na = renderCard(none, bundle);
    expect(na).toContain('Cost n/a (cost-state $0.50, recovered -;');
    expect(na).toMatch(/^\| main \|.*\| n\/a \| 0 \|$/m);
    expect(na).toMatch(/^\| unattributed \|.*\| \$0\.50 \|/m);
    // reconcile: no transcript total and no recovered ratio next to the process total.
    const rec = reconcileSession(k, pricing);
    expect(rec).toMatchObject({
      transcriptUSD: null,
      transcriptPartial: true,
      costStateUSD: EXPECTED.unknown.unpricedCostStateUSD,
      recovered: null,
    });
    expect(renderReconcile(rec, bundle)).toContain(
      'Total: transcript n/a of cost-state $0.50, recovered -;'
    );
    // The same process shared with a second session, nothing priced: no basis for a split, so no
    // cost-state figure (never a silent share) and a warning naming the process.
    const other = { ...k, sessionId: 'k-other' };
    const shared = sessionReport(k, { pricing, related: [other] });
    expect(shared).toMatchObject({ costStateUSD: null, recovered: null, unattributedUSD: null });
    expect(shared.warnings).toContain(`cost-state-share-unknown:${U.unpricedStartTime}`);
    const sharedRec = reconcileSession(k, pricing, [other]);
    expect(sharedRec).toMatchObject({ transcriptUSD: null, costStateUSD: null, recovered: null });
    expect(renderReconcile(sharedRec, bundle)).toContain(
      'Total: transcript n/a of cost-state -, recovered -;'
    );
    // The card says why the figure is missing (share unknown), not that no record exists.
    const sharedCard = renderCard(shared, bundle);
    expect(sharedCard).toContain(
      '(cost-state n/a: its share of this scope is unknown, no model is priced)'
    );
    expect(sharedCard).not.toContain('(no cost-state record)');
    // Feature scope: every record with a gitBranch is on feature/fixture-unpriced (the cost-state
    // record has none, so `complete` ignores it), the process lies wholly in scope: share 1.
    const kFeature = featureReport([k], 'fixture-unpriced', { pricing });
    expect(kFeature).toMatchObject({ costUSD: null, costStateUSD: U.unpricedCostStateUSD });
    expect(kFeature.warnings.filter((w) => w.startsWith('cost-state-share-unknown'))).toEqual([]);
    expect(renderCard(kFeature, bundle)).not.toContain('(no cost-state record)');

    // `record` refuses a partial line; --force writes it, marked `costPartial: true`.
    const file = path.join(home, 'history-unknown.jsonl');
    const refused = cli(['record', 'fixture-unknown', '--history', file]);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain(
      `fixture-unknown has models without a price (${UNKNOWN_MODEL})`
    );
    expect(fs.existsSync(file)).toBe(false);
    const forced = cli(['record', 'fixture-unknown', '--history', file, '--force']);
    expect(forced.status, forced.stderr).toBe(0);
    expect(readJsonl(file)).toEqual([
      expect.objectContaining({ feature: 'fixture-unknown', costUSD: 0.1, costPartial: true }),
    ]);
  });

  it('reconciles against cost-state per process and warns on pricing drift', () => {
    const E = EXPECTED.cost;
    const D = EXPECTED.demo;

    // Priced tokens equal cost-state's costUSD: recovered ratio and unattributed row, no warning.
    const d = load('d-cost');
    const report = sessionReport(d, { pricing });
    expect(report).toMatchObject({
      costUSD: E.transcriptUSD,
      costStateUSD: E.costStateUSD,
      costStateProcesses: 1,
      recovered: E.recovered,
      unattributedUSD: E.unattributedUSD,
      pricingOk: true,
    });
    expect(report.pricingCheck[OPUS]).toEqual({
      costUSD: 1.948,
      lowUSD: E.opusLowUSD,
      highUSD: E.opusHighUSD,
      divergence: 0,
    });
    expect(report.pricingCheck[SONNET]).toEqual({
      costUSD: 0.052,
      lowUSD: E.sonnetLowUSD,
      highUSD: E.sonnetHighUSD,
      divergence: 0,
    });
    expect(report.warnings).toEqual([]);
    const card = renderCard(report, bundle);
    expect(card).toContain('recovered 90%');
    expect(card).toContain('pricing check within 5%');
    expect(card).toMatch(/\| unattributed \|.*\$0\.20/);
    const rec = reconcileSession(d, pricing);
    expect(rec).toMatchObject({
      transcriptUSD: E.transcriptUSD,
      costStateUSD: E.costStateUSD,
      recovered: E.recovered,
      pricingOk: true,
      requests: 2,
    });
    expect(rec.rows).toContainEqual({
      model: OPUS,
      kind: 'input',
      transcript: 1000,
      costState: 2000,
      ratio: 0.5,
    });

    // cost-state's costUSD 10% above the high end of its interval: a pricing warning on the card.
    const e = load('e-drift');
    const drift = sessionReport(e, { pricing });
    expect(drift.pricingOk).toBe(false);
    expect(drift.warnings).toEqual([`pricing-check:${OPUS}`]);
    expect(drift.pricingCheck[OPUS]).toEqual({
      costUSD: E.driftOpusCostUSD,
      lowUSD: E.opusLowUSD,
      highUSD: E.opusHighUSD,
      divergence: E.driftOpusDivergence,
    });
    expect(drift.pricingCheck[OPUS].divergence).toBeGreaterThan(PRICING_TOLERANCE);
    expect(drift.pricingCheck[SONNET].divergence).toBe(0);
    expect(renderCard(drift, bundle)).toContain(
      `WARNING pricing check off by more than 5%: ${OPUS}`
    );
    expect(reconcileSession(e, pricing).pricingOk).toBe(false);

    // The interval edges on e-drift's tokens, only its opus costUSD changed (low 1.648, high 2.248):
    // 2.0 inside -> 0; 2.36 below high * 1.05 = 2.3604 -> 0.112 / 2.248 = 0.0498, no warning;
    // 2.37 just above -> 0.122 / 2.248 = 0.0543, a warning; 1.5 below low -> 0.148 / 1.648 = 0.0898.
    const withOpusCost = (costUSD) => {
      const variant = structuredClone(e);
      const [last] = costState(variant.main);
      last.modelUsage[OPUS].costUSD = costUSD;
      last.totalCostUSD = costUSD + 0.052;
      return sessionReport(variant, { pricing });
    };
    for (const [costUSD, divergence, warns] of [
      [2, 0, false],
      [2.36, 0.0498, false],
      [2.37, 0.0543, true],
      [1.5, 0.0898, true],
    ]) {
      const r = withOpusCost(costUSD);
      expect(r.pricingCheck[OPUS], String(costUSD)).toEqual({
        costUSD,
        lowUSD: E.opusLowUSD,
        highUSD: E.opusHighUSD,
        divergence,
      });
      expect(r.pricingOk, String(costUSD)).toBe(!warns);
      expect(r.warnings, String(costUSD)).toEqual(warns ? [`pricing-check:${OPUS}`] : []);
    }

    // One process writing into two sessions: its last, larger total once, never the sum.
    const a = load('a-main');
    const b = load('b-resumed');
    const processes = processesOf([a, b]);
    expect(processes).toHaveLength(1);
    expect(processes[0].record.totalCostUSD).toBe(D.processUSD);
    expect(processes[0].sessionIds.sort()).toEqual(['a-main', 'b-resumed']);
    const whole = buildReport({
      scope: 'session',
      sessions: [a, b],
      processes: scopeProcesses([a, b], ['a-main', 'b-resumed'], pricing),
      pricing,
    });
    expect(whole).toMatchObject({ costUSD: D.wholeUSD, costStateUSD: D.processUSD });

    // The share of a process's total a scope carries (definitions section 5): 1 when the process
    // lies wholly in scope, whatever is priced; else the priced share, at most 1; no priced cost
    // and records outside the scope: no basis for a split (null).
    expect(processShare(true, null, 0)).toBe(1);
    expect(processShare(false, 1, 4)).toBe(0.25);
    expect(processShare(false, 5, 4)).toBe(1);
    expect(processShare(false, null, 0)).toBeNull();

    // A process whose sessions hold records outside the scope contributes its proportional share:
    // the feature cuts r-b-2 (on `main`) out of b-resumed, while c-time keeps every record.
    expect(featureRecords(b, 'fixture-demo').complete).toBe(false);
    expect(featureRecords(load('c-time'), 'fixture-time').complete).toBe(true);
    const feature = featureReport([a, b], 'fixture-demo', { pricing });
    expect(feature).toMatchObject({
      costUSD: D.featureUSD,
      costStateUSD: D.featureCostStateUSD,
      recovered: D.featureRecovered,
      unattributedUSD: D.featureUnattributedUSD,
    });
    expect(feature.warnings).toEqual([]);
  });

  it('attributes phases from markers and falls back to home phases', () => {
    const L = EXPECTED.live;
    const H = EXPECTED.history;
    const events = readJsonl(EVENT_LOG);

    // Markers 2, 3, 3, 2: the repeated 3 is no new round, the re-entered 2 is.
    expect(phaseMarkers(events).map((m) => m.phase)).toEqual(['2', '3', '2']);
    const live = sessionReport({ ...load('h-live'), events }, { pricing });
    expect(live.phaseSource).toBe('markers');
    expect(live.phases['2'].rounds).toBe(L.rounds[2]);
    expect(live.phases['3'].rounds).toBe(L.rounds[3]);
    expect(live.phases['0']?.rounds).toBeNull();
    for (const [phase, row] of Object.entries(L.phases))
      expect(live.phases[phase], `phase ${phase}`).toMatchObject(row);

    // Without markers: the home phase of each agent type, the main thread orchestrates, no rounds.
    const history = sessionReport(load('g-history'), { pricing });
    expect(history.phaseSource).toBe('home-phase');
    expect(Object.keys(history.phases).sort()).toEqual(Object.keys(H.phases).sort());
    for (const [phase, row] of Object.entries(H.phases))
      expect(history.phases[phase], `phase ${phase}`).toMatchObject({ rounds: null, ...row });

    // A `none` marker after completion still reads its phase number (PLAN Risks).
    expect(phaseOf('none (products-excel-upload #7 done)')).toBe('7');
    expect(phaseOf('none')).toBe('none');
  });

  it('flags rework launches', () => {
    const L = EXPECTED.live;
    const H = EXPECTED.history;
    const launch =
      (day) =>
      ([agentType, min]) => ({ agentType, ts: ms(day, min) });

    // History rule: a home phase lower than the highest launched before it.
    const history = [
      ['architect', 1],
      ['fiori-app-dev', 16],
      ['architect', 26],
      ['reviewer', 36],
    ].map(launch(4));
    expect(reworkOf(history, [])).toEqual(H.rework);
    const hReport = sessionReport(load('g-history'), { pricing });
    expect(hReport).toMatchObject({
      launches: 4,
      relaunches: 1,
      costUSD: H.costUSD,
      reworkUSD: H.reworkUSD,
      reworkShare: H.reworkShare,
    });
    expect(hReport.agents.find((x) => x.agentType === 'architect')).toMatchObject({
      launches: 2,
      reworkLaunches: 1,
      reworkUSD: H.reworkUSD,
    });

    // Live rule: the phase marker at launch differs from the home phase; a launch before the
    // first marker is in its home phase and no rework.
    const events = readJsonl(EVENT_LOG);
    const live = [
      ['architect', 1],
      ['cap-backend-dev', 21],
      ['fiori-app-dev', 41],
      ['test-backend', 61],
      ['architect', 71],
    ].map(launch(5));
    expect(reworkOf(live, phaseMarkers(events))).toEqual(L.rework);
    expect(reworkOf(live, [])).toEqual(L.historyRuleRework);
    const lReport = sessionReport({ ...load('h-live'), events }, { pricing });
    expect(lReport).toMatchObject({
      launches: 5,
      relaunches: 1,
      calls: L.calls,
      costUSD: L.costUSD,
      reworkUSD: 0.2,
      reworkShare: L.reworkShare,
    });
    expect(lReport.agents.find((x) => x.agentType === 'architect')).toMatchObject({
      launches: 2,
      reworkLaunches: 1,
    });
    expect(lReport.agents.find((x) => x.agentType === 'test-backend').reworkLaunches).toBe(0);

    // A launch is timed by its Agent block (`id` = the meta `toolUseId`), not by the agent's first
    // record: h1 launched at minute 1 stays a pre-marker launch (home phase 1, no rework) even when
    // its own records arrive after the first marker (minute 20).
    const late = load('h-live');
    const h1 = late.agents.find((x) => x.id === 'h1');
    expect(h1.toolUseId).toBe('tu-h1');
    h1.records = h1.records.map((r, k) => ({ ...r, ts: ms(5, 20.2 + 0.8 * k) }));
    const lateReport = sessionReport({ ...late, events }, { pricing });
    expect(lateReport.agents.find((x) => x.agentType === 'architect').reworkLaunches).toBe(1);
    expect(lateReport.phases['1']).toMatchObject(L.phases[1]);
  });

  it('joins a feature across sessions by branch and spec prompt', () => {
    const L = EXPECTED.live;
    const events = readJsonl(EVENT_LOG);
    const h = { ...load('h-live'), events };
    const i = load('i-branch');

    // `/spec #7` opens a window naming the feature; the plain prompt after it is no command marker.
    expect(promptWindows(events, 'fixture-live', 7)).toEqual([[ms(5, 0.5), Infinity]]);
    expect(promptWindows(events, 'fixture-live')).toEqual([]);
    const scoped = featureRecords(h, 'fixture-live', { issue: 7 });
    expect(scoped.main.map((r) => r.uuid)).not.toContain('h-m-a0');
    expect(scoped.agents.map((x) => x.id)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);

    // Branch and spec window together, per record: h-live from its /spec prompt, i-branch on the
    // feature branch only; a session without an in-scope record drops out.
    const joined = featureReport([h, i, load('a-main')], 'fixture-live', { issue: 7, pricing });
    expect(joined).toMatchObject({
      scope: 'feature',
      feature: 'fixture-live',
      issue: 7,
      sessions: L.feature.sessions,
      sessionIds: ['h-live', 'i-branch'],
      calls: L.feature.calls,
      costUSD: L.feature.costUSD,
      specAttributed: true,
      firstTs: iso(5, L.feature.firstMin),
      lastTs: iso(5, L.feature.lastMin),
    });

    // Without the issue number the /spec #7 window names nothing: the branch alone joins.
    const branchOnly = featureReport([h, i], 'fixture-live', { pricing });
    expect(branchOnly).toMatchObject({
      sessions: L.branchOnly.sessions,
      calls: L.branchOnly.calls,
      costUSD: L.branchOnly.costUSD,
      specAttributed: false,
      firstTs: iso(5, L.branchOnly.firstMin),
    });
    expect(renderCard(branchOnly, bundle)).toContain('spec: not attributed');
  });

  it('builds the history line and refuses a duplicate record', () => {
    const D = EXPECTED.demo;
    const I = EXPECTED.inputs;

    // `feature --json` over the fixture project dir carries every figure of the history line.
    const shown = cli(['feature', 'fixture-demo', '--json']);
    expect(shown.status, shown.stderr).toBe(0);
    const report = JSON.parse(shown.stdout);
    for (const k of HISTORY_KEYS.filter((x) => x !== 'recordedAt'))
      expect(report).toHaveProperty(k);
    expect(report).toMatchObject({
      feature: 'fixture-demo',
      sessions: 2,
      calls: D.featureCalls,
      skipped: D.skipped,
      launches: D.launches,
      activeMin: D.featureActiveMin,
      leadMin: D.featureLeadMin,
      costUSD: D.featureUSD,
      costPartial: false,
      costStateUSD: D.featureCostStateUSD,
      ...I.figures,
      // No approved PLAN for fixture-demo: the home-phase fallback, no plan commit.
      reworkSource: 'home-phase',
      planCommit: null,
      versions: [VERSION],
    });
    const line = historyLine(report, '2026-09-29');
    expect(Object.keys(line).sort()).toEqual([...HISTORY_KEYS].sort());
    expect(line).toMatchObject({ costPartial: false, reworkSource: 'home-phase', ...I.figures });
    expect(Object.keys(line.tokens)).toEqual([
      'input',
      'cacheWrite5m',
      'cacheWrite1h',
      'cacheRead',
      'output',
    ]);
    for (const p of Object.values(line.phases))
      expect(Object.keys(p).sort()).toEqual(['activeMin', 'costUSD', 'rounds']);

    // `record` appends one line, refuses the same feature again, and replaces it with --force.
    const file = path.join(home, 'history.jsonl');
    const first = cli(['record', 'fixture-demo', '--history', file]);
    expect(first.status, first.stderr).toBe(0);
    const recorded = readJsonl(file);
    expect(recorded).toHaveLength(1);
    expect(Object.keys(recorded[0]).sort()).toEqual([...HISTORY_KEYS].sort());
    expect(recorded[0]).toMatchObject({
      feature: 'fixture-demo',
      costUSD: D.featureUSD,
      costPartial: false,
      ...I.figures,
      recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    const duplicate = cli(['record', 'fixture-demo', '--history', file]);
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr).toContain('fixture-demo is already recorded');
    expect(readJsonl(file)).toHaveLength(1);
    const forced = cli(['record', 'fixture-demo', '--history', file, '--force']);
    expect(forced.status, forced.stderr).toBe(0);
    expect(readJsonl(file)).toHaveLength(1);

    // Live figures of the line: gate blocks by reason from the event log; the turn inputs from the
    // transcript (D13: 3 human prompts), not from the log's 2 `prompt` records.
    const events = readJsonl(EVENT_LOG);
    expect(events.filter((e) => e.event === 'prompt')).toHaveLength(2);
    const live = sessionReport({ ...load('h-live'), events }, { pricing });
    expect(historyLine(live, '2026-09-29')).toMatchObject({
      gateSource: 'events',
      gateBlocks: {
        lint: 1,
        mcp: 1,
        protected: 1,
        registry: 1,
        docs: 1,
        tests: 1,
        'tests-timeout': 1,
        'state-shape': 1,
        'state-budget': 1,
      },
      prompts: EXPECTED.live.prompts,
      handbacks: 0,
      notifications: 0,
      reworkSource: 'home-phase',
      costPartial: false,
    });
    // History fallback without an event log: Stop-hook summaries, the same D13 rule.
    const history = sessionReport(load('g-history'), { pricing });
    expect(historyLine(history, '2026-09-29')).toMatchObject({
      gateSource: 'stop-hook-summary',
      gateBlocks: EXPECTED.history.gateBlocks,
      prompts: EXPECTED.history.prompts,
      handbacks: 0,
      notifications: 0,
    });

    // The agent-stop aggregates match the re-parse cut at their lastTs; a skewed one is flagged.
    expect(live.warnings).toEqual([]);
    const skewed = events.map((e) =>
      e.event === 'agent-stop' && e.agent === 'h2'
        ? { ...e, tokens: { ...e.tokens, output: 40000 } }
        : e
    );
    expect(sessionReport({ ...load('h-live'), events: skewed }, { pricing }).warnings).toEqual([
      'agent-stop-drift:h2',
    ]);

    // Review and criteria figures: n/a without the reviewer's result format, never 0.
    expect(reviewCounts('# Review\n\nFindings follow in prose.\n- a remark\n')).toBeNull();
    expect(reviewCounts('## Blocking\n\n## Important\n- a\n- b\n\n## Minor\n- c\n')).toEqual({
      blocking: 0,
      total: 3,
    });
    expect(criteriaCounts('## Acceptance criteria\n- [x] a\n- [ ] b\n- [x] c\n')).toEqual({
      closed: 2,
      total: 3,
    });
  });

  it('compares history lines with deltas', () => {
    const lines = [
      {
        feature: 'alpha',
        issue: 5,
        recordedAt: '2026-09-20',
        costUSD: 10,
        activeMin: 100,
        reworkShare: 0.1,
        gateBlocks: { 'stop-gate': 2 },
        gateSource: 'stop-hook-summary',
      },
      {
        feature: 'beta',
        issue: 6,
        recordedAt: '2026-09-25',
        costUSD: 12.5,
        activeMin: 90,
        reworkShare: 0.25,
        gateBlocks: { 'stop-gate': 1 },
        gateSource: 'stop-hook-summary',
      },
      {
        feature: 'gamma',
        issue: null,
        recordedAt: '2026-09-29',
        costUSD: 11,
        activeMin: 120,
        reworkShare: 0.2,
        gateBlocks: { lint: 3, mcp: 1 },
        gateSource: 'events',
        // D13 fields of a fix-round line; alpha and beta lack them (lines recorded before).
        prompts: 7,
        handbacks: 29,
        notifications: 35,
      },
    ];
    const rows = compareLines(lines);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      feature: 'alpha',
      dCostUSD: null,
      dActiveMin: null,
      dReworkShare: null,
      gateBlocks: 2,
      dGateBlocks: null,
    });
    expect(rows[1]).toMatchObject({
      feature: 'beta',
      dCostUSD: 2.5,
      dActiveMin: -10,
      dReworkShare: 0.15,
      gateBlocks: 1,
      dGateBlocks: -1,
      gatesComparable: true,
      prompts: null,
      handbacks: null,
      notifications: null,
    });
    // Stop-hook summaries and live gate records count different things: no gate delta.
    expect(rows[2]).toMatchObject({
      feature: 'gamma',
      dCostUSD: -1.5,
      dActiveMin: 30,
      dReworkShare: -0.05,
      gateBlocks: 4,
      dGateBlocks: null,
      gatesComparable: false,
      prompts: 7,
      handbacks: 29,
      notifications: 35,
    });
    const table = renderCompare(rows, bundle).split('\n');
    expect(table).toHaveLength(2 + 3);
    expect(table[0]).toMatch(/\| Prompts \/ hand-backs \/ notifications \|$/);
    expect(table[3]).toContain('+$2.50');
    // The last column holds the turn inputs, n/a for a line that lacks them.
    expect(table[3]).toMatch(/\| 1 \| -1 \| n\/a \/ n\/a \/ n\/a \|$/);
    expect(table[4]).toMatch(/\| 4 \| n\/a \| 7 \/ 29 \/ 35 \|$/);

    // The CLI: one row per line of the history file, a name filter keeps the file's deltas.
    const file = path.join(home, 'compare.jsonl');
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const all = cli(['compare', '--history', file]);
    expect(all.status, all.stderr).toBe(0);
    expect(all.stdout.trim().split('\n')).toHaveLength(2 + 3);
    const beta = cli(['compare', 'beta', '--history', file]);
    const betaRows = beta.stdout.trim().split('\n');
    expect(betaRows).toHaveLength(2 + 1);
    expect(betaRows[2]).toContain('+$2.50');
    const json = JSON.parse(cli(['compare', '--history', file, '--json']).stdout);
    expect(json.map((r) => r.dCostUSD)).toEqual([null, 2.5, -1.5]);

    // D4: a `record --force` line is a lower bound: its cost prints with `≥`, and neither it nor
    // the next line gets a cost delta (n/a), while the other deltas stay.
    const partialRows = compareLines([lines[0], { ...lines[1], costPartial: true }, lines[2]]);
    expect(partialRows[1]).toMatchObject({
      feature: 'beta',
      costPartial: true,
      dCostUSD: null,
      costComparable: false,
      dActiveMin: -10,
    });
    expect(partialRows[2]).toMatchObject({
      feature: 'gamma',
      costPartial: false,
      dCostUSD: null,
      costComparable: false,
      dActiveMin: 30,
    });
    const partialTable = renderCompare(partialRows, bundle).split('\n');
    expect(partialTable[3]).toContain('| beta (#6) | 2026-09-25 | ≥$12.50 | n/a |');
    expect(partialTable[4]).toContain('| gamma | 2026-09-29 | $11.00 | n/a |');
  });

  it('counts prompts, hand-backs and notifications from the transcript', () => {
    const I = EXPECTED.inputs;
    const a = load('a-main');
    const b = load('b-resumed');

    // slim() keeps the D13 kind of a turn input only: `origin.kind` of a string user record or of a
    // `queued_command` attachment, else (Claude Code 2.1.282) its `commandMode` task-notification.
    const kinds = Object.fromEntries(a.main.filter((r) => r.input).map((r) => [r.uuid, r.input]));
    expect(kinds).toEqual(I.kinds);
    expect(a.main.find((r) => r.uuid === 'a-m-q2')).toEqual({
      type: 'attachment',
      ts: ms(0, 2.92),
      uuid: 'a-m-q2',
      gitBranch: 'feature/fixture-demo',
      version: VERSION,
      input: 'human',
    });
    // A string user record without `origin` and a `coordinator` delivery in an agent file: none.
    expect(a.main.find((r) => r.uuid === 'a-m-u5')).not.toHaveProperty('input');
    const a1 = a.agents.find((x) => x.id === 'a1');
    expect(a1.records.find((r) => r.uuid === 'a-1-u2')).not.toHaveProperty('input');

    // History path (no event log): the copied hand-back of b-resumed counts once in the feature,
    // although alone it is b-resumed's own record.
    const history = featureReport([a, b], 'fixture-demo', { pricing });
    expect(turnInputsOf(history)).toEqual(I.figures);
    expect(turnInputsOf(sessionReport(b, { pricing }))).toEqual(I.resumed);

    // Live path: the hook's six `prompt` records in the same window move none of the figures.
    expect(DEMO_EVENTS.filter((e) => e.event === 'prompt')).toHaveLength(I.promptEvents);
    const live = featureReport([{ ...a, events: DEMO_EVENTS }, b], 'fixture-demo', { pricing });
    expect(live.gateSource).toBe('events');
    expect(turnInputsOf(live)).toEqual(I.figures);
    // One rule for history and live: both history lines carry the same three values.
    expect(turnInputsOf(historyLine(live, '2026-09-30'))).toEqual(I.figures);
    expect(turnInputsOf(historyLine(history, '2026-09-30'))).toEqual(I.figures);
    expect(renderCard(live, bundle)).toContain('prompts 2, hand-backs 1, notifications 3;');
  });

  it("judges rework against the plan's Steps table", () => {
    const P = EXPECTED.plan;
    const launchAt = ([agentType, min]) => ({ agentType, ts: ms(6, min) });

    // The (phase, agent type) pairs of the Steps table: `5a` is phase 5; `orchestrator`, prose and
    // file names are no agent types.
    const plan = planAssignments(PLAN_STEPS);
    expect(plan).toEqual(new Map(P.assignments.map(([type, phases]) => [type, new Set(phases)])));
    // No Phase column, a Phase column without numbers, no Steps section, no text: no assignment.
    expect(planAssignments(PLAN_NO_PHASE)).toBeNull();
    expect(planAssignments(PLAN_UNNUMBERED)).toBeNull();
    expect(planAssignments(PLAN_STEPS.replace('## Steps', '## Tasks'))).toBeNull();
    expect(planAssignments(null)).toBeNull();

    // Live, markers 2, 4, 2: a launch the plan lists for its phase is never rework; any other one
    // is judged by its home phase.
    const markers = phaseMarkers(
      ['2', '4', '2'].map((phase, k) => ({
        ts: iso(6, 10 * (k + 1)),
        event: 'phase',
        feature: 'fixture-plan (#9)',
        phase,
        raw: `${phase}: step`,
      }))
    );
    expect(markers.map((m) => m.phase)).toEqual(['2', '4', '2']);
    const live = P.live.map(launchAt);
    expect(reworkOf(live, markers, plan)).toEqual(P.liveRework);
    expect(reworkOf(live, markers)).toEqual(P.liveFallback);

    // History, no markers: planned when the plan lists the type in a phase >= H.
    const history = P.history.map((agentType, k) => launchAt([agentType, 100 + 10 * k]));
    expect(reworkOf(history, [], plan)).toEqual(P.historyRework);
    expect(reworkOf(history, [], planAssignments(PLAN_NO_PHASE))).toEqual(P.historyFallback);

    // The report names its rework basis; the plan commit is null without a plan and for a
    // working-tree plan.
    const g = load('g-history');
    const planned = sessionReport(g, { pricing, plan });
    expect(planned).toMatchObject({ reworkSource: 'plan', planCommit: null, ...P.gHistory });
    expect(planned.agents.find((x) => x.agentType === 'architect').reworkLaunches).toBe(0);
    expect(renderCard(planned, bundle)).toContain('; rework: plan;');
    expect(historyLine(planned, '2026-09-30').reworkSource).toBe('plan');
    const committed = sessionReport(g, { pricing, plan, extras: { planCommit: 'c10c4f0' } });
    expect(committed.planCommit).toBe('c10c4f0');
    const fallback = sessionReport(g, {
      pricing,
      plan: planAssignments(PLAN_NO_PHASE),
      extras: { planCommit: 'c10c4f0' },
    });
    expect(fallback).toMatchObject({
      reworkSource: 'home-phase',
      planCommit: null,
      reworkShare: EXPECTED.history.reworkShare,
    });
    expect(renderCard(fallback, bundle)).toContain('; rework: home-phase fallback;');

    // The plan as approved at the plan gate: the first `Status:` value begins with `approved`,
    // optionally in backticks (real status lines of this repo's plans).
    const statuses = [
      ['Date: 2026-09-25. Status: approved (user, 2026-09-25). Gate mode: semi-autonomous.', true],
      ['Date: 2026-09-29. Status: approved 2026-09-29. Gate mode: semi-autonomous.', true],
      ['Date: 2026-09-30. Status: `approved` (user, 2026-09-30).', true],
      ['Date: 2026-09-07. Status: draft. Gate mode: semi-autonomous.', false],
      ['Date: 2026-09-29. Status: proposed.', false],
      [
        'Date: 2026-09-07. Status: `done` (set by `docs-keeper`, 2026-09-16; approved by the user 2026-09-10).',
        false,
      ],
      ['Date: YYYY-MM-DD. Status: draft | approved | done.', false],
      ['Date: 2026-09-07. Status: draft.\n\nStatus: approved.', false],
      ['# plan\n\nDate: 2026-09-07. Gate mode: autonomous.\n', false],
      [null, false],
    ];
    for (const [text, approved] of statuses) expect(planApproved(text), text).toBe(approved);
    expect(planApproved(PLAN_STEPS)).toBe(true);

    // The commit a pruned feature's final documents are read at, from SUMMARY.md's `## Full record`.
    const sha = '94a991df29046b88f8f2a0d7e6a178deb08e76ac';
    const summary = (where) =>
      `# x: summary\n\n## Cost\n\n## Full record\n\nPruned to this file (ADR-0019). PLAN.md of this feature stays in git history at ${where} (commit \`${sha.slice(0, 7)}\`).\n`;
    expect(permalinkCommit(summary(`https://github.com/o/r/tree/${sha}/docs/features/x`))).toBe(
      sha
    );
    expect(permalinkCommit(summary(`docs/features/x at ${sha}`))).toBe(sha.slice(0, 7));
    expect(permalinkCommit('# x: summary\n\n## Cost\n')).toBeNull();
  });

  it('compares a live agent-stop with the re-parse cut at its lastTs', () => {
    const R = EXPECTED.race;
    const T = EXPECTED.time;
    const c = load('c-time');
    const stop = TIME_EVENTS.at(-1);
    expect(stop).toMatchObject({ event: 'agent-stop', agent: 'c1', requests: R.liveRequests });

    // SubagentStop fired before c1's final message reached the file: the file holds one request
    // more than the last live record, the file cut at its lastTs exactly as many.
    const c1 = c.agents.find((x) => x.id === 'c1');
    expect(requests(c1.records)).toHaveLength(R.liveRequests + 1);
    const cut = c1.records.filter((r) => r.ts <= Date.parse(stop.lastTs));
    expect(requests(cut)).toHaveLength(R.liveRequests);

    // One request short is the race, not drift; the figures come from the whole file.
    expect(DRIFT_MAX).toBe(0.01);
    const live = sessionReport({ ...c, events: TIME_EVENTS }, { pricing });
    expect(live.warnings).toEqual([]);
    expect(live).toMatchObject({
      calls: R.calls,
      costUSD: R.costUSD,
      leadMin: T.leadMin,
      activeMin: T.mergedMin,
      agentMin: T.agentMinutes,
    });
    expect(live.agents.find((x) => x.agentType === 'cap-backend-dev')).toMatchObject(R.agent);

    // A real skew of the last record still warns; a difference below DRIFT_MAX does not.
    const withOutput = (output) =>
      TIME_EVENTS.map((e) => (e === stop ? { ...e, tokens: { ...e.tokens, output } } : e));
    const skewed = sessionReport({ ...c, events: withOutput(R.skewOutput) }, { pricing });
    expect(skewed.warnings).toEqual(['agent-stop-drift:c1']);
    const close = sessionReport({ ...c, events: withOutput(R.toleratedOutput) }, { pricing });
    expect(close.warnings).toEqual([]);

    // A stop without an agent file is the fallback row: priced under its model, no timeline point,
    // a warning. A zero-request stop without a file (an internal agent) stands in for nothing.
    const M = R.missing;
    const events = [...TIME_EVENTS, ...MISSING_AGENT_EVENTS];
    const missing = sessionReport({ ...c, events }, { pricing });
    expect(missing.warnings).toEqual(['agent-transcript-missing:c2']);
    expect(missing).toMatchObject({
      leadMin: M.leadMin,
      activeMin: M.activeMin,
      agentMin: M.agentMin,
      parallelism: M.parallelism,
      launches: M.launches,
      calls: M.calls,
      costUSD: M.costUSD,
    });
    expect(missing.agents.map((x) => x.agentType)).toEqual([
      'main',
      'cap-backend-dev',
      'docs-keeper',
    ]);
    expect(missing.agents.find((x) => x.agentType === 'docs-keeper')).toMatchObject(M.agent);
    expect(missing.byModel[SONNET_55]).toMatchObject({ calls: 2, costUSD: 0.1 });
    expect(missing.phases['6']).toMatchObject(M.phase6);

    // Feature scope: an agent whose records are all out of scope still has its file, so its stop
    // gets no fallback; the same stop with the file gone does.
    const away = {
      ...c,
      events: TIME_EVENTS,
      agents: c.agents.map((a) => ({
        ...a,
        records: a.records.map((r) => ({ ...r, gitBranch: 'main' })),
      })),
    };
    const scoped = featureReport([away], 'fixture-time', { pricing });
    expect(scoped.warnings).toEqual([]);
    expect(scoped).toMatchObject({ launches: 0, calls: 6 });
    expect(scoped.agents.map((x) => x.agentType)).toEqual(['main']);
    const gone = featureReport([{ ...c, agents: [], events: TIME_EVENTS }], 'fixture-time', {
      pricing,
    });
    expect(gone.warnings).toEqual(['agent-transcript-missing:c1']);
    expect(gone.agents.find((x) => x.agentType === 'cap-backend-dev')).toMatchObject(R.gone);
  });

  describe('context of a launch (D14-D18, ADR-0031 decision 5)', () => {
    const X = CONTEXT_EXPECTED;
    const contextReport = () =>
      featureReport(
        SESSIONS.map((s) => load(s.id)),
        'fixture-context',
        { pricing, root: CONTEXT_ROOT }
      );
    const recordsOf = (agent) => load('m-context').agents.find((a) => a.id === agent).records;
    const byUuid = (agent, uuid) => recordsOf(agent).find((r) => r.uuid === uuid);

    it('context figures of a launch (D14-D18)', () => {
      // The parser drops the api-request records whole: they repeat the blocks of others.
      for (const type of ['api-request', 'api-request-blob', 'api-request-shape'])
        expect(slim({ type, timestamp: iso(8, 0), message: { content: [] } }), type).toBeNull();
      expect(recordsOf('m1').map((r) => r.uuid)).not.toContain('m-1-x1');
      // Of a tool use its id, of a Read its path and whether it was partial, of Bash the class.
      const doc = `${CONTEXT_ROOT}/docs/a.md`;
      expect(byUuid('m1', 'm-1-a2').tools).toEqual([
        { name: 'Read', id: 'tu-m1-r2', file: doc, partial: true },
        { name: 'Read', id: 'tu-m1-r3', file: doc, partial: false },
        { name: 'Bash', id: 'tu-m1-b2', program: 'search' },
        {
          name: 'Read',
          id: 'tu-m1-r4',
          file: `${CONTEXT_ROOT}/.pipeline/brief/cap-backend-dev-2.md`,
          partial: false,
        },
      ]);
      expect(byUuid('m2', 'm-2-a2').tools[1]).toMatchObject({ partial: true });
      // Of a tool result its tool-use id and length, an error flag; of a hook string its length.
      expect(byUuid('m2', 'm-2-u3').results).toEqual([
        { id: 'tu-m2-r2', chars: 30, error: true },
        { id: 'tu-m2-r3', chars: 10 },
      ]);
      expect(byUuid('m1', 'm-1-h1').hookContext).toEqual({ event: 'SubagentStart', chars: 60 });
      // No text survives: neither a result's text nor a command.
      const kept = JSON.stringify(load('m-context'));
      expect(kept).not.toMatch(/xxxxx|vitest|git status/);

      const report = contextReport();
      const [m1, m2] = report.context.launches;
      expect(m1).toEqual(X.m1);
      expect(m2).toEqual(X.m2);
      expect(report.context.main).toHaveLength(1);
      expect(report.context.main[0]).toMatchObject(X.main);
      expect(report.context.totals).toMatchObject({
        toolResults: 16,
        toolChars: 445,
        byTool: {
          Read: { n: 8, chars: 280 },
          Bash: { n: 5, chars: 98 },
          Edit: { n: 1, chars: 5 },
          SubagentHandback: { n: 2, chars: 62 },
        },
        bash: X.m1.bash,
        repeatReads: 1,
        repeatChars: 40,
        briefChars: 130,
        startupMax: 20500,
        peakMax: 22500,
      });
      // The card: one row per launch, the compactions next to the peak, the five largest results.
      const text = renderContext(report, bundle);
      const row = text.split('\n').find((l) => l.startsWith('| cap-backend-dev | m1 |'));
      expect(row).toMatch(/^\| cap-backend-dev \| m1 \| 20\.5K \| 22\.5K \| 1 \| 7 \| 315 \|/);
      expect(row).toContain('| 40 (1) | 130 |');
      expect(row).toContain(
        'Read .pipeline/brief/cap-backend-dev-2.md 70; Read docs/a.md 40; Read docs/a.md 40; Read docs/a.md 40; Bash check 30 |'
      );
      expect(text).toMatch(/^\| test-backend \| m2 \| 15\.4K \| 16\.9K \| 0 \| 4 \| 130 \|/m);
      expect(text).toContain(
        'Main thread: startup 31.0K, peak 37.0K tokens, compactions 0, requests 5'
      );
    });

    it('launches, resumes and compactions are counted apart', () => {
      const report = contextReport();
      expect(report.context.byType).toEqual(X.byType);
      expect(report.context.totals).toMatchObject({ launches: 2, resumes: 2, compactions: 1 });
      // D9 counts the SendMessage calls of the main thread; D18 the deliveries in the agent files.
      expect(report).toMatchObject({ launches: 2, resumes: 2 });
      const card = renderCard(report, bundle);
      expect(card).toContain(
        '- cap-backend-dev: launches 1, resumes 1, compactions 1; startup max 20.5K, peak max 22.5K tokens; tool results 315, brief 130, repeat reads 40'
      );
      expect(card).toContain(
        '- test-backend: launches 1, resumes 1, compactions 0; startup max 15.4K, peak max 16.9K tokens; tool results 130, brief 0, repeat reads 0'
      );
      expect(card).toContain('- main: compactions 0, peak 37.0K tokens');
      const text = renderContext(report, bundle);
      expect(text).toContain('| cap-backend-dev | 1 | 1 | 1 | 20.5K | 22.5K |');
      expect(text).toContain('| test-backend | 1 | 1 | 0 | 15.4K | 16.9K |');
      expect(text).toContain('Launches 2, resumes 2, compactions 1, resumes after a report 1;');
      // fixture-demo: a1's `coordinator` delivery is a resume of a launch without a compaction.
      const demo = featureReport([load('a-main'), load('b-resumed')], 'fixture-demo', { pricing });
      expect(demo.context.byType['cap-backend-dev']).toMatchObject({
        launches: 1,
        resumes: 1,
        compactions: 0,
      });
      expect(demo.context.totals).toMatchObject({ launches: 2, resumes: 1, resumesAfterReport: 0 });
    });

    it('resumes after a report are listed with their context', () => {
      // A delivered report is a SubagentHandback with a result that is no error; a denied one is not.
      expect(deliveredReports(recordsOf('m1'))).toEqual([
        { ts: ms(8, 2.2), name: 'SubagentHandback', id: 'tu-m1-h1' },
      ]);
      expect(deliveredReports(recordsOf('m2'))).toEqual([]);
      const report = contextReport();
      expect(report.context.resumesAfterReport).toEqual(X.m1.afterReport);
      expect(report.context.totals.resumesAfterReport).toBe(1);
      const line =
        'Resumes after a report (1): cap-backend-dev m1 at 2026-09-09 10:04 UTC, context 13.5K tokens';
      expect(renderCard(report, bundle)).toContain(line);
      expect(renderContext(report, bundle)).toContain(line);
      expect(historyLine(report, '2026-11-11').context).toMatchObject({ resumesAfterReport: 1 });
    });

    it('a resume after a report fails the ratchet', () => {
      // The ceiling the plan pins (criterion "Ratchet zero").
      const budget = JSON.parse(
        fs.readFileSync(path.join(root, 'test/context-budget.json'), 'utf8')
      );
      expect(budget.resumesAfterReport).toBe(0);
      const file = path.join(home, 'ratchet-history.jsonl');
      const refused = cli(['record', 'fixture-context', '--history', file]);
      expect(refused.status, refused.stderr).toBe(1);
      expect(refused.stderr).toContain(
        'fixture-context has 1 resumes after a report, above the ceiling 0 of resumesAfterReport in test/context-budget.json: cap-backend-dev m1 (2026-09-09T10:04:48.000Z, context 13500)'
      );
      expect(fs.existsSync(file)).toBe(false);
      // --force records the line with the count, so the rise reaches the retro.
      const forced = cli(['record', 'fixture-context', '--history', file, '--force']);
      expect(forced.status, forced.stderr).toBe(0);
      expect(readJsonl(file)).toEqual([
        expect.objectContaining({
          feature: 'fixture-context',
          context: expect.objectContaining({ resumesAfterReport: 1 }),
        }),
      ]);
    });

    it('history line carries the context figures', () => {
      const file = path.join(home, 'context-history.jsonl');
      for (const [name, extra] of [
        ['fixture-demo', []],
        ['fixture-context', ['--force']],
      ]) {
        const res = cli(['record', name, '--history', file, ...extra]);
        expect(res.status, res.stderr).toBe(0);
      }
      const [demo, ctx] = readJsonl(file);
      expect(ctx.context).toMatchObject(X.history);
      expect(Object.keys(ctx.context).sort()).toEqual([...Object.keys(X.history), 'gates'].sort());
      expect(demo.context).toMatchObject({
        launches: 2,
        resumes: 1,
        compactions: 0,
        resumesAfterReport: 0,
      });
      // compare: the four D18 figures with their deltas against the previous line.
      const json = cli(['compare', '--history', file, '--json']);
      expect(json.status, json.stderr).toBe(0);
      const rows = JSON.parse(json.stdout);
      expect(rows[0]).toMatchObject({ dContext: null });
      expect(rows[1]).toMatchObject({
        context: { launches: 2, resumes: 2, compactions: 1, resumesAfterReport: 1 },
        dContext: { launches: 0, resumes: 1, compactions: 1, resumesAfterReport: 1 },
      });
      const text = cli(['compare', '--history', file]);
      expect(text.stdout).toContain('| 2 / 2 / 1 / 1 (±0 / +1 / +1 / +1) |');
      // A line recorded before the figure existed shows no context and no delta.
      const [legacy, next] = compareLines([{ ...demo, context: undefined }, ctx]);
      expect(legacy.context).toBeNull();
      expect(next.dContext).toBeNull();
    });
  });

  it('the fixture holds only the allowed record keys', () => {
    const files = filesUnder(dir);
    let records = 0;
    const seen = new Set();
    for (const file of files) {
      const meta = file.endsWith('.meta.json');
      const rows = meta ? [JSON.parse(fs.readFileSync(file, 'utf8'))] : readJsonl(file);
      for (const r of rows) {
        records++;
        const bad = keyPaths(r).filter((k) => !(meta ? META_KEYS : TRANSCRIPT_KEYS).has(k));
        expect(bad, path.relative(dir, file)).toEqual([]);
        if (!meta) for (const k of keyPaths(r)) seen.add(k);
        if ('toolUseResult' in r) expect(r.toolUseResult).toBe(true);
        // Only the type of a user prompt's content is read: the empty string, never text; an
        // array holds tool results only.
        const content = r.message?.content;
        if (r.type === 'user' && r.message && !Array.isArray(content)) expect(content).toBe('');
        if (r.type === 'assistant') expect(Array.isArray(content)).toBe(true);
        for (const c of Array.isArray(content) ? content : []) {
          if (r.type === 'user') expect(c.type).toBe('tool_result');
          if ('id' in c) expect(c.type).toBe('tool_use');
          // A result's text is a run of `x`: its length is the figure, there is no content.
          if (c.type === 'tool_result') expect(c.content).toMatch(/^x*$/);
        }
        // Only whether hookErrors is empty is read: its entries are empty objects.
        for (const e of r.hookErrors || []) expect(e).toEqual({});
        // D13 enums only: `origin` on a user record, a `queued_command` attachment without text.
        if ('origin' in r) expect(r.type).toBe('user');
        if ('attachment' in r) expect(r).toMatchObject({ type: 'attachment' });
        if (r.type === 'attachment')
          expect(['queued_command', 'hook_additional_context']).toContain(r.attachment.type);
        for (const v of r.attachment?.content || []) expect(v).toMatch(/^x*$/);
        for (const v of strings(r)) expect(v.length).toBeLessThanOrEqual(80);
      }
    }
    // Every record of the builder is on disk, and nothing else is.
    const built = SESSIONS.reduce(
      (n, s) => n + s.main.length + s.agents.reduce((m, a) => m + a.records.length + 1, 0),
      0
    );
    expect(records).toBe(built);
    // The allowed keys equal the field list of definitions section 1: each is used by the fixture.
    expect([...TRANSCRIPT_KEYS].filter((k) => !seen.has(k))).toEqual([]);

    // The event logs: only the keys of the hook records, a prompt record without any prompt text.
    for (const e of [
      ...readJsonl(EVENT_LOG),
      ...DEMO_EVENTS,
      ...TIME_EVENTS,
      ...MISSING_AGENT_EVENTS,
    ]) {
      expect(keyPaths(e).filter((k) => !EVENT_KEYS.has(k))).toEqual([]);
      if (e.event === 'prompt')
        expect(
          Object.keys(e).filter((k) => !['ts', 'event', 'command', 'arg'].includes(k))
        ).toEqual([]);
      for (const v of strings(e)) expect(v.length).toBeLessThanOrEqual(80);
    }

    // slim() keeps none of a transcript's text (definitions section 1): message text, thinking,
    // tool input and output, hook error text; a sentinel in each of them never survives.
    const SENTINEL = 'SENTINEL-7f3a';
    const timestamp = '2026-09-29T10:00:00.000Z';
    const raw = [
      {
        type: 'assistant',
        uuid: 's-a1',
        requestId: 's-r1',
        timestamp,
        message: {
          model: OPUS,
          usage: { input_tokens: 1, output_tokens: 2 },
          content: [
            { type: 'thinking', thinking: SENTINEL, signature: SENTINEL },
            { type: 'text', text: SENTINEL },
            {
              type: 'tool_use',
              id: 'toolu_s1',
              name: 'Agent',
              input: { subagent_type: 'reviewer', description: SENTINEL, prompt: SENTINEL },
            },
            {
              type: 'tool_use',
              id: 'toolu_s2',
              name: 'SendMessage',
              input: { to: 'reviewer', message: SENTINEL },
            },
            { type: 'tool_use', id: 'toolu_s3', name: 'Bash', input: { command: SENTINEL } },
          ],
        },
      },
      {
        type: 'user',
        uuid: 's-u1',
        timestamp,
        origin: { kind: 'human' },
        message: { role: 'user', content: SENTINEL },
      },
      {
        type: 'user',
        uuid: 's-u2',
        timestamp,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_s3', content: SENTINEL }],
        },
        toolUseResult: { stdout: SENTINEL, stderr: SENTINEL },
      },
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        uuid: 's-s1',
        timestamp,
        content: SENTINEL,
        hookErrors: [{ error: SENTINEL }],
      },
      {
        type: 'attachment',
        uuid: 's-q1',
        timestamp,
        attachment: { type: 'queued_command', prompt: SENTINEL, commandMode: 'task-notification' },
      },
      // The SubagentStart brief in an agent's transcript (review Minor "Privacy test gap"): its
      // `content` is the brief text, of which only the length is kept.
      {
        type: 'attachment',
        uuid: 's-h1',
        timestamp,
        attachment: {
          type: 'hook_additional_context',
          hookEvent: 'SubagentStart',
          hookName: 'SubagentStart',
          content: [SENTINEL, `# Brief ${SENTINEL}`],
        },
      },
    ];
    const slimmed = raw.map(slim);
    for (const r of slimmed) expect(JSON.stringify(r), r.uuid).not.toContain(SENTINEL);
    const hookChars = SENTINEL.length + `# Brief ${SENTINEL}`.length;
    expect(slimmed[5]).toEqual({
      type: 'attachment',
      ts: Date.parse(timestamp),
      uuid: 's-h1',
      hookContext: { event: 'SubagentStart', chars: hookChars },
    });

    // The same records on disk as a session, the attachment in the transcript of the launch that
    // `toolu_s1` started: the sentinel reaches neither the loaded session nor the card, while the
    // card counts the brief's characters.
    const project = fs.mkdtempSync(path.join(home, 'sentinel-'));
    const agentDir = path.join(project, 's-sentinel', 'subagents');
    fs.mkdirSync(agentDir, { recursive: true });
    const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(path.join(project, 's-sentinel.jsonl'), jsonl(raw.slice(0, 5)));
    const agentAssistant = {
      type: 'assistant',
      uuid: 's-a2',
      requestId: 's-r2',
      timestamp,
      agentId: 'a7',
      message: {
        model: OPUS,
        usage: { input_tokens: 3, output_tokens: 4 },
        content: [{ type: 'text', text: SENTINEL }],
      },
    };
    fs.writeFileSync(path.join(agentDir, 'agent-a7.jsonl'), jsonl([raw[5], agentAssistant]));
    fs.writeFileSync(
      path.join(agentDir, 'agent-a7.meta.json'),
      JSON.stringify({ agentType: 'test-backend', toolUseId: 'toolu_s1' })
    );
    const session = loadSession(project, 's-sentinel');
    expect(session.agents.map((a) => a.agentType)).toEqual(['test-backend']);
    expect(JSON.stringify(session)).not.toContain(SENTINEL);
    const report = sessionReport(session, { pricing });
    expect(report.context.launches).toHaveLength(1);
    expect(report.context.launches[0]).toMatchObject({
      agentType: 'test-backend',
      briefChars: hookChars,
    });
    expect(JSON.stringify(report)).not.toContain(SENTINEL);
    const card = renderCard(report, bundle);
    const contextCard = renderContext(report, bundle);
    expect(contextCard).toContain('| test-backend |');
    expect(card).not.toContain(SENTINEL);
    expect(contextCard).not.toContain(SENTINEL);
    // What stays: names, ids and enums only.
    expect(slimmed[0]).toMatchObject({
      type: 'assistant',
      model: OPUS,
      tools: [
        { name: 'Agent', id: 'toolu_s1', subagentType: 'reviewer' },
        { name: 'SendMessage', to: 'reviewer' },
        { name: 'Bash' },
      ],
      lastTool: 'Bash',
    });
    expect(slimmed[1]).toMatchObject({ type: 'user', toolResult: false, input: 'human' });
    expect(slimmed[2]).toMatchObject({ type: 'user', toolResult: true });
    expect(slimmed[3]).toMatchObject({ subtype: 'stop_hook_summary', stopHookBlocked: true });
    expect(slimmed[4]).toMatchObject({ type: 'attachment', input: 'task-notification' });
  });
});
