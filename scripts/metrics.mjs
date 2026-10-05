#!/usr/bin/env node
/**
 * Pipeline metrics CLI (ADR-0022; docs/metrics/data-flow.md section 4 of pipeline-metrics). Prints
 * aggregates only, never prompt text, thinking or tool output.
 *   session [id]              card of one session (default: .pipeline/current-session, else the
 *                             newest transcript of this project)
 *   feature <name|#N>         card over every session that carries the feature (D10)
 *   record <name> [--force]   append the feature's history line to docs/metrics/history.jsonl
 *                             (refuses a duplicate line or an unknown-model warning without --force)
 *   compare [name...]         history lines with deltas against the previous line
 *   reconcile <id>            transcript against cost-state per model and token kind
 * Options: --json (the report object), --idle <min>, --tool <min> (D6 caps), --history <file>.
 * Texts in PIPELINE_LANG from scripts/i18n/pipeline*.properties (metrics.*).
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, run, readJsonl } from './lib/hook-utils.mjs';
import { readAudit } from './lib/mcp-audit.mjs';
import { readMetrics, currentSession } from './lib/metrics-log.mjs';
import {
  projectDir,
  listSessions,
  loadSession,
  sessionFiles,
  readTranscript,
  costState,
} from './lib/transcript-usage.mjs';
import {
  IDLE_MS,
  TOOL_MS,
  sessionReport,
  featureReport,
  historyLine,
  compareLines,
  reconcileSession,
  reviewCounts,
  criteriaCounts,
  renderCard,
  renderCompare,
  renderReconcile,
  loadPricing,
  planAssignments,
  planApproved,
  permalinkCommit,
  featureNameOf,
  HISTORY_FILE,
} from './lib/pipeline-metrics.mjs';
import { pickLang, readLocalSettings, loadBundle, t } from './lib/i18n.mjs';
import { fetchIssues, readIssuesCache } from './lib/backlog.mjs';

const root = repoRoot();
const pricing = loadPricing(root);
const bundle = loadBundle(pickLang(process.env, readLocalSettings(root)), root);

function parseArgs(argv) {
  const flags = { json: false, force: false };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '--force') flags[a.slice(2)] = true;
    else if (['--idle', '--tool', '--history'].includes(a)) flags[a.slice(2)] = argv[++i];
    else pos.push(a);
  }
  return { cmd: pos[0], args: pos.slice(1), flags };
}

const { cmd, args, flags } = parseArgs(process.argv.slice(2));
const capMs = (value, fallback) => (Number(value) > 0 ? Number(value) * 60_000 : fallback);
const caps = { idleMs: capMs(flags.idle, IDLE_MS), toolMs: capMs(flags.tool, TOOL_MS) };
const historyFile = path.resolve(root, flags.history || HISTORY_FILE);
const historyShown = historyFile.startsWith(root + path.sep)
  ? path.relative(root, historyFile)
  : historyFile;

function fail(key, ...params) {
  process.stderr.write(t(bundle, key, ...params) + '\n');
  process.exit(key === 'metrics.usage' ? 2 : 1);
}

function print(obj, text) {
  process.stdout.write((flags.json ? JSON.stringify(obj, null, 2) : text) + '\n');
}

/** Transcript directory of a session: the `session` record's transcriptPath, else the slug rule. */
function dirOf(events) {
  const rec = events.find((e) => e.event === 'session' && e.transcriptPath);
  return rec ? path.dirname(rec.transcriptPath) : projectDir(root);
}

function load(sessionId, dir) {
  const events = readMetrics(root, sessionId);
  const session = loadSession(dir ?? dirOf(events), sessionId);
  return session && { ...session, events, audit: readAudit(root, sessionId) };
}

/** `maxTurns` of every agent definition, from its frontmatter. */
function maxTurns() {
  const dir = path.join(root, '.claude', 'agents');
  const out = {};
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!name.endsWith('.md')) continue;
    const head = fs.readFileSync(path.join(dir, name), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    const n = head?.[1].match(/^maxTurns:\s*(\d+)/m);
    if (n) out[name.slice(0, -3)] = Number(n[1]);
  }
  return out;
}

