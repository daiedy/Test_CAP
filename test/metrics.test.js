// Pipeline metrics (ADR-0022): the transcript parser, the aggregation and the CLI, pinned on the
// synthetic fixture of test/fixtures/transcript-fixture.mjs. Pure functions, no server, no real
// transcript: the fixture is written into a temp directory, and the CLI is pointed at it through
// CLAUDE_CONFIG_DIR. Every expected figure is computed by hand in the fixture file from
// docs/features/pipeline-metrics/research/definitions.md, never copied from the code's output.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  readJsonl,
  projectDir,
  loadSession,
  requests,
  scopeThreads,
  usageByModel,
  timelinePoints,
} from '../scripts/lib/transcript-usage.mjs';
import {
  IDLE_MS,
  TOOL_MS,
  PRICING_TOLERANCE,
  loadPricing,
  activeTime,
  priceOf,
  costOf,
  phaseOf,
  phaseMarkers,
  reworkOf,
  processesOf,
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
} from '../scripts/lib/pipeline-metrics.mjs';
import { loadBundle } from '../scripts/lib/backlog.mjs';
import {
  SESSIONS,
  EXPECTED,
  VERSION,
  EVENT_LOG,
  OPUS,
  SONNET,
  UNKNOWN_MODEL,
  ms,
  iso,
  writeFixture,
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

/** The keys of a history line (research/data-flow.md section 4). */
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
  'lines',
  'phases',
  'pricingDate',
  'idleMin',
  'toolMin',
  'phaseSource',
  'gateSource',
];

/** Allowed key paths of a transcript record (research/data-flow.md section 5, definitions section 1). */
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
/** Allowed key paths of an event-log record (research/data-flow.md section 2). */
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
    expect(report.pricingCheck[OPUS]).toMatchObject({ pricedUSD: E.opusPricedUSD, divergence: 0 });
    expect(report.pricingCheck[SONNET]).toMatchObject({
      pricedUSD: E.sonnetPricedUSD,
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

    // cost-state's costUSD 10% above its priced tokens: a pricing warning on the card.
    const e = load('e-drift');
    const drift = sessionReport(e, { pricing });
    expect(drift.pricingOk).toBe(false);
    expect(drift.warnings).toEqual([`pricing-check:${OPUS}`]);
    expect(drift.pricingCheck[OPUS].divergence).toBeGreaterThan(PRICING_TOLERANCE);
    expect(drift.pricingCheck[OPUS].divergence).toBeGreaterThanOrEqual(0.09);
    expect(drift.pricingCheck[OPUS].divergence).toBeLessThanOrEqual(0.1);
    expect(drift.pricingCheck[SONNET].divergence).toBe(0);
    expect(renderCard(drift, bundle)).toContain(
      `WARNING pricing check off by more than 5%: ${OPUS}`
    );
    expect(reconcileSession(e, pricing).pricingOk).toBe(false);

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

    // A process whose sessions hold records outside the scope contributes its proportional share.
    const feature = featureReport([a, b], 'fixture-demo', { pricing });
    expect(feature).toMatchObject({
      costUSD: D.featureUSD,
      costStateUSD: D.featureCostStateUSD,
      recovered: D.featureRecovered,
      unattributedUSD: D.featureUnattributedUSD,
    });
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
      costStateUSD: D.featureCostStateUSD,
      prompts: D.featurePrompts,
      versions: [VERSION],
    });
    const line = historyLine(report, '2026-09-29');
    expect(Object.keys(line).sort()).toEqual([...HISTORY_KEYS].sort());
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
      recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    const duplicate = cli(['record', 'fixture-demo', '--history', file]);
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr).toContain('fixture-demo is already recorded');
    expect(readJsonl(file)).toHaveLength(1);
    const forced = cli(['record', 'fixture-demo', '--history', file, '--force']);
    expect(forced.status, forced.stderr).toBe(0);
    expect(readJsonl(file)).toHaveLength(1);

    // Live figures of the line: gate blocks by reason from the event log, prompts from its markers.
    const events = readJsonl(EVENT_LOG);
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
    });
    // History fallback without an event log: Stop-hook summaries, prompts from the transcript.
    const history = sessionReport(load('g-history'), { pricing });
    expect(historyLine(history, '2026-09-29')).toMatchObject({
      gateSource: 'stop-hook-summary',
      gateBlocks: EXPECTED.history.gateBlocks,
      prompts: EXPECTED.history.prompts,
    });

    // The agent-stop aggregates match the re-parse; a skewed one is flagged.
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
    });
    const table = renderCompare(rows, bundle).split('\n');
    expect(table).toHaveLength(2 + 3);
    expect(table[3]).toContain('+$2.50');
    expect(table[3]).toMatch(/\| 1 \| -1 \|$/);
    expect(table[4]).toMatch(/\| 4 \| n\/a \|$/);

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
  });

  it('the fixture holds only the allowed record keys', () => {
    const files = filesUnder(dir);
    let records = 0;
    for (const file of files) {
      const meta = file.endsWith('.meta.json');
      const rows = meta ? [JSON.parse(fs.readFileSync(file, 'utf8'))] : readJsonl(file);
      for (const r of rows) {
        records++;
        const bad = keyPaths(r).filter((k) => !(meta ? META_KEYS : TRANSCRIPT_KEYS).has(k));
        expect(bad, path.relative(dir, file)).toEqual([]);
        if ('toolUseResult' in r) expect(r.toolUseResult).toBe(true);
        // Only the type of a user prompt's content is read: the empty string, never text.
        if (r.type === 'user' && r.message) expect(r.message.content).toBe('');
        if (r.type === 'assistant') expect(Array.isArray(r.message.content)).toBe(true);
        for (const c of r.type === 'assistant' ? r.message.content : [])
          if ('id' in c) expect(c.name).toBe('Agent');
        // Only whether hookErrors is empty is read: its entries are empty objects.
        for (const e of r.hookErrors || []) expect(e).toEqual({});
        for (const v of strings(r)) expect(v.length).toBeLessThanOrEqual(80);
      }
    }
    // Every record of the builder is on disk, and nothing else is.
    const built = SESSIONS.reduce(
      (n, s) => n + s.main.length + s.agents.reduce((m, a) => m + a.records.length + 1, 0),
      0
    );
    expect(records).toBe(built);

    // The event log: only the keys of the hook records, a prompt record without any prompt text.
    for (const e of readJsonl(EVENT_LOG)) {
      expect(keyPaths(e).filter((k) => !EVENT_KEYS.has(k))).toEqual([]);
      if (e.event === 'prompt')
        expect(
          Object.keys(e).filter((k) => !['ts', 'event', 'command', 'arg'].includes(k))
        ).toEqual([]);
      for (const v of strings(e)) expect(v.length).toBeLessThanOrEqual(80);
    }
  });
});
