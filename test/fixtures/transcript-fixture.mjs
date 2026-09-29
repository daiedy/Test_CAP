// Synthetic Claude Code transcripts for test/metrics.test.js (ADR-0022; pipeline-metrics
// research/data-flow.md section 5). Built in code and written into a temp directory at test time:
// no real transcript is read or copied, and every record holds only the allowed keys (no text,
// thinking or prompt content), which the test "the fixture holds only the allowed record keys"
// enforces. The expected figures below are computed by hand from research/definitions.md D1-D13
// and section 5, with the prices of scripts/lib/model-pricing.json in USD per million tokens:
//   claude-opus-5-5    input 4, cacheWrite5m 5,   cacheWrite1h 8, cacheRead 0.2, output 20
//   claude-sonnet-5    input 2, cacheWrite5m 2.5, cacheWrite1h 4, cacheRead 0.2, output 10
//   claude-sonnet-5-5  input 2, cacheWrite5m 2.5, cacheWrite1h 4, cacheRead 0.2, output 10 (D4 seed)
// Session ids sort in the D1 fixed order: `a-main` (the original) before `b-resumed` (its copy).
// `message.stop_reason` is not written: the parser does not read it, D1 takes the maximum over the
// snapshot records of a request. An `Agent` block carries an `id` equal to the `toolUseId` of the
// launched agent's `.meta.json`, so a launch is timed by its launching block (D9).
// Fix round 1 (data-flow section 5): D13 turn inputs in `a-main`/`b-resumed`/`a1`, the plan texts
// of D12, the event logs of the live `agent-stop` race on `c-time` (its agent `c1` ends its resumed
// run with a request after the live `lastTs`; `a1` stays as it is, since test/hooks-metrics.test.js
// pins its whole-file aggregate) and `k-unpriced`, a session with no priced model (D4 partial cost).
import fs from 'node:fs';
import path from 'node:path';

export const OPUS = 'claude-opus-5-5';
export const SONNET = 'claude-sonnet-5';
export const SONNET_55 = 'claude-sonnet-5-5';
export const UNKNOWN_MODEL = 'claude-mystery-1';
export const SYNTHETIC = '<synthetic>';
export const VERSION = '2.1.282';
/** Event-log fixture of session `h-live` (records of research/data-flow.md section 2). */
export const EVENT_LOG = path.join(import.meta.dirname, 'metrics-log.jsonl');

const BASE = Date.parse('2026-09-01T10:00:00.000Z');
const DAY = 86_400_000;
/** Epoch ms of minute `min` of fixture day `day` (day 0 = 2026-09-01, 10:00 UTC). */
export const ms = (day, min) => BASE + day * DAY + Math.round(min * 60_000);
export const iso = (day, min) => new Date(ms(day, min)).toISOString();

// ---------- record builders (allowed keys only) ----------

const TEXT = { type: 'text' };
const tool = (name, input) =>
  input ? { type: 'tool_use', name, input } : { type: 'tool_use', name };
const agentCall = (subagentType, id) => [
  { type: 'tool_use', name: 'Agent', id, input: { subagent_type: subagentType } },
];
const ZERO = [0, 0, 0, 0, 0];
const OUT = (n) => [0, 0, 0, 0, n];

/** `[input, cacheWrite5m, cacheWrite1h, cacheRead, output]` as a transcript `message.usage`. */
function usage([input, write5m, write1h, read, output], thinking) {
  const u = {
    input_tokens: input,
    cache_creation_input_tokens: write5m + write1h,
    cache_creation: { ephemeral_5m_input_tokens: write5m, ephemeral_1h_input_tokens: write1h },
    cache_read_input_tokens: read,
    output_tokens: output,
  };
  if (thinking) u.output_tokens_details = { thinking_tokens: thinking };
  return u;
}

/**
 * Builders of the records of one transcript file. A turn input carries `message.content` as the
 * empty string (the parser reads only its type), a tool result `toolUseResult: true`. `prompt`
 * gives the string content without `origin` (a built-in command, `!` input: D13 counts nothing);
 * `origin` adds `origin.kind` (`human`, `peer`, `task-notification`; `coordinator` in agent files).
 */
function thread(day, branch, agentId = null) {
  const base = (min, uuid, b) => {
    const r = { timestamp: iso(day, min), uuid, gitBranch: b ?? branch, version: VERSION };
    if (agentId) r.agentId = agentId;
    return r;
  };
  return {
    user: (min, uuid, { result = false, prompt = false, origin, branch: b } = {}) => ({
      type: 'user',
      ...base(min, uuid, b),
      ...(result ? { toolUseResult: true } : {}),
      ...(prompt || origin ? { message: { content: '' } } : {}),
      ...(origin ? { origin: { kind: origin } } : {}),
    }),
    /**
     * A `queued_command` attachment (a turn input absorbed into a running turn, D13): its kind in
     * `origin.kind`, or only `commandMode` in the Claude Code 2.1.282 shape; `attachment.prompt`
     * (the text) is never written.
     */
    attachment: (min, uuid, { origin, commandMode } = {}) => ({
      type: 'attachment',
      ...base(min, uuid),
      attachment: {
        type: 'queued_command',
        ...(commandMode ? { commandMode } : {}),
        ...(origin ? { origin: { kind: origin } } : {}),
      },
    }),
    assistant: (min, uuid, requestId, tokens, opts = {}) => {
      const { model = OPUS, content = [TEXT], thinking, branch: b } = opts;
      return {
        type: 'assistant',
        ...base(min, uuid, b),
        requestId,
        message: { model, usage: usage(tokens, thinking), content },
      };
    },
    /** A `system` record; `hookErrors` holds empty objects, only its emptiness is read. */
    system: (min, uuid, subtype, hookErrors) => ({
      type: 'system',
      subtype,
      ...base(min, uuid),
      ...(hookErrors ? { hookErrors } : {}),
    }),
  };
}

