// ADR-0029 decision 7: the JSDoc gate of webapp/ext reaches the PostToolUse hook and the git-based
// gates through checkUi5 of scripts/lib/file-checks.mjs, which runs the app's own ESLint
// (`npx eslint --format json` in the app dir) on webapp JavaScript outside webapp/test and
// webapp/localService. Also pins STALE_EXCLUDE: an app's package files are not registry sources.
// The checks run against one temp root, so their only write (docs/registry/.stale) lands there;
// ESLint and ui5lint only read. Model: test/hooks-registry-gate.test.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runFileChecks } from '../scripts/lib/file-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const APP = path.join(root, 'app', 'products');

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
// The app config keeps `semi` for all of webapp, webapp/test included: linted, this text gives a
// finding anywhere, so an empty result shows the path is skipped, not that the text is clean.
const NO_SEMICOLON = UNDOCUMENTED.replace('return value;', 'return value');

const STALE_NOTE = /registry is marked stale/;
/** The notes of the ESLint run: findings, a crash or the timeout. */
const eslintNotes = (notes) => notes.filter((n) => /^eslint[ :]/.test(n));

let tmp;

function put(rel, text) {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

beforeAll(() => {
  // realpath: macOS tmpdir is a symlink (/var -> /private/var); keep one form of every path.
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'file-checks-')));
  // Two apps with the files of app/products that ui5lint and ESLint read: `demo` has its packages
  // installed (a link to the real ones), `bare` has none.
  for (const app of ['demo', 'bare'])
    for (const f of ['ui5.yaml', 'package.json', 'eslint.config.mjs'])
      put(`app/${app}/${f}`, fs.readFileSync(path.join(APP, f), 'utf8'));
  fs.symlinkSync(path.join(APP, 'node_modules'), path.join(tmp, 'app/demo/node_modules'), 'dir');
  // npx finds a bin by walking up from the app, as it does from app/products to the repository
  // root: the packages at the temp root let ui5lint of `bare` resolve locally instead of through
  // the registry, and they hold an ESLint that `bare` has not installed.
  fs.symlinkSync(path.join(APP, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('app ESLint in the file checks (ADR-0029 decision 7)', () => {
  it('runs the app ESLint for webapp JavaScript and reports a missing JSDoc', () => {
    const r = 'app/demo/webapp/ext/x.js';
    put(r, UNDOCUMENTED);
    const notes = eslintNotes(runFileChecks(tmp, r, { markRegistryStale: false }));
    expect(notes).toHaveLength(1);
    // Same note format as checkJs, naming the repository path, not the app-relative one.
    expect(notes[0]).toMatch(/^eslint app\/demo\/webapp\/ext\/x\.js: \d+ findings\n/);
    expect(notes[0]).toMatch(/^ {2}error 3:3 .*\(jsdoc\/require-jsdoc\)$/m);

    put(r, DOCUMENTED);
    expect(eslintNotes(runFileChecks(tmp, r, { markRegistryStale: false }))).toEqual([]);

    const t = 'app/demo/webapp/test/x.js';
    put(t, NO_SEMICOLON);
    expect(eslintNotes(runFileChecks(tmp, t, { markRegistryStale: false }))).toEqual([]);
  });

  it('lints the rest of webapp with the Fiori tools rules and skips webapp/localService', () => {
    // Outside ext the JSDoc rules do not apply, the rest of the app config does.
    const c = 'app/demo/webapp/controller/x.js';
    put(c, NO_SEMICOLON);
    const notes = eslintNotes(runFileChecks(tmp, c, { markRegistryStale: false }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^eslint app\/demo\/webapp\/controller\/x\.js: /);
    expect(notes[0]).toMatch(/\(semi\)$/m);
    expect(notes[0]).not.toMatch(/jsdoc\//);

    // The app config ignores localService: linted by name, ESLint would warn "File ignored".
    const l = 'app/demo/webapp/localService/x.js';
    put(l, NO_SEMICOLON);
    expect(eslintNotes(runFileChecks(tmp, l, { markRegistryStale: false }))).toEqual([]);
  });

  it('skips the app ESLint for an app without its own node_modules', () => {
    const r = 'app/bare/webapp/ext/x.js';
    put(r, UNDOCUMENTED);
    let notes;
    expect(() => {
      notes = runFileChecks(tmp, r, { markRegistryStale: false });
    }).not.toThrow();
    expect(eslintNotes(notes)).toEqual([]);
  });
});

describe('registry staleness of app files', () => {
  it("does not mark the registry stale for an app's package files", () => {
    const stale = path.join(tmp, 'docs/registry/.stale');
    fs.rmSync(path.join(tmp, 'docs'), { recursive: true, force: true });
    put('app/demo/package-lock.json', '{ "lockfileVersion": 3 }\n');
    for (const r of ['app/demo/package.json', 'app/demo/package-lock.json'])
      expect(
        runFileChecks(tmp, r).filter((n) => STALE_NOTE.test(n)),
        r
      ).toEqual([]);
    expect(fs.existsSync(stale)).toBe(false);

    // The app's own sources stay registry sources.
    const m = 'app/demo/webapp/manifest.json';
    put(m, '{ "sap.app": { "id": "demo" } }\n');
    expect(runFileChecks(tmp, m).some((n) => STALE_NOTE.test(n))).toBe(true);
    expect(fs.readFileSync(stale, 'utf8')).toMatch(/^\S+ app\/demo\/webapp\/manifest\.json\n$/);
  });
});
