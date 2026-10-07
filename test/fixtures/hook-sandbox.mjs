// The git sandbox of the hook tests (ADR-0022, ADR-0023), shared by test/hooks-metrics.test.js,
// test/hooks-state-hygiene.test.js and the projectNow() test of test/backlog.test.js. A temp git
// repository holds copies of scripts/hooks, scripts/lib and scripts/i18n: `repoRoot()` follows the
// script's own location, so every write of a hook (.pipeline/, current-session, sessions.log, the
// MCP audit, the drift key) lands in the sandbox, and the tree the git-based gates inspect is known.
// `gh` (the SessionStart briefing) gets an empty config dir and no token, so it fails at once
// without a network call. Idiom of test/hooks-protect-bash.test.js: a hook runs as a child process
// with sample JSON on stdin.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJsonl } from '../../scripts/lib/transcript-usage.mjs';
import { metricsFile } from '../../scripts/lib/metrics-log.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const PHASE_2 = '2: backend';
/** The branch the sandbox is created on, and the `Branch:` of its docs/STATE.md. */
export const SANDBOX_BRANCH = 'feature/fixture-live';
/** The ignore list of the sandbox; a test that needs another line puts it itself. */
export const SANDBOX_GITIGNORE = '.pipeline/\n.claude/.gate-state.json\n';
/** Variables a hook must not inherit from the session that runs the tests. */
const UNSET = [
  'PIPELINE_ALLOW_PROTECTED',
  'PIPELINE_SKIP_GATE',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
];

/** docs/STATE.md of the sandbox in the shape of templates/STATE.md. */
export function stateDoc({
  branch = SANDBOX_BRANCH,
  feature = 'fixture-live (#7)',
  phase = PHASE_2,
  lastCommit = '0000000 init',
  extra = '',
} = {}) {
  return [
    '# Project state',
    '',
    '## Now',
    '',
    '- Date: 2026-09-29',
    `- Branch: ${branch}`,
    `- Feature: ${feature}`,
    `- Phase: ${phase}`,
    `- Last commit: ${lastCommit}`,
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

/**
 * Creates the sandbox: a real path (macOS tmpdir is a symlink, /var -> /private/var, and the hooks
 * resolve their root from their own real location, so a file path must use the same prefix), the
 * script copies, `.gitignore`, docs/STATE.md and docs/CHANGELOG.md committed as `init` on
 * SANDBOX_BRANCH.
 * @param {{prefix: string, session: string, files?: Record<string, string>}} options `files`
 *   overrides or adds files of the first commit (relative path to content)
 */
export function createSandbox({ prefix, session, files = {} }) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`)));
  const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-gh-`));

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
      { cwd: dir, encoding: 'utf8' }
    );

  /** Writes files into the sandbox (relative path to content). */
  function put(entries) {
    for (const [rel, text] of Object.entries(entries)) {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
  }

  /** The abbreviated hash of `ref`, as STATE writes it in `Last commit:`. */
  const rev = (ref = 'HEAD') => git('rev-parse', '--short', ref).stdout.trim();

  /** Writes `entries` and commits everything; returns the abbreviated hash of the new commit. */
  function commit(entries, message) {
    put(entries);
    git('add', '-A');
    git('commit', '-qm', message);
    return rev();
  }

  /** Back to the committed tree; ignored files (.pipeline/) stay. */
  function resetTree() {
    git('checkout', '-q', '--', '.');
    git('clean', '-fdq');
  }

  /** Runs a hook of the sandbox with `payload` on stdin; `env` adds or keeps variables. */
  function hook(name, payload, env = {}) {
    const childEnv = { ...process.env, GH_CONFIG_DIR: ghDir, ...env };
    for (const k of UNSET) if (!(k in env)) delete childEnv[k];
    return spawnSync('node', [path.join(dir, 'scripts', 'hooks', name)], {
      input: JSON.stringify({ session_id: session, cwd: dir, ...payload }),
      encoding: 'utf8',
      env: childEnv,
    });
  }

  /** The event log of the test session. */
  const log = () => readJsonl(metricsFile(dir, session));

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

  function remove() {
    for (const d of [dir, ghDir]) fs.rmSync(d, { recursive: true, force: true });
  }

  for (const d of ['scripts/hooks', 'scripts/lib', 'scripts/i18n'])
    fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
  put({
    '.gitignore': SANDBOX_GITIGNORE,
    'docs/STATE.md': stateDoc(),
    'docs/CHANGELOG.md': '# Changelog\n',
    ...files,
  });
  git('init', '-q', '-b', SANDBOX_BRANCH);
  git('add', '-A');
  git('commit', '-qm', 'init');

  return { root: dir, ghDir, git, put, rev, commit, resetTree, hook, log, appended, remove };
}