/** `[inputTokens, cacheCreationInputTokens, cacheReadInputTokens, outputTokens]` of a cost-state model. */
function modelUsage(
  [inputTokens, cacheCreationInputTokens, cacheReadInputTokens, outputTokens],
  costUSD
) {
  return {
    inputTokens,
    outputTokens,
    thinkingTokens: 0,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    costUSD,
  };
}

function costStateRecord(startTime, totalCostUSD, models = {}, minutes = 2) {
  return {
    type: 'cost-state',
    startTime,
    totalCostUSD,
    modelUsage: models,
    totalAPIDuration: minutes * 30_000,
    totalToolDuration: minutes * 10_000,
    totalDuration: minutes * 60_000,
    totalLinesAdded: 60 * minutes,
    totalLinesRemoved: 15 * minutes,
    hasUnknownModelCost: false,
  };
}

// ---------- sessions ----------

// D1, D2, D5 and the shared process: `a-main` with subagents a1 (cap-backend-dev, opus) and a2
// (ui-verifier, sonnet); `b-resumed` copies two records of `a-main` (same requestId and uuid) and
// adds its own, one of them on `main`, outside the feature scope.
const DEMO = 'feature/fixture-demo';
const PROCESS_DEMO = 1_788_000_000_000;
const am = thread(0, DEMO);
const COPIED = [
  am.assistant(3, 'a-m-a4', 'r-main-2', [2000, 0, 200000, 800000, 5000], {
    content: agentCall('ui-verifier', 'tu-a2'),
  }),
  am.user(4, 'a-m-u2', { result: true }),
];
const a1 = thread(0, DEMO, 'a1');
const a2 = thread(0, DEMO, 'a2');
const bm = thread(0, DEMO);
// D13: a1's report delivered as a turn after a1 (background) stopped at 2.7; b-resumed copies it.
const HANDBACK = am.user(2.8, 'a-m-u3', { origin: 'peer' });

const aMain = {
  id: 'a-main',
  main: [
    am.user(0, 'a-m-u1', { origin: 'human' }),
    // Two records of one request with identical usage (the main file's stream).
    am.assistant(1, 'a-m-a1', 'r-main-1', [1000, 100000, 0, 500000, 10000], { thinking: 4000 }),
    am.assistant(1.5, 'a-m-a2', 'r-main-1', [1000, 100000, 0, 500000, 10000], {
      thinking: 4000,
      content: agentCall('cap-backend-dev', 'tu-a1'),
    }),
    am.assistant(2, 'a-m-a3', 'r-synth', ZERO, { model: SYNTHETIC }),
    // D13 turn inputs next to each other (attachments are no timeline points, the user records
    // are points inside 0..4 whose gaps stay below 5 min, so no time figure moves): the hand-back,
    // the queued notice after a1 stopped, a notice delivered as a turn, a prompt typed during a
    // turn, a 2.1.282 notice without `origin`, and a string record without `origin` (not counted).
    HANDBACK,
    am.attachment(2.85, 'a-m-q1', { origin: 'task-notification' }),
    am.user(2.9, 'a-m-u4', { origin: 'task-notification' }),
    am.attachment(2.92, 'a-m-q2', { origin: 'human' }),
    am.attachment(2.94, 'a-m-q3', { commandMode: 'task-notification' }),
    am.user(2.96, 'a-m-u5', { prompt: true }),
    ...COPIED,
    // One process, two snapshots: the last (larger) one is the process total so far.
    costStateRecord(PROCESS_DEMO, 2, {}, 1),
    costStateRecord(PROCESS_DEMO, 4, {}, 2),
  ],
  agents: [
    {
      id: 'a1',
      agentType: 'cap-backend-dev',
      toolUseId: 'tu-a1',
      records: [
        a1.user(1.6, 'a-1-u1'),
        // A SendMessage delivery inside an agent file (D13: `coordinator`, not a turn input). A
        // point inside 1.6..2.7, so the agent's aggregate (test/hooks-metrics.test.js) stays.
        a1.user(1.8, 'a-1-u2', { origin: 'coordinator' }),
        // Growing stream, the per-field maximum differs from the last record (cacheRead).
        a1.assistant(2, 'a-1-a1', 'r-a1-1', [500, 30000, 0, 100000, 4000]),
        a1.assistant(2.2, 'a-1-a2', 'r-a1-1', [500, 30000, 0, 90000, 9000]),
        // Snapshot records only, output growing, no final record (in a real transcript they carry
        // `stop_reason: null`; modelled here by the usage alone).
        a1.assistant(2.5, 'a-1-a3', 'r-a1-2', [300, 0, 0, 130000, 1000]),
        a1.assistant(2.7, 'a-1-a4', 'r-a1-2', [300, 0, 0, 130000, 6000]),
      ],
    },
    {
      id: 'a2',
      agentType: 'ui-verifier',
      toolUseId: 'tu-a2',
      records: [
        a2.user(3.2, 'a-2-u1'),
        a2.assistant(3.5, 'a-2-a1', 'r-a2-1', [700, 0, 40000, 200000, 3000], { model: SONNET }),
      ],
    },
  ],
};

