// The metrics records of the hooks (ADR-0022; pipeline-metrics docs/metrics/data-flow.md section 2):
// every hook appends its record kind and nothing else, and no record carries prompt text. The
// hooks run from the sandbox of test/fixtures/hook-sandbox.mjs (a temp git repository holding
// copies of scripts/hooks, scripts/lib and scripts/i18n), so every write lands in the sandbox and
// the tree the git-based gates inspect is known.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { metricsFile, appendMetric } from '../scripts/lib/metrics-log.mjs';
import { appendAudit } from '../scripts/lib/mcp-audit.mjs';
import { HANDBACK_DENY_MAX } from '../scripts/lib/handover-checks.mjs';
import { writeFixture, iso } from './fixtures/transcript-fixture.mjs';
import {
  createSandbox,
  stateDoc,
  PHASE_2,
  writeAddressee,
  handbackInput,
} from './fixtures/hook-sandbox.mjs';

const SESSION = `test-metrics-${process.pid}`;
const SENTINEL = 'SENTINEL-7f3a';
const SUBAGENT = { agent_id: 'agent-x9', agent_type: 'reviewer' };
const STOP = { hook_event_name: 'Stop', stop_hook_active: false };
/** npm must not look for its own update while the Stop gate runs `npm test` in the sandbox. */
const NO_NPM_NOTIFIER = { npm_config_update_notifier: 'false' };

let box;
let sandbox;
let fixtureDir;

const put = (files) => box.put(files);
const resetTree = () => box.resetTree();
const hook = (name, payload, env) => box.hook(name, payload, env);
const appended = (run) => box.appended(run);

/** SubagentStop of the fixture agent a1 (cap-backend-dev); `agent-stop` precedes the checks. */
const subagentStop = (extra = {}) => ({
  hook_event_name: 'SubagentStop',
  agent_id: 'a1',
  agent_type: 'cap-backend-dev',
  agent_transcript_path: path.join(fixtureDir, 'a-main', 'subagents', 'agent-a1.jsonl'),
  stop_hook_active: false,
  last_assistant_message: '## Done',
  ...extra,
});
/** A Claude Code internal agent at SubagentStop: empty type, no transcript file. */
const internalStop = () =>
  subagentStop({
    agent_id: 'b7c9',
    agent_type: '',
    agent_transcript_path: path.join(fixtureDir, 'missing', 'agent-b7c9.jsonl'),
  });

