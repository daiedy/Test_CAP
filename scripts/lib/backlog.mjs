/**
 * Backlog in GitHub Issues (ADR-0019). Pure functions over `gh issue list` JSON plus the fetch
 * with a cache, used by scripts/backlog.mjs (CLI, the /backlog skill) and by the SessionStart hook
 * for the briefing. User-facing texts come from scripts/i18n/pipeline*.properties, selected by
 * PIPELINE_LANG (loaded by i18n.mjs, re-exported here for the existing importers); everything
 * stored (issue bodies, docs) stays English. The briefing also prints the last line of
 * docs/metrics/history.jsonl (ADR-0022), rendered by pipeline-metrics.mjs, which takes its texts
 * from i18n.mjs and does not import this module. ADR-0023: a feature folder holding a plan draft
 * marks its issue "plan drafted", and the STATE drift found by state-now.mjs (which owns
 * `projectNow()`, re-exported here) is the last line of the briefing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { run, repoRoot, readSection, readJsonl, exists } from './hook-utils.mjs';
import { HISTORY_FILE, renderBriefingLine } from './pipeline-metrics.mjs';
import { pickLang, readLocalSettings, loadBundle, t } from './i18n.mjs';
import { projectNow, stateDrift } from './state-now.mjs';

export { DEFAULT_LANG, pickLang, readLocalSettings, loadBundle, t } from './i18n.mjs';
export { projectNow } from './state-now.mjs';

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
export const FEATURES_DIR = 'docs/features';
/** A feature folder holding one of these has a drafted spec; `SUMMARY.md` alone is a finished one. */
export const DRAFT_FILES = ['PLAN.md', 'CONTEXT.md'];

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

/**
 * Open feature issues by priority then age, each with `blocked`: an open blocker exists, and
 * `specDraft`: its folder name is in `drafts` while neither status label is set (ADR-0023).
 * @param {object[]} issues from parseIssue()
 * @param {Set<string>} drafts folder names from specDrafts()
 */
export function buildQueue(issues, drafts = new Set()) {
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  return issues
    .filter((i) => i.state === 'OPEN' && i.labels.includes(FEATURE_LABEL))
    .map((i) => ({
      ...i,
      openBlockers: i.blockedBy.filter((n) => byNumber.get(n)?.state === 'OPEN'),
      specDraft: !i.specReady && !i.inProgress && drafts.has(i.name),
    }))
    .map((i) => ({ ...i, blocked: i.openBlockers.length > 0 }))
    .sort(
      (a, b) =>
        PRIOS.indexOf(a.prio) - PRIOS.indexOf(b.prio) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.number - b.number
    );
}

/**
 * What to do now: continue the item in work, else review the first drafted spec (a repeated
 * `/spec` would start over the drafts, ADR-0023), else the first unblocked item.
 */
export function recommend(queue) {
  const inWork = queue.find((i) => i.inProgress);
  if (inWork) return { kind: 'continue', issue: inWork };
  const draft = queue.find((i) => i.specDraft);
  if (draft) return { kind: 'review', issue: draft };
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
  return readIssuesCache(root);
}

/** The issues cache `.pipeline/issues.json` without a network call; never throws. */
export function readIssuesCache(root = repoRoot()) {
  try {
    const cached = JSON.parse(fs.readFileSync(path.join(root, CACHE_FILE), 'utf8'));
    return { issues: cached.issues || [], source: 'cache', fetchedAt: cached.fetchedAt };
  } catch {
    return { issues: [], source: 'none', fetchedAt: null };
  }
}

// ---------- project state ----------

/**
 * Names of the feature folders with a drafted spec: `docs/features/<name>/` holding PLAN.md or
 * CONTEXT.md (ADR-0023). The local folder is the evidence; no label, no STATE value.
 * @param {string} root repo root
 * @returns {Set<string>} folder names; empty when the directory is missing
 */
