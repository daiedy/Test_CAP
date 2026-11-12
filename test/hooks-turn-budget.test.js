// The turn note of ADR-0032: scripts/hooks/turn-budget.mjs (PostToolBatch, subagents only) counts
// the turns of a subagent's current run in its own transcript and, from turn
// `maxTurns - reserve(maxTurns)` on, hands the note as `additionalContext` and appends one
// `turn-note` record. The hook runs from the sandbox of test/fixtures/hook-sandbox.mjs (copies of
// scripts/ plus the agent definitions below), the subagent files are synthetic
// (`turnRecords()` of test/fixtures/transcript-fixture.mjs) in a temp directory of their own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  agentMaxTurns,
  reserve,
  TURN_LAST_CALL,
  TURN_NOTE_EVENT,
} from '../scripts/lib/turn-budget.mjs';
import { createSandbox } from './fixtures/hook-sandbox.mjs';
import { turnRecords, writeAgentFile } from './fixtures/transcript-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const SESSION = `test-turn-budget-${process.pid}`;
/** A tool result in the batch input: the hook reads and logs nothing of it. */
const SENTINEL = 'SENTINEL-turn-7c1e';
/** Agent definitions of the sandbox: limits 30 and 60, a definition without a limit (its body
 * holds a `maxTurns:` line that is no frontmatter), and a file that is no agent definition. */
const AGENTS = {
  '.claude/agents/test-backend.md':
    '---\nname: test-backend\ndescription: tester\nmaxTurns: 30\n---\n\nBody.\n',
  '.claude/agents/cap-backend-dev.md':
    '---\nname: cap-backend-dev\nmodel: opus\nmaxTurns: 60\n---\n\nBody.\n',
  '.claude/agents/no-limit.md':
    '---\nname: no-limit\n---\n\nmaxTurns: 40\nA body line is no limit.\n',
  '.claude/agents/notes.txt': '---\nmaxTurns: 12\n---\n',
};
/** No variable of the running session reaches the hook. */
const UNSET = ['PIPELINE_ALLOW_PROTECTED', 'PIPELINE_SKIP_GATE'];

/** The note text of CONTEXT "Backend: the hook", `K = m - n` turns left. */
const note = (n, m) =>
  `Turn ${n} of ${m} (${m - n} left): start no new item; write the current state into your ` +
  'document (mark an unfinished row), stop the processes you started, hand back your report ' +
  'through SubagentHandback.';
/** The sharper text at `K <= 3` (probe P6 fallback). */
const lastCall = (n, m) =>
  `Turn ${n} of ${m}: hand back your report through SubagentHandback in this turn; a denied ` +
  'handback needs a turn to fix.';

let box;
let txDir;

beforeAll(() => {
  box = createSandbox({ prefix: 'hooks-turn-budget', session: SESSION, files: AGENTS });
  txDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-turn-budget-tx-')));
});

afterAll(() => {
  box.remove();
  fs.rmSync(txDir, { recursive: true, force: true });
});

/** Runs the hook with `stdin` as is; returns its result, its context and the records it appended. */
function raw(stdin) {
  const env = { ...process.env };
  for (const k of UNSET) delete env[k];
  const { res, records } = box.appended(() =>
    spawnSync('node', [path.join(box.root, 'scripts', 'hooks', 'turn-budget.mjs')], {
      input: stdin,
      encoding: 'utf8',
      env,
    })
  );
  expect(res.status).toBe(0);
  expect(res.stderr).toBe('');
  const context = res.stdout ? JSON.parse(res.stdout).hookSpecificOutput : null;
  return { stdout: res.stdout, context, records };
}

/** The `tool_calls` of a batch: one call per tool use id, each result holding SENTINEL. */
const calls = (...ids) =>
  ids.map((tool_use_id) => ({
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    tool_use_id,
    tool_response: SENTINEL,
  }));

/** A PostToolBatch input: the common fields, `payload`, and a call `toolu_1` that is in no file. */
const send = (payload) =>
  raw(
    JSON.stringify({
      session_id: SESSION,
      cwd: box.root,
      hook_event_name: 'PostToolBatch',
      tool_calls: calls('toolu_1'),
      ...payload,
    })
  );

