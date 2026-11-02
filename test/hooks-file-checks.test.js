// ADR-0029 decision 7: the JSDoc gate of webapp/ext reaches the PostToolUse hook and the git-based
// gates through checkUi5 of scripts/lib/file-checks.mjs, which runs the app's own ESLint
// (`npx eslint --format json` in the app dir) on webapp JavaScript outside webapp/test and
// webapp/localService. Also pins STALE_EXCLUDE: an app's package files are not registry sources.
// The checks run against one temp root, so their only write (docs/registry/.stale) lands there;
// ESLint and ui5lint only read. Model: test/hooks-registry-gate.test.js.
// PLAN step 4 part 2 (ADR-0029 amendment D-F): brace alternatives in the globs of isUnder, the
// UI5_SCOPE of the resources ui5lint lints, the install check of an app's linters and a linter run
// without a JSON report. A run gets a fresh empty npm cache (`withNpmCache`): npm writes `_logs`
// into the cache on every npx call, so a cache still empty afterwards proves that no linter ran.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runFileChecks, UI5_SCOPE } from '../scripts/lib/file-checks.mjs';
import { isUnder } from '../scripts/lib/hook-utils.mjs';
import { createSandbox } from './fixtures/hook-sandbox.mjs';

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

/** Runs `fn` with a fresh empty offline npm cache; `npx` tells whether any npx call happened. */
function withNpmCache(fn) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'file-checks-npm-'));
  const saved = {
    npm_config_cache: undefined,
    npm_config_offline: undefined,
    npm_config_update_notifier: undefined,
  };
  for (const k of Object.keys(saved)) saved[k] = process.env[k];
  // No update notice: npm appends it to stderr on the first call with a fresh cache.
  Object.assign(process.env, {
    npm_config_cache: cache,
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
  });
  try {
    const result = fn();
    return { result, npx: fs.readdirSync(cache).length > 0 };
  } finally {
    for (const [k, v] of Object.entries(saved))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    fs.rmSync(cache, { recursive: true, force: true });
  }
}

/** The notes of the app linters: findings, a failure, or a skipped check. */
const appLintNotes = (notes) => notes.filter((n) => /^(ui5lint|eslint) |is not installed/.test(n));
const notInstalled = (tool) =>
  `app/bare: ${tool} is not installed (no app/bare/node_modules/.bin/${tool}), its check was skipped; run \`npm install\` in app/bare.`;

beforeAll(() => {
  // realpath: macOS tmpdir is a symlink (/var -> /private/var); keep one form of every path.
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'file-checks-')));
  // Three apps with the files of app/products that ui5lint and ESLint read: `demo` has its packages
  // installed (a link to the real ones), `bare` has none, and the .bin/ui5lint and .bin/eslint of
  // `stub` exit 2 with stderr only.
  for (const app of ['demo', 'bare', 'stub'])
    for (const f of ['ui5.yaml', 'package.json', 'eslint.config.mjs'])
      put(`app/${app}/${f}`, fs.readFileSync(path.join(APP, f), 'utf8'));
  fs.symlinkSync(path.join(APP, 'node_modules'), path.join(tmp, 'app/demo/node_modules'), 'dir');
  for (const tool of ['ui5lint', 'eslint']) {
    const bin = `app/stub/node_modules/.bin/${tool}`;
    put(bin, `#!/bin/sh\necho "stub ${tool}: cannot start" >&2\nexit 2\n`);
    fs.chmodSync(path.join(tmp, bin), 0o755);
  }
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

  it('runs ui5lint and the app ESLint only when installed in the app', () => {
    // `bare` has no node_modules; the ancestor install at the temp root holds both tools.
    const r = 'app/bare/webapp/ext/x.js';
    put(r, UNDOCUMENTED);
    const { result, npx } = withNpmCache(() => runFileChecks(tmp, r, { markRegistryStale: false }));
    expect(npx).toBe(false);
    expect(appLintNotes(result)).toEqual([notInstalled('ui5lint'), notInstalled('eslint')]);
  });

  it('reports a linter that fails without a JSON report', () => {
    const r = 'app/stub/webapp/ext/x.js';
    put(r, DOCUMENTED);
    const { result, npx } = withNpmCache(() => runFileChecks(tmp, r, { markRegistryStale: false }));
    expect(npx).toBe(true);
    expect(appLintNotes(result)).toEqual([
      `ui5lint ${r}: failed (exit 2) without a JSON report: stub ui5lint: cannot start`,
      `eslint ${r}: failed (exit 2) without a JSON report: stub eslint: cannot start`,
    ]);
  });
});

