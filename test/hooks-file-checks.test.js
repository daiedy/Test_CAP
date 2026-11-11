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
import { isUnder, HOOK_OUTPUT_MAX } from '../scripts/lib/hook-utils.mjs';
import { blockText } from '../scripts/lib/handover-checks.mjs';
import { createSandbox, SANDBOX_GITIGNORE, handbackInput } from './fixtures/hook-sandbox.mjs';

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

// MANY undocumented helpers: one jsdoc/require-jsdoc error each, a lint note and a block text far
// above HOOK_OUTPUT_MAX (ADR-0031 decision 4).
const MANY = 300;
const BULK = [
  'sap.ui.define([], function () {',
  '  "use strict";',
  ...Array.from(
    { length: MANY },
    (_, i) => `  function helper${i}(value) {\n    return value;\n  }`
  ),
  `  return { ${Array.from({ length: MANY }, (_, i) => `helper${i}: helper${i}`).join(', ')} };`,
  '});',
  '',
].join('\n');
/** The last line of a relay() summary: the bytes and the repo-relative path of the whole. */
const WHOLE_LOG =
  /The whole output \((\d+) bytes\) is in (\.pipeline\/logs\/\S+\.log); read it there\./;
/** The log a relayed `text` names under `base`, checked to hold the announced bytes. */
function logOf(base, text) {
  const m = text.match(WHOLE_LOG);
  expect(m, text).not.toBeNull();
  const body = fs.readFileSync(path.join(base, m[2]), 'utf8');
  expect(Buffer.byteLength(body)).toBe(Number(m[1]));
  return body;
}

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