const bResumed = {
  id: 'b-resumed',
  main: [
    ...COPIED,
    HANDBACK,
    bm.user(60, 'b-m-u1', { prompt: true }),
    bm.assistant(61, 'b-m-a1', 'r-b-1', [3000, 50000, 0, 900000, 7000]),
    bm.user(90, 'b-m-u2', { branch: 'main', prompt: true }),
    bm.assistant(91, 'b-m-a2', 'r-b-2', [4000, 0, 0, 1000000, 20000], { branch: 'main' }),
    // Same process as a-main, a larger total: the reference total is this one, not the sum.
    costStateRecord(PROCESS_DEMO, 6, {}, 3),
  ],
  agents: [],
};

// D5, D6, D8: gaps of every kind in the main thread, an Agent launch whose subagent c1 fills the
// wait, and a SendMessage resume of c1. Every request: opus, output 1,000 ($0.02).
const TIME = 'feature/fixture-time';
const cm = thread(1, TIME);
const c1 = thread(1, TIME, 'c1');
const cTime = {
  id: 'c-time',
  main: [
    cm.user(0, 'c-m-u0', { prompt: true }),
    cm.assistant(1, 'c-m-a1', 'c-1', OUT(1000), {
      content: [TEXT, tool('Bash')],
    }),
    cm.user(13, 'c-m-u1', { result: true }),
    cm.assistant(14, 'c-m-a2', 'c-2', OUT(1000)),
    cm.user(54, 'c-m-u2', { prompt: true }),
    cm.assistant(55, 'c-m-a3', 'c-3', OUT(1000), {
      content: [tool('AskUserQuestion')],
    }),
    cm.user(63, 'c-m-u3', { result: true }),
    cm.assistant(64, 'c-m-a4', 'c-4', OUT(1000), {
      content: agentCall('cap-backend-dev', 'tu-c1'),
    }),
    cm.user(70, 'c-m-u4', { result: true }),
    cm.assistant(71, 'c-m-a5', 'c-5', OUT(1000), {
      content: [tool('SendMessage', { to: 'c1' })],
    }),
    cm.user(72, 'c-m-u5', { result: true }),
    cm.assistant(73, 'c-m-a6', 'c-6', OUT(1000)),
  ],
  agents: [
    {
      id: 'c1',
      agentType: 'cap-backend-dev',
      toolUseId: 'tu-c1',
      records: [
        c1.user(64.5, 'c-1-u0'),
        c1.assistant(66, 'c-1-a1', 'c1-1', OUT(1000), {
          content: [tool('Bash')],
        }),
        c1.user(68, 'c-1-u1', { result: true }),
        c1.assistant(69.5, 'c-1-a2', 'c1-2', OUT(1000)),
        c1.user(71.5, 'c-1-u2'),
        c1.assistant(71.8, 'c-1-a3', 'c1-3', OUT(1000)),
      ],
    },
  ],
};

// D4 and the pricing self-check: two requests ($1.648 opus + $0.152 sonnet = $1.80) and one
// process with two snapshots. `d-cost`: the last snapshot's tokens priced with the table equal its
// costUSD ($2.00, recovered 0.90); `e-drift`: the opus costUSD is 10% above its priced tokens.
const COST = 'feature/fixture-cost';
function costSession(id, prefix, startTime, opusCostUSD, totalCostUSD) {
  const t = thread(2, COST);
  return {
    id,
    main: [
      t.user(0, `${prefix}-u0`, { prompt: true }),
      t.assistant(1, `${prefix}-a1`, `${prefix}-1`, [1000, 100000, 100000, 1000000, 7200]),
      t.user(2, `${prefix}-u1`, { prompt: true }),
      t.assistant(3, `${prefix}-a2`, `${prefix}-2`, [1000, 0, 0, 500000, 5000], { model: SONNET }),
      costStateRecord(
        startTime,
        1,
        {
          [OPUS]: modelUsage([1000, 100000, 600000, 10000], 0.974),
          [SONNET]: modelUsage([500, 0, 120000, 100], 0.026),
        },
        1
      ),
      costStateRecord(
        startTime,
        totalCostUSD,
        {
          [OPUS]: modelUsage([2000, 200000, 1200000, 20000], opusCostUSD),
          [SONNET]: modelUsage([1000, 0, 240000, 200], 0.052),
        },
        2
      ),
    ],
    agents: [],
  };
}
const dCost = costSession('d-cost', 'd', 1_788_100_000_000, 1.948, 2);
const eDrift = costSession('e-drift', 'e', 1_788_200_000_000, 2.1428, 2.1948);

// D4: a model missing from the price table next to a priced one ($0.10).
const f = thread(3, 'feature/fixture-unknown');
const fUnknown = {
  id: 'f-unknown',
  main: [
    f.user(0, 'f-u0', { prompt: true }),
    f.assistant(1, 'f-a1', 'f-1', [1000, 0, 0, 0, 1000], { model: UNKNOWN_MODEL }),
    f.user(2, 'f-u1', { prompt: true }),
    f.assistant(3, 'f-a2', 'f-2', OUT(5000)),
  ],
  agents: [],
};

