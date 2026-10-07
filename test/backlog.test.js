// ADR-0019: the backlog lives in GitHub Issues; the queue, the recommendation and the localized
// briefing are pure functions over `gh issue list` JSON, pinned here without network access.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseIssue,
  parseBlockers,
  buildQueue,
  recommend,
  renderBriefing,
  renderQueueList,
  pickLang,
  loadBundle,
  lastHistoryLine,
  t,
  specDrafts,
  renderRecommendation,
  renderDriftLine,
  projectNow,
} from '../scripts/lib/backlog.mjs';
import { HISTORY_FILE } from '../scripts/lib/pipeline-metrics.mjs';
import { stateDrift, driftKey, MAX_BEHIND } from '../scripts/lib/state-now.mjs';
import { createSandbox, stateDoc, SANDBOX_BRANCH } from './fixtures/hook-sandbox.mjs';

const root = path.resolve(import.meta.dirname, '..');

const raw = (n, title, extra = {}) => ({
  number: n,
  title,
  state: 'OPEN',
  labels: [{ name: 'feature' }],
  body: '',
  createdAt: `2026-09-25T10:0${n}:00Z`,
  ...extra,
});

describe('issue parsing', () => {
  it('reads name, priority, status and blockers from a record', () => {
    const i = parseIssue(
      raw(4, 'products-rating-filter: RangeSlider filter', {
        labels: [{ name: 'feature' }, { name: 'prio:P1' }, { name: 'spec-ready' }],
        body: '## Request\nx\n\n## Blocked by\n#3, #9\n\n## Questions\n- y',
      })
    );
    expect(i.name).toBe('products-rating-filter');
    expect(i.prio).toBe('P1');
    expect(i.specReady).toBe(true);
    expect(i.blockedBy).toEqual([3, 9]);
  });

  it('defaults to P2 and accepts the one-line "Blocked by:" form', () => {
    expect(parseIssue(raw(1, 'a: b')).prio).toBe('P2');
    expect(parseBlockers('Blocked by: #2 and #5\n')).toEqual([2, 5]);
    expect(parseBlockers('## Blocked by\nnone\n')).toEqual([]);
  });
});

