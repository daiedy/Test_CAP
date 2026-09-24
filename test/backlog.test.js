// ADR-0019: the backlog lives in GitHub Issues; the queue, the recommendation and the localized
// briefing are pure functions over `gh issue list` JSON, pinned here without network access.
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
  t,
} from '../scripts/lib/backlog.mjs';

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
});