export function specDrafts(root = repoRoot()) {
  const dir = path.join(root, FEATURES_DIR);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return new Set();
  }
  return new Set(
    entries
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => DRAFT_FILES.some((f) => exists(path.join(dir, name, f))))
  );
}

/** Rows of the Open debt table in docs/STATE.md. */
export function debtCount(root = repoRoot()) {
  const section = readSection(path.join(root, 'docs', 'STATE.md'), '## Open debt');
  return section
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*Item\s*\|/.test(l) && !/^\|\s*-+/.test(l)).length;
}

/** The last line of docs/metrics/history.jsonl, or null when the file is missing or empty. */
export function lastHistoryLine(root = repoRoot()) {
  return readJsonl(path.join(root, HISTORY_FILE)).at(-1) ?? null;
}

// ---------- rendering ----------

/** Status and blocker tags of a queue item, shared by the briefing and `backlog.mjs list`. */
function statusTags(bundle, i) {
  const tags = [];
  if (i.inProgress) tags.push(t(bundle, 'briefing.inprogress'));
  else if (i.specReady) tags.push(t(bundle, 'briefing.specready'));
  else if (i.specDraft) tags.push(t(bundle, 'briefing.specdraft'));
  if (i.blocked) tags.push(t(bundle, 'briefing.blocked', i.openBlockers.join(', #')));
  return tags;
}

function queueEntry(bundle, i) {
  const tags = statusTags(bundle, i);
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
  if (rec.kind === 'review') return t(bundle, 'briefing.recommend.review', number, name, prio);
  return t(bundle, `briefing.recommend.${rec.kind}`, number, prio);
}

/**
 * One line naming every STATE drift finding; the briefing prints it in PIPELINE_LANG, the Stop
 * gate in English (ADR-0023).
 * @param {Record<string, string>} bundle from loadBundle()
 * @param {ReturnType<typeof stateDrift>} drift non-empty findings of stateDrift()
 * @returns {string} the line
 */
export function renderDriftLine(bundle, drift) {
  const parts = drift.map((d) =>
    t(bundle, `briefing.drift.${d.kind}`, d.state, d.kind === 'branch' ? d.git : d.count)
  );
  return t(bundle, 'briefing.drift', parts.join('; '));
}

/**
 * The briefing block printed by the SessionStart hook and by `backlog.mjs briefing`. The metrics
 * line goes after the GitHub status line: `backlog.mjs list` prints line index 3. The STATE drift
 * line, when there is one, is the last line.
 */
export function renderBriefing({
  lang,
  bundle,
  now,
  queue,
  rec,
  debt,
  source,
  fetchedAt,
  metrics,
  drift,
}) {
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
  if (metrics) lines.push(renderBriefingLine(metrics, bundle));
  lines.push(t(bundle, 'briefing.debt', debt));
  if (drift?.length) lines.push(renderDriftLine(bundle, drift));
  return lines.join('\n');
}

/** Multi-line queue for `backlog.mjs list`. */
export function renderQueueList(bundle, queue) {
  if (!queue.length) return t(bundle, 'queue.empty');
  const rows = queue.map((i) =>
    t(bundle, 'queue.row', i.number, i.name, i.prio, statusTags(bundle, i).join(', ')).trimEnd()
  );
  return [t(bundle, 'queue.title', queue.length), ...rows].join('\n');
}

/** Everything the briefing needs, in one call; never throws. */
export function collectBriefing(root = repoRoot(), env = process.env) {
  const lang = pickLang(env, readLocalSettings(root));
  const bundle = loadBundle(lang, root);
  const { issues, source, fetchedAt } = fetchIssues(root);
  const queue = buildQueue(issues, specDrafts(root));
  const now = projectNow(root);
  return {
    lang,
    bundle,
    now,
    queue,
    rec: recommend(queue),
    debt: debtCount(root),
    source,
    fetchedAt,
    metrics: lastHistoryLine(root),
    drift: stateDrift(now),
  };
}
