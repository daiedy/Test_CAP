/**
 * Backlog in GitHub Issues (ADR-0019). Pure functions over `gh issue list` JSON plus the fetch
 * with a cache, used by scripts/backlog.mjs (CLI, the /backlog skill) and by the SessionStart hook
 * for the briefing. User-facing texts come from scripts/i18n/pipeline*.properties, selected by
 * PIPELINE_LANG; everything stored (issue bodies, docs) stays English.
 */
import fs from 'node:fs';
import path from 'node:path';
import { run, repoRoot, readSection, exists } from './hook-utils.mjs';

export const FEATURE_LABEL = 'feature';
export const PRIOS = ['P1', 'P2', 'P3'];
export const DEFAULT_PRIO = 'P2';
export const STATUS_LABELS = ['spec-ready', 'in-progress'];
export const LABELS = [
  {
    name: 'feature',
    color: '0E8A16',
    description: 'Planned feature (backlog): /backlog or the issue form',
  },
  { name: 'prio:P1', color: 'B60205', description: 'Priority 1: next in line' },
  { name: 'prio:P2', color: 'FBCA04', description: 'Priority 2: normal' },
  { name: 'prio:P3', color: 'C5DEF5', description: 'Priority 3: later' },
  { name: 'spec-ready', color: '1D76DB', description: 'PLAN.md approved, ready for /feature' },
  { name: 'in-progress', color: '5319E7', description: 'Feature branch in work' },
];
export const CACHE_FILE = '.pipeline/issues.json';
export const DEFAULT_LANG = 'en';

// ---------- language and texts ----------

/** PIPELINE_LANG from the environment, else from .claude/settings.local.json `env`, else 'en'. */
export function pickLang(env = process.env, settings = null) {
  const fromEnv = (env.PIPELINE_LANG || '').trim().toLowerCase();
  if (fromEnv) return fromEnv;
  const fromSettings = (settings?.env?.PIPELINE_LANG || '').trim().toLowerCase();
  return fromSettings || DEFAULT_LANG;
}

export function readLocalSettings(root = repoRoot()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf8'));
  } catch {
    return null;
  }
}

function parseProperties(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Base bundle overlaid with pipeline_<lang>.properties when it exists. */
export function loadBundle(lang = DEFAULT_LANG, root = repoRoot()) {
  const dir = path.join(root, 'scripts', 'i18n');
  const base = parseProperties(fs.readFileSync(path.join(dir, 'pipeline.properties'), 'utf8'));
  const file = path.join(dir, `pipeline_${lang}.properties`);
  if (lang !== DEFAULT_LANG && exists(file))
    return { ...base, ...parseProperties(fs.readFileSync(file, 'utf8')) };
  return base;
}

export function t(bundle, key, ...args) {
  const text = bundle[key] ?? key;
  return text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}

// ---------- issues ----------

const BLOCKED_LINE = /^blocked by:?\s*(.*)$/im;

/** Issue numbers named in the "Blocked by" line or section of a body. */
export function parseBlockers(body = '') {
  let text = '';
  const section = body.match(/^#{2,3}\s+Blocked by\s*\n([\s\S]*?)(?=^#{2,3}\s|\s*$)/im);
  if (section) text += ' ' + section[1];
  const line = body.match(BLOCKED_LINE);
  if (line) text += ' ' + line[1];
  return [...new Set([...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])))];
}

/** Normalizes one `gh issue list --json` record. */
export function parseIssue(raw) {
  const labels = (raw.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  const prio = (labels.find((l) => /^prio:P[123]$/.test(l)) || `prio:${DEFAULT_PRIO}`).slice(5);
  const title = raw.title || '';
  const name = title.includes(':') ? title.split(':')[0].trim() : title.trim();
  return {
    number: raw.number,
    title,
    name,
    state: (raw.state || 'OPEN').toUpperCase(),
    labels,
    prio,
    specReady: labels.includes('spec-ready'),
    inProgress: labels.includes('in-progress'),
    blockedBy: parseBlockers(raw.body || ''),
    createdAt: raw.createdAt || '',
    url: raw.url || '',
  };
}

/** Open feature issues by priority then age, each with `blocked`: an open blocker exists. */
export function buildQueue(issues) {
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  return issues
    .filter((i) => i.state === 'OPEN' && i.labels.includes(FEATURE_LABEL))
    .map((i) => ({
      ...i,
      openBlockers: i.blockedBy.filter((n) => byNumber.get(n)?.state === 'OPEN'),
    }))
    .map((i) => ({ ...i, blocked: i.openBlockers.length > 0 }))
    .sort(
      (a, b) =>
        PRIOS.indexOf(a.prio) - PRIOS.indexOf(b.prio) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.number - b.number
    );
}

/** What to do now: continue the item in work, else the first unblocked item. */
export function recommend(queue) {
  const inWork = queue.find((i) => i.inProgress);
  if (inWork) return { kind: 'continue', issue: inWork };
  const next = queue.find((i) => !i.blocked);
  if (!next) return { kind: 'none', issue: null };
  return { kind: next.specReady ? 'feature' : 'spec', issue: next };
}

/** `gh issue list` with a cache in .pipeline/issues.json; never throws. */
export function fetchIssues(root = repoRoot(), { timeoutMs = 8_000 } = {}) {
  const cachePath = path.join(root, CACHE_FILE);
  const res = run(
    'gh',
    [
      'issue',
      'list',
      '--label',
      FEATURE_LABEL,
      '--state',
      'all',
      '--limit',
      '200',
      '--json',
      'number,title,state,labels,body,createdAt,url',
    ],
    { cwd: root, timeoutMs }
  );
  if (res.code === 0) {
    try {
      const issues = JSON.parse(res.stdout).map(parseIssue);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(
        cachePath,
        JSON.stringify({ fetchedAt: new Date().toISOString(), issues }, null, 2) + '\n'
      );
      return { issues, source: 'live', fetchedAt: null };
    } catch {
      /* fall through to the cache */
    }
  }
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return { issues: cached.issues || [], source: 'cache', fetchedAt: cached.fetchedAt };
  } catch {
    return { issues: [], source: 'none', fetchedAt: null };
  }
}