/** The tool use id `turnRecords()` writes for turn `n` of agent `bare`. */
const toolId = (bare, n) => `${bare}-tu${n}`;

/** Writes subagent `agentId`'s file with `runs` (turns per run) and sends its batch: by default
 * the batch of the file's last turn, already on disk (its tool use id); `extra` overrides. */
function batch(agentId, agentType, runs, extra = {}) {
  const bare = agentId.replace(/^agent-/, '');
  const transcript_path = writeAgentFile(txDir, SESSION, bare, turnRecords(bare, runs));
  const last = runs.reduce((a, b) => a + b, 0);
  return send({
    transcript_path,
    agent_id: agentId,
    agent_type: agentType,
    tool_calls: calls(toolId(bare, last)),
    ...extra,
  });
}

const SILENT = { stdout: '', context: null, records: [] };
const record = (agent, agentType, turn, maxTurns) => ({
  event: 'turn-note',
  agent,
  agentType,
  turn,
  maxTurns,
});

describe('turn-budget hook (ADR-0032)', () => {
  it('main thread is silent', () => {
    // The main transcript at turn 29 of a 30-turn type: no agent id means the main thread.
    const transcript_path = path.join(txDir, `${SESSION}.jsonl`);
    fs.writeFileSync(
      transcript_path,
      turnRecords('main', [29])
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n'
    );
    expect(send({ transcript_path, agent_type: 'test-backend' })).toEqual(SILENT);
    expect(send({ transcript_path })).toEqual(SILENT);
    for (const agent_id of ['', '   ', null, 7])
      expect(send({ transcript_path, agent_id, agent_type: 'test-backend' })).toEqual(SILENT);
  });

  it('silent below the threshold', () => {
    // 30 - reserve(30) = 24, 60 - reserve(60) = 54: the last silent turns are 23 and 53.
    for (const turns of [1, 10, 23]) expect(batch('s1', 'test-backend', [turns])).toEqual(SILENT);
    for (const turns of [1, 53]) expect(batch('s2', 'cap-backend-dev', [turns])).toEqual(SILENT);
  });

  it('notes from the threshold', () => {
    for (let n = 24; n <= 30; n++) {
      const out = batch('t1', 'test-backend', [n]);
      expect(out.context).toEqual({
        hookEventName: 'PostToolBatch',
        additionalContext: 30 - n > TURN_LAST_CALL ? note(n, 30) : lastCall(n, 30),
      });
      expect(out.context.additionalContext.startsWith(`Turn ${n} of 30`)).toBe(true);
      expect(out.records).toEqual([record('t1', 'test-backend', n, 30)]);
    }
    expect(note(24, 30)).toContain('Turn 24 of 30 (6 left): ');

    // 60 turns: the threshold is 54, six left.
    const sixty = batch('t2', 'cap-backend-dev', [54]);
    expect(sixty.context.additionalContext).toBe(note(54, 60));
    expect(sixty.records).toEqual([record('t2', 'cap-backend-dev', 54, 60)]);

    // An `agent-` prefixed id finds the same file and logs the bare id.
    const prefixed = batch('agent-t3', 'test-backend', [25]);
    expect(prefixed.context.additionalContext).toBe(note(25, 30));
    expect(prefixed.records).toEqual([record('t3', 'test-backend', 25, 30)]);

    // The event name is echoed, so the fallback events work unchanged.
    const echoed = batch('t4', 'test-backend', [24], { hook_event_name: 'PostToolUse' });
    expect(echoed.context).toEqual({
      hookEventName: 'PostToolUse',
      additionalContext: note(24, 30),
    });
    expect(echoed.records[0].event).toBe(TURN_NOTE_EVENT);

    // Nothing of the tool calls reaches the output or the event log.
    expect(prefixed.stdout).not.toContain(SENTINEL);
    expect(JSON.stringify(box.log())).not.toContain(SENTINEL);
  });

  it('last turns ask for the handback', () => {
    expect(TURN_LAST_CALL).toBe(3);
    // K = 4: the closing steps, not yet the handback in this turn.
    const four = batch('l1', 'test-backend', [26]);
    expect(four.context.additionalContext).toBe(note(26, 30));
    expect(four.context.additionalContext).toContain('(4 left)');
    expect(four.context.additionalContext).not.toContain('in this turn');
    // K = 3, 2, 1: the handback in this turn.
    for (const n of [27, 28, 29]) {
      const out = batch('l1', 'test-backend', [n]);
      expect(out.context.additionalContext).toBe(lastCall(n, 30));
      expect(out.records).toEqual([record('l1', 'test-backend', n, 30)]);
    }
    // The same edge at 60 turns.
    expect(batch('l2', 'cap-backend-dev', [56]).context.additionalContext).toBe(note(56, 60));
    expect(batch('l2', 'cap-backend-dev', [57]).context.additionalContext).toBe(lastCall(57, 60));
  });

  it('a resume restarts the run', () => {
    // 28 + 5 turns in the file, 5 in the run after the `coordinator` resume: silent.
    expect(batch('r1', 'test-backend', [28, 5])).toEqual(SILENT);
    // 5 + 24: the run after the resume reaches the threshold alone.
    const resumed = batch('r1', 'test-backend', [5, 24]);
    expect(resumed.context.additionalContext).toBe(note(24, 30));
    expect(resumed.records).toEqual([record('r1', 'test-backend', 24, 30)]);
    // The last resume opens the run that counts.
    const twice = batch('r1', 'test-backend', [28, 20, 25]);
    expect(twice.context.additionalContext).toBe(note(25, 30));
    expect(twice.records).toEqual([record('r1', 'test-backend', 25, 30)]);
  });

  it('counts each request once', () => {
    // The fixture really holds the repeats: two `assistant` records per request id, and an
    // `api-request` record with a request id of its own plus an `api-request-blob` per turn.
    const records = turnRecords('c1', [12]);
    const kinds = (type) => records.filter((r) => r.type === type);
    expect(kinds('assistant')).toHaveLength(24);
    expect(new Set(kinds('assistant').map((r) => r.requestId)).size).toBe(12);
    expect(kinds('api-request')).toHaveLength(12);
    expect(kinds('api-request-blob')).toHaveLength(12);
    expect(new Set(records.map((r) => r.requestId).filter(Boolean)).size).toBe(24);
    // 12 turns read as 24 by a record or request-id count would note; one per request is silent.
    expect(batch('c1', 'test-backend', [12])).toEqual(SILENT);
    const exact = batch('c1', 'test-backend', [24]);
    expect(exact.context.additionalContext).toBe(note(24, 30));
    expect(exact.records).toEqual([record('c1', 'test-backend', 24, 30)]);
  });

  it('silent on unknowns', () => {
    // An agent type without a definition (Claude Code internal agents) and one without
    // `maxTurns` (its body line `maxTurns: 40` would note at 39).
    expect(batch('u1', 'general-purpose', [29])).toEqual(SILENT);
    expect(batch('u2', 'no-limit', [39])).toEqual(SILENT);
    // No agent type, and an agent type that is no string.
    expect(batch('u3', undefined, [29])).toEqual(SILENT);
    expect(batch('u3', 7, [29])).toEqual(SILENT);
    // A missing transcript: no agent file, no `transcript_path`, a path that is no `.jsonl`.
    const transcript_path = path.join(txDir, `${SESSION}.jsonl`);
    expect(send({ transcript_path, agent_id: 'u4', agent_type: 'test-backend' })).toEqual(SILENT);
    expect(send({ agent_id: 'u1', agent_type: 'test-backend' })).toEqual(SILENT);
    batch('u5', 'test-backend', [29]);
    expect(send({ transcript_path: txDir, agent_id: 'u5', agent_type: 'test-backend' })).toEqual(
      SILENT
    );
    // No event name.
    expect(
      send({ transcript_path, agent_id: 'u5', agent_type: 'test-backend', hook_event_name: '' })
    ).toEqual(SILENT);
    // Malformed input on stdin.
    for (const stdin of ['', '{not json', 'null', '[]', '42']) expect(raw(stdin)).toEqual(SILENT);
    // The control: the same agent file with every field present notes.
    expect(
      send({
        transcript_path,
        agent_id: 'u5',
        agent_type: 'test-backend',
        tool_calls: calls(toolId('u5', 29)),
      }).context.additionalContext
    ).toBe(lastCall(29, 30));
  });

  it('a batch not yet on disk counts', () => {
    // A lagged read at the threshold (Claude Code 2.1.323, VERIFICATION check 1): the file holds
    // 23 turns, the batch is turn 24, its tool use not yet written. The batch is the 24th turn.
    const lagged = batch('n1', 'test-backend', [23], { tool_calls: calls(toolId('n1', 24)) });
    expect(lagged.context).toEqual({
      hookEventName: 'PostToolBatch',
      additionalContext: note(24, 30),
    });
    expect(lagged.records).toEqual([record('n1', 'test-backend', 24, 30)]);
    // At 60 turns, and at the edge of the sharper text.
    const sixty = batch('n2', 'cap-backend-dev', [53], { tool_calls: calls(toolId('n2', 54)) });
    expect(sixty.context.additionalContext).toBe(note(54, 60));
    const last = batch('n1', 'test-backend', [26], { tool_calls: calls(toolId('n1', 27)) });
    expect(last.context.additionalContext).toBe(lastCall(27, 30));
    // Parallel calls of the batch, none on disk: one turn, not one per call.
    const parallel = batch('n1', 'test-backend', [23], {
      tool_calls: calls(toolId('n1', 24), toolId('n1', 25)),
    });
    expect(parallel.context.additionalContext).toBe(note(24, 30));
    // After a resume the run counts alone: 28 + 23 on disk, the batch is turn 24 of the resume.
    const resumed = batch('n3', 'test-backend', [28, 23], { tool_calls: calls(toolId('n3', 52)) });
    expect(resumed.context.additionalContext).toBe(note(24, 30));
    expect(resumed.records).toEqual([record('n3', 'test-backend', 24, 30)]);
    // Only the ids are read: an on-disk id inside `tool_input` and `tool_response` does not make
    // the batch on disk, and neither SENTINEL nor any id reaches the output or the event log.
    const onDiskId = toolId('n4', 23);
    const nested = batch('n4', 'test-backend', [23], {
      tool_calls: [
        {
          tool_name: 'Bash',
          tool_input: { command: onDiskId, tool_use_id: onDiskId },
          tool_use_id: toolId('n4', 24),
          tool_response: { stdout: SENTINEL, tool_use_id: onDiskId },
        },
      ],
    });
    expect(nested.context.additionalContext).toBe(note(24, 30));
    expect(nested.records).toEqual([record('n4', 'test-backend', 24, 30)]);
    for (const out of [lagged, parallel, nested]) {
      expect(out.stdout).not.toContain(SENTINEL);
      expect(out.stdout).not.toMatch(/-tu\d/);
    }
    const log = JSON.stringify(box.log());
    expect(log).not.toContain(SENTINEL);
    expect(log).not.toMatch(/-tu\d/);
  });

  it('a batch on disk counts once', () => {
    // The batch's tool use is in the file: the file count, no turn added.
    expect(batch('o1', 'test-backend', [23])).toEqual(SILENT);
    const at = batch('o1', 'test-backend', [24]);
    expect(at.context.additionalContext).toBe(note(24, 30));
    expect(at.records).toEqual([record('o1', 'test-backend', 24, 30)]);
    // Any tool use of the run is enough: an earlier turn's id.
    expect(batch('o1', 'test-backend', [23], { tool_calls: calls(toolId('o1', 5)) })).toEqual(
      SILENT
    );
    // Parallel calls of one request, the first written and the second not yet: on disk.
    expect(
      batch('o1', 'test-backend', [23], { tool_calls: calls(toolId('o1', 23), 'toolu_late') })
    ).toEqual(SILENT);
    expect(
      batch('o1', 'test-backend', [23], { tool_calls: calls('toolu_late', toolId('o1', 23)) })
    ).toEqual(SILENT);
    // After a resume, the run's own id: 28 + 23 turns in the file, 23 in the run.
    expect(batch('o2', 'test-backend', [28, 23])).toEqual(SILENT);
    expect(batch('o2', 'test-backend', [28, 24]).context.additionalContext).toBe(note(24, 30));
  });

  it('no batch ids counts the file', () => {
    // No `tool_calls[].tool_use_id` string: the file alone, 23 silent and 24 at the threshold.
    const variants = [
      { tool_calls: undefined },
      { tool_calls: [] },
      { tool_calls: [{ tool_name: 'Bash', tool_response: SENTINEL }] },
      { tool_calls: [{ tool_use_id: 7 }, { tool_use_id: null }, null, toolId('f1', 24)] },
      { tool_calls: { tool_use_id: toolId('f1', 24) } },
      { tool_calls: toolId('f1', 24) },
    ];
    for (const extra of variants) {
      expect(batch('f1', 'test-backend', [23], extra), JSON.stringify(extra)).toEqual(SILENT);
      const at = batch('f1', 'test-backend', [24], extra);
      expect(at.context.additionalContext, JSON.stringify(extra)).toBe(note(24, 30));
      expect(at.records).toEqual([record('f1', 'test-backend', 24, 30)]);
    }
  });

  it('reserve by maxTurns', () => {
    expect([30, 60, 70, 80].map(reserve)).toEqual([6, 6, 7, 8]);
  });

  it('agentMaxTurns reads the frontmatter', () => {
    // Frontmatter only, `.md` files only; a definition without `maxTurns` has no key.
    expect(agentMaxTurns(box.root)).toEqual({ 'test-backend': 30, 'cap-backend-dev': 60 });
    // No agents directory: no limits, no throw.
    expect(agentMaxTurns(txDir)).toEqual({});
    // Every agent definition of the project carries its limit.
    const live = agentMaxTurns(root);
    const types = fs
      .readdirSync(path.join(root, '.claude', 'agents'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.basename(f, '.md'));
    expect(Object.keys(live).sort()).toEqual(types.sort());
    for (const n of Object.values(live)) expect(Number.isInteger(n) && n > 0).toBe(true);
    // The only frontmatter reader: scripts/metrics.mjs imports it and holds no reader of its own.
    const scripts = path.join(root, 'scripts');
    const readers = fs
      .readdirSync(scripts, { recursive: true })
      .filter((f) => f.endsWith('.mjs'))
      .filter((f) => /\^maxTurns/.test(fs.readFileSync(path.join(scripts, f), 'utf8')));
    expect(readers).toEqual([path.join('lib', 'turn-budget.mjs')]);
    const metrics = fs.readFileSync(path.join(scripts, 'metrics.mjs'), 'utf8');
    expect(metrics).toMatch(/import \{ agentMaxTurns \} from '\.\/lib\/turn-budget\.mjs';/);
    expect(metrics).not.toMatch(/function maxTurns\b/);
  });

  it('registered in settings', () => {
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8')
    );
    const commands = Object.entries(settings.hooks).flatMap(([event, entries]) =>
      entries.flatMap((e) => e.hooks.map((h) => ({ event, matcher: e.matcher, ...h })))
    );
    // Probe P1 confirmed PostToolBatch: one entry, no matcher, no fallback registration.
    const turn = commands.filter((c) => c.command.includes('turn-budget.mjs'));
    expect(turn).toHaveLength(1);
    expect(settings.hooks.PostToolBatch).toHaveLength(1);
    expect(turn[0]).toMatchObject({ event: 'PostToolBatch', type: 'command', timeout: 10 });
    expect(turn[0].matcher).toBeUndefined();
    // The same command shape as the other entries: their PATH prefix, then the script.
    const other = commands.find((c) => c.command.endsWith('node scripts/hooks/subagent-start.mjs'));
    const prefix = other.command.slice(0, -'node scripts/hooks/subagent-start.mjs'.length);
    expect(turn[0].command).toBe(`${prefix}node scripts/hooks/turn-budget.mjs`);
    expect(fs.existsSync(path.join(root, 'scripts', 'hooks', 'turn-budget.mjs'))).toBe(true);
  });
});
