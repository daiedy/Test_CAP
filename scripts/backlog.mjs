#!/usr/bin/env node
/**
 * Backlog CLI over GitHub Issues (ADR-0019), used by the /backlog, /spec and /feature skills.
 *   list                                   queue by priority with blockers, in PIPELINE_LANG
 *   briefing                               the SessionStart briefing block
 *   create --title T --body-file F [--prio P2]   new feature issue with the labels
 *   prio <N> <P1|P2|P3>                    change the priority label
 *   blocked-by <N> [#M ...]                rewrite the "Blocked by" section of the body
 *   status <N> <spec-ready|in-progress|none>     set the status label
 *   close <N> --summary F                  comment with the file, drop in-progress, close
 *   setup-labels                           create or update the labels (idempotent)
 */
import fs from 'node:fs';
import path from 'node:path';
import { run, repoRoot } from './lib/hook-utils.mjs';
import {
  LABELS,
  PRIOS,
  DEFAULT_PRIO,
  STATUS_LABELS,
  FEATURE_LABEL,
  collectBriefing,
  renderBriefing,
  renderQueueList,
} from './lib/backlog.mjs';

const root = repoRoot();
const [cmd, ...rest] = process.argv.slice(2);

function opt(name, fallback) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
}
function gh(args) {
  const r = run('gh', args, { cwd: root, timeoutMs: 30_000 });
  if (r.code !== 0) {
    process.stderr.write(`gh ${args.slice(0, 3).join(' ')} failed: ${r.stderr || r.stdout}\n`);
    process.exit(1);
  }
  return r.stdout.trim();
}
function issueNumber(s) {
  const n = Number(String(s || '').replace('#', ''));
  if (!n) {
    process.stderr.write('issue number expected\n');
    process.exit(2);
  }
  return n;
}

switch (cmd) {
  case 'list': {
    const b = collectBriefing(root);
    if (b.source !== 'live')
      process.stdout.write(renderBriefing(b).split('\n').slice(3, 4).join('') + '\n');
    process.stdout.write(renderQueueList(b.bundle, b.queue) + '\n');
    break;
  }
  case 'briefing': {
    process.stdout.write(renderBriefing(collectBriefing(root)) + '\n');
    break;
  }
  case 'create': {
    const title = opt('title');
    const bodyFile = opt('body-file');
    const prio = opt('prio', DEFAULT_PRIO).toUpperCase();
    if (!title || !bodyFile || !PRIOS.includes(prio)) {
      process.stderr.write('usage: create --title T --body-file F [--prio P1|P2|P3]\n');
      process.exit(2);
    }
    process.stdout.write(
      gh([
        'issue',
        'create',
        '--title',
        title,
        '--body-file',
        bodyFile,
        '--label',
        FEATURE_LABEL,
        '--label',
        `prio:${prio}`,
      ]) + '\n'
    );
    break;
  }
  case 'prio': {
    const n = issueNumber(rest[0]);
    const prio = String(rest[1] || '').toUpperCase();
    if (!PRIOS.includes(prio)) {
      process.stderr.write('usage: prio <N> <P1|P2|P3>\n');
      process.exit(2);
    }
    const args = ['issue', 'edit', String(n), '--add-label', `prio:${prio}`];
    for (const p of PRIOS) if (p !== prio) args.push('--remove-label', `prio:${p}`);
    gh(args);
    process.stdout.write(`#${n}: prio:${prio}\n`);
    break;
  }
  case 'blocked-by': {
    const n = issueNumber(rest[0]);
    const blockers = rest.slice(1).map((s) => `#${issueNumber(s)}`);
    const body = gh(['issue', 'view', String(n), '--json', 'body', '-q', '.body']);
    const content = blockers.length ? blockers.join(', ') : 'none';
    const next = /^#{2,3}\s+Blocked by\s*$/m.test(body)
      ? body.replace(/(^#{2,3}\s+Blocked by\s*\n)([\s\S]*?)(?=^#{2,3}\s|\s*$)/m, `$1${content}\n\n`)
      : `${body.trimEnd()}\n\n## Blocked by\n${content}\n`;
    const tmp = path.join(root, '.pipeline', `issue-${n}-body.md`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, next);
    gh(['issue', 'edit', String(n), '--body-file', tmp]);
    process.stdout.write(`#${n}: blocked by ${content}\n`);
    break;
  }
  case 'status': {
    const n = issueNumber(rest[0]);
    const status = rest[1];
    if (![...STATUS_LABELS, 'none'].includes(status)) {
      process.stderr.write(`usage: status <N> <${STATUS_LABELS.join('|')}|none>\n`);
      process.exit(2);
    }
    const args = ['issue', 'edit', String(n)];
    for (const l of STATUS_LABELS) args.push(l === status ? '--add-label' : '--remove-label', l);
    gh(args);
    process.stdout.write(`#${n}: ${status}\n`);
    break;
  }
  case 'close': {
    const n = issueNumber(rest[0]);
    const summary = opt('summary');
    if (!summary || !fs.existsSync(summary)) {
      process.stderr.write('usage: close <N> --summary <SUMMARY.md>\n');
      process.exit(2);
    }
    gh(['issue', 'comment', String(n), '--body-file', summary]);
    gh([
      'issue',
      'edit',
      String(n),
      '--remove-label',
      'in-progress',
      '--remove-label',
      'spec-ready',
    ]);
    gh(['issue', 'close', String(n), '--reason', 'completed']);
    process.stdout.write(`#${n}: closed with ${summary}\n`);
    break;
  }
  case 'setup-labels': {
    for (const l of LABELS)
      gh([
        'label',
        'create',
        l.name,
        '--color',
        l.color,
        '--description',
        l.description,
        '--force',
      ]);
    process.stdout.write(`${LABELS.length} labels ensured\n`);
    break;
  }
  default:
    process.stderr.write(
      'usage: backlog.mjs <list|briefing|create|prio|blocked-by|status|close|setup-labels>\n'
    );
    process.exit(2);
}