describe('queue and recommendation', () => {
  const issues = [
    parseIssue(raw(3, 'rating-column: c')),
    parseIssue(raw(4, 'rating-filter: f', { body: '## Blocked by\n#3' })),
    parseIssue(raw(5, 'excel-upload: u', { labels: [{ name: 'feature' }, { name: 'prio:P3' }] })),
    parseIssue(raw(6, 'subcategories: s', { labels: [{ name: 'feature' }, { name: 'prio:P1' }] })),
    parseIssue(raw(7, 'details: d', { body: 'Blocked by: #6' })),
    parseIssue(raw(8, 'old: o', { state: 'CLOSED' })),
    parseIssue(raw(9, 'not a feature', { labels: [] })),
  ];

  it('orders by priority then age and marks open blockers only', () => {
    const q = buildQueue(issues);
    expect(q.map((i) => i.number)).toEqual([6, 3, 4, 7, 5]);
    expect(q.find((i) => i.number === 4).blocked).toBe(true);
    expect(q.find((i) => i.number === 4).openBlockers).toEqual([3]);
    const closedBlocker = buildQueue([
      parseIssue(raw(2, 'x: y', { body: 'Blocked by: #8' })),
      issues[5],
    ]);
    expect(closedBlocker[0].blocked).toBe(false);
  });

  it('recommends the item in work, else the first unblocked one, spec before feature', () => {
    const q = buildQueue(issues);
    expect(recommend(q)).toMatchObject({ kind: 'spec', issue: { number: 6 } });
    const ready = buildQueue([
      parseIssue(
        raw(6, 'subcategories: s', { labels: [{ name: 'feature' }, { name: 'spec-ready' }] })
      ),
    ]);
    expect(recommend(ready).kind).toBe('feature');
    const working = buildQueue([
      ...issues,
      parseIssue(raw(1, 'w: w', { labels: [{ name: 'feature' }, { name: 'in-progress' }] })),
    ]);
    expect(recommend(working)).toMatchObject({ kind: 'continue', issue: { number: 1 } });
    const openBlocker = parseIssue(raw(3, 'rating-column: c', { labels: [] }));
    expect(recommend(buildQueue([issues[1], openBlocker])).kind).toBe('none');
  });

  it('marks a drafted spec and recommends its review', () => {
    // ADR-0023: the local folder is the evidence. PLAN.md or CONTEXT.md make a draft; SUMMARY.md
    // alone is a finished feature; an empty folder or a plain file is nothing.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-drafts-'));
    try {
      expect(specDrafts(tmp)).toEqual(new Set());
      const put = (rel) => {
        fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
        fs.writeFileSync(path.join(tmp, rel), '# x\n');
      };
      put('docs/features/rating-column/PLAN.md');
      put('docs/features/subcategories/CONTEXT.md');
      put('docs/features/details/PLAN.md');
      put('docs/features/excel-upload/SUMMARY.md');
      put('docs/features/README.md');
      fs.mkdirSync(path.join(tmp, 'docs/features/empty'));
      const drafts = specDrafts(tmp);
      expect([...drafts].sort()).toEqual(['details', 'rating-column', 'subcategories']);

      const p1 = { labels: [{ name: 'feature' }, { name: 'prio:P1' }] };
      const issues = [
        parseIssue(raw(6, 'colors: c', p1)),
        parseIssue(raw(3, 'rating-column: r')),
        parseIssue(raw(5, 'excel-upload: u')),
      ];
      // Without the folders the first unblocked item gets /spec, as before.
      expect(recommend(buildQueue(issues))).toMatchObject({ kind: 'spec', issue: { number: 6 } });
      const q = buildQueue(issues, drafts);
      expect(q.map((i) => [i.number, i.specDraft])).toEqual([
        [6, false],
        [3, true],
        [5, false],
      ]);
      // The draft ranks before the first unblocked item and is never recommended as /spec #3.
      const rec = recommend(q);
      expect(rec).toMatchObject({ kind: 'review', issue: { number: 3 } });
      // Blocked or not (PATTERNS "Advisory from a Stop hook"): an open blocker keeps the draft
      // blocked, and its review is still recommended.
      const blockedDraft = buildQueue(
        [issues[0], parseIssue(raw(3, 'rating-column: r', { body: '## Blocked by\n#6' }))],
        drafts
      );
      expect(blockedDraft.find((i) => i.number === 3).blocked).toBe(true);
      expect(recommend(blockedDraft)).toMatchObject({ kind: 'review', issue: { number: 3 } });
      const en = loadBundle('en', root);
      expect(renderRecommendation(en, rec)).toBe(
        'Recommended now: review the drafted plan of #3 in docs/features/rating-column/ (P2): ' +
          'approve it or resume its /spec session; a new /spec #3 would start over the drafts.'
      );
      const briefing = renderBriefing({
        lang: 'en',
        bundle: en,
        now: { branch: 'main', dirty: 0, lastCommit: 'abc1234 x', feature: null, phase: 'none' },
        queue: q,
        rec,
        debt: 0,
        source: 'live',
        fetchedAt: null,
      });
      expect(briefing).toContain(
        'Queue: P1 #6 colors; P2 #3 rating-column (plan drafted), #5 excel'
      );
      expect(briefing).not.toContain('Recommended now: /spec');
      expect(renderQueueList(en, q)).toContain('#3 rating-column [P2] plan drafted');
      const ru = loadBundle('ru', root);
      expect(renderQueueList(ru, q)).toContain('#3 rating-column [P2] черновик плана');
      expect(renderRecommendation(ru, rec)).toMatch(
        /^Рекомендуется сейчас: проверить черновик плана #3 в docs\/features\/rating-column\//
      );

      // A status label wins over the folder: in-progress is continued, spec-ready goes to /feature.
      const working = buildQueue(
        [
          ...issues,
          parseIssue(
            raw(8, 'details: d', { labels: [{ name: 'feature' }, { name: 'in-progress' }] })
          ),
        ],
        drafts
      );
      expect(working.find((i) => i.number === 8).specDraft).toBe(false);
      expect(recommend(working)).toMatchObject({ kind: 'continue', issue: { number: 8 } });
      const ready = buildQueue(
        [
          parseIssue(
            raw(3, 'rating-column: r', { labels: [{ name: 'feature' }, { name: 'spec-ready' }] })
          ),
        ],
        drafts
      );
      expect(ready[0].specDraft).toBe(false);
      expect(recommend(ready)).toMatchObject({ kind: 'feature', issue: { number: 3 } });
      expect(renderQueueList(en, ready)).toContain('#3 rating-column [P2] plan ready');
      // SUMMARY.md alone: the issue is recommended for /spec, not for review.
      const finished = buildQueue([parseIssue(raw(5, 'excel-upload: u'))], drafts);
      expect(recommend(finished)).toMatchObject({ kind: 'spec', issue: { number: 5 } });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('language and briefing', () => {
  it('picks the language from the environment, then settings.local.json, then en', () => {
    expect(pickLang({ PIPELINE_LANG: 'ru' }, { env: { PIPELINE_LANG: 'de' } })).toBe('ru');
    expect(pickLang({}, { env: { PIPELINE_LANG: 'ru' } })).toBe('ru');
    expect(pickLang({}, null)).toBe('en');
  });

  it('keeps the ru bundle complete against the base bundle', () => {
    const en = loadBundle('en', root);
    const ru = loadBundle('ru', root);
    expect(Object.keys(en).filter((k) => !(k in ru))).toEqual([]);
    expect(Object.keys(en).filter((k) => ru[k] === en[k])).toEqual(['queue.row']);
    expect(t(en, 'briefing.debt', 3)).toBe('Open debt: 3 item(s), docs/STATE.md.');
  });

  it('renders the briefing in both languages with the queue and the recommendation', () => {
    const queue = buildQueue([
      parseIssue(raw(3, 'rating-column: c')),
      parseIssue(raw(4, 'rating-filter: f', { body: '## Blocked by\n#3' })),
    ]);
    const base = {
      now: { branch: 'main', dirty: 0, lastCommit: 'abc1234 x', feature: null, phase: 'none' },
      queue,
      rec: recommend(queue),
      debt: 10,
      source: 'live',
      fetchedAt: null,
    };
    const en = renderBriefing({ ...base, lang: 'en', bundle: loadBundle('en', root) });
    expect(en).toContain('## Briefing');
    expect(en).toContain('Queue: P2 #3 rating-column, #4 rating-filter (after #3)');
    expect(en).toContain('Recommended now: /spec #3 (P2, unblocked, no plan yet).');
    expect(en).toContain('Open debt: 10 item(s)');
    const ru = renderBriefing({ ...base, lang: 'ru', bundle: loadBundle('ru', root) });
    expect(ru).toContain('## Брифинг');
    expect(ru).toContain('Рекомендуется сейчас: /spec #3');
    const cached = renderBriefing({
      ...base,
      lang: 'en',
      bundle: loadBundle('en', root),
      source: 'cache',
      fetchedAt: '2026-09-24T10:00:00Z',
      now: { ...base.now, feature: 'x (#3)', phase: '2', dirty: 2 },
    });
    expect(cached).toContain('queue from the cache of 2026-09-24');
    expect(cached).toContain('Now: feature x (#3), phase 2, branch main, 2 uncommitted file(s)');
    expect(renderQueueList(loadBundle('en', root), queue)).toContain(
      '#4 rating-filter [P2] after #3'
    );
  });

  it('briefing prints the last metrics line', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-metrics-'));
    try {
      expect(lastHistoryLine(tmp)).toBeNull();
      const file = path.join(tmp, HISTORY_FILE);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '');
      expect(lastHistoryLine(tmp)).toBeNull();
      const line = (feature, issue, costUSD, activeMin, reworkShare) =>
        JSON.stringify({ feature, issue, costUSD, activeMin, reworkShare });
      fs.writeFileSync(
        file,
        `${line('products-rating-column', 5, 13.9325, 70.6, 0.029)}\n${line('products-excel-upload', 7, 62.8812, 252.4, 0.117)}\n`
      );
      const metrics = lastHistoryLine(tmp);
      expect(metrics.feature).toBe('products-excel-upload');

      const queue = buildQueue([parseIssue(raw(3, 'rating-column: c'))]);
      const base = {
        now: { branch: 'main', dirty: 0, lastCommit: 'abc1234 x', feature: null, phase: 'none' },
        queue,
        rec: recommend(queue),
        debt: 10,
        source: 'cache',
        fetchedAt: '2026-09-24T10:00:00Z',
      };
      const en = renderBriefing({ ...base, lang: 'en', bundle: loadBundle('en', root), metrics });
      expect(en).toContain(
        'Last recorded feature: products-excel-upload (#7), cost $62.88, active 4h 12m, rework 12% of cost'
      );
      // `backlog.mjs list` prints line index 3: it stays the GitHub status line.
      expect(en.split('\n')[3]).toContain('queue from the cache of 2026-09-24');
      const ru = renderBriefing({ ...base, lang: 'ru', bundle: loadBundle('ru', root), metrics });
      expect(ru).toContain(
        'Последняя записанная фича: products-excel-upload (#7), стоимость $62.88, активно 4ч 12м, доработки 12% стоимости'
      );

      const none = renderBriefing({
        ...base,
        lang: 'en',
        bundle: loadBundle('en', root),
        metrics: lastHistoryLine(path.join(tmp, 'missing')),
      });
      expect(none).not.toContain('Last recorded feature');
      expect(none.split('\n')).toHaveLength(en.split('\n').length - 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('STATE drift (ADR-0023)', () => {
  it('reports STATE drift against git', () => {
    // The rule over the fields of projectNow(): a committed STATE names the parent of HEAD, so
    // MAX_BEHIND (1) first-parent commit is the normal state (research/state-drift.md section 1).
    expect(MAX_BEHIND).toBe(1);
    const now = {
      head: 'f'.repeat(40),
      gitBranch: 'feature/x',
      stateBranch: 'feature/x',
      stateCommit: 'abc1234',
      behind: 1,
    };
    expect(stateDrift(now)).toEqual([]);
    expect(stateDrift({ ...now, behind: 0 })).toEqual([]);
    expect(driftKey(now)).toBeNull();
    expect(stateDrift({ ...now, behind: 2 })).toEqual([
      { kind: 'behind', state: 'abc1234', count: 2 },
    ]);
    expect(stateDrift({ ...now, behind: 'unknown' })).toEqual([
      { kind: 'unknown', state: 'abc1234' },
    ]);
    expect(stateDrift({ ...now, behind: 'diverged' })).toEqual([
      { kind: 'diverged', state: 'abc1234' },
    ]);
    expect(stateDrift({ ...now, stateBranch: 'main' })).toEqual([
      { kind: 'branch', state: 'main', git: 'feature/x' },
    ]);
    // Both findings, the branch first.
    expect(stateDrift({ ...now, stateBranch: 'main', behind: 8 }).map((d) => d.kind)).toEqual([
      'branch',
      'behind',
    ]);
    // A detached HEAD has no branch to compare with; the commit rule still applies.
    expect(stateDrift({ ...now, gitBranch: '', stateBranch: 'main' })).toEqual([]);
    expect(stateDrift({ ...now, gitBranch: '', behind: 3 })).toEqual([
      { kind: 'behind', state: 'abc1234', count: 3 },
    ]);
    // No commit yet, or git failed otherwise: nothing to compare with.
    expect(stateDrift({ ...now, head: '', stateBranch: 'main', behind: 'unknown' })).toEqual([]);
    expect(stateDrift({ ...now, behind: null })).toEqual([]);
    // The key names one drift: it changes with HEAD and with the STATE values.
    const stale = { ...now, behind: 2 };
    expect(driftKey(stale)).toEqual(expect.any(String));
    expect(driftKey({ ...stale, head: 'e'.repeat(40) })).not.toBe(driftKey(stale));
    expect(driftKey({ ...stale, stateCommit: 'abc9999' })).not.toBe(driftKey(stale));

    // The same rule on a real history, read by projectNow() from the sandbox of the hook tests.
    const box = createSandbox({ prefix: 'state-drift', session: `test-drift-${process.pid}` });
    try {
      const init = box.rev();
      // A pipeline commit: its STATE names its parent, 1 behind.
      const s = box.commit({ 'docs/STATE.md': stateDoc({ lastCommit: `${init} init` }) }, 'state');
      let git = projectNow(box.root);
      expect(git).toMatchObject({
        branch: SANDBOX_BRANCH,
        gitBranch: SANDBOX_BRANCH,
        stateBranch: SANDBOX_BRANCH,
        stateCommit: init,
        behind: 1,
        head: box.git('rev-parse', 'HEAD').stdout.trim(),
      });
      expect(stateDrift(git)).toEqual([]);

      // A merge whose STATE names its first parent (fdd2a82 of section 1): 2 commits in all, 1 on
      // the first-parent line, so no drift.
      box.git('checkout', '-qb', 'side');
      box.commit({ 'docs/side.md': 'side\n' }, 'side');
      box.git('checkout', '-q', SANDBOX_BRANCH);
      box.git('merge', '-q', '--no-ff', '--no-commit', 'side');
      box.commit({ 'docs/STATE.md': stateDoc({ lastCommit: `${s} state` }) }, 'Merge side');
      expect(
        box.git('rev-list', '--parents', '-n', '1', 'HEAD').stdout.trim().split(' ')
      ).toHaveLength(3);
      expect(box.git('rev-list', '--count', `${s}..HEAD`).stdout.trim()).toBe('2');
      git = projectNow(box.root);
      expect(git.behind).toBe(1);
      expect(stateDrift(git)).toEqual([]);

      // One more commit without a STATE update: 2 first-parent commits behind, stale.
      box.commit({ 'docs/notes.md': 'notes\n' }, 'notes');
      expect(stateDrift(projectNow(box.root))).toEqual([{ kind: 'behind', state: s, count: 2 }]);

      // A hash that does not resolve, and a value that is no hash at all.
      box.put({ 'docs/STATE.md': stateDoc({ lastCommit: '0000000 init' }) });
      expect(stateDrift(projectNow(box.root))).toEqual([{ kind: 'unknown', state: '0000000' }]);
      box.put({ 'docs/STATE.md': stateDoc({ lastCommit: 'none' }) });
      expect(stateDrift(projectNow(box.root))).toEqual([{ kind: 'unknown', state: 'none' }]);

      // A commit of an abandoned branch is not an ancestor of HEAD.
      box.resetTree();
      box.git('checkout', '-qb', 'lost');
      const lost = box.commit({ 'docs/lost.md': 'lost\n' }, 'lost');
      box.git('checkout', '-q', SANDBOX_BRANCH);
      box.put({ 'docs/STATE.md': stateDoc({ lastCommit: `${lost} lost` }) });
      expect(stateDrift(projectNow(box.root))).toEqual([{ kind: 'diverged', state: lost }]);

      // STATE on another branch than git (the `!` merge of #7).
      const head = box.rev();
      box.put({ 'docs/STATE.md': stateDoc({ branch: 'main', lastCommit: `${head} notes` }) });
      git = projectNow(box.root);
      expect(git.behind).toBe(0);
      expect(stateDrift(git)).toEqual([{ kind: 'branch', state: 'main', git: SANDBOX_BRANCH }]);

      // A detached HEAD: no branch finding, no key.
      box.git('checkout', '-q', '--detach');
      git = projectNow(box.root);
      expect(git).toMatchObject({ branch: 'HEAD', gitBranch: '', stateBranch: 'main', behind: 0 });
      expect(stateDrift(git)).toEqual([]);
      expect(driftKey(git)).toBeNull();
    } finally {
      box.remove();
    }
  });

  it('renders the drift line last in both languages', () => {
    const queue = buildQueue([parseIssue(raw(3, 'rating-column: c'))]);
    const base = {
      now: { branch: 'main', dirty: 0, lastCommit: 'abc1234 x', feature: null, phase: 'none' },
      queue,
      rec: recommend(queue),
      debt: 10,
      source: 'cache',
      fetchedAt: '2026-10-05T10:00:00Z',
      metrics: {
        feature: 'products-excel-upload',
        issue: 7,
        costUSD: 62.88,
        activeMin: 252.4,
        reworkShare: 0.117,
      },
    };
    const drift = [
      { kind: 'branch', state: 'feature/x', git: 'main' },
      { kind: 'behind', state: 'abc1234', count: 8 },
    ];
    const en = loadBundle('en', root);
    const enLines = renderBriefing({ ...base, lang: 'en', bundle: en, drift }).split('\n');
    expect(enLines.at(-1)).toBe(
      'STATE drift: Branch feature/x, but git is on main; Last commit abc1234 is 8 first-parent ' +
        'commits behind HEAD. Update Branch, Last commit and Next in ## Now of docs/STATE.md.'
    );
    expect(enLines.at(-2)).toBe('Open debt: 10 item(s), docs/STATE.md.');
    expect(enLines.at(-3)).toMatch(/^Last recorded feature: products-excel-upload \(#7\)/);
    // `backlog.mjs list` prints line index 3: it stays the GitHub status line.
    expect(enLines[3]).toBe('GitHub unreachable; queue from the cache of 2026-10-05.');

    const ru = loadBundle('ru', root);
    const ruLines = renderBriefing({ ...base, lang: 'ru', bundle: ru, drift }).split('\n');
    expect(ruLines.at(-1)).toBe(
      'STATE расходится с git: Branch feature/x, а git на ветке main; Last commit abc1234 ' +
        'отстаёт от HEAD на 8 коммит(ов) по первому родителю. Обновите Branch, Last commit и ' +
        'Next в ## Now файла docs/STATE.md.'
    );
    expect(ruLines[3]).toBe(t(ru, 'briefing.github.cached', '2026-10-05'));
    expect(ruLines).toHaveLength(enLines.length);

    // The two commit findings that need no count.
    expect(renderDriftLine(en, [{ kind: 'unknown', state: '0000000' }])).toBe(
      'STATE drift: Last commit 0000000 is not a commit of this repository. ' +
        'Update Branch, Last commit and Next in ## Now of docs/STATE.md.'
    );
    expect(renderDriftLine(ru, [{ kind: 'diverged', state: 'def5678' }])).toBe(
      'STATE расходится с git: Last commit def5678 не является предком HEAD. ' +
        'Обновите Branch, Last commit и Next в ## Now файла docs/STATE.md.'
    );

    // No drift: no line, the briefing as before.
    for (const none of [[], undefined]) {
      const lines = renderBriefing({ ...base, lang: 'en', bundle: en, drift: none }).split('\n');
      expect(lines).toEqual(enLines.slice(0, -1));
    }
  });
});
