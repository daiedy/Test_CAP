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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSandbox, SANDBOX_GITIGNORE } from './fixtures/hook-sandbox.mjs';

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
