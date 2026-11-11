// ADR-0031 (context-hygiene #44, PLAN step 9): the role brief of SubagentStart (decision 2), the
// read gate (decision 3), the resume gate (decision 7 level 3), the Stop gate's relay of a red
// `npm test` (decision 4) and the report a hand-over leaves on disk (decision 7 level 2, Q8). Every
// hook runs from one createSandbox() of test/fixtures/hook-sandbox.mjs, whose feature folder holds
// the templates of templates/feature/; each `it` uses its own session id, so the read ledger, the
// metrics log and the MCP audit of one case never meet another. Addressee transcripts of the resume
// gate live in a temp directory outside the sandbox (writeAddressee()).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOOK_OUTPUT_MAX } from '../scripts/lib/hook-utils.mjs';
import { ledgerFile } from '../scripts/lib/read-ledger.mjs';
import { metricsFile, appendMetric } from '../scripts/lib/metrics-log.mjs';
import { readJsonl } from '../scripts/lib/transcript-usage.mjs';
import {
  createSandbox,
  stateDoc,
  writeAddressee,
  handbackInput,
} from './fixtures/hook-sandbox.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const template = (f) => fs.readFileSync(path.join(repo, 'templates', 'feature', f), 'utf8');
const FEATURE = 'docs/features/fixture-live';
const BRIEF = '.pipeline/brief/cap-backend-dev-2.md';
const NOTES = 'docs/notes.md';
/** chmod 000 does not stop root from reading, so an unreadable-file case needs another user. */
const ROOT_USER = process.getuid?.() === 0;

let sb;
let tx;

beforeAll(() => {
  sb = createSandbox({
    prefix: 'hooks-context',
    session: 'hooks-context',
    files: {
      [`${FEATURE}/PLAN.md`]: template('PLAN.md'),
      [`${FEATURE}/CONTEXT.md`]: template('CONTEXT.md'),
      [NOTES]: '# Notes\n\nfirst version\n',
    },
  });
  tx = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-context-tx-')));
});

afterAll(() => {
  sb?.remove();
  if (tx) fs.rmSync(tx, { recursive: true, force: true });
});

const withoutTs = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'ts'));
/** The session's metrics records, without `ts`. */
const metrics = (session) => readJsonl(metricsFile(sb.root, session)).map(withoutTs);
const gates = (session) => metrics(session).filter((r) => r.event === 'gate');
const ledger = (session) => readJsonl(ledgerFile(sb.root, session));
const json = (res) => (res.stdout.trim() ? JSON.parse(res.stdout) : null);
/** The permissionDecision of a PreToolUse run, '' for a silent pass. */
const decision = (res) => json(res)?.hookSpecificOutput?.permissionDecision ?? '';
const reason = (res) => json(res).hookSpecificOutput.permissionDecisionReason;

const start = (session, agentId, agentType) =>
  sb.hook('subagent-start.mjs', {
    session_id: session,
    hook_event_name: 'SubagentStart',
    agent_id: agentId,
    agent_type: agentType,
  });

/** PreToolUse Read of `file` (repo-relative or absolute); `extra` adds `offset`, `limit`. */
const read = (session, file, extra = {}, agent = {}) =>
  sb.hook('read-gate.mjs', {
    session_id: session,
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: path.isAbsolute(file) ? file : path.join(sb.root, file), ...extra },
    ...agent,
  });

/** PreToolUse SendMessage from the main thread; `undefined` leaves the key out. */
const sendMessage = (session, transcript, to) =>
  sb.hook('resume-gate.mjs', {
    session_id: session,
    hook_event_name: 'PreToolUse',
    tool_name: 'SendMessage',
    transcript_path: transcript,
    tool_input: to === undefined ? { message: 'go on' } : { to, message: 'go on' },
  });

const gateRecord = (hook, agent, agentType, why) => ({
  event: 'gate',
  hook,
  agent,
  agentType,
  reason: why,
});

