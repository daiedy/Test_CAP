// The metrics records of the hooks (ADR-0022; pipeline-metrics research/data-flow.md section 2):
// every hook appends its record kind and nothing else, and no record carries prompt text. Idiom of
// test/hooks-protect-bash.test.js: the hook runs as a child process with sample JSON on stdin.
// The hooks run from a sandbox, a temp git repository holding copies of scripts/hooks, scripts/lib
// and scripts/i18n: `repoRoot()` follows the script's own location, so every write (.pipeline/,
// current-session, sessions.log, the MCP audit) lands in the sandbox, and the tree the git-based
// gates inspect is known. `gh` (the SessionStart briefing) gets an empty config dir and no token,
// so it fails at once without a network call.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJsonl } from '../scripts/lib/transcript-usage.mjs';
import { metricsFile } from '../scripts/lib/metrics-log.mjs';
import { writeFixture, iso } from './fixtures/transcript-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const SESSION = `test-metrics-${process.pid}`;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PHASE_2 = '2: backend';
const SENTINEL = 'SENTINEL-7f3a';
const SUBAGENT = { agent_id: 'agent-x9', agent_type: 'reviewer' };
const STOP = { hook_event_name: 'Stop', stop_hook_active: false };
/** npm must not look for its own update while the Stop gate runs `npm test` in the sandbox. */
const NO_NPM_NOTIFIER = { npm_config_update_notifier: 'false' };

let sandbox;
let ghDir;
let fixtureDir;

/** docs/STATE.md of the sandbox in the shape of templates/STATE.md. */
function stateDoc({ feature = 'fixture-live (#7)', phase = PHASE_2, extra = '' } = {}) {
  return [
    '# Project state',
    '',
    '## Now',
    '',
    '- Date: 2026-09-29',
    '- Branch: feature/fixture-live',
    `- Feature: ${feature}`,
    `- Phase: ${phase}`,
    '- Last commit: 0000000 init',
    '- Next: run the hook tests',
    '',
    '## Open debt',
    '',
    '| Item | Resolution | Who |',
    '|---|---|---|',
    '',
    '## What works',
    '',
    '- the sandbox',
    '',
    '## Decisions',
    '',
    'See `docs/decisions/`.',
    extra,
  ].join('\n');
}

const git = (...args) =>
  spawnSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      ...args,
    ],
    { cwd: sandbox, encoding: 'utf8' }
  );

/** Writes files into the sandbox (relative path to content). */
function put(files) {
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(sandbox, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

/** Back to the committed tree; ignored files (.pipeline/) stay. */
function resetTree() {
  git('checkout', '-q', '--', '.');
  git('clean', '-fdq');
}

/** Runs a hook of the sandbox with `payload` on stdin; `env` adds or keeps variables. */
function hook(name, payload, env = {}) {
  const childEnv = { ...process.env, GH_CONFIG_DIR: ghDir, ...env };
  for (const k of [
    'PIPELINE_ALLOW_PROTECTED',
    'PIPELINE_SKIP_GATE',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'GH_ENTERPRISE_TOKEN',
    'GITHUB_ENTERPRISE_TOKEN',
  ])
    if (!(k in env)) delete childEnv[k];
  return spawnSync('node', [path.join(sandbox, 'scripts', 'hooks', name)], {
    input: JSON.stringify({ session_id: SESSION, cwd: sandbox, ...payload }),
    encoding: 'utf8',
    env: childEnv,
  });
}

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

/** The event log of the test session. */
const log = () => readJsonl(metricsFile(sandbox, SESSION));
/** The records appended by `run`, without their `ts` (checked to be an ISO stamp). */
function appended(run) {
  const before = log().length;
  const res = run();
  const added = log().slice(before);
  for (const r of added) expect(r.ts).toMatch(ISO);
  return {
    res,
    records: added.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'ts'))),
  };
}

beforeAll(() => {
  // The real path: macOS tmpdir is a symlink (/var -> /private/var) and the hooks resolve their
  // root from their own real location, so a file path must use the same prefix.
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-')));
  ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-gh-'));
  fixtureDir = writeFixture(fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-metrics-fx-')));
  for (const dir of ['scripts/hooks', 'scripts/lib', 'scripts/i18n'])
    fs.cpSync(path.join(root, dir), path.join(sandbox, dir), { recursive: true });
  put({
    '.gitignore': '.pipeline/\n.claude/.gate-state.json\n',
    'docs/STATE.md': stateDoc(),
    'docs/CHANGELOG.md': '# Changelog\n',
  });
  git('init', '-q', '-b', 'feature/fixture-live');
  git('add', '-A');
  git('commit', '-qm', 'init');
});

afterAll(() => {
  for (const dir of [sandbox, ghDir, fixtureDir]) fs.rmSync(dir, { recursive: true, force: true });
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
  });

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

    // No file the hooks wrote holds the sentinel, in any case.
    const logs = path.join(sandbox, '.pipeline');
    expect(fs.readdirSync(logs)).toEqual(
      expect.arrayContaining([path.basename(metricsFile(sandbox, SESSION)), 'sessions.log'])
    );
    for (const name of fs.readdirSync(logs))
      expect(fs.readFileSync(path.join(logs, name), 'utf8').toLowerCase(), name).not.toContain(
        SENTINEL.toLowerCase()
      );
  });
});