// ---------- project state ----------

/** Branch, dirty count, last commit and the Feature/Phase lines of docs/STATE.md. */
export function projectNow(root = repoRoot()) {
  const git = (args) => run('git', args, { cwd: root, timeoutMs: 5_000 }).stdout.trim();
  const now = readSection(path.join(root, 'docs', 'STATE.md'), '## Now');
  const line = (label) => (now.match(new RegExp(`^- ${label}:\\s*(.*)$`, 'm')) || [])[1]?.trim();
  const feature = line('Feature');
  return {
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']) || '?',
    dirty: git(['status', '--porcelain']).split('\n').filter(Boolean).length,
    lastCommit: git(['log', '-1', '--format=%h %s']) || '?',
    feature: feature && feature !== 'none' ? feature : null,
    phase: line('Phase') || 'none',
  };
}

/** Rows of the Open debt table in docs/STATE.md. */
export function debtCount(root = repoRoot()) {
  const section = readSection(path.join(root, 'docs', 'STATE.md'), '## Open debt');
  return section
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*Item\s*\|/.test(l) && !/^\|\s*-+/.test(l)).length;
}

// ---------- rendering ----------

function queueEntry(bundle, i) {
  const tags = [];
  if (i.inProgress) tags.push(t(bundle, 'briefing.inprogress'));
  else if (i.specReady) tags.push(t(bundle, 'briefing.specready'));
  if (i.blocked) tags.push(t(bundle, 'briefing.blocked', i.openBlockers.join(', #')));
  return `#${i.number} ${i.name}${tags.length ? ` (${tags.join(', ')})` : ''}`;
}

/** One-line queue grouped by priority: "P1 #3 a, #4 b (after #3); P2 #6 c". */
export function renderQueueLine(bundle, queue) {
  if (!queue.length) return t(bundle, 'briefing.queue.empty');
  const groups = PRIOS.map((p) => {
    const items = queue.filter((i) => i.prio === p);
    return items.length ? `${p} ${items.map((i) => queueEntry(bundle, i)).join(', ')}` : null;
  }).filter(Boolean);
  return t(bundle, 'briefing.queue', groups.join('; '));
}

export function renderRecommendation(bundle, rec) {
  if (rec.kind === 'none') return t(bundle, 'briefing.recommend.none');
  const { number, name, prio } = rec.issue;
  if (rec.kind === 'continue') return t(bundle, 'briefing.recommend.continue', number, name);
  return t(bundle, `briefing.recommend.${rec.kind}`, number, prio);
}

/** The briefing block printed by the SessionStart hook and by `backlog.mjs briefing`. */
export function renderBriefing({ lang, bundle, now, queue, rec, debt, source, fetchedAt }) {
  const tree = now.dirty
    ? t(bundle, 'briefing.tree.dirty', now.dirty)
    : t(bundle, 'briefing.tree.clean');
  const lines = [`## ${t(bundle, 'briefing.title')}`, t(bundle, 'briefing.language', lang)];
  lines.push(
    now.feature
      ? t(bundle, 'briefing.now.feature', now.feature, now.phase, now.branch, tree, now.lastCommit)
      : t(bundle, 'briefing.now.idle', now.branch, tree, now.lastCommit)
  );
  if (source === 'cache')
    lines.push(t(bundle, 'briefing.github.cached', (fetchedAt || '').slice(0, 10)));
  if (source === 'none') lines.push(t(bundle, 'briefing.github.down'));
  else lines.push(renderQueueLine(bundle, queue), renderRecommendation(bundle, rec));
  lines.push(t(bundle, 'briefing.debt', debt));
  return lines.join('\n');
}

/** Multi-line queue for `backlog.mjs list`. */
export function renderQueueList(bundle, queue) {
  if (!queue.length) return t(bundle, 'queue.empty');
  const rows = queue.map((i) => {
    const tags = [];
    if (i.inProgress) tags.push(t(bundle, 'briefing.inprogress'));
    else if (i.specReady) tags.push(t(bundle, 'briefing.specready'));
    if (i.blocked) tags.push(t(bundle, 'briefing.blocked', i.openBlockers.join(', #')));
    return t(bundle, 'queue.row', i.number, i.name, i.prio, tags.join(', ')).trimEnd();
  });
  return [t(bundle, 'queue.title', queue.length), ...rows].join('\n');
}

/** Everything the briefing needs, in one call; never throws. */
export function collectBriefing(root = repoRoot(), env = process.env) {
  const lang = pickLang(env, readLocalSettings(root));
  const bundle = loadBundle(lang, root);
  const { issues, source, fetchedAt } = fetchIssues(root);
  const queue = buildQueue(issues);
  return {
    lang,
    bundle,
    now: projectNow(root),
    queue,
    rec: recommend(queue),
    debt: debtCount(root),
    source,
    fetchedAt,
  };
}