describe('SubagentStart brief (ADR-0031 decision 2)', () => {
  it('SubagentStart hands the brief whole or by path', () => {
    const session = 'ctx-brief';
    let res = start(session, 'b1', 'cap-backend-dev');
    expect(res.status, res.stderr).toBe(0);
    const text = fs.readFileSync(path.join(sb.root, BRIEF), 'utf8');
    expect(text).toContain('## Your steps');
    expect(text.length).toBeLessThanOrEqual(HOOK_OUTPUT_MAX);
    expect(json(res).hookSpecificOutput).toEqual({
      hookEventName: 'SubagentStart',
      additionalContext: text,
    });
    const hash = expect.stringMatching(/^[0-9a-f]{12,64}$/);
    expect(metrics(session)).toEqual([
      { event: 'agent-start', agent: 'b1', agentType: 'cap-backend-dev' },
      {
        event: 'brief',
        agent: 'b1',
        agentType: 'cap-backend-dev',
        feature: 'fixture-live',
        phase: '2',
        bytes: Buffer.byteLength(text),
        mode: 'inline',
        hash,
      },
    ]);

    try {
      // A Backend subsection that takes the brief above HOOK_OUTPUT_MAX: handed by path.
      const bulk = Array.from({ length: 200 }, (_, i) => `- backend fact ${i}: ${'x'.repeat(60)}`);
      sb.put({
        [`${FEATURE}/CONTEXT.md`]: template('CONTEXT.md').replace(
          '### UI: <topic>',
          `### Backend: bulk\n\n${bulk.join('\n')}\n\n### UI: <topic>`
        ),
      });
      res = start(session, 'b2', 'cap-backend-dev');
      expect(res.status, res.stderr).toBe(0);
      const big = fs.readFileSync(path.join(sb.root, BRIEF));
      expect(big.toString('utf8').length).toBeGreaterThan(HOOK_OUTPUT_MAX);
      expect(big.toString('utf8')).toContain('backend fact 199');
      const pointer = json(res).hookSpecificOutput.additionalContext;
      expect(pointer.split('\n')).toHaveLength(1);
      expect(pointer).toContain(BRIEF);
      expect(pointer).toMatch(/Read it whole as protocol step 1/);
      const bytes = pointer.match(/\((\d{1,3}(?:,\d{3})*) bytes/)?.[1];
      expect(Number(bytes?.replaceAll(',', ''))).toBe(big.length);
      expect(metrics(session).slice(2)).toEqual([
        { event: 'agent-start', agent: 'b2', agentType: 'cap-backend-dev' },
        {
          event: 'brief',
          agent: 'b2',
          agentType: 'cap-backend-dev',
          feature: 'fixture-live',
          phase: '2',
          bytes: big.length,
          mode: 'path',
          hash,
        },
      ]);
    } finally {
      sb.resetTree();
    }
  });

  it('SubagentStart stays silent without a brief to hand', () => {
    const session = 'ctx-silent';
    const silent = (agentId, agentType) => {
      const res = start(session, agentId, agentType);
      expect(res.status, res.stderr).toBe(0);
      expect(res.stdout, `${agentType} ${agentId}`).toBe('');
    };
    silent('s1', 'reviewer');
    // A resume: s2 already has an agent-start record in the session, so the hook hands nothing
    // (F5: no SubagentStart context reaches a resumed agent), whatever the documents hold; the case
    // "a resume gets no brief" changes them in between.
    expect(json(start(session, 's2', 'cap-backend-dev'))).not.toBeNull();
    silent('s2', 'cap-backend-dev');
    try {
      sb.put({ 'docs/STATE.md': stateDoc({ feature: 'none' }) });
      silent('s3', 'cap-backend-dev');
      sb.put({
        'docs/STATE.md': stateDoc({ feature: 'fixture-empty (#8)' }),
        'docs/features/fixture-empty/CONTEXT.md': template('CONTEXT.md'),
      });
      silent('s4', 'cap-backend-dev');
    } finally {
      sb.resetTree();
    }
    // Every start still appends agent-start; the only brief is the launch of s2.
    const records = metrics(session);
    expect(records.filter((r) => r.event === 'agent-start').map((r) => r.agent)).toEqual([
      's1',
      's2',
      's2',
      's3',
      's4',
    ]);
    expect(records.filter((r) => r.event === 'brief').map((r) => r.agent)).toEqual(['s2']);
  });

  it("a rework outside its phase gets its own phase's brief", () => {
    const session = 'ctx-rework';
    const label = 'phase 2 (own steps; current phase 5)';
    const briefRecord = (agent, agentType, bytes, mode) => ({
      event: 'brief',
      agent,
      agentType,
      feature: 'fixture-live',
      phase: '2',
      bytes,
      mode,
      hash: expect.stringMatching(/^[0-9a-f]{12,64}$/),
    });
    try {
      // Phase 5 has no row of either type in the template plan; both have their rows in phase 2.
      sb.put({ 'docs/STATE.md': stateDoc({ phase: '5: review' }) });
      const handed = {};
      for (const [agent, type] of [
        ['w1', 'cap-backend-dev'],
        ['w2', 'test-backend'],
      ]) {
        const res = start(session, agent, type);
        expect(res.status, res.stderr).toBe(0);
        const file = `.pipeline/brief/${type}-2.md`;
        const text = fs.readFileSync(path.join(sb.root, file), 'utf8');
        expect(text.split('\n')[0]).toBe(`# Brief: ${type}, ${label}`);
        expect(text).toContain(`Feature \`fixture-live\`, phase 2, step`);
        expect(json(res).hookSpecificOutput.additionalContext).toBe(text);
        expect(fs.existsSync(path.join(sb.root, `.pipeline/brief/${type}-5.md`))).toBe(false);
        handed[agent] = briefRecord(agent, type, Buffer.byteLength(text), 'inline');
      }
      // A whole reader with a row in phase 5 still gets nothing.
      expect(start(session, 'w0', 'reviewer').stdout).toBe('');

      // By path: the pointer line carries the label and the phase 2 file.
      const bulk = Array.from({ length: 200 }, (_, i) => `- backend fact ${i}: ${'x'.repeat(60)}`);
      sb.put({
        [`${FEATURE}/CONTEXT.md`]: template('CONTEXT.md').replace(
          '### UI: <topic>',
          `### Backend: bulk\n\n${bulk.join('\n')}\n\n### UI: <topic>`
        ),
      });
      const res = start(session, 'w3', 'cap-backend-dev');
      expect(res.status, res.stderr).toBe(0);
      const pointer = json(res).hookSpecificOutput.additionalContext;
      expect(pointer.split('\n')).toHaveLength(1);
      expect(pointer).toContain(`Your brief of feature fixture-live, ${label}: ${BRIEF} (`);
      const big = fs.readFileSync(path.join(sb.root, BRIEF));
      expect(big.toString('utf8').split('\n')[0]).toBe(`# Brief: cap-backend-dev, ${label}`);
      handed.w3 = briefRecord('w3', 'cap-backend-dev', big.length, 'path');

      expect(metrics(session).filter((r) => r.event === 'brief')).toEqual([
        handed.w1,
        handed.w2,
        handed.w3,
      ]);
      // The read gate points the rework to the phase 2 file it was handed.
      for (const [agent, type] of [
        ['w1', 'cap-backend-dev'],
        ['w2', 'test-backend'],
      ]) {
        const denied = read(
          session,
          `${FEATURE}/PLAN.md`,
          {},
          { agent_id: agent, agent_type: type }
        );
        expect(decision(denied), agent).toBe('deny');
        expect(reason(denied)).toContain(`.pipeline/brief/${type}-2.md`);
        expect(reason(denied)).toContain('phase 2');
        expect(reason(denied)).not.toContain(`${type}-5.md`);
      }
    } finally {
      sb.resetTree();
    }
  });

  it('a resume gets no brief', () => {
    const session = 'ctx-resume';
    const first = start(session, 'u1', 'cap-backend-dev');
    expect(json(first).hookSpecificOutput.additionalContext).toContain('## Your steps');
    const handed = fs.readFileSync(path.join(sb.root, BRIEF), 'utf8');
    try {
      // The documents change between the launch and the resume: the brief would hash differently.
      sb.put({
        [`${FEATURE}/CONTEXT.md`]: template('CONTEXT.md').replace(
          '### UI: <topic>',
          '### Backend: changed after the launch\n\n- RESUME-FACT a new fact\n\n### UI: <topic>'
        ),
      });
      const res = start(session, 'u1', 'cap-backend-dev');
      expect(res.status, res.stderr).toBe(0);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe('');
      // No brief file is written: the file still holds the launch's brief.
      expect(fs.readFileSync(path.join(sb.root, BRIEF), 'utf8')).toBe(handed);
      expect(metrics(session).map((r) => `${r.event} ${r.agent}`)).toEqual([
        'agent-start u1',
        'brief u1',
        'agent-start u1',
      ]);
      // A new agent id of the same type is a launch and gets the changed brief.
      const fresh = json(start(session, 'u2', 'cap-backend-dev')).hookSpecificOutput;
      expect(fresh.additionalContext).toContain('RESUME-FACT');
      expect(
        metrics(session)
          .filter((r) => r.event === 'brief')
          .map((r) => r.agent)
      ).toEqual(['u1', 'u2']);
    } finally {
      sb.resetTree();
    }
  });
});

describe('read gate (ADR-0031 decision 3)', () => {
  it('a repeated whole read is denied once', () => {
    const session = 'ctx-repeat';
    const agent = { agent_id: 'agent-r1', agent_type: 'cap-backend-dev' };
    expect(decision(read(session, NOTES, {}, agent))).toBe('');
    const [first] = ledger(session);
    expect(first).toMatchObject({
      event: 'read',
      agent: 'r1',
      agentType: 'cap-backend-dev',
      file: NOTES,
      bytes: Buffer.byteLength('# Notes\n\nfirst version\n'),
    });
    const denied = read(session, NOTES, {}, agent);
    expect(decision(denied)).toBe('deny');
    expect(reason(denied)).toContain(`you already read ${NOTES} whole at ${first.ts}`);
    expect(reason(denied)).toMatch(/the second attempt passes/);
    for (let i = 0; i < 2; i++) expect(decision(read(session, NOTES, {}, agent))).toBe('');
    expect(ledger(session).map((r) => `${r.event} ${r.reason ?? ''}`.trim())).toEqual([
      'read',
      'deny reread',
    ]);
  });

  it('a changed, partial or foreign read passes', () => {
    const session = 'ctx-pass';
    const agent = { agent_id: 'p1', agent_type: 'test-backend' };
    const outside = path.join(tx, 'outside.md');
    fs.writeFileSync(outside, 'outside the repository\n');
    try {
      expect(decision(read(session, NOTES, {}, agent))).toBe('');
      for (const extra of [{ offset: 1 }, { limit: 2 }, { offset: 1, limit: 2 }])
        expect(decision(read(session, NOTES, extra, agent)), JSON.stringify(extra)).toBe('');
      // Another agent id, and the main thread.
      expect(
        decision(read(session, NOTES, {}, { agent_id: 'p2', agent_type: 'test-backend' }))
      ).toBe('');
      expect(decision(read(session, NOTES))).toBe('');
      sb.put({ [NOTES]: '# Notes\n\nsecond version\n' });
      expect(decision(read(session, NOTES, {}, agent))).toBe('');
      for (let i = 0; i < 2; i++) expect(decision(read(session, outside, {}, agent))).toBe('');
      // A partial read and a file outside the repository leave no record.
      const records = ledger(session);
      expect(records.map((r) => `${r.event} ${r.agent} ${r.file}`)).toEqual([
        `read p1 ${NOTES}`,
        `read p2 ${NOTES}`,
        `read main ${NOTES}`,
        `read p1 ${NOTES}`,
      ]);
      expect(records[3].hash).not.toBe(records[0].hash);
    } finally {
      sb.resetTree();
    }
  });

  it('a briefed agent is pointed to its brief once', () => {
    const session = 'ctx-briefed';
    const agent = { agent_id: 'f1', agent_type: 'cap-backend-dev' };
    expect(json(start(session, 'f1', 'cap-backend-dev'))).not.toBeNull();
    for (const doc of ['PLAN.md', 'CONTEXT.md']) {
      const res = read(session, `${FEATURE}/${doc}`, {}, agent);
      expect(decision(res), doc).toBe('deny');
      expect(reason(res)).toContain(BRIEF);
      expect(reason(res)).toContain(
        `read a whole ${doc} only for a section the brief lists under "Not included"`
      );
      expect(decision(read(session, `${FEATURE}/${doc}`, {}, agent)), doc).toBe('');
    }
    // A type that reads whole passes even with a brief record of its id; a brief role without a
    // brief (no SubagentStart record) passes too.
    appendMetric(sb.root, session, {
      event: 'brief',
      agent: 'v1',
      agentType: 'reviewer',
      feature: 'fixture-live',
      phase: '2',
      bytes: 1,
      mode: 'path',
      hash: 'f'.repeat(12),
    });
    const plan = `${FEATURE}/PLAN.md`;
    expect(decision(read(session, plan, {}, { agent_id: 'v1', agent_type: 'reviewer' }))).toBe('');
    expect(decision(read(session, plan, {}, { agent_id: 'f2', agent_type: 'test-backend' }))).toBe(
      ''
    );
    expect(
      ledger(session)
        .filter((r) => r.event === 'deny')
        .map((r) => `${r.file} ${r.reason}`)
    ).toEqual([`${FEATURE}/PLAN.md brief`, `${FEATURE}/CONTEXT.md brief`]);
  });

  it("a compaction resets the main thread's ledger", () => {
    const session = 'ctx-compact';
    const sub = { agent_id: 'c1', agent_type: 'test-backend' };
    expect(decision(read(session, NOTES))).toBe('');
    expect(decision(read(session, NOTES, {}, sub))).toBe('');
    const res = sb.hook('pre-compact.mjs', {
      session_id: session,
      hook_event_name: 'PreCompact',
      trigger: 'auto',
    });
    expect(res.status).toBe(0);
    expect(ledger(session).at(-1)).toMatchObject({ event: 'reset', agent: 'main' });
    expect(decision(read(session, NOTES))).toBe('');
    // The subagent's reads still count, and so does the main thread's read after the reset.
    expect(decision(read(session, NOTES, {}, sub))).toBe('deny');
    expect(decision(read(session, NOTES))).toBe('deny');
  });

  it('a broken ledger allows the read', () => {
    // A directory where the ledger should be.
    const dirSession = 'ctx-broken-dir';
    fs.mkdirSync(ledgerFile(sb.root, dirSession), { recursive: true });
    for (let i = 0; i < 3; i++) expect(decision(read(dirSession, NOTES))).toBe('');
    if (ROOT_USER) return;
    // A ledger that holds the first read and cannot be read.
    const fileSession = 'ctx-broken-mode';
    expect(decision(read(fileSession, NOTES))).toBe('');
    const file = ledgerFile(sb.root, fileSession);
    fs.chmodSync(file, 0o000);
    try {
      for (let i = 0; i < 2; i++) expect(decision(read(fileSession, NOTES))).toBe('');
    } finally {
      fs.chmodSync(file, 0o644);
    }
    expect(gates(dirSession)).toEqual([]);
    expect(gates(fileSession)).toEqual([]);
  });
});

describe('resume gate (ADR-0031 decision 7)', () => {
  it('a resume after the report is denied', () => {
    const session = 'ctx-resume';
    const main = writeAddressee(tx, session, 'r1', { attempts: ['denied', 'delivered'] });
    // The report as the handback gate's PostToolUse saved it.
    sb.hook('handback-gate.mjs', {
      session_id: session,
      ...handbackInput('PostToolUse', { agentId: 'r1', message: '## Done\nthe report\n' }),
    });
    const saved = '.pipeline/logs/report-cap-backend-dev-r1.md';
    expect(fs.readFileSync(path.join(sb.root, saved), 'utf8')).toBe('## Done\nthe report\n');
    for (const to of ['r1', 'agent-r1']) {
      const res = sendMessage(session, main, to);
      expect(decision(res), to).toBe('deny');
      const text = reason(res);
      expect(text).toContain(
        'agent r1 (cap-backend-dev) already delivered its report through SubagentHandback (1 delivered in its transcript)'
      );
      expect(text).toContain('Launch a fresh cap-backend-dev agent instead');
      expect(text).toContain('the file list and the exact edits');
      expect(text).toContain(`Its report is saved at ${saved}.`);
    }
    // No deny-once: every resume is denied and counted.
    expect(gates(session)).toEqual([
      gateRecord('resume-gate', 'main', 'main', 'resume'),
      gateRecord('resume-gate', 'main', 'main', 'resume'),
    ]);
  });

  it('a resume of an agent without a report passes', () => {
    const session = 'ctx-noreport';
    // Stopped at its turn limit; and an agent whose every handback attempt was denied.
    writeAddressee(tx, session, 'n1', { agentType: 'test-backend' });
    const main = writeAddressee(tx, session, 'n2', {
      agentType: 'test-backend',
      attempts: ['denied', 'denied', 'denied'],
    });
    for (const to of ['n1', 'n2']) {
      const res = sendMessage(session, main, to);
      expect(res.status, res.stderr).toBe(0);
      expect(res.stdout, to).toBe('');
    }
    expect(gates(session)).toEqual([]);
  });

  it('an unreadable addressee allows the resume', () => {
    const session = 'ctx-unreadable';
    const main = writeAddressee(tx, session, 'u1', { attempts: ['delivered'] });
    // Readable, the same addressee is denied: the passes below are the gate's safety.
    expect(decision(sendMessage(session, main, 'u1'))).toBe('deny');
    if (!ROOT_USER) {
      const file = path.join(tx, session, 'subagents', 'agent-u1.jsonl');
      fs.chmodSync(file, 0o000);
      try {
        expect(decision(sendMessage(session, main, 'u1'))).toBe('');
      } finally {
        fs.chmodSync(file, 0o644);
      }
    }
    // An unknown addressee (a name, no file), a call without `to`, no transcript path.
    expect(decision(sendMessage(session, main, 'helper-name'))).toBe('');
    expect(decision(sendMessage(session, main, undefined))).toBe('');
    expect(decision(sendMessage(session, undefined, 'u1'))).toBe('');
    expect(gates(session)).toHaveLength(1);
  });
});

describe('relays and reports (ADR-0031 decisions 4 and 7)', () => {
  it('the Stop gate names every failed test and the log', () => {
    const session = 'ctx-stop';
    const FAILS = [
      'FAIL  test/a.test.js > suite > first',
      'FAIL  test/b.test.js > second',
      'FAIL  test/c.test.js [ test/c.test.js ]',
    ];
    const TOTALS = [
      ' Test Files  3 failed | 13 passed (16)',
      '      Tests  2 failed | 244 passed (246)',
    ];
    const stop = (output) => {
      sb.put({ 'fake-output.txt': output });
      return sb.hook(
        'stop-gate.mjs',
        { session_id: session, hook_event_name: 'Stop', stop_hook_active: false },
        { npm_config_update_notifier: 'false' }
      );
    };
    const logOf = (stderr, pattern) => {
      const m = stderr.match(pattern);
      expect(m, stderr).not.toBeNull();
      return fs.readFileSync(path.join(sb.root, m[1]), 'utf8');
    };
    try {
      sb.put({
        'package.json': JSON.stringify({
          name: 'sandbox',
          private: true,
          scripts: { test: 'node fake-test.mjs' },
        }),
        'fake-test.mjs':
          "import fs from 'node:fs';\nprocess.stdout.write(fs.readFileSync('fake-output.txt', 'utf8'));\nprocess.exit(1);\n",
        'test/a.test.js': '',
        'docs/STATE.md': stateDoc({ phase: '2: backend, tests' }),
        'docs/CHANGELOG.md': '# Changelog\n\n- a line\n',
      });
      // A short red run: the output whole, and the log path.
      const short = `${[FAILS[0], ...TOTALS].join('\n')}\n`;
      let res = stop(short);
      expect(res.status, res.stderr).toBe(2);
      expect(res.stderr).toContain(short.trimEnd());
      expect(
        logOf(res.stderr, /is also saved in (\.pipeline\/logs\/npm-test-\S+\.log)\./)
      ).toContain(short.trimEnd());

      // A long red run: every FAIL line and the totals, the log path, never the last lines.
      const noise = Array.from(
        { length: 400 },
        (_, i) => `    at frame${i} (node_modules/x/frame${i}.js:1:1)`
      );
      const long = `${[FAILS[0], ...noise.slice(0, 200), FAILS[1], FAILS[2], ...noise.slice(200), ...TOTALS].join('\n')}\n`;
      expect(long.length).toBeGreaterThan(HOOK_OUTPUT_MAX);
      res = stop(long);
      expect(res.status, res.stderr).toBe(2);
      expect(res.stderr).toContain('Failed tests and suites (3):');
      for (const line of [...FAILS, ...TOTALS.map((t) => t.trim())])
        expect(res.stderr).toContain(line);
      expect(res.stderr).not.toMatch(/frame\d/);
      expect(res.stderr.length).toBeLessThan(HOOK_OUTPUT_MAX);
      expect(
        logOf(res.stderr, /is in (\.pipeline\/logs\/npm-test-\S+\.log); read it there\./)
      ).toContain(long.trimEnd());
      expect(gates(session).map((r) => r.reason)).toEqual(['tests', 'tests']);
    } finally {
      sb.resetTree();
    }
  }, 30_000);

  it('the handback or the plain-text end keeps the report on disk', () => {
    const session = 'ctx-report';
    const reportOf = (type, id) =>
      path.join(sb.root, '.pipeline', 'logs', `report-${type}-${id}.md`);
    const long = `## Done\n${'a line of the report\n'.repeat(1500)}`;
    const handback = (event, agentId, message) =>
      sb.hook('handback-gate.mjs', {
        session_id: session,
        ...handbackInput(event, { agentId, message }),
      });
    let res = handback('PostToolUse', 'k1', long);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toBe('');
    expect(fs.readFileSync(reportOf('cap-backend-dev', 'k1'), 'utf8')).toBe(long);
    // A later delivery of the same agent id overwrites it.
    handback('PostToolUse', 'k1', '## Done\nthe second delivery\n');
    expect(fs.readFileSync(reportOf('cap-backend-dev', 'k1'), 'utf8')).toBe(
      '## Done\nthe second delivery\n'
    );
    // PreToolUse checks the hand-over; the report is saved only once delivered.
    handback('PreToolUse', 'k0', long);
    expect(fs.existsSync(reportOf('cap-backend-dev', 'k0'))).toBe(false);

    const stop = (agentId, extra) =>
      sb.hook('subagent-stop.mjs', {
        session_id: session,
        hook_event_name: 'SubagentStop',
        agent_id: agentId,
        agent_type: 'test-backend',
        stop_hook_active: false,
        ...extra,
      });
    // A plain-text end: saved on a pass ...
    res = stop('k2', { last_assistant_message: long });
    expect(res.status, res.stderr).toBe(0);
    expect(fs.readFileSync(reportOf('test-backend', 'k2'), 'utf8')).toBe(long);
    try {
      // ... and on a block.
      sb.put({ '.claude/settings.json': '{}\n' });
      res = stop('k3', { last_assistant_message: '## Done\nblocked\n' });
      expect(res.status, res.stderr).toBe(2);
      expect(fs.readFileSync(reportOf('test-backend', 'k3'), 'utf8')).toBe('## Done\nblocked\n');
      // After a SubagentHandback the key is absent (F8): SubagentStop writes no report.
      res = stop('k4', {});
      expect(res.status, res.stderr).toBe(0);
      expect(fs.existsSync(reportOf('test-backend', 'k4'))).toBe(false);
    } finally {
      sb.resetTree();
    }
  });
});