/**
 * A final feature document (`criteria`, `review`): the working tree while the folder holds it,
 * else its version at the commit of the SUMMARY.md permalink once the prune removed it
 * (`permalinkCommit`). With `reworkPlan` the only git reader of feature docs. Null when neither.
 */
function featureDoc(name, file) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return null;
  const rel = `docs/features/${name}/${file}`;
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
  const summary = path.join(root, 'docs', 'features', name, 'SUMMARY.md');
  const sha = fs.existsSync(summary) ? permalinkCommit(fs.readFileSync(summary, 'utf8')) : null;
  if (!sha) return null;
  const res = run('git', ['show', `${sha}:${rel}`], { cwd: root, timeoutMs: 20_000 });
  return res.code === 0 ? res.stdout : null;
}

/**
 * D12 plan source: the plan as approved at the plan gate, apart from `criteria` and `review` (the
 * final plan, `featureDoc`). The first commit of the path's full history whose text passes
 * `planApproved` (the deletion commit holds no file and is skipped; `--full-history` keeps a path
 * created and deleted on a merged branch); before the approval is committed, the working tree when
 * its own status passes. No approved version: no plan, the home-phase fallback.
 * @returns {{plan: Map<string, Set<string>>|null, commit: string|null}}
 */
function reworkPlan(name) {
  const none = { plan: null, commit: null };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return none;
  const rel = `docs/features/${name}/PLAN.md`;
  const git = (args) => run('git', args, { cwd: root, timeoutMs: 20_000 });
  const log = git(['log', '--full-history', '--reverse', '--format=%H', '--', rel]);
  for (const commit of log.code === 0 ? log.stdout.split('\n').filter(Boolean) : []) {
    const res = git(['show', `${commit}:${rel}`]);
    if (res.code === 0 && planApproved(res.stdout))
      return { plan: planAssignments(res.stdout), commit };
  }
  const abs = path.join(root, rel);
  const text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  return planApproved(text) ? { plan: planAssignments(text), commit: null } : none;
}

/** D12 for a session: the plan of the feature named by its latest `phase` marker, else none. */
function sessionPlan(events) {
  const marker = events
    .filter((e) => e.event === 'phase' && e.ts)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .at(-1);
  const name = marker ? featureNameOf(marker.feature) : 'none';
  return name === 'none' ? { plan: null, commit: null } : reworkPlan(name);
}

/** Lines added and removed by the commits whose subject names the feature. */
function gitLines(name) {
  const res = run('git', ['log', '--all', '--no-merges', '--shortstat', '--format=%x01%s'], {
    cwd: root,
    timeoutMs: 30_000,
  });
  if (res.code !== 0) return null;
  const named = new RegExp(
    `(^|[^a-z0-9-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9-]|$)`
  );
  const lines = { added: 0, removed: 0 };
  for (const chunk of res.stdout.split('\x01').slice(1)) {
    const [subject, ...rest] = chunk.split('\n');
    if (!named.test(subject)) continue;
    const stat = rest.join(' ');
    lines.added += Number(stat.match(/(\d+) insertions?\(\+\)/)?.[1] || 0);
    lines.removed += Number(stat.match(/(\d+) deletions?\(-\)/)?.[1] || 0);
  }
  return lines;
}

/**
 * `name` or `#N` to `{ name, issue }` (ADR-0019): `#N` asks `gh` (falling back to the cache), a
 * plain name reads only the issues cache `.pipeline/issues.json`, no network.
 */
function resolveFeature(arg) {
  if (!arg) fail('metrics.usage');
  const number = /^#?\d+$/.test(arg) ? Number(arg.replace('#', '')) : null;
  const { issues } = number ? fetchIssues(root) : readIssuesCache(root);
  if (number) {
    const found = issues.find((i) => i.number === number);
    if (!found) fail('metrics.error.unknownIssue', number);
    return { name: found.name, issue: number };
  }
  return { name: arg, issue: issues.find((i) => i.name === arg)?.number ?? null };
}