// D11, D12 without markers (history): architect, fiori-app-dev, architect again, reviewer.
const HISTORY = 'feature/fixture-history';
const g = thread(4, HISTORY);
const gAgent = (id, agentType, min, output, model = OPUS) => {
  const t = thread(4, HISTORY, id);
  return {
    id,
    agentType,
    toolUseId: `tu-${id}`,
    records: [
      t.user(min, `g-${id}-u`),
      t.assistant(min + 1, `g-${id}-a`, `${id}-1`, OUT(output), { model }),
    ],
  };
};
const gHistory = {
  id: 'g-history',
  main: [
    g.user(0, 'g-m-u0', { origin: 'human' }),
    g.assistant(1, 'g-m-a1', 'gm-1', OUT(10000), { content: agentCall('architect', 'tu-g1') }),
    g.user(15, 'g-m-u1', { result: true }),
    g.assistant(16, 'g-m-a2', 'gm-2', ZERO, { content: agentCall('fiori-app-dev', 'tu-g2') }),
    g.user(25, 'g-m-u2', { result: true }),
    g.assistant(26, 'g-m-a3', 'gm-3', ZERO, { content: agentCall('architect', 'tu-g3') }),
    g.user(35, 'g-m-u3', { result: true }),
    g.assistant(36, 'g-m-a4', 'gm-4', ZERO, { content: agentCall('reviewer', 'tu-g4') }),
    g.user(45, 'g-m-u4', { result: true }),
    g.assistant(46, 'g-m-a5', 'gm-5', ZERO),
    // History gate fallback: one Stop that blocked (non-empty hookErrors), one that passed.
    g.system(46.5, 'g-m-s1', 'stop_hook_summary', [{}]),
    g.system(46.7, 'g-m-s2', 'stop_hook_summary', []),
    g.system(46.8, 'g-m-s3', 'turn_duration'),
  ],
  agents: [
    gAgent('g1', 'architect', 2, 10000),
    gAgent('g2', 'fiori-app-dev', 17, 20000),
    gAgent('g3', 'architect', 27, 10000),
    gAgent('g4', 'reviewer', 37, 20000, SONNET),
  ],
};

// D10, D11, D12 live, with the event log EVENT_LOG: `h-live` starts on `main` with `/spec #7`
// at minute 0.5, launches architect h1 before the first phase marker (minute 20), then works on
// feature/fixture-live under the markers 2 (20), 3 (40, repeated at 45), 2 (60); `i-branch` is a
// later session on the feature branch with one record pair on `main`.
const LIVE = 'feature/fixture-live';
const h = thread(5, LIVE);
const hAgent = (id, agentType, min, output, model, branch = LIVE) => {
  const t = thread(5, branch, id);
  return {
    id,
    agentType,
    toolUseId: `tu-${id}`,
    records: [
      t.user(min + 0.2, `h-${id}-u`),
      t.assistant(min + 1, `h-${id}-a`, `${id}-1`, OUT(output), { model }),
    ],
  };
};
const hLive = {
  id: 'h-live',
  main: [
    h.user(0, 'h-m-u0', { branch: 'main', origin: 'human' }),
    h.assistant(0.2, 'h-m-a0', 'hm-0', OUT(5000), { branch: 'main' }),
    h.user(0.5, 'h-m-u1', { branch: 'main', origin: 'human' }),
    h.assistant(1, 'h-m-a1', 'hm-1', ZERO, {
      branch: 'main',
      content: agentCall('architect', 'tu-h1'),
    }),
    h.user(9, 'h-m-u2', { branch: 'main', result: true }),
    h.assistant(10, 'h-m-a2', 'hm-2', ZERO, { branch: 'main' }),
    h.user(19, 'h-m-u3', { origin: 'human' }),
    h.assistant(21, 'h-m-a3', 'hm-3', ZERO, {
      content: agentCall('cap-backend-dev', 'tu-h2'),
    }),
    h.user(29.5, 'h-m-u4', { result: true }),
    h.assistant(41, 'h-m-a4', 'hm-4', ZERO, {
      content: agentCall('fiori-app-dev', 'tu-h3'),
    }),
    h.user(49.5, 'h-m-u5', { result: true }),
    h.assistant(61, 'h-m-a5', 'hm-5', ZERO, {
      content: agentCall('test-backend', 'tu-h4'),
    }),
    h.user(69.5, 'h-m-u6', { result: true }),
    h.assistant(71, 'h-m-a6', 'hm-6', ZERO, { content: agentCall('architect', 'tu-h5') }),
    h.user(79.5, 'h-m-u7', { result: true }),
    h.assistant(80, 'h-m-a7', 'hm-7', OUT(5000)),
  ],
  agents: [
    hAgent('h1', 'architect', 1, 10000, OPUS, 'main'),
    hAgent('h2', 'cap-backend-dev', 21, 20000, OPUS),
    hAgent('h3', 'fiori-app-dev', 41, 20000, SONNET),
    hAgent('h4', 'test-backend', 61, 10000, SONNET),
    hAgent('h5', 'architect', 71, 10000, OPUS),
  ],
};
const i = thread(5, LIVE);
const iBranch = {
  id: 'i-branch',
  main: [
    i.user(200, 'i-m-u0', { branch: 'main', prompt: true }),
    i.assistant(201, 'i-m-a0', 'i-0', OUT(5000), { branch: 'main' }),
    i.user(210, 'i-m-u1', { prompt: true }),
    i.assistant(211, 'i-m-a1', 'i-1', OUT(5000)),
  ],
  agents: [],
};

// D4 partial cost: nothing priced at all, next to a process record (cost-state $0.50), so the
// transcript total, the recovered ratio and the rework share have no priced part to stand on.
const k = thread(7, 'feature/fixture-unpriced');
const kUnpriced = {
  id: 'k-unpriced',
  main: [
    k.user(0, 'k-u0', { origin: 'human' }),
    k.assistant(1, 'k-a1', 'k-1', [1000, 0, 0, 0, 1000], { model: UNKNOWN_MODEL }),
    costStateRecord(
      1_788_300_000_000,
      0.5,
      { [UNKNOWN_MODEL]: modelUsage([1000, 0, 0, 1000], 0.5) },
      1
    ),
  ],
  agents: [],
};

