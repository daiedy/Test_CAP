// The SubagentStop lint gate of the apps (ADR-0029 decision 7, amendment D-F; docs-toolchain #27,
// PLAN step 4 part 2): per app, ui5lint on the changed UI5 files and one app ESLint pass on the
// changed webapp JavaScript outside webapp/test and webapp/localService. Errors and a linter run
// without a JSON report block (exit 2); a tool the app has not installed is not run and only advised.
// One createSandbox() for the file, three apps made of the app/products files ui5lint and ESLint
// read: `demo` with a node_modules link to app/products/node_modules, `bare` without node_modules,
// `stub` whose .bin/ui5lint and .bin/eslint exit 2 with stderr only. The sandbox root carries the
// same link, the ancestor install npx would otherwise walk up to. Each `it` writes its files
// untracked and resetTree() clears them. Every hook run gets a fresh empty npm cache with
// npm_config_offline: npx never reaches the registry, and npm writes `_logs` into the cache on
// every npx call, so a cache still empty afterwards proves that no linter ran. No update notice:
// npm appends it to stderr on the first call with a fresh cache.
// ADR-0031 decision 8 (context-hygiene #44): the same checks run on PreToolUse `SubagentHandback`
// (scripts/hooks/handback-gate.mjs, one implementation in scripts/lib/handover-checks.mjs), and
// SubagentStop blocks only a plain-text end. Each of those cases uses its own session id, so the
// MCP audit and the metrics log of one case never meet another.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HANDBACK_DENY_MAX } from '../scripts/lib/handover-checks.mjs';
import { auditFile } from '../scripts/lib/mcp-audit.mjs';
import { metricsFile } from '../scripts/lib/metrics-log.mjs';
import { readJsonl } from '../scripts/lib/transcript-usage.mjs';
import { createSandbox, SANDBOX_GITIGNORE, handbackInput } from './fixtures/hook-sandbox.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const APP = path.join(repo, 'app', 'products');
const APP_FILES = ['ui5.yaml', 'package.json', 'eslint.config.mjs', 'webapp/manifest.json'];

// A helper inside a sap.ui.define factory, neither exported nor a method: only the app config's
// "every function of webapp/ext" scope asks for its JSDoc block (line 3, column 3).
const UNDOCUMENTED = [
  'sap.ui.define([], function () {',
  '  "use strict";',
  '  function helper(value) {',
  '    return value;',
  '  }',
  '  return { helper: helper };',
  '});',
  '',
].join('\n');
const DOCUMENTED = UNDOCUMENTED.replace(
  '  function helper',
  [
    '  /**',
    '   * Returns the value unchanged.',
    '   * @param {string} value The value.',
    '   * @returns {string} The same value.',
    '   */',
    '  function helper',
  ].join('\n')
);
// `semi` is an error of the app config outside webapp/test, which has no error rule at all.
const NO_SEMICOLON = UNDOCUMENTED.replace('return value;', 'return value');
// Still undocumented, and ESLint cannot parse it: linted, it blocks anywhere with a fatal error
// (severity 2), while ui5lint reports nothing for it (measured with @ui5/linter of app/products).
// A pass under webapp/test shows the app ESLint skipped the path; under webapp/localService the
// app config's own `ignores` would also keep it out.
const UNPARSABLE = UNDOCUMENTED.replace('return value;', 'return value +;');
// Documented, so ESLint passes; the global access on line 9 is a ui5lint error.
const GLOBAL_CORE = DOCUMENTED.replace('return value;', 'return sap.ui.getCore() && value;');

const stub = (tool) => `#!/bin/sh\necho "stub ${tool}: cannot start" >&2\nexit 2\n`;

let sb;

beforeAll(() => {
  const files = { '.gitignore': `${SANDBOX_GITIGNORE}node_modules\n` };
  for (const app of ['demo', 'bare', 'stub'])
    for (const f of APP_FILES)
      files[`app/${app}/${f}`] = fs.readFileSync(path.join(APP, f), 'utf8');
  sb = createSandbox({ prefix: 'subagent-stop', session: 'subagent-stop-lint', files });
  for (const dir of ['app/demo', '.'])
    fs.symlinkSync(path.join(APP, 'node_modules'), path.join(sb.root, dir, 'node_modules'), 'dir');
  for (const tool of ['ui5lint', 'eslint']) {
    const bin = `app/stub/node_modules/.bin/${tool}`;
    sb.put({ [bin]: stub(tool) });
    fs.chmodSync(path.join(sb.root, bin), 0o755);
  }
});

afterAll(() => sb?.remove());