beforeAll(() => {
  box = createSandbox({ prefix: 'hooks-metrics', session: SESSION });
  sandbox = box.root;
  fixtureDir = writeFixture(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-fx-')));
});

afterAll(() => {
  box.remove();
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe('metrics records of the hooks (ADR-0022)', () => {
  it('writes a session record and the current-session file', () => {
    const logs = path.join(sandbox, '.pipeline');
    fs.mkdirSync(logs, { recursive: true });
    const stale = path.join(logs, 'metrics-stale-test.jsonl');
    const fresh = path.join(logs, 'metrics-fresh-test.jsonl');
    fs.writeFileSync(stale, '{}\n');
    fs.writeFileSync(fresh, '{}\n');
    const old = (Date.now() - 31 * 86_400_000) / 1000;
    fs.utimesSync(stale, old, old);

    const transcriptPath = path.join(fixtureDir, 'a-main.jsonl');
    const { res, records } = appended(() =>
      hook('session-start.mjs', {
        hook_event_name: 'SessionStart',
        source: 'startup',
        transcript_path: transcriptPath,
      })
    );
    expect(res.status).toBe(0);
    expect(records).toEqual([
      { event: 'session', source: 'startup', transcriptPath, branch: 'feature/fixture-live' },
    ]);
    expect(fs.readFileSync(path.join(logs, 'current-session'), 'utf8').trim()).toBe(SESSION);
    // Event logs older than 30 days are pruned, younger ones stay.
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(fresh)).toBe(true);
    fs.rmSync(fresh);
  });

  it('writes a prompt record with only the command and a safe argument', () => {
    const cases = [
      ['/spec #7', { command: 'spec', arg: '#7' }],
      ['/feature pipeline-metrics', { command: 'feature', arg: 'pipeline-metrics' }],
      // `arg` names a feature only for spec and feature (data-flow section 2): backlog drops it.
      ['/backlog #12 prio P1', { command: 'backlog' }],
      ['/review', { command: 'review' }],
      ['/feature Add a rating filter', { command: 'feature' }],
      ['please run the tests again', {}],
      ['/Users/someone/file.txt looks wrong', {}],
    ];
    for (const [prompt, fields] of cases) {
      const { res, records } = appended(() =>
        hook('user-prompt.mjs', { hook_event_name: 'UserPromptSubmit', prompt })
      );
      expect(res.status, prompt).toBe(0);
      // Plain stdout of UserPromptSubmit would reach Claude's context: the hook prints nothing.
      expect(res.stdout, prompt).toBe('');
      expect(records, prompt).toEqual([{ event: 'prompt', ...fields }]);
    }
  });

  it('writes agent-start and agent-stop records with the transcript aggregate', () => {
    // SubagentStart: the bare agent id, with or without the `agent-` prefix.
    for (const agentId of ['agent-a1', 'a1']) {
      const { res, records } = appended(() =>
        hook('subagent-start.mjs', {
          hook_event_name: 'SubagentStart',
          agent_id: agentId,
          agent_type: 'cap-backend-dev',
        })
      );
      expect(res.status).toBe(0);
      expect(records).toEqual([
        { event: 'agent-start', agent: 'a1', agentType: 'cap-backend-dev' },
      ]);
    }

    // SubagentStop on a clean tree: the aggregate of the agent's own transcript (fixture agent a1
    // of a-main, computed by hand): r-a1-1 (500, 30000, 0, 100000, 9000) and r-a1-2
    // (300, 0, 0, 130000, 6000); opus 800*4 + 30000*5 + 230000*0.2 + 15000*20 = 499,200 / 1e6;
    // points 1.6, 2, 2.2, 2.5, 2.7: every gap a turn gap below 5 min, active and lead 1.1 min.
    const transcriptPath = path.join(fixtureDir, 'a-main', 'subagents', 'agent-a1.jsonl');
    const stop = {
      hook_event_name: 'SubagentStop',
      agent_id: 'a1',
      agent_type: 'cap-backend-dev',
      agent_transcript_path: transcriptPath,
      stop_hook_active: false,
      last_assistant_message: '## Done',
    };
    const { res, records } = appended(() => hook('subagent-stop.mjs', stop));
    expect(res.status).toBe(0);
    expect(records).toEqual([
      {
        event: 'agent-stop',
        agent: 'a1',
        agentType: 'cap-backend-dev',
        transcriptPath,
        model: 'claude-opus-5-5',
        requests: 2,
        tokens: {
          input: 800,
          cacheWrite5m: 30000,
          cacheWrite1h: 0,
          cacheRead: 230000,
          output: 15000,
        },
        costUSD: 0.4992,
        activeMin: 1.1,
        leadMin: 1.1,
        toolCalls: 0,
        firstTs: iso(0, 1.6),
        lastTs: iso(0, 2.7),
      },
    ]);

    // A Claude Code internal agent (empty type, no transcript file): same exit, no record.
    const internal = appended(() =>
      hook('subagent-stop.mjs', {
        ...stop,
        agent_id: 'b7c9',
        agent_type: '',
        agent_transcript_path: path.join(fixtureDir, 'missing', 'agent-b7c9.jsonl'),
      })
    );
    expect(internal.res.status).toBe(res.status);
    expect(internal.records).toEqual([]);
    // An empty type with a transcript is a pipeline agent and is recorded.
    const untyped = appended(() => hook('subagent-stop.mjs', { ...stop, agent_type: '' }));
    expect(untyped.records.map((r) => [r.event, r.agent, r.requests])).toEqual([
      ['agent-stop', 'a1', 2],
    ]);
  });

  it('agent-start carries maxTurns', () => {
    // Agent definitions in the working tree only: resetTree() removes them for the later tests.
    put({
      '.claude/agents/cap-backend-dev.md':
        '---\nname: cap-backend-dev\nmaxTurns: 60\n---\n\nBody.\n',
      '.claude/agents/no-limit.md': '---\nname: no-limit\n---\n\nmaxTurns: 40\n',
    });
    // A session of its own: agent-start records without an agent-stop in SESSION would read as
    // running subagents and defer the Stop gate of the later tests.
    const own = `${SESSION}-max-turns`;
    const lines = () => {
      const file = metricsFile(sandbox, own);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n') : [];
    };
    try {
      const start = (agentId, agentType) => {
        const before = lines().length;
        const res = hook('subagent-start.mjs', {
          session_id: own,
          hook_event_name: 'SubagentStart',
          agent_id: agentId,
          agent_type: agentType,
        });
        expect(res.status).toBe(0);
        // eslint-disable-next-line no-unused-vars
        const records = lines().map((l) => (({ ts, ...r }) => r)(JSON.parse(l)));
        return { res, records: records.slice(before) };
      };
      const launch = start('agent-mt1', 'cap-backend-dev');
      expect(launch.records).toEqual([
        { event: 'agent-start', agent: 'mt1', agentType: 'cap-backend-dev', maxTurns: 60 },
      ]);
      // A resume carries the limit in force for its run as well.
      expect(start('mt1', 'cap-backend-dev').records).toEqual(launch.records);
      // A definition without `maxTurns` (a body line is no frontmatter) and an internal type
      // without a definition: the record goes without the key.
      expect(start('mt2', 'no-limit').records).toEqual([
        { event: 'agent-start', agent: 'mt2', agentType: 'no-limit' },
      ]);
      expect(start('mt3', 'general-purpose').records).toEqual([
        { event: 'agent-start', agent: 'mt3', agentType: 'general-purpose' },
      ]);
    } finally {
      resetTree();
    }
  });

  it('writes a phase record on a docs/STATE.md edit only', () => {
    const edit = (rel) =>
      appended(() =>
        hook('post-edit.mjs', {
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: path.join(sandbox, rel) },
        })
      );
    try {
      let out = edit('docs/STATE.md');
      expect(out.res.status).toBe(0);
      expect(out.records).toEqual([
        { event: 'phase', feature: 'fixture-live (#7)', phase: '2', raw: PHASE_2 },
      ]);

      // Any other file: no phase record.
      expect(edit('docs/CHANGELOG.md').records).toEqual([]);

      // A completion marker keeps its phase number; a value without one is `none`; raw is cut at 80.
      put({ 'docs/STATE.md': stateDoc({ phase: 'none (fixture-live #7 done, pruned)' }) });
      expect(edit('docs/STATE.md').records).toEqual([
        {
          event: 'phase',
          feature: 'fixture-live (#7)',
          phase: '7',
          raw: 'none (fixture-live #7 done, pruned)',
        },
      ]);
      put({ 'docs/STATE.md': stateDoc({ feature: 'none', phase: 'none' }) });
      expect(edit('docs/STATE.md').records).toEqual([
        { event: 'phase', feature: 'none', phase: 'none', raw: 'none' },
      ]);
      const long = `3: ${'x'.repeat(120)}`;
      put({ 'docs/STATE.md': stateDoc({ phase: long }) });
      out = edit('docs/STATE.md');
      expect(out.records).toEqual([
        { event: 'phase', feature: 'fixture-live (#7)', phase: '3', raw: long.slice(0, 80) },
      ]);
    } finally {
      resetTree();
    }
  });

  it('writes a gate record at every blocking exit', () => {
    const decision = (res) => JSON.parse(res.stdout).hookSpecificOutput.permissionDecision;
    const gate = (hook, agent, agentType, reason) => ({
      event: 'gate',
      hook,
      agent,
      agentType,
      reason,
    });

    // PreToolUse Edit/Write: a deny records; the user's sanction neither denies nor records.
    const edit = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(sandbox, '.claude', 'settings.json') },
      ...SUBAGENT,
    };
    let out = appended(() => hook('protect-files.mjs', edit));
    expect(decision(out.res)).toBe('deny');
    expect(out.records).toEqual([gate('protect-files', 'x9', 'reviewer', 'protected')]);
    out = appended(() => hook('protect-files.mjs', edit, { PIPELINE_ALLOW_PROTECTED: '1' }));
    expect(out.res.stdout).toBe('');
    expect(out.records).toEqual([]);

    // PreToolUse Bash: a subagent is denied (a block, recorded); the main thread is asked.
    const bash = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo x > .claude/settings.json' },
    };
    out = appended(() => hook('protect-files-bash.mjs', { ...bash, ...SUBAGENT }));
    expect(decision(out.res)).toBe('deny');
    expect(out.records).toEqual([gate('protect-files-bash', 'x9', 'reviewer', 'protected')]);
    out = appended(() => hook('protect-files-bash.mjs', bash));
    expect(decision(out.res)).toBe('ask');
    expect(out.records).toEqual([]);

    try {
      // A protected file written outside Edit/Write: SubagentStop and Stop block.
      put({ '.claude/settings.json': '{}\n' });
      out = appended(() => hook('subagent-stop.mjs', subagentStop()));
      expect(out.res.status).toBe(2);
      expect(out.records.map((r) => r.event)).toEqual(['agent-stop', 'gate']);
      expect(out.records[1]).toEqual(gate('subagent-stop', 'a1', 'cap-backend-dev', 'protected'));
      // The internal agent is blocked the same way, without a record.
      const internal = appended(() => hook('subagent-stop.mjs', internalStop()));
      expect(internal.res.status).toBe(2);
      expect(internal.records).toEqual([]);
      // A typed internal agent: a missing transcript file decides, the type does not.
      const typed = appended(() =>
        hook(
          'subagent-stop.mjs',
          subagentStop({
            agent_id: 'c3d4',
            agent_type: 'claude',
            agent_transcript_path: path.join(fixtureDir, 'missing', 'agent-c3d4.jsonl'),
          })
        )
      );
      expect(typed.res.status).toBe(2);
      expect(typed.records).toEqual([]);
      out = appended(() => hook('stop-gate.mjs', STOP));
      expect(out.res.status).toBe(2);
      expect(out.records).toEqual([
        gate('stop-gate', 'main', 'main', 'protected'),
        { event: 'turn-end', blocked: true },
      ]);
      resetTree();

      // docs/STATE.md out of the template shape.
      put({ 'docs/STATE.md': stateDoc({ extra: '\n## Notes\n\n- a story\n' }) });
      out = appended(() => hook('stop-gate.mjs', STOP));
      expect(out.res.status).toBe(2);
      expect(out.records[0]).toEqual(gate('stop-gate', 'main', 'main', 'state-shape'));
      resetTree();

      // Code changed, docs/STATE.md and docs/CHANGELOG.md not.
      put({ 'srv/service.js': 'export default 1;\n' });
      out = appended(() => hook('stop-gate.mjs', STOP));
      expect(out.res.status).toBe(2);
      expect(out.records[0]).toEqual(gate('stop-gate', 'main', 'main', 'docs'));

      // Both touched, and `npm test` fails (the sandbox has no package.json).
      put({
        'docs/STATE.md': stateDoc({ phase: '2: backend, tests' }),
        'docs/CHANGELOG.md': '# Changelog\n\n- a line\n',
        'test/a.test.js': '',
      });
      out = appended(() => hook('stop-gate.mjs', STOP, NO_NPM_NOTIFIER));
      expect(out.res.status).toBe(2);
      expect(out.records[0]).toEqual(gate('stop-gate', 'main', 'main', 'tests'));
    } finally {
      resetTree();
    }

    // ADR-0031: the read gate denies a repeated whole read (`reread`) and a briefed agent's whole
    // read of the feature plan (`brief`).
    const read = (file, agent = {}) =>
      hook('read-gate.mjs', {
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: path.join(sandbox, file) },
        ...agent,
      });
    expect(appended(() => read('docs/CHANGELOG.md')).records).toEqual([]);
    out = appended(() => read('docs/CHANGELOG.md'));
    expect(decision(out.res)).toBe('deny');
    expect(out.records).toEqual([gate('read-gate', 'main', 'main', 'reread')]);
    try {
      put({ 'docs/features/fixture-live/PLAN.md': '# Fixture: plan\n' });
      appendMetric(sandbox, SESSION, {
        event: 'brief',
        agent: 'rb',
        agentType: 'cap-backend-dev',
        feature: 'fixture-live',
        phase: '2',
        bytes: 1,
        mode: 'path',
        hash: 'a'.repeat(12),
      });
      out = appended(() =>
        read('docs/features/fixture-live/PLAN.md', {
          agent_id: 'rb',
          agent_type: 'cap-backend-dev',
        })
      );
      expect(decision(out.res)).toBe('deny');
      expect(out.records).toEqual([gate('read-gate', 'rb', 'cap-backend-dev', 'brief')]);
    } finally {
      resetTree();
    }

    // The resume gate denies a resume of an agent that delivered its report (`resume`).
    const transcripts = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-tx-'));
    try {
      const main = writeAddressee(transcripts, SESSION, 'rr', { attempts: ['delivered'] });
      out = appended(() =>
        hook('resume-gate.mjs', {
          hook_event_name: 'PreToolUse',
          tool_name: 'SendMessage',
          transcript_path: main,
          tool_input: { to: 'rr', message: 'once more' },
        })
      );
      expect(decision(out.res)).toBe('deny');
      expect(out.records).toEqual([gate('resume-gate', 'main', 'main', 'resume')]);
    } finally {
      fs.rmSync(transcripts, { recursive: true, force: true });
    }

    // The handback gate: `protected` up to HANDBACK_DENY_MAX, then `handback-limit`; `lint` (a
    // root ESLint run without a report: offline, nothing installed in the sandbox) and `mcp`.
    const handback = (agentId, env) =>
      hook('handback-gate.mjs', handbackInput('PreToolUse', { agentId }), env);
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-npm-'));
    try {
      put({ '.claude/settings.json': '{}\n' });
      for (let i = 0; i < HANDBACK_DENY_MAX; i++) {
        out = appended(() => handback('hp'));
        expect(decision(out.res)).toBe('deny');
        expect(out.records).toEqual([gate('handback-gate', 'hp', 'cap-backend-dev', 'protected')]);
      }
      out = appended(() => handback('hp'));
      expect(out.res.stdout).toBe('');
      expect(out.records).toEqual([
        gate('handback-gate', 'hp', 'cap-backend-dev', 'handback-limit'),
      ]);
      resetTree();

      put({ 'scripts/zz-probe.mjs': 'export const a = 1;\n' });
      out = appended(() =>
        handback('hl', {
          npm_config_cache: cache,
          npm_config_offline: 'true',
          ...NO_NPM_NOTIFIER,
        })
      );
      expect(decision(out.res)).toBe('deny');
      expect(out.records).toEqual([gate('handback-gate', 'hl', 'cap-backend-dev', 'lint')]);
      resetTree();

      appendAudit(sandbox, SESSION, {
        event: 'edit',
        agent: 'hm',
        agentType: 'cap-backend-dev',
        tool: 'Edit',
        file: 'srv/service.cds',
      });
      out = appended(() => handback('hm'));
      expect(decision(out.res)).toBe('deny');
      expect(out.records).toEqual([gate('handback-gate', 'hm', 'cap-backend-dev', 'mcp')]);
    } finally {
      resetTree();
      fs.rmSync(cache, { recursive: true, force: true });
    }
  }, 60_000);

  it('writes a compact record with the trigger only', () => {
    for (const [trigger, instructions] of [
      ['manual', 'keep the plan in view'],
      ['auto', ''],
    ]) {
      const { res, records } = appended(() =>
        hook('pre-compact.mjs', {
          hook_event_name: 'PreCompact',
          trigger,
          custom_instructions: instructions,
        })
      );
      expect(res.status).toBe(0);
      expect(records).toEqual([{ event: 'compact', trigger }]);
    }
    // The session checkpoint of .pipeline/sessions.log is still written next to the record.
    const lines = fs
      .readFileSync(path.join(sandbox, '.pipeline', 'sessions.log'), 'utf8')
      .trim()
      .split('\n')
      .slice(-2);
    expect(lines[0]).toMatch(new RegExp(`session ${SESSION}: .*compaction manual$`));
    expect(lines[1]).toMatch(new RegExp(`session ${SESSION}: .*compaction auto$`));
  });

  it('writes one turn-end record per stop', () => {
    // The loop guard, the user's bypass and a clean tree all end the turn unblocked.
    for (const [payload, env] of [
      [{ ...STOP, stop_hook_active: true }, {}],
      [STOP, { PIPELINE_SKIP_GATE: '1' }],
      [STOP, {}],
    ]) {
      const { res, records } = appended(() => hook('stop-gate.mjs', payload, env));
      expect(res.status).toBe(0);
      expect(records).toEqual([{ event: 'turn-end', blocked: false }]);
    }
    // A block: the gate record, then the turn-end with `blocked: true`.
    try {
      put({ 'srv/service.js': 'export default 1;\n' });
      const { res, records } = appended(() => hook('stop-gate.mjs', STOP));
      expect(res.status).toBe(2);
      expect(records.map((r) => r.event)).toEqual(['gate', 'turn-end']);
      expect(records[1]).toEqual({ event: 'turn-end', blocked: true });
    } finally {
      resetTree();
    }
  });

  it('defers the Stop gate while a subagent of the session still works', () => {
    // Raw event-log lines with a chosen `ts`, as SubagentStart and SubagentStop write them.
    const log = (minutesAgo, event, agent, agentType) =>
      fs.appendFileSync(
        metricsFile(sandbox, SESSION),
        JSON.stringify({
          ts: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
          event,
          agent,
          agentType,
        }) + '\n'
      );
    const transcripts = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-running-'));
    const mainTranscript = path.join(transcripts, 'main.jsonl');
    const agentFile = path.join(transcripts, 'main', 'subagents', 'agent-r6.jsonl');
    const stop = { ...STOP, transcript_path: mainTranscript };
    const blocked = () => {
      const { res, records } = appended(() => hook('stop-gate.mjs', stop));
      expect(res.status).toBe(2);
      expect(records[0]).toEqual({
        event: 'gate',
        hook: 'stop-gate',
        agent: 'main',
        agentType: 'main',
        reason: 'docs',
      });
    };
    const deferred = (types) => {
      const { res, records } = appended(() => hook('stop-gate.mjs', stop));
      expect(res.status).toBe(0);
      expect(res.stdout).toBe(
        `Stop gate deferred: ${types} still running; the next stop runs the full gate.\n`
      );
      expect(records).toEqual([{ event: 'turn-end', blocked: false }]);
    };
    try {
      // Code changed, docs not: the gate blocks while no agent works.
      put({ 'srv/service.js': 'export default 1;\n' });
      blocked();

      // A launch (SubagentStart) with no transcript yet: the start time counts.
      const start = appended(() =>
        hook('subagent-start.mjs', {
          hook_event_name: 'SubagentStart',
          agent_id: 'agent-r5',
          agent_type: 'test-backend',
        })
      );
      expect(start.records).toEqual([
        { event: 'agent-start', agent: 'r5', agentType: 'test-backend' },
      ]);
      deferred('test-backend');
      // Its agent-stop ends the deferral, and the docs check runs again.
      log(0, 'agent-stop', 'r5', 'test-backend');
      blocked();

      // A start older than TOOL_MS without a transcript: an agent killed without SubagentStop.
      log(11, 'agent-start', 'r6', 'ui-verifier');
      blocked();
      // The same agent writing its transcript is at work.
      fs.mkdirSync(path.dirname(agentFile), { recursive: true });
      fs.writeFileSync(agentFile, '{}\n');
      deferred('ui-verifier');
      // Its transcript untouched for longer than TOOL_MS: no longer counted.
      const old = (Date.now() - 11 * 60_000) / 1000;
      fs.utimesSync(agentFile, old, old);
      blocked();
    } finally {
      log(0, 'agent-stop', 'r6', 'ui-verifier');
      fs.rmSync(transcripts, { recursive: true, force: true });
      resetTree();
    }
  });

  it('records no prompt text', () => {
    const prompts = [
      [`please look at ${SENTINEL} first`, {}],
      [`/spec pipeline-metrics ${SENTINEL}`, { command: 'spec', arg: 'pipeline-metrics' }],
      [`/spec ${SENTINEL}`, { command: 'spec' }],
    ];
    for (const [prompt, fields] of prompts)
      expect(
        appended(() => hook('user-prompt.mjs', { hook_event_name: 'UserPromptSubmit', prompt }))
          .records
      ).toEqual([{ event: 'prompt', ...fields }]);
    appended(() =>
      hook('pre-compact.mjs', {
        hook_event_name: 'PreCompact',
        trigger: 'manual',
        custom_instructions: `summarize ${SENTINEL}`,
      })
    );
    appended(() =>
      hook('subagent-stop.mjs', subagentStop({ last_assistant_message: `## Done ${SENTINEL}` }))
    );

    // No log the hooks wrote holds the sentinel, in any case: the files directly in .pipeline/.
    // Its subdirectories hold texts kept on purpose, the saved report under logs/ above all
    // (ADR-0031 decision 7, test/hooks-context.test.js "keeps the report on disk").
    const logs = path.join(sandbox, '.pipeline');
    const names = fs
      .readdirSync(logs, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name);
    expect(names).toEqual(
      expect.arrayContaining([path.basename(metricsFile(sandbox, SESSION)), 'sessions.log'])
    );
    for (const name of names)
      expect(fs.readFileSync(path.join(logs, name), 'utf8').toLowerCase(), name).not.toContain(
        SENTINEL.toLowerCase()
      );
  });
});