export const SESSIONS = [
  aMain,
  bResumed,
  cTime,
  dCost,
  eDrift,
  fUnknown,
  gHistory,
  hLive,
  iBranch,
  kUnpriced,
];

// ---------- event logs built in code (records of research/data-flow.md section 2) ----------

const event = (day, min, record) => ({ ts: iso(day, min), ...record });
const TOKENS = (output, [input, write5m, write1h, read] = [0, 0, 0, 0]) => ({
  input,
  cacheWrite5m: write5m,
  cacheWrite1h: write1h,
  cacheRead: read,
  output,
});

/**
 * D13 live path of `a-main`: the UserPromptSubmit hook's six `prompt` records in the window of the
 * six counted turn inputs (it fires for prompts, hand-backs and notices alike); no command marker.
 */
export const DEMO_EVENTS = [0, 2.8, 2.85, 2.9, 2.92, 2.94].map((min) =>
  event(0, min, { event: 'prompt' })
);

/**
 * The live `agent-stop` race (F4) on `c-time`: SubagentStop fires before the agent's final message
 * reaches its file. First stop at 69.6: the file held c-1-u0..c-1-u1 (c1-1 only, lastTs 68;
 * active 1.5 + Bash gap 2 = 3.5). After the SendMessage resume, the last stop at 71.9: the file held
 * c-1-u0..c-1-u2 (c1-1, c1-2: output 2,000, $0.04, lastTs 71.5; active 1.5 + 2 + 1.5 + 2 = 7), not
 * c-1-a3 (c1-3 at 71.8), so the file holds one request more than the last record.
 */
export const TIME_EVENTS = [
  event(1, 64.2, { event: 'agent-start', agent: 'c1', agentType: 'cap-backend-dev' }),
  event(1, 69.6, {
    event: 'agent-stop',
    agent: 'c1',
    agentType: 'cap-backend-dev',
    model: OPUS,
    requests: 1,
    tokens: TOKENS(1000),
    costUSD: 0.02,
    activeMin: 3.5,
    leadMin: 3.5,
    toolCalls: 1,
    firstTs: iso(1, 64.5),
    lastTs: iso(1, 68),
  }),
  event(1, 71.9, {
    event: 'agent-stop',
    agent: 'c1',
    agentType: 'cap-backend-dev',
    model: OPUS,
    requests: 2,
    tokens: TOKENS(2000),
    costUSD: 0.04,
    activeMin: 7,
    leadMin: 7,
    toolCalls: 1,
    firstTs: iso(1, 64.5),
    lastTs: iso(1, 71.5),
  }),
];

/**
 * Two stops without an agent file, added to TIME_EVENTS: `c2` (docs-keeper on claude-sonnet-5-5,
 * 2 requests: 500*2 + 19,600*2.5 + 100,000*0.2 + 3,000*10 = 100,000 / 1e6 = $0.10, active 0.8) is
 * the fallback row; `c3` (an internal agent: empty type, 0 requests) stands in for nothing.
 */
export const MISSING_AGENT_EVENTS = [
  event(1, 72.05, { event: 'agent-start', agent: 'c2', agentType: 'docs-keeper' }),
  event(1, 72.95, {
    event: 'agent-stop',
    agent: 'c2',
    agentType: 'docs-keeper',
    model: SONNET_55,
    requests: 2,
    tokens: TOKENS(3000, [500, 19600, 0, 100000]),
    costUSD: 0.1,
    activeMin: 0.8,
    leadMin: 0.8,
    toolCalls: 1,
    firstTs: iso(1, 72.1),
    lastTs: iso(1, 72.9),
  }),
  event(1, 72.97, {
    event: 'agent-stop',
    agent: 'c3',
    agentType: '',
    model: null,
    requests: 0,
    tokens: TOKENS(0),
    costUSD: 0,
    activeMin: 0,
    leadMin: 0,
    toolCalls: 0,
  }),
];

// ---------- plan texts (D12) ----------

const planText = (status, steps) =>
  [
    '# fixture-plan: plan',
    '',
    `Date: 2026-09-07. Status: ${status} Gate mode: semi-autonomous.`,
    '',
    '## Acceptance criteria',
    '- [ ] a criterion',
    '',
    '## Steps',
    '',
    ...steps,
    '',
    '## Risks',
    '- none',
    '',
  ].join('\n');

/** An approved plan whose Steps table has `Phase` and `Agent` columns (data-flow section 5). */
export const PLAN_STEPS = planText('approved (user, 2026-09-07).', [
  '| # | Phase | Agent | Files | Pattern | Check |',
  '|---|---|---|---|---|---|',
  '| 1 | 2: backend | `cap-backend-dev`, then `test-backend` | `srv/catalog-service.js` | | `npm test` |',
  '| 2 | 4: verification | `test-backend` | `VERIFICATION.md` | | |',
  '| 3 | 5a: review follow-up | `architect` | `research/definitions.md` | | |',
  '| 4 | 6: documentation | orchestrator | `docs/STATE.md` | | |',
]);
/** The same steps without a `Phase` column: no plan assignment, the home-phase fallback. */
export const PLAN_NO_PHASE = planText('approved (user, 2026-09-07).', [
  '| # | Agent | Files | Check |',
  '|---|---|---|---|',
  '| 1 | `cap-backend-dev`, then `test-backend` | `srv/catalog-service.js` | `npm test` |',
  '| 2 | `test-backend` | `VERIFICATION.md` | |',
  '| 3 | `architect` | `research/definitions.md` | |',
]);
/** A `Phase` column without numbers (templates/feature/PLAN.md today): no pair, the fallback. */
export const PLAN_UNNUMBERED = planText('approved (user, 2026-09-07).', [
  '| # | Phase | Agent | Files | Pattern | Check |',
  '|---|---|---|---|---|---|',
  '| 1 | Backend: model | `cap-backend-dev` | `db/schema.cds` | New entity | `npm run lint` |',
  '| 2 | Backend: logic | `cap-backend-dev`, then `test-backend` | `srv/catalog-service.js` | | |',
]);

