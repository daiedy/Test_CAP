/**
 * Shared helpers for Claude Code hook scripts (scripts/hooks/*.mjs).
 * Node built-ins only. Hook input arrives as JSON on stdin, see
 * https://code.claude.com/docs/en/hooks.md
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const NODE_BIN_DIRS = ['/opt/homebrew/opt/node@22/bin', '/opt/homebrew/bin'];

/** Repo root: scripts/lib is two levels below the root. */
export function repoRoot() {
  return path.resolve(import.meta.dirname, '..', '..');
}

/** Read the whole stdin and parse it as JSON; returns {} on any failure. */
export function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Environment with the Node binary directories prepended to PATH. */
export function envWithNode(extra = {}) {
  const current = process.env.PATH || '';
  const parts = [...NODE_BIN_DIRS, ...current.split(':')].filter(Boolean);
  return { ...process.env, PATH: [...new Set(parts)].join(':'), ...extra };
}

/**
 * Run a command synchronously.
 * @returns {{code:number|null, stdout:string, stderr:string, timedOut:boolean}}
 */
export function run(cmd, args = [], { cwd = repoRoot(), timeoutMs = 60_000, env } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: envWithNode(env),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const timedOut = res.error?.code === 'ETIMEDOUT';
  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || (res.error ? String(res.error.message) : ''),
    timedOut,
  };
}

/** Convert an absolute or relative path to a posix path relative to the repo root. */
export function rel(p, root = repoRoot()) {
  if (!p) return '';
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  return path.relative(root, abs).split(path.sep).join('/');
}

/** True when the relative path lies inside the repository. */
export function insideRepo(relPath) {
  return relPath !== '' && !relPath.startsWith('..') && !path.isAbsolute(relPath);
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        re += '\\{';
      } else {
        const alts = glob
          .slice(i + 1, end)
          .split(',')
          .map((s) => s.replace(/[.+^${}()|[\]\\*?]/g, '\\$&'));
        re += '(?:' + alts.join('|') + ')';
        i = end;
      }
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

/**
 * Glob-like matcher: `**` any depth, `*` within a segment, `{a,b}` alternatives.
 * Patterns are matched against a posix path relative to the repo root.
 */
export function isUnder(relPath, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return list.some((g) => globToRegExp(g).test(relPath));
}

/**
 * Changed files from `git status --porcelain -uall`, including untracked.
 * @returns {{status:string, path:string}[]}
 */
export function changedFiles(root = repoRoot(), pathspecs = []) {
  const res = run('git', ['status', '--porcelain', '-uall', '--', ...pathspecs], {
    cwd: root,
    timeoutMs: 20_000,
  });
  if (res.code !== 0) return [];
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      let p = line.slice(3);
      if (p.includes(' -> ')) p = p.split(' -> ').pop();
      return { status: status.trim(), path: p.replace(/^"|"$/g, '') };
    });
}

export function currentBranch(root = repoRoot()) {
  const res = run('git', ['branch', '--show-current'], { cwd: root, timeoutMs: 10_000 });
  return res.code === 0 ? res.stdout.trim() : '';
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function truncate(text, max = 1500) {
  if (!text) return '';
  return text.length > max
    ? text.slice(0, max) + `\n... (truncated, ${text.length} characters total)`
    : text;
}

export function lastLines(text, n) {
  const lines = (text || '').trimEnd().split('\n');
  return lines.slice(-n).join('\n');
}

/** Print JSON to stdout for Claude Code to parse. */
export function emitJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

/** Find the nearest ancestor directory (inclusive) that contains `marker`. */
export function findUp(startDir, marker, stopAt = repoRoot()) {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    if (dir === stopAt || dir === path.dirname(dir)) return null;
    dir = path.dirname(dir);
  }
}

export function readLines(file, count) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(0, count).join('\n');
  } catch {
    return '';
  }
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}