describe('UI5 scope of the file checks (ADR-0029 amendment D)', () => {
  it('expands brace alternatives and keeps other braces literal', () => {
    const dir = 'app/products/webapp/ext/fragment';
    const js = 'app/**/webapp/**/*.{js,html}';
    expect(isUnder(`${dir}/DetailsForm.js`, js)).toBe(true);
    expect(isUnder(`${dir}/DetailsForm.html`, js)).toBe(true);
    expect(
      isUnder(`${dir}/DetailsForm.fragment.xml`, 'app/**/webapp/**/*.{view,fragment}.xml')
    ).toBe(true);
    for (const f of ['x.json', 'x.jsx']) expect(isUnder(`${dir}/${f}`, js), f).toBe(false);
    // An unclosed `{` and a lone `}` match only themselves.
    expect(isUnder('app/{x', 'app/{x')).toBe(true);
    expect(isUnder('app/x', 'app/{x')).toBe(false);
    expect(isUnder('app/x}', 'app/x}')).toBe(true);
    expect(isUnder('app/x', 'app/x}')).toBe(false);
  });

  it('sends only the resources ui5lint lints to ui5lint', () => {
    const w = 'app/products/webapp';
    for (const r of [
      `${w}/Component.js`,
      `${w}/test/flpSandbox.html`,
      `${w}/ext/view/Main.view.xml`,
      `${w}/ext/fragment/DetailsForm.fragment.xml`,
      `${w}/manifest.json`,
    ])
      expect(isUnder(r, UI5_SCOPE), r).toBe(true);
    for (const r of [
      `${w}/localService/metadata.xml`,
      `${w}/localService/mockdata/Products.json`,
      `${w}/i18n/i18n.properties`,
    ])
      expect(isUnder(r, UI5_SCOPE), r).toBe(false);

    // A fragment of the installed app reaches ui5lint, a regenerated metadata.xml does not.
    const f = 'app/demo/webapp/ext/fragment/DetailsForm.fragment.xml';
    put(f, fs.readFileSync(path.join(APP, 'webapp/ext/fragment/DetailsForm.fragment.xml'), 'utf8'));
    expect(withNpmCache(() => runFileChecks(tmp, f, { markRegistryStale: false })).npx).toBe(true);
    const m = 'app/demo/webapp/localService/metadata.xml';
    put(m, fs.readFileSync(path.join(APP, 'webapp/localService/metadata.xml'), 'utf8'));
    const { result, npx } = withNpmCache(() => runFileChecks(tmp, m, { markRegistryStale: false }));
    expect(npx).toBe(false);
    expect(result.filter((n) => /ui5lint/.test(n))).toEqual([]);
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

// ADR-0030 decision 6: the PostToolUse checks hold a wiki page to its folder's shape at the edit;
// a generated file (generator header) and a `_*.md` file are no pages. A sandbox of its own: the
// pages live in the temp git repository of createSandbox(), never in the real docs/wiki.
describe('wiki pages in the file checks (ADR-0030 decision 6)', () => {
  it('reports a wiki page that breaks the shape at the edit', () => {
    const sb = createSandbox({ prefix: 'file-checks-wiki', session: 'file-checks-wiki' });
    const RULE = 'docs/wiki/rules/The-subcategory-belongs-to-the-products-category.md';
    const INDEX = 'docs/wiki/rules/Business-rules.md';
    const check = (r) => runFileChecks(sb.root, r, { markRegistryStale: false });
    try {
      sb.put({
        'docs/wiki/rules/x.md': '# x\n\nA rule without frontmatter.\n',
        [RULE]: fs.readFileSync(path.join(root, RULE), 'utf8'),
        [INDEX]:
          '<!-- generated by scripts/gen-wiki.mjs | sources: 0123456789abcdef | do not edit -->\n# Business rules\n',
        'docs/wiki/_Footer.md': 'A read-only mirror.\n',
      });
      const notes = check('docs/wiki/rules/x.md');
      expect(notes).toEqual([
        expect.stringMatching(
          /^docs\/wiki\/rules\/x\.md must keep the page shape of its wiki folder/
        ),
      ]);
      expect(notes[0]).toMatch(/no frontmatter/);
      for (const r of [RULE, INDEX, 'docs/wiki/_Footer.md']) expect(check(r), r).toEqual([]);
    } finally {
      sb.remove();
    }
  });
});