describe('relays without cuts (ADR-0031 decision 4)', () => {
  it('a long report is summarised with the path of the whole', () => {
    // The lint note of an edit: counts per severity and rule, the log holds every finding.
    const r = 'app/demo/webapp/ext/bulk.js';
    put(r, BULK);
    const [note] = eslintNotes(runFileChecks(tmp, r, { markRegistryStale: false }));
    expect(note).toMatch(
      new RegExp(`^eslint ${r}: \\d+ findings, counted by severity and rule:\\n`)
    );
    expect(note).toMatch(new RegExp(`^ {2}error jsdoc/require-jsdoc: ${MANY}$`, 'm'));
    expect(note).not.toMatch(/^ {2}error \d+:\d+ /m);
    expect(note.length).toBeLessThan(HOOK_OUTPUT_MAX);
    const whole = logOf(tmp, note);
    expect(whole.match(/^ {2}error \d+:\d+ .*\(jsdoc\/require-jsdoc\)$/gm)).toHaveLength(MANY);
    // A note that fits stays whole and writes no log.
    const logs = () => fs.readdirSync(path.join(tmp, '.pipeline', 'logs'));
    const before = logs();
    put(r, UNDOCUMENTED);
    const [short] = eslintNotes(runFileChecks(tmp, r, { markRegistryStale: false }));
    expect(short).toMatch(/^ {2}error 3:3 .*\(jsdoc\/require-jsdoc\)$/m);
    expect(short).not.toContain('.pipeline/logs');
    expect(logs()).toEqual(before);

    // The handback gate's deny reason and the SubagentStop block of the same findings.
    const files = { '.gitignore': `${SANDBOX_GITIGNORE}node_modules\n` };
    for (const f of ['ui5.yaml', 'package.json', 'eslint.config.mjs', 'webapp/manifest.json'])
      files[`app/demo/${f}`] = fs.readFileSync(path.join(APP, f), 'utf8');
    const box = createSandbox({ prefix: 'relay', session: 'relay', files });
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-npm-'));
    const env = {
      npm_config_cache: cache,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
    };
    try {
      for (const dir of ['app/demo', '.'])
        fs.symlinkSync(
          path.join(APP, 'node_modules'),
          path.join(box.root, dir, 'node_modules'),
          'dir'
        );
      box.put({ [r]: BULK });
      const gate = box.hook(
        'handback-gate.mjs',
        handbackInput('PreToolUse', { agentId: 'w1' }),
        env
      );
      const stop = box.hook(
        'subagent-stop.mjs',
        {
          hook_event_name: 'SubagentStop',
          agent_id: 'w2',
          agent_type: 'cap-backend-dev',
          stop_hook_active: false,
          last_assistant_message: '## Done',
        },
        env
      );
      expect(stop.status, stop.stderr).toBe(2);
      const denied = JSON.parse(gate.stdout).hookSpecificOutput;
      expect(denied.permissionDecision).toBe('deny');
      for (const [text, next] of [
        [denied.permissionDecisionReason, 'call SubagentHandback again'],
        [stop.stderr, 'finish again'],
      ]) {
        expect(text).toMatch(
          new RegExp(
            `^The subagent cannot finish: \\d+ linter errors in changed files\\. Fix them and ${next}\\.\\n`
          )
        );
        expect(text).toMatch(
          new RegExp(`^Errors per rule:\\n(?: {2}.*\\n)*? {2}jsdoc/require-jsdoc: ${MANY}$`, 'm')
        );
        expect(text).toMatch(/^Errors per file:\n {2}app\/demo\/webapp\/ext\/bulk\.js: \d+$/m);
        expect(text).not.toMatch(/bulk\.js:\d+:\d+ /);
        expect(text.length).toBeLessThan(HOOK_OUTPUT_MAX);
        const log = logOf(box.root, text);
        expect(
          log.match(/^app\/demo\/webapp\/ext\/bulk\.js:\d+:\d+ .*\(jsdoc\/require-jsdoc\)$/gm)
        ).toHaveLength(MANY);
      }
    } finally {
      box.remove();
      fs.rmSync(cache, { recursive: true, force: true });
    }

    // blockText() of both hooks: whole when it fits; the protected and MCP summaries count paths.
    const lines = [
      'app/x/a.js:1:1 Missing semicolon. (semi)',
      'app/x/b.js:2:1 Missing semicolon. (semi)',
    ];
    expect(blockText({ reason: 'lint', lines, root: tmp }, 'finish again')).toBe(
      `The subagent cannot finish: 2 linter errors in changed files. Fix them and finish again.\n${lines.join('\n')}\n`
    );
    for (const [why, label, count] of [
      ['protected', 'hook script', 'reason'],
      ['mcp', 'CDS model and services', 'rule'],
    ]) {
      const paths = Array.from(
        { length: 400 },
        (_, i) => `  scripts/x/file-${i}.mjs (${label}) → a query`
      );
      const text = blockText({ reason: why, lines: paths, root: tmp }, 'finish again');
      expect(text).toContain(`400 paths, counted by ${count}:\n  ${label}: 400\n`);
      expect(text.length).toBeLessThan(HOOK_OUTPUT_MAX);
      expect(logOf(tmp, text)).toContain(paths.join('\n'));
    }
  }, 60_000);

  it('no relay cuts output by characters or lines', () => {
    // A cut by characters or lines is a slice with a literal length, a constant length or a
    // negative start. Allowed, each on purpose (ADR-0031 decision 4, "Unchanged"): hash and date
    // formatting, a field of a log record, the 80-character quote of an offending line in
    // doc-shapes.mjs, the D17 top-five list, and CHECK_LIMIT of SubagentStop, which prints what it
    // skipped. capped() of SessionStart is a visible cap with the path (ADR-0018 principle 3).
    const SLICES = {
      'scripts/hooks/post-edit.mjs': ['.slice(0, MARKER_MAX)'], // the phase record's STATE values
      'scripts/hooks/pre-compact.mjs': ['.slice(0, 16)'], // the minute of a sessions.log stamp
      'scripts/hooks/read-gate.mjs': ['.slice(0, 12)'], // a sha256 prefix in the deny reason
      'scripts/hooks/subagent-stop.mjs': ['.slice(0, CHECK_LIMIT)'], // prints what it skipped
      'scripts/lib/backlog.mjs': ['.slice(0, 10)'], // a date
      'scripts/lib/doc-shapes.mjs': [...Array(10).fill('.slice(0, 80)'), '.slice(0, 60)'], // quotes
      'scripts/lib/feature-brief.mjs': ['.slice(0, 10)', '.slice(0, 12)'], // a date, a hash
      'scripts/lib/handover-checks.mjs': ['.slice(idx, idx + 800)'], // the justification record
      'scripts/lib/pipeline-metrics.mjs': [
        '.slice(0, 10)',
        '.slice(0, 16)',
        '.slice(0, LARGEST_RESULTS)',
      ],
      'scripts/lib/registry-sources.mjs': ['.slice(0, 16)'], // a hash
    };
    // truncate() only for a field of a log record: the audit subject, the justification text.
    const TRUNCATES = {
      'scripts/hooks/mcp-audit.mjs': ['truncate(String(subject), 120)'],
      'scripts/lib/handover-checks.mjs': ['truncate(text.slice(idx, idx + 800), 800)'],
    };
    const CALL = String.raw`\(([^()]*(?:\([^()]*\)[^()]*)*)\)`;
    const LENGTH = /(^|[^\w.])(\d{2,}|-[2-9]|-\d{2,})\b|\b[A-Z][A-Z0-9_]{2,}\b/;
    const slices = {};
    const truncates = {};
    for (const dir of ['scripts/hooks', 'scripts/lib'])
      for (const name of fs.readdirSync(path.join(root, dir)).filter((n) => /\.m?js$/.test(n))) {
        const file = `${dir}/${name}`;
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        expect(text, file).not.toMatch(/\blastLines\b/);
        for (const m of text.matchAll(
          new RegExp(String.raw`\.(slice|substring|substr)${CALL}`, 'g')
        ))
          if (LENGTH.test(m[2])) (slices[file] ||= []).push(m[0]);
        for (const m of text.matchAll(new RegExp(String.raw`(?<!function )\btruncate${CALL}`, 'g')))
          (truncates[file] ||= []).push(m[0]);
      }
    const sorted = (map) =>
      Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]));
    expect(sorted(slices)).toEqual(sorted(SLICES));
    expect(truncates).toEqual(TRUNCATES);
  });
});
