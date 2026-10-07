/**
 * The `## Now` lines of docs/STATE.md against git (ADR-0018, ADR-0023). `projectNow()` reads the
 * project state for the briefing (moved here from backlog.mjs, which re-exports it) together with
 * the inputs of the drift rule; `stateDrift()` is the rule itself, a pure function; the drift key in
 * .pipeline/state-drift.json lets the SessionStart briefing and the Stop gate report one drift once.
 * A committed STATE cannot name its own commit, so `Last commit:` one first-parent commit behind
 * HEAD is the normal state after every pipeline commit (ADR-0023, measured over ten commits).
 * Imports only hook-utils.mjs: the Stop gate loads it on every turn end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { run, repoRoot, readSection, currentBranch } from './hook-utils.mjs';

/** The drift key last reported, gitignored with the rest of `.pipeline/`. */
export const DRIFT_FILE = '.pipeline/state-drift.json';

/** `Last commit:` up to this many first-parent commits behind HEAD is not a drift. */
export const MAX_BEHIND = 1;

/** A commit hash as STATE writes it; anything else (a ref name, `none`) never reaches git. */
const HASH = /^[0-9a-f]{7,40}$/i;

/**
 * Distance of the `Last commit:` hash from HEAD in first-parent commits (`--first-parent`: a
 * merge on main is one step, not two).
 * @param {(args: string[]) => {code: number|null, stdout: string}} git runs git in the repo
 * @param {string} hash leading token of `Last commit:`
 * @returns {number|'unknown'|'diverged'|null} the count; 'unknown' when the hash does not resolve
 *   to a commit, 'diverged' when it is not an ancestor of HEAD, null when git fails otherwise
 */
function distance(git, hash) {
  if (!HASH.test(hash) || git(['rev-parse', '--verify', '-q', `${hash}^{commit}`]).code !== 0)
    return 'unknown';
  const ancestor = git(['merge-base', '--is-ancestor', hash, 'HEAD']).code;
  if (ancestor === 1) return 'diverged';
  if (ancestor !== 0) return null;
  const count = git(['rev-list', '--count', '--first-parent', `${hash}..HEAD`]);
  return count.code === 0 ? Number(count.stdout.trim()) : null;
}

/**
 * Branch, dirty count, last commit and the Feature/Phase lines of docs/STATE.md, plus the inputs
 * of the drift rule.
 * @param {string} root repo root
 * @returns {{branch: string, dirty: number, lastCommit: string, feature: string|null,
 *   phase: string, head: string, gitBranch: string, stateBranch: string, stateCommit: string,
 *   behind: number|'unknown'|'diverged'|null}} `branch` for display ('HEAD' when detached, '?'
 *   without git); `head` the full HEAD hash ('' without a commit); `gitBranch` from
 *   `git branch --show-current` ('' when detached); `stateBranch` and `stateCommit` the first
 *   tokens of `Branch:` and `Last commit:` ('' when the label is missing); `behind` see distance()
 */
export function projectNow(root = repoRoot()) {
  const git = (args) => run('git', args, { cwd: root, timeoutMs: 5_000 });
  const out = (args) => git(args).stdout.trim();
  const now = readSection(path.join(root, 'docs', 'STATE.md'), '## Now');
  const line = (label) => (now.match(new RegExp(`^- ${label}:\\s*(.*)$`, 'm')) || [])[1]?.trim();
  const firstToken = (label) => (line(label) || '').split(/\s+/)[0];
  const feature = line('Feature');
  const [head = '', last = ''] = out(['log', '-1', '--format=%H%n%h %s']).split('\n');
  const gitBranch = currentBranch(root);
  const stateCommit = firstToken('Last commit');
  return {
    branch: gitBranch || (head ? 'HEAD' : '?'),
    dirty: out(['status', '--porcelain']).split('\n').filter(Boolean).length,
    lastCommit: last || '?',
    feature: feature && feature !== 'none' ? feature : null,
    phase: line('Phase') || 'none',
    head,
    gitBranch,
    stateBranch: firstToken('Branch'),
    stateCommit,
    behind: head && stateCommit ? distance(git, stateCommit) : null,
  };
}

/**
 * The drift rule of ADR-0023: `Branch:` differs from the checked-out branch (not on a detached
 * HEAD), or `Last commit:` does not resolve, is not an ancestor of HEAD, or is more than MAX_BEHIND
 * first-parent commits behind it. A missing label is a finding of the shape check
 * (doc-shapes.mjs), not a drift.
 * @param {ReturnType<typeof projectNow>} now from projectNow()
 * @returns {{kind: 'branch'|'unknown'|'diverged'|'behind', state: string, git?: string,
 *   count?: number}[]} one entry per finding, branch first; empty when STATE matches git or
 *   there is no HEAD to compare with
 */
export function stateDrift(now) {
  const drift = [];
  if (!now?.head) return drift;
  if (now.gitBranch && now.stateBranch && now.stateBranch !== now.gitBranch)
    drift.push({ kind: 'branch', state: now.stateBranch, git: now.gitBranch });
  if (now.behind === 'unknown' || now.behind === 'diverged')
    drift.push({ kind: now.behind, state: now.stateCommit });
  else if (typeof now.behind === 'number' && now.behind > MAX_BEHIND)
    drift.push({ kind: 'behind', state: now.stateCommit, count: now.behind });
  return drift;
}

/**
 * The identity of one drift: checked-out branch, HEAD and the two STATE values.
 * @param {ReturnType<typeof projectNow>} now from projectNow()
 * @returns {string|null} the key, or null when stateDrift() finds nothing
 */
export function driftKey(now) {
  if (!stateDrift(now).length) return null;
  return [now.gitBranch || 'HEAD', now.head, now.stateBranch, now.stateCommit].join(' ');
}

/**
 * The drift key reported last.
 * @param {string} root repo root
 * @returns {string|null} the key from .pipeline/state-drift.json, null when there is none
 */
export function readDriftKey(root = repoRoot()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, DRIFT_FILE), 'utf8')).key ?? null;
  } catch {
    return null;
  }
}

/**
 * Records a drift key as reported, replacing the previous one. Best effort, never throws.
 * @param {string} root repo root
 * @param {string} key from driftKey()
 */
export function writeDriftKey(root, key) {
  try {
    const file = path.join(root, DRIFT_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key, at: new Date().toISOString() }, null, 2) + '\n');
  } catch {
    // the drift is then reported once more, never lost
  }
}