/**
 * Runs SubagentStop of the sandbox over `files`, written untracked into the committed tree.
 * @returns {{status: number, stderr: string, message: string, npx: boolean}} the exit code, the
 *   block text, the advisory `systemMessage` and whether any npx call happened
 */
function stop(files) {
  sb.resetTree();
  sb.put(files);
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-stop-npm-'));
  try {
    const res = sb.hook(
      'subagent-stop.mjs',
      {
        hook_event_name: 'SubagentStop',
        agent_id: 'lint-probe',
        agent_type: 'cap-backend-dev',
        stop_hook_active: false,
        last_assistant_message: 'probe report',
      },
      { npm_config_cache: cache, npm_config_offline: 'true', npm_config_update_notifier: 'false' }
    );
    const out = res.stdout.trim();
    return {
      status: res.status,
      stderr: res.stderr,
      message: out ? (JSON.parse(out).systemMessage ?? '') : '',
      npx: fs.readdirSync(cache).length > 0,
    };
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
}

const HEADER = (n) =>
  new RegExp(`^The subagent cannot finish: ${n} linter errors in changed files\\. `);

describe('SubagentStop lint gate of the apps (ADR-0029 amendment D-F)', () => {
  // One blocked run serves the ESLint and the ui5lint test: every error line blocks on its own.
  let blocked;
  beforeAll(() => {
    blocked = stop({
      'app/demo/webapp/ext/x.js': UNDOCUMENTED,
      'app/demo/webapp/controller/x.js': NO_SEMICOLON,
      'app/demo/webapp/ext/z.js': GLOBAL_CORE,
    });
  }, 30_000);

  it('blocks a hand-over on app ESLint errors in webapp JavaScript outside test and localService', () => {
    expect(blocked.status, blocked.stderr).toBe(2);
    expect(blocked.stderr).toMatch(HEADER('\\d+'));
    expect(blocked.stderr).toMatch(
      /^app\/demo\/webapp\/ext\/x\.js:3:3 .*\(jsdoc\/require-jsdoc\)$/m
    );
    expect(blocked.stderr).toMatch(/^app\/demo\/webapp\/controller\/x\.js:\d+:\d+ .*\(semi\)$/m);

    // One run for every text that must pass: the documented function, and the undocumented one
    // where the app ESLint does not look.
    const passed = stop({
      'app/demo/webapp/ext/x.js': DOCUMENTED,
      'app/demo/webapp/test/x.js': UNPARSABLE,
      'app/demo/webapp/localService/x.js': UNPARSABLE,
    });
    expect(passed.status, passed.stderr).toBe(0);
    expect(passed.stderr).toBe('');
    expect(passed.npx).toBe(true);
  });

  it('blocks a hand-over on ui5lint errors in webapp JavaScript', () => {
    expect(blocked.status, blocked.stderr).toBe(2);
    expect(blocked.stderr).toMatch(
      /^app\/demo\/webapp\/ext\/z\.js:9:\d+ .*\((no-globals|no-deprecated-api)\)$/m
    );
  });

  it('passes a hand-over with an advisory when the app has not installed its linters', () => {
    const res = stop({ 'app/bare/webapp/ext/x.js': UNDOCUMENTED });
    expect(res.status, res.stderr).toBe(0);
    expect(res.npx).toBe(false);
    for (const tool of ['ui5lint', 'eslint']) {
      const note = `app/bare: ${tool} is not installed (no app/bare/node_modules/.bin/${tool}), its check was skipped; run \`npm install\` in app/bare.`;
      // Exactly once: the per-file checks of SubagentStop do not repeat it.
      expect(res.message.split(note), res.message).toHaveLength(2);
    }
  });

  it('blocks a hand-over when a linter fails without a report', () => {
    const res = stop({ 'app/stub/webapp/ext/x.js': DOCUMENTED });
    expect(res.status, res.stderr).toBe(2);
    expect(res.stderr).toMatch(HEADER(2));
    for (const tool of ['ui5lint', 'eslint'])
      expect(res.stderr).toMatch(
        new RegExp(
          `^${tool} \\(app/stub\\): failed \\(exit 2\\) without a JSON report: stub ${tool}: cannot start$`,
          'm'
        )
      );
  });
});

/** Runs `fn` with the env of a fresh empty offline npm cache, removed afterwards. */
function withCache(fn) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-stop-npm-'));
  try {
    return fn({
      npm_config_cache: cache,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
    });
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
}

/** Appends `records` to the session's MCP audit, each with a `ts`. */
function audit(session, ...records) {
  const file = auditFile(sb.root, session);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const r of records)
    fs.appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...r })}\n`);
}
const auditOf = (session) => readJsonl(auditFile(sb.root, session));
const edit = (agent, file) => ({
  event: 'edit',
  agent,
  agentType: 'cap-backend-dev',
  tool: 'Write',
  file,
});
/** The session's metrics records as `<event> <agent>[ <reason>]`. */
const events = (session) =>
  readJsonl(metricsFile(sb.root, session)).map((r) =>
    [r.event, r.hook, r.agent, r.reason].filter(Boolean).join(' ')
  );

/** PreToolUse `SubagentHandback` of agent `agentId` with `message` as its report. */
function handback(session, agentId, message = '## Done\n') {
  return withCache((env) => {
    const res = sb.hook(
      'handback-gate.mjs',
      { session_id: session, ...handbackInput('PreToolUse', { agentId, message }) },
      env
    );
    const out = res.stdout.trim() ? JSON.parse(res.stdout).hookSpecificOutput : null;
    return {
      status: res.status,
      stdout: res.stdout,
      stderr: res.stderr,
      decision: out?.permissionDecision ?? '',
      reason: out?.permissionDecisionReason ?? '',
    };
  });
}

describe('handback gate (ADR-0031 decision 8)', () => {
  it("the handback gate denies on the agent's own findings", () => {
    const session = 'hb-own';
    try {
      sb.resetTree();
      sb.put({ 'app/demo/webapp/ext/x.js': UNDOCUMENTED });
      audit(session, edit('h1', 'app/demo/webapp/ext/x.js'));
      let res = handback(session, 'h1');
      expect(res.decision, res.stderr).toBe('deny');
      expect(res.reason).toMatch(HEADER('\\d+'));
      expect(res.reason).toMatch(/^app\/demo\/webapp\/ext\/x\.js:3:3 .*\(jsdoc\/require-jsdoc\)$/m);
      expect(res.reason).toContain('Fix them and call SubagentHandback again.');
      // A file only another agent's records explain is not this agent's finding.
      res = handback(session, 'h2');
      expect(res.decision, res.reason).toBe('');
      // A file no edit record explains is linted whoever wrote it.
      sb.put({ 'app/demo/webapp/ext/y.js': UNDOCUMENTED });
      res = handback(session, 'h2');
      expect(res.decision).toBe('deny');
      expect(res.reason).toMatch(/^app\/demo\/webapp\/ext\/y\.js:3:3 /m);
      expect(res.reason).not.toContain('ext/x.js');

      // A protected path written outside Edit/Write, until the report names it.
      sb.resetTree();
      sb.put({ '.claude/settings.json': '{}\n' });
      res = handback(session, 'h3', '## Done\nnothing else\n');
      expect(res.decision).toBe('deny');
      expect(res.reason).toMatch(/^Protected files were changed outside Edit\/Write/);
      expect(res.reason).toMatch(/^ {2}\.claude\/settings\.json \(/m);
      expect(res.reason).toContain('under "## Open questions"');
      res = handback(
        session,
        'h3',
        '## Open questions\n- .claude/settings.json changed by a script\n'
      );
      expect(res.decision, res.reason).toBe('');

      expect(events(session)).toEqual([
        'gate handback-gate h1 lint',
        'gate handback-gate h2 lint',
        'gate handback-gate h3 protected',
      ]);
      expect(
        auditOf(session)
          .filter((r) => r.event === 'handback-deny')
          .map((r) => `${r.agent} ${r.agentType} ${r.reason}`)
      ).toEqual([
        'h1 cap-backend-dev lint',
        'h2 cap-backend-dev lint',
        'h3 cap-backend-dev protected',
      ]);
    } finally {
      sb.resetTree();
    }
  }, 60_000);

  it('the handback gate reads the MCP reason from the report', () => {
    const session = 'hb-mcp';
    sb.resetTree();
    audit(session, edit('m1', 'srv/service.cds'), edit('m2', 'srv/service.cds'));
    let res = handback(session, 'm1');
    expect(res.decision).toBe('deny');
    expect(res.reason).toMatch(/^MCP check \(rule pipeline-config\.md, ADR-0014\)/);
    expect(res.reason).toContain(
      '  srv/service.cds (CDS model and services) → mcp__cds-mcp__search_model or mcp__cds-mcp__search_docs'
    );
    expect(res.reason).toContain('Then call SubagentHandback again.');
    // ADR-0014 blocks once: the second attempt without the section passes.
    res = handback(session, 'm1');
    expect(res.decision, res.reason).toBe('');
    // The report with the section passes at once.
    res = handback(session, 'm2', '## Done\n\n## MCP not used\nsrv/service.cds → a comment fix\n');
    expect(res.decision, res.reason).toBe('');

    const records = auditOf(session).filter((r) => r.event !== 'edit');
    expect(records.map((r) => `${r.event} ${r.agent}`)).toEqual([
      'handback-deny m1',
      'skipped-unjustified m1',
      'justification m2',
    ]);
    expect(records[2]).toMatchObject({
      files: ['srv/service.cds'],
      text: expect.stringContaining('srv/service.cds → a comment fix'),
    });
    expect(events(session)).toEqual(['gate handback-gate m1 mcp']);
  });

  it('the attempt after the limit passes with a gate record', () => {
    const session = 'hb-limit';
    try {
      sb.resetTree();
      sb.put({ '.claude/settings.json': '{}\n' });
      expect(HANDBACK_DENY_MAX).toBe(3);
      for (let i = 1; i <= HANDBACK_DENY_MAX; i++)
        expect(handback(session, 'l1').decision, `attempt ${i}`).toBe('deny');
      const last = handback(session, 'l1');
      expect(last.status).toBe(0);
      expect(last.stdout).toBe('');
      expect(events(session)).toEqual([
        ...Array(HANDBACK_DENY_MAX).fill('gate handback-gate l1 protected'),
        'gate handback-gate l1 handback-limit',
      ]);
      // The limit counts per agent id.
      expect(handback(session, 'l2').decision).toBe('deny');
    } finally {
      sb.resetTree();
    }
  });

  it('SubagentStop blocks a plain-text end only', () => {
    const session = 'ss-plain';
    const stopOf = (agentId, extra) =>
      withCache((env) =>
        sb.hook(
          'subagent-stop.mjs',
          {
            session_id: session,
            hook_event_name: 'SubagentStop',
            agent_id: agentId,
            agent_type: 'cap-backend-dev',
            stop_hook_active: false,
            ...extra,
          },
          env
        )
      );
    try {
      sb.resetTree();
      sb.put({ 'app/demo/webapp/ext/x.js': UNDOCUMENTED });
      let res = stopOf('p1', { last_assistant_message: '## Done' });
      expect(res.status, res.stderr).toBe(2);
      expect(res.stderr).toMatch(HEADER('\\d+'));
      expect(res.stderr).toContain('Fix them and finish again.');
      // Without the key the report went through SubagentHandback (F8): nothing blocks.
      res = stopOf('p2', {});
      expect(res.status, res.stderr).toBe(0);
      expect(res.stderr).toBe('');

      sb.resetTree();
      audit(session, edit('p3', 'srv/service.cds'), edit('p4', 'srv/service.cds'));
      res = stopOf('p3', { last_assistant_message: '## Done' });
      expect(res.status, res.stderr).toBe(2);
      expect(res.stderr).toMatch(/^MCP check \(rule pipeline-config\.md, ADR-0014\)/);
      expect(res.stderr).toContain('Then finish again.');
      res = stopOf('p4', {});
      expect(res.status, res.stderr).toBe(0);
      expect(res.stderr).toBe('');

      expect(events(session)).toEqual([
        'agent-stop p1',
        'gate subagent-stop p1 lint',
        'agent-stop p2',
        'agent-stop p3',
        'gate subagent-stop p3 mcp',
        'agent-stop p4',
      ]);
    } finally {
      sb.resetTree();
    }
  }, 60_000);

  it('an unreadable handback input allows', () => {
    const session = 'hb-safe';
    const script = path.join(sb.root, 'scripts', 'hooks', 'handback-gate.mjs');
    const env = { ...process.env };
    delete env.PIPELINE_ALLOW_PROTECTED;
    const raw = (input) => spawnSync('node', [script], { input, encoding: 'utf8', env });
    try {
      sb.resetTree();
      sb.put({ '.claude/settings.json': '{}\n' });
      // Readable and with an agent id, the call is denied: the passes below are the gate's safety.
      expect(handback(session, 's1').decision).toBe('deny');
      for (const input of ['', 'not json', '[]']) {
        const res = raw(input);
        expect(res.status, input).toBe(0);
        expect(res.stdout, input).toBe('');
      }
      // No agent id: the main thread has no handback.
      let res = sb.hook('handback-gate.mjs', {
        session_id: session,
        ...handbackInput('PreToolUse', {}),
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toBe('');
      // An internal error: the audit log cannot take the deny record.
      fs.mkdirSync(auditFile(sb.root, 'hb-broken'), { recursive: true });
      res = sb.hook('handback-gate.mjs', {
        session_id: 'hb-broken',
        ...handbackInput('PreToolUse', { agentId: 's2' }),
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe('');
      expect(events('hb-broken')).toEqual([]);
      expect(events(session)).toEqual(['gate handback-gate s1 protected']);
    } finally {
      sb.resetTree();
    }
  });
});