function featureOf(arg) {
  const { name, issue } = resolveFeature(arg);
  const dir = projectDir(root);
  const sessions = listSessions(dir)
    .map((id) => load(id, dir))
    .filter(Boolean);
  const approved = reworkPlan(name);
  const report = featureReport(sessions, name, {
    issue,
    pricing,
    plan: approved.plan,
    ...caps,
    extras: {
      review: reviewCounts(featureDoc(name, 'REVIEW.md')),
      criteria: criteriaCounts(featureDoc(name, 'PLAN.md')),
      lines: gitLines(name),
      maxTurns: maxTurns(),
      planCommit: approved.commit,
    },
  });
  if (!report.sessions) fail('metrics.error.noFeature', name, dir);
  return report;
}

/** Compactions of a session: `compact` records, else the lines of .pipeline/sessions.log naming it. */
function compactionsOf(session) {
  if (session.events.length) return session.events.filter((e) => e.event === 'compact').length;
  try {
    const log = fs.readFileSync(path.join(root, '.pipeline', 'sessions.log'), 'utf8');
    return log.split('\n').filter((l) => l.includes(`session ${session.sessionId}:`)).length;
  } catch {
    return 0;
  }
}

/** Full sessions that share a Claude Code process (a cost-state `startTime`) with `session`. */
function relatedSessions(session) {
  const dir = dirOf(session.events);
  const mine = new Set(costState(session.main).map((c) => String(c.startTime)));
  if (!mine.size) return [];
  return listSessions(dir)
    .filter((id) => id !== session.sessionId)
    .filter((id) =>
      costState(readTranscript(sessionFiles(dir, id).main)).some((c) =>
        mine.has(String(c.startTime))
      )
    )
    .map((id) => load(id, dir))
    .filter(Boolean);
}

function sessionOf(id) {
  const sessionId = id || currentSession(root) || listSessions(projectDir(root))[0];
  const session = sessionId && load(sessionId);
  if (!session) fail('metrics.error.noSession', sessionId || '-', projectDir(root));
  return session;
}

switch (cmd) {
  case 'session': {
    const session = sessionOf(args[0]);
    const approved = sessionPlan(session.events);
    const report = sessionReport(session, {
      pricing,
      plan: approved.plan,
      related: relatedSessions(session),
      ...caps,
      extras: {
        maxTurns: maxTurns(),
        compactions: compactionsOf(session),
        planCommit: approved.commit,
      },
    });
    print(report, renderCard(report, bundle));
    break;
  }
  case 'feature': {
    const report = featureOf(args[0]);
    print(report, renderCard(report, bundle));
    break;
  }
  case 'record': {
    const report = featureOf(args[0]);
    // D4: a partial cost would compare as a real drop; complete the price table or --force.
    const unpriced = report.warnings.filter((w) => w.startsWith('unknown-model:'));
    if (unpriced.length && !flags.force)
      fail(
        'metrics.record.unknownModel',
        report.feature,
        unpriced.map((w) => w.slice('unknown-model:'.length)).join(', ')
      );
    const line = historyLine(report, new Date().toISOString().slice(0, 10));
    const lines = readJsonl(historyFile);
    const at = lines.findIndex((l) => l.feature === line.feature);
    if (at >= 0 && !flags.force) fail('metrics.record.duplicate', line.feature, historyShown);
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    if (at >= 0) {
      lines[at] = line;
      fs.writeFileSync(historyFile, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    } else {
      fs.appendFileSync(historyFile, JSON.stringify(line) + '\n');
    }
    print(line, t(bundle, 'metrics.record.done', line.feature, historyShown));
    break;
  }
  case 'compare': {
    const lines = readJsonl(historyFile);
    if (!lines.length) {
      print([], t(bundle, 'metrics.compare.empty', historyShown));
      break;
    }
    const rows = compareLines(lines).filter((r) => !args.length || args.includes(r.feature));
    print(rows, renderCompare(rows, bundle));
    break;
  }
  case 'reconcile': {
    const session = sessionOf(args[0]);
    const rec = reconcileSession(session, pricing, relatedSessions(session));
    print(rec, renderReconcile(rec, bundle));
    break;
  }
  default:
    fail('metrics.usage');
}
