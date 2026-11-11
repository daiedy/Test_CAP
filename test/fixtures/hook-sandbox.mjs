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

/**
 * Writes the transcript of a subagent the resume gate looks up (ADR-0031 decision 7, probe fact
 * F7): `<dir>/<sessionId>/subagents/agent-<agentId>.jsonl` with its `.meta.json`, in the record
 * shapes of a real agent file. Each attempt is a `SubagentHandback` tool use, repeated by an
 * `api-request-blob` record (the reader skips it), and its `tool_result`: `delivered` a result
 * without an error, `denied` an error result (a PreToolUse deny of the handback gate, F9). No
 * attempt at all is an agent stopped at its turn limit without a report.
 * @param {string} dir the directory of the main session transcript
 * @param {string} sessionId the main session id
 * @param {string} agentId the bare agent id
 * @param {{agentType?: string, attempts?: ('delivered'|'denied')[]}} [options]
 * @returns {string} the main transcript path, the `transcript_path` of a `SendMessage` hook input
 */
export function writeAddressee(
  dir,
  sessionId,
  agentId,
  { agentType = 'cap-backend-dev', attempts = [] } = {}
) {
  const sub = path.join(dir, sessionId, 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  const main = path.join(dir, `${sessionId}.jsonl`);
  if (!fs.existsSync(main)) fs.writeFileSync(main, '');
  let n = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 11, 10, 0, n++)).toISOString();
  const usage = { input_tokens: 10, output_tokens: 5 };
  const assistant = (content) => ({
    type: 'assistant',
    timestamp: stamp(),
    uuid: `${agentId}-a${n}`,
    requestId: `${agentId}-req${n}`,
    message: { model: 'claude-fixture', role: 'assistant', content, usage },
  });
  const records = [
    {
      type: 'user',
      timestamp: stamp(),
      uuid: `${agentId}-u0`,
      message: { role: 'user', content: 'the delegation message' },
    },
    assistant([{ type: 'text', text: 'working on it' }]),
  ];
  attempts.forEach((kind, i) => {
    const block = {
      type: 'tool_use',
      id: `toolu_${agentId}_${i}`,
      name: 'SubagentHandback',
      input: { message: `## Done\nattempt ${i + 1}` },
    };
    records.push(assistant([block]), {
      type: 'api-request-blob',
      timestamp: stamp(),
      message: { content: [block] },
    });
    const denied = kind === 'denied';
    records.push({
      type: 'user',
      timestamp: stamp(),
      uuid: `${agentId}-u${n}`,
      toolUseResult: denied ? 'Error: denied by a hook' : 'Report delivered.',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: block.id,
            content: denied ? 'Hook PreToolUse:SubagentHandback denied this tool' : 'Delivered.',
            ...(denied ? { is_error: true } : {}),
          },
        ],
      },
    });
  });
  fs.writeFileSync(
    path.join(sub, `agent-${agentId}.jsonl`),
    records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  );
  fs.writeFileSync(path.join(sub, `agent-${agentId}.meta.json`), JSON.stringify({ agentType }));
  return main;
}

/**
 * The hook input of a `SubagentHandback` call in a subagent (measured keys, ADR-0031 decision 8):
 * PreToolUse runs the hand-over checks, PostToolUse also carries `tool_response` and saves the
 * report. An `agentId` left out is the main thread, which has no handback.
 * @param {'PreToolUse'|'PostToolUse'} event the hook event
 * @param {{agentId?: string, agentType?: string, message?: string}} [options]
 * @returns {object} the payload for `hook('handback-gate.mjs', ...)`
 */
export function handbackInput(
  event,
  { agentId, agentType = 'cap-backend-dev', message = '## Done\n' } = {}
) {
  const input = {
    hook_event_name: event,
    tool_name: 'SubagentHandback',
    tool_input: { message },
    agent_id: agentId,
    agent_type: agentType,
  };
  if (event === 'PostToolUse') input.tool_response = 'Delivered.';
  return input;
}