/**
 * Writes the sessions as a Claude Code project directory: `<id>.jsonl` and
 * `<id>/subagents/agent-<agent>.jsonl` + `.meta.json` (`agentType`, `toolUseId`).
 */
export function writeFixture(dir) {
  const jsonl = (records) => records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.mkdirSync(dir, { recursive: true });
  for (const s of SESSIONS) {
    fs.writeFileSync(path.join(dir, `${s.id}.jsonl`), jsonl(s.main));
    if (!s.agents.length) continue;
    const sub = path.join(dir, s.id, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    for (const a of s.agents) {
      fs.writeFileSync(path.join(sub, `agent-${a.id}.jsonl`), jsonl(a.records));
      fs.writeFileSync(
        path.join(sub, `agent-${a.id}.meta.json`),
        JSON.stringify({ agentType: a.agentType, toolUseId: a.toolUseId })
      );
    }
  }
  return dir;
}

// ---------- expected figures, by hand ----------

export const EXPECTED = {
  demo: {
    // r-main-1: two identical records count once: output 10,000, not 20,000.
    identical: { input: 1000, cacheWrite5m: 100000, cacheRead: 500000, output: 10000 },
    // r-a1-1: per field max of (500, 30000, 0, 100000, 4000) and (500, 30000, 0, 90000, 9000).
    growing: { input: 500, cacheWrite5m: 30000, cacheWrite1h: 0, cacheRead: 100000, output: 9000 },
    // r-a1-2: snapshot records only, no final record, outputs 1,000 and 6,000.
    nullStop: { cacheRead: 130000, output: 6000 },
    // a-main 3 (r-main-1, r-synth, r-main-2) + a1 2 + a2 1 + b-resumed 2 (r-b-1, r-b-2).
    requests: 8,
    // Timeline points: a-main 9 (6 + the user records a-m-u3, a-m-u4, a-m-u5; attachments are no
    // points) + a1 6 (5 + a-1-u2) + a2 2 + b-resumed 4; its 3 copied records are no points.
    points: 21,
    // D2 over a-main with its subagents (requests r-main-1, r-main-2, r-a1-1, r-a1-2 | r-a2-1).
    opus: {
      calls: 4,
      input: 1000 + 2000 + 500 + 300, // 3,800
      cacheWrite5m: 100000 + 30000, // 130,000
      cacheWrite1h: 200000,
      cacheRead: 500000 + 800000 + 100000 + 130000, // 1,530,000
      output: 10000 + 5000 + 9000 + 6000, // 30,000
      thinking: 4000,
    },
    sonnet: {
      calls: 1,
      input: 700,
      cacheWrite5m: 0,
      cacheWrite1h: 40000,
      cacheRead: 200000,
      output: 3000,
    },
    skipped: 1,
    // D4: 3,800*4 + 130,000*5 + 200,000*8 + 1,530,000*0.2 + 30,000*20 = 3,171,200 / 1e6.
    opusUSD: 3.1712,
    // The same tokens with every cache write at the 1h rate: + 130,000 * (8 - 5) / 1e6.
    opusAll1hUSD: 3.5612,
    // 700*2 + 40,000*4 + 200,000*0.2 + 3,000*10 = 231,400 / 1e6.
    sonnetUSD: 0.2314,
    // a-main 3.4026 + r-b-1 0.582 (3,000*4 + 50,000*5 + 900,000*0.2 + 7,000*20)
    //                + r-b-2 0.616 (4,000*4 + 1,000,000*0.2 + 20,000*20).
    wholeUSD: 4.6006,
    // Feature fixture-demo: r-b-2 is on `main`, outside the scope.
    featureUSD: 3.9846,
    // Reference total: the process total of the last snapshot (6), not 2 + 4 + 6 or 4 + 6.
    processUSD: 6,
    // Proportional share: 6 * 3.9846 / 4.6006 = 5.19662...; recovered 3.9846 / 5.19662 = 4.6006 / 6.
    featureCostStateUSD: 5.1966,
    featureRecovered: 0.767,
    featureUnattributedUSD: 1.212,
    // Feature timeline: 0, 1, 1.5, 1.6, 2, 2, 2.2, 2.5, 2.7, 3, 3.2, 3.5, 4 | 60, 61; every gap is a
    // turn gap below 5 min except 4 -> 60 (counts 5): active 5 + 5 = 10, lead 61.
    featureActiveMin: 10,
    featureLeadMin: 61,
    featureCalls: 6,
    launches: 2,
  },
  // D13 on the feature fixture-demo (a-main + b-resumed, main threads only).
  inputs: {
    // The kind slim() keeps per record; a-m-u5 (no origin) and a1's `coordinator` record get none.
    kinds: {
      'a-m-u1': 'human',
      'a-m-u3': 'peer',
      'a-m-q1': 'task-notification',
      'a-m-u4': 'task-notification',
      'a-m-q2': 'human',
      'a-m-q3': 'task-notification',
    },
    // prompts: a-m-u1 + a-m-q2 (b-m-u1 has no origin, b-m-u2 is on `main` without one either);
    // handbacks: a-m-u3 once (b-resumed's copy is dropped); notifications: a-m-q1, a-m-u4, a-m-q3.
    figures: { prompts: 2, handbacks: 1, notifications: 3 },
    // DEMO_EVENTS: the hook's count in the same window, which moves none of the three figures.
    promptEvents: 6,
    // b-resumed alone: the copied hand-back is its own record there.
    resumed: { prompts: 0, handbacks: 1, notifications: 0 },
  },
  time: {
    // Merged timeline (min): 0 1 13 14 54 55 63 64 64.5 66 68 69.5 70 71 71.5 71.8 72 73.
    // Gaps: 1, 12 Bash -> 10, 1, 40 turn -> 5, 1, 8 AskUserQuestion -> 5, 1, then 64..70 filled by
    // c1 (0.5 + 1.5 + 2 + 1.5 + 0.5 = 6), 1, 0.5, 0.3, 0.2, 1 = 33.
    mergedMin: 33,
    // Main alone: 1 + 10 + 1 + 5 + 1 + 5 + 1 + 5 (Agent 64 -> 70 is a turn gap) + 1 + 1 + 1 = 32.
    mainMin: 32,
    // c1 alone: 64.5 66 68 69.5 71.5 71.8 -> 1.5 + 2 + 1.5 + 2 + 0.3 = 7.3.
    agentMin: 7.3,
    // Merged with a 5-minute tool cap: the Bash gap counts 5 instead of 10.
    mergedTool5Min: 28,
    leadMin: 73,
    waitingMin: 40, // 73 - 33
    agentMinutes: 39.3, // 32 + 7.3
    parallelism: 1.19, // 39.3 / 33 = 1.1909
    resumes: 1,
  },
  cost: {
    // opus 1,000*4 + 100,000*5 + 100,000*8 + 1,000,000*0.2 + 7,200*20 = 1,648,000 / 1e6 = 1.648;
    // sonnet 1,000*2 + 500,000*0.2 + 5,000*10 = 152,000 / 1e6 = 0.152.
    transcriptUSD: 1.8,
    costStateUSD: 2, // the last snapshot, not 1 + 2
    recovered: 0.9,
    unattributedUSD: 0.2,
    // Pricing check of the last snapshot, cache writes split by the transcript share (opus 5m
    // 100,000 of 200,000 = 0.5 -> 6.5 per MTok; sonnet has no writes -> all 5m):
    // opus 2,000*4 + 200,000*6.5 + 1,200,000*0.2 + 20,000*20 = 1,948,000 / 1e6 = 1.948 = costUSD;
    // sonnet 1,000*2 + 240,000*0.2 + 200*10 = 52,000 / 1e6 = 0.052 = costUSD.
    opusPricedUSD: 1.948,
    sonnetPricedUSD: 0.052,
    // e-drift: opus costUSD 2.1428 = 1.948 * 1.1, divergence 0.1948 / 2.1428 = 0.0909.
    driftOpusCostUSD: 2.1428,
  },
  unknown: {
    pricedUSD: 0.1, // f-2: 5,000 * 20 / 1e6; f-1 has no price
    // D4 partial cost: f-unknown's total, main row and orchestration phase row are the priced part
    // ($0.10, printed `≥$0.10`); k-unpriced has no priced part (null, `n/a`, no rework share) and a
    // process total of $0.50, against which reconcile has no transcript total and no ratio. Its
    // only process lies wholly in the session: share 1 on the card and in reconcile alike ($0.50,
    // unattributed $0.50 - $0 = $0.50). Shared with a second session and nothing priced, there is
    // no basis for a split: no cost-state figure and `cost-state-share-unknown:<startTime>`.
    unpricedCostStateUSD: 0.5,
    unpricedStartTime: 1_788_300_000_000,
  },
  history: {
    // Home phases: architect 1, fiori-app-dev 3, architect 1 (after 3: rework), reviewer 5.
    rework: [false, false, true, false],
    // main 0.2 (gm-1) | g1 0.2, g2 0.4, g3 0.2 (opus 10k/20k/10k out), g4 0.2 (sonnet 20k out).
    costUSD: 1.2,
    reworkUSD: 0.2,
    reworkShare: 0.167, // 0.2 / 1.2
    // No event log: the Stop-hook summaries, one of two with non-empty hookErrors; one human
    // prompt (g-m-u0, D13).
    gateBlocks: { 'stop-gate': 1 },
    prompts: 1,
    phases: {
      1: { calls: 2, costUSD: 0.4, reworkUSD: 0.2 },
      3: { calls: 1, costUSD: 0.4, reworkUSD: 0 },
      5: { calls: 1, costUSD: 0.2, reworkUSD: 0 },
      orchestration: { calls: 5, costUSD: 0.2, reworkUSD: 0 },
    },
  },
  live: {
    // Launches h1 (before the first marker: home phase 1, no rework), h2 in phase 2 (home 2),
    // h3 in phase 3 (home 3), h4 test-backend in re-entered phase 2 (home 2; the history rule would
    // flag it after fiori-app-dev), h5 architect in phase 2 (home 1: rework).
    rework: [false, false, false, false, true],
    historyRuleRework: [false, false, false, true, true],
    // main hm-0 0.1 + hm-7 0.1 | h1 0.2, h2 0.4, h3 0.2, h4 0.1, h5 0.2.
    costUSD: 1.3,
    calls: 13,
    reworkShare: 0.154, // 0.2 / 1.3
    // Markers 2 (20), 3 (40), 3 again (45, same phase: no new round), 2 (60).
    rounds: { 2: 2, 3: 1 },
    phases: {
      0: { calls: 3, costUSD: 0.1 }, // hm-0, hm-1, hm-2: main-thread records before the first marker
      1: { calls: 1, costUSD: 0.2 }, // h1: a launch before the first marker takes its home phase
      2: { calls: 7, costUSD: 0.8, reworkUSD: 0.2 }, // hm-3, hm-5, hm-6, hm-7, h2, h4, h5
      3: { calls: 2, costUSD: 0.2, reworkUSD: 0 }, // hm-4, h3
    },
    // D13 from the transcript: h-m-u0, h-m-u1, h-m-u3 (`human`), not the log's 2 `prompt` records.
    prompts: 3,
    // With `issue: 7` the `/spec #7` window (from minute 0.5) adds h-live's `main` records after
    // it: h-live 12 calls ($1.20) + i-branch i-1 ($0.10); hm-0 and i-0 stay outside.
    feature: { sessions: 2, calls: 13, costUSD: 1.3, firstMin: 0.5, lastMin: 211 },
    // Without the issue only the branch joins: hm-3..hm-7, h2..h5 (9 calls, $1.00) + i-1.
    branchOnly: { sessions: 2, calls: 10, costUSD: 1.1, firstMin: 19 },
  },
  // D12 against PLAN_STEPS: cap-backend-dev in 2, test-backend in 2 and 4, architect in 5 (`5a`);
  // `orchestrator` and the file names are no agent types. Launch times in minutes of day 6.
  plan: {
    assignments: [
      ['cap-backend-dev', ['2']],
      ['test-backend', ['2', '4']],
      ['architect', ['5']],
    ],
    // Live, markers 2 (10), 4 (20), 2 (30): architect at 5 (before the first marker: never rework),
    // test-backend at 21 (phase 4 is planned for it: not rework although its home is 2), architect
    // at 31 (phase 2, planned only in 5: rework, home 1), cap-backend-dev at 32 (phase 2, planned).
    live: [
      ['architect', 5],
      ['test-backend', 21],
      ['architect', 31],
      ['cap-backend-dev', 32],
    ],
    liveRework: [false, false, true, false],
    // No plan: the home-phase rule alone also flags test-backend in phase 4.
    liveFallback: [false, true, true, false],
    // History, no markers; H = the highest home phase launched before: cap-backend-dev (H 0,
    // planned in 2), fiori-app-dev (H 2, home 3 >= 2), test-backend (H 3, planned in 4 >= 3),
    // architect (H 3, planned in 5 >= 3), docs-keeper (H 3, home 6), test-backend (H 6: no plan
    // phase >= 6, home 2 < 6).
    history: [
      'cap-backend-dev',
      'fiori-app-dev',
      'test-backend',
      'architect',
      'docs-keeper',
      'test-backend',
    ],
    historyRework: [false, false, false, false, false, true],
    // No plan assignment: home 2, 3, 2 < 3, 1 < 3, 6, 2 < 6.
    historyFallback: [false, false, true, true, false, true],
    // g-history against PLAN_STEPS: architect (H 0, planned in 5), fiori-app-dev (home 3),
    // architect (H 3, planned in 5 >= 3: no longer rework), reviewer (home 5): no rework cost.
    gHistory: { reworkUSD: 0, reworkShare: 0 },
  },
  // F4 on c-time with TIME_EVENTS: c1's last stop (2 requests, lastTs 71.5) equals the re-parse cut
  // at 71.5, while the whole file also holds c1-3 (uncut output 3,000 against 2,000 live: 33%).
  race: {
    // Requests: main c-1..c-6 + c1 c1-1..c1-3, each opus output 1,000 ($0.02).
    calls: 9,
    costUSD: 0.18,
    liveRequests: 2,
    // The row from the file: 3 calls (one more than the record), active 7.3 (time.agentMin).
    agent: {
      agentType: 'cap-backend-dev',
      launches: 1,
      resumes: 1,
      calls: 3,
      activeMin: 7.3,
      costUSD: 0.06,
    },
    // The last stop's output skewed: 2,100 is 100 / 2,100 = 4.8% off (warns), 2,010 is 0.5% (not).
    skewOutput: 2100,
    toleratedOutput: 2010,
    // With MISSING_AGENT_EVENTS: c2's row from its record, no timeline point (lead 73 and active 33
    // stay), its own active 0.8 adds to agent-minutes (39.3 + 0.8 = 40.1; 40.1 / 33 = 1.215).
    missing: {
      leadMin: 73,
      activeMin: 33,
      agentMin: 40.1,
      parallelism: 1.22,
      launches: 2,
      calls: 11, // 9 + c2's 2
      costUSD: 0.28, // 0.18 + 0.10
      agent: {
        agentType: 'docs-keeper',
        launches: 1,
        resumes: 0,
        activeMin: 0.8,
        calls: 2,
        costUSD: 0.1,
        costPartial: false,
        reworkLaunches: 0,
      },
      // No markers: docs-keeper's home phase 6, without a timeline point there.
      phase6: { rounds: null, activeMin: 0, calls: 2, costUSD: 0.1 },
    },
    // Feature scope with c1's file gone: its last record stands in (2 calls, $0.04, active 7).
    gone: { agentType: 'cap-backend-dev', launches: 1, calls: 2, activeMin: 7, costUSD: 0.04 },
  },
};
