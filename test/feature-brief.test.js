// ADR-0031 decision 2: the role brief of scripts/lib/feature-brief.mjs, the ceilings of
// test/context-budget.json and the two CLIs that read them. Pinned on a small fixture feature built
// in this file (every section carries a marker token, so the test can tell which section a brief
// holds), never on the real feature folders. The CLIs run with a temp directory as their working
// directory: they read docs/features/<name>/ and test/context-budget.json from there and write
// nothing outside it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { briefFor, allBriefs } from '../scripts/lib/feature-brief.mjs';
import { planShapeErrors, contextShapeErrors } from '../scripts/lib/doc-shapes.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const NAME = 'fixture-brief';
const DIR = `docs/features/${NAME}`;
const P = `${DIR}/PLAN.md`;
const C = `${DIR}/CONTEXT.md`;
const S = `${DIR}/SCREENS.md`;

const PLAN = `# Fixture brief: plan

Date: 2026-11-11. Status: approved 2026-11-11. Gate mode: autonomous.

PLAN-PREAMBLE contract rule: not applicable.

## Acceptance criteria

### Phase 2: backend
- [ ] CRIT-P2-A the service rejects a negative stock
- [ ] CRIT-P2-B a test covers the rule

### Phase 3: UI
- [ ] CRIT-P3 the form disables the field

### Phase 4: verification
- [ ] CRIT-P4 the verifier sees the disabled field

### Phase 5: review
- [ ] CRIT-P5 zero blocking findings

### Phase 6: documentation
- [ ] CRIT-P6 registry and CHANGELOG updated

### Every phase
- [ ] CRIT-ALL npm test is green at every gate

## Steps

| # | Phase | Agent | Files | Pattern | Check |
|---|---|---|---|---|---|
| 1 | 1: spec | \`architect\`, \`ux-designer\` | \`CONTEXT.md\` | | ROW-1 |
| 2 | 2: model | \`cap-backend-dev\` | \`db/schema.cds\`, \`research/probe.md\` | New entity | ROW-2 |
| 3 | 2: tests | \`test-backend\` | \`test/catalog-service.test.js\` | | ROW-3 |
| 4 | 3: UI | \`fiori-app-dev\` | \`app/products/annotations/Products.cds\` | ADR-0099 decision 2 | ROW-4 |
| 5 | 3: UI tests | \`test-ui\` | \`webapp/test/...\` | | ROW-5 |
| 6 | 4: verification | \`ui-verifier\` | \`VERIFICATION.md\` | | ROW-6 |
| 7 | 5: review | \`reviewer\` | | | ROW-7 |
| 8 | 6: documentation | \`docs-keeper\` | \`docs/STATE.md\` | | ROW-8 |

## Decisions that require an ADR
- \`docs/decisions/ADR-0099-fixture.md\`: PLAN-ADR the fixture decision.

## Risks
PLAN-RISKS none.

## Open questions
PLAN-OPEN none.
`;

const CONTEXT = `# Fixture brief: context

Date: 2026-11-11. Author: \`architect\`. Branch: \`feature/${NAME}\`.

CTX-PREAMBLE what this file is.

## Request
CTX-REQUEST the user wants a stock rule.

## User decisions
CTX-DECISIONS none beyond the request.

## Affected entities and services
CTX-AFFECTED text before the first subsection.

### All: shared facts
CTX-ALL the entity is Products.

### Backend: the rule
CTX-BACKEND the handler rejects a stock below 0.

### UI: the control
CTX-UI the field is a step input.

### Backend, UI: the message
CTX-BOTH the message key is STOCK_NEGATIVE.

## What already exists and is reused
CTX-REUSE nothing suitable.

## Applicable patterns
CTX-PATTERNS Mandatory field.

## Relevant lessons
CTX-LESSONS none.

## Open questions
CTX-OPEN none.
`;

const SCREENS = `# Fixture brief: screens

SCR-PREAMBLE the screens of the feature.

## Floorplan and duplication check
SCR-FLOORPLAN List Report.

## Alternatives
SCR-ALTERNATIVES none.

## Open questions for the user
SCR-OPEN none.

## Screen: list
SCR-LIST a stock column.

## Verifier scenarios
SCR-VERIFIER open the list.
`;

const DOCS = { name: NAME, plan: PLAN, context: CONTEXT, screens: SCREENS };
const TEXTS = { [P]: PLAN, [C]: CONTEXT, [S]: SCREENS };
const CRITERIA = PLAN.split('\n').filter((l) => l.startsWith('- [ ] '));
const ROWS = PLAN.split('\n').filter((l) => /^\| \d+ \|/.test(l));

/**
 * Every section a brief either holds or names under `## Not included`: file, heading, the parent
 * section of a subsection, and the marker token of its text.
 */
const UNITS = [
  { file: P, heading: '(preamble)', marker: 'PLAN-PREAMBLE' },
  ...[
    ['### Phase 2: backend', 'CRIT-P2-A'],
    ['### Phase 3: UI', 'CRIT-P3'],
    ['### Phase 4: verification', 'CRIT-P4'],
    ['### Phase 5: review', 'CRIT-P5'],
    ['### Phase 6: documentation', 'CRIT-P6'],
    ['### Every phase', 'CRIT-ALL'],
  ].map(([heading, marker]) => ({ file: P, heading, parent: '## Acceptance criteria', marker })),
  { file: P, heading: '## Decisions that require an ADR', marker: 'PLAN-ADR' },
  { file: P, heading: '## Risks', marker: 'PLAN-RISKS' },
  { file: P, heading: '## Open questions', marker: 'PLAN-OPEN' },
  { file: C, heading: '(preamble)', marker: 'CTX-PREAMBLE' },
  { file: C, heading: '## Request', marker: 'CTX-REQUEST' },
  { file: C, heading: '## User decisions', marker: 'CTX-DECISIONS' },
  ...[
    ['### All: shared facts', 'CTX-ALL'],
    ['### Backend: the rule', 'CTX-BACKEND'],
    ['### UI: the control', 'CTX-UI'],
    ['### Backend, UI: the message', 'CTX-BOTH'],
  ].map(([heading, marker]) => ({
    file: C,
    heading,
    parent: '## Affected entities and services',
    marker,
  })),
  { file: C, heading: '## What already exists and is reused', marker: 'CTX-REUSE' },
  { file: C, heading: '## Applicable patterns', marker: 'CTX-PATTERNS' },
  { file: C, heading: '## Relevant lessons', marker: 'CTX-LESSONS' },
  { file: C, heading: '## Open questions', marker: 'CTX-OPEN' },
  ...[
    ['(preamble)', 'SCR-PREAMBLE'],
    ['## Floorplan and duplication check', 'SCR-FLOORPLAN'],
    ['## Alternatives', 'SCR-ALTERNATIVES'],
    ['## Open questions for the user', 'SCR-OPEN'],
    ['## Screen: list', 'SCR-LIST'],
    ['## Verifier scenarios', 'SCR-VERIFIER'],
  ].map(([heading, marker]) => ({ file: S, heading, marker })),
];

const grouped = (n) => n.toLocaleString('en-US');
const shown = (h) => (h.startsWith('#') ? `\`${h}\`` : h);

/**
 * Bytes of a section as the brief counts them: from its heading line (the first line for the
 * preamble) up to the next heading of the same or a higher level, without the line break before
 * that heading.
 */
function unitBytes(text, heading) {
  const lines = text.split('\n');
  const start = heading === '(preamble)' ? 0 : lines.indexOf(heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const level = heading === '(preamble)' ? 2 : heading.match(/^#+/)[0].length;
  let end = start + 1;
  while (end < lines.length && !(/^#{2,3} /.test(lines[end]) && lines[end].indexOf(' ') <= level))
    end++;
  return Buffer.byteLength(lines.slice(start, end).join('\n'));
}

/** The lines of one `## ` section of a brief, heading excluded. */
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.indexOf(heading);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).filter((l) => l.trim());
}

/** Whether a brief holds a unit: its text, or for SCREENS.md the reading list entry. */
function holds(brief, unit) {
  if (unit.file !== S) return brief.text.includes(unit.marker);
  return section(brief.text, '## Reading list').some(
    (l) => l.startsWith(`- \`${S}\` lines `) && l.includes(`: ${shown(unit.heading)} (`)
  );
}

/** The `## Not included` line of a unit, or of its whole file for a role that reads none of it. */
function omissionOf(brief, unit) {
  const list = section(brief.text, '## Not included');
  const where = unit.parent ? ` in \`${unit.parent}\`` : '';
  const own = `- \`${unit.file}\` ${shown(unit.heading)}${where} (${grouped(unitBytes(TEXTS[unit.file], unit.heading))} bytes)`;
  const whole = list.find(
    (l) =>
      l.startsWith(`- \`${unit.file}\` (whole file)`) &&
      l.endsWith(`(${grouped(Buffer.byteLength(TEXTS[unit.file]))} bytes)`)
  );
  return list.find((l) => l === own) || whole || null;
}

function runCli(script, args, cwd) {
  return spawnSync(process.execPath, [path.join(repo, 'scripts', script), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

/** A temp working directory holding the fixture feature folder and, optionally, a budget file. */
function tempRoot(budget) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-brief-'));
  fs.mkdirSync(path.join(dir, DIR), { recursive: true });
  for (const [rel, text] of Object.entries(TEXTS)) fs.writeFileSync(path.join(dir, rel), text);
  fs.mkdirSync(path.join(dir, 'test'));
  if (budget !== undefined)
    fs.writeFileSync(
      path.join(dir, 'test/context-budget.json'),
      typeof budget === 'string' ? budget : JSON.stringify(budget, null, 2)
    );
  return dir;
}

const roots = [];
afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

describe('role brief (ADR-0031 decision 2)', () => {
  it('the fixture keeps the shape of the templates', () => {
    expect(planShapeErrors(PLAN)).toEqual([]);
    expect(contextShapeErrors(CONTEXT)).toEqual([]);
  });

  it('a backend brief holds its phase and its readers only', () => {
    const brief = briefFor(DOCS, 'cap-backend-dev', 2);
    expect(brief).toMatchObject({ group: 'backend', steps: ['2'] });
    const has = (m) => brief.text.includes(m);
    // Its own step row with the table header, no row of another agent or phase.
    expect(section(brief.text, '## Your steps')).toEqual([
      '| # | Phase | Agent | Files | Pattern | Check |',
      '|---|---|---|---|---|---|',
      ROWS[1],
    ]);
    for (const m of ['ROW-1', 'ROW-3', 'ROW-4', 'ROW-5', 'ROW-6', 'ROW-7', 'ROW-8'])
      expect(has(m), m).toBe(false);
    // The plan preamble, the criteria of phase 2 and of every phase, nothing of phases 3 to 6.
    expect(has('PLAN-PREAMBLE')).toBe(true);
    expect(section(brief.text, '## Acceptance criteria')).toEqual([
      '### Phase 2: backend',
      CRITERIA[0],
      CRITERIA[1],
      '### Every phase',
      CRITERIA.at(-1),
    ]);
    // Request, User decisions, the unsplit sections, the All and Backend subsections, in file order.
    const kept = [
      'CTX-REQUEST',
      'CTX-DECISIONS',
      'CTX-AFFECTED',
      'CTX-ALL',
      'CTX-BACKEND',
      'CTX-BOTH',
      'CTX-REUSE',
      'CTX-PATTERNS',
      'CTX-LESSONS',
    ];
    const at = kept.map((m) => brief.text.indexOf(m));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(brief.text).toContain('## Request\n\nCTX-REQUEST');
    // Nothing of UI, of the open questions or of SCREENS.md; the research file its row names.
    for (const m of ['CTX-UI', 'CTX-OPEN', 'CTX-PREAMBLE', 'PLAN-RISKS', 'PLAN-OPEN', 'SCR-'])
      expect(has(m), m).toBe(false);
    expect(section(brief.text, '## Reading list')).toEqual([
      `- \`${DIR}/research/probe.md\` (step 2)`,
    ]);
    // The UI developer of phase 3 is the mirror image: UI instead of Backend, its own row.
    const ui = briefFor(DOCS, 'fiori-app-dev', 3);
    expect(ui.text).toContain('CTX-UI');
    expect(ui.text).toContain('CTX-BOTH');
    expect(ui.text).not.toContain('CTX-BACKEND');
    expect(ui.text).toContain('ROW-4');
    expect(ui.text).not.toContain('ROW-2');
  });

  it('no criterion is lost and every omission is named', () => {
    const briefs = allBriefs(DOCS);
    expect(briefs.map((b) => `${b.agentType}-${b.phase}`)).toEqual([
      'cap-backend-dev-2',
      'test-backend-2',
      'fiori-app-dev-3',
      'test-ui-3',
      'ui-verifier-4',
      'docs-keeper-6',
    ]);
    // Every criterion reaches at least one brief.
    for (const c of CRITERIA)
      expect(
        briefs.some(({ brief }) => brief.text.includes(c)),
        c
      ).toBe(true);
    // Every step row of a briefed agent reaches its brief; the rows of the whole readers
    // (architect, ux-designer, reviewer) reach none by design and are named instead.
    for (const row of ROWS) {
      const inSome = briefs.some(({ brief }) => brief.text.includes(row));
      expect(inSome, row).toBe(!/ROW-[17] /.test(row));
    }
    for (const { agentType, phase, brief } of briefs) {
      const label = `${agentType}-${phase}`;
      const own = section(brief.text, '## Your steps').slice(2);
      const others = ROWS.filter((r) => !own.includes(r));
      const steps = others.map((r) => r.match(/^\| (\d+) \|/)[1]);
      expect(steps, label).toEqual(expect.arrayContaining(['1', '7']));
      expect(section(brief.text, '## Not included'), label).toContain(
        `- \`${P}\` \`## Steps\`: rows of steps ${steps.join(', ')} (${grouped(Buffer.byteLength(others.join('\n')))} bytes)`
      );
      // Every section of the three files is in the brief or named with file, heading and bytes.
      for (const unit of UNITS) {
        const where = `${label}: ${unit.file} ${unit.heading}`;
        if (holds(brief, unit)) expect(omissionOf(brief, unit), where).toBeNull();
        else expect(omissionOf(brief, unit), where).not.toBeNull();
      }
      // And nothing is named that the brief holds: one Not included line per omission.
      expect(section(brief.text, '## Not included')).toHaveLength(brief.omitted.length);
    }
  });

  it('whole readers get no brief; verifier and docs-keeper get theirs', () => {
    for (const [type, phase] of [
      ['reviewer', 5],
      ['architect', 1],
      ['ux-designer', 1],
      ['an-unknown-agent', 2],
    ])
      expect(briefFor(DOCS, type, phase), type).toBeNull();
    // A briefed type gets nothing in a phase without its step row.
    expect(briefFor(DOCS, 'cap-backend-dev', 3)).toBeNull();

    const verifier = briefFor(DOCS, 'ui-verifier', 4);
    expect(verifier.group).toBe('verifier');
    expect(section(verifier.text, '## Acceptance criteria')).toEqual([
      '### Phase 3: UI',
      CRITERIA[2],
      '### Phase 4: verification',
      CRITERIA[3],
      '### Every phase',
      CRITERIA.at(-1),
    ]);
    expect(verifier.text).not.toContain('PLAN-PREAMBLE');
    expect(verifier.text).not.toContain('CTX-');
    // The SCREENS reading list: every section except the three plan-gate ones, with line ranges.
    const reading = section(verifier.text, '## Reading list');
    expect(reading).toEqual([
      expect.stringMatching(/^- `.*SCREENS\.md` lines 1-3: \(preamble\) \(\d+ bytes\)$/),
      expect.stringMatching(/^- `.*SCREENS\.md` lines 14-15: `## Screen: list` \(\d+ bytes\)$/),
      expect.stringMatching(
        /^- `.*SCREENS\.md` lines 17-18: `## Verifier scenarios` \(\d+ bytes\)$/
      ),
    ]);
    const omitted = section(verifier.text, '## Not included').join('\n');
    for (const h of [
      '## Floorplan and duplication check',
      '## Alternatives',
      '## Open questions for the user',
    ])
      expect(omitted).toContain(`\`${S}\` \`${h}\``);
    expect(omitted).toContain(`\`${C}\` (whole file)`);
    // The developers read no verifier scenarios; the UI tester does.
    expect(briefFor(DOCS, 'fiori-app-dev', 3).text).not.toMatch(/lines \d+-\d+: `## Verifier/);
    expect(briefFor(DOCS, 'test-ui', 3).text).toMatch(/lines 17-18: `## Verifier scenarios`/);

    const docs = briefFor(DOCS, 'docs-keeper', 6);
    expect(docs.group).toBe('docs');
    expect(section(docs.text, '## Acceptance criteria').filter((l) => l.startsWith('- ['))).toEqual(
      CRITERIA
    );
    expect(section(docs.text, '## Reading list')).toEqual(['None.']);
    const docsOmitted = section(docs.text, '## Not included').join('\n');
    expect(docsOmitted).toContain(`\`${C}\` (whole file)`);
    expect(docsOmitted).toContain(`\`${S}\` (whole file): 5 sections`);
  });

  it('a brief over its recorded ceiling fails the feature check', () => {
    const backend = allBriefs(DOCS).filter(({ brief }) => brief.group === 'backend');
    const largest = backend.reduce((a, b) => (b.brief.bytes > a.brief.bytes ? b : a));
    const ceiling = largest.brief.bytes - 1;
    const budget = (bytes) => ({
      briefs: { bytes: { backend: bytes, ui: 1e6, verifier: 1e6, docs: 1e6 } },
    });

    const over = tempRoot(budget(ceiling));
    roots.push(over);
    const red = runCli('check-feature-docs.mjs', [NAME], over);
    expect(red.status, red.stdout + red.stderr).toBe(1);
    expect(red.stdout).toContain(
      `brief .pipeline/brief/${largest.agentType}-2.md: ${grouped(largest.brief.bytes)} bytes, above the backend ceiling of ${grouped(ceiling)} bytes in test/context-budget.json`
    );
    // Only the brief above its ceiling is named.
    expect(red.stdout.trim().split('\n')).toHaveLength(
      backend.filter(({ brief }) => brief.bytes > ceiling).length
    );

    // At the ceiling the check passes; without a budget file no ceiling is checked.
    const at = tempRoot(budget(largest.brief.bytes));
    const none = tempRoot();
    const broken = tempRoot('{ "briefs": ');
    roots.push(at, none, broken);
    const green = runCli('check-feature-docs.mjs', [NAME], at);
    expect(green.status, green.stdout + green.stderr).toBe(0);
    expect(green.stdout).toContain('6 brief(s) within the ceilings of test/context-budget.json');
    const absent = runCli('check-feature-docs.mjs', [NAME], none);
    expect(absent.status, absent.stdout + absent.stderr).toBe(0);
    expect(absent.stdout).toContain('No brief ceiling checked');
    // An unparsable budget is a finding, not a pass.
    const crash = runCli('check-feature-docs.mjs', [NAME], broken);
    expect(crash.status).toBe(1);
    expect(crash.stdout).toContain('test/context-budget.json: not valid JSON');
  });

  it('a record never lowers a ceiling', () => {
    const measured = {};
    for (const { brief } of allBriefs(DOCS))
      measured[brief.group] = Math.max(measured[brief.group] || 0, brief.bytes);
    const high = measured.backend + 1000;
    const dir = tempRoot({
      briefs: {
        recordedAt: '2026-11-01',
        bytes: { backend: high, ui: 1, legacy: 7 },
        sources: { backend: 'other-feature', ui: 'other-feature', legacy: 'old' },
      },
      resumesAfterReport: 0,
      note: 'kept',
    });
    roots.push(dir);
    const file = path.join(dir, 'test/context-budget.json');

    const res = runCli('feature-brief.mjs', [NAME, '--record'], dir);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain(
      `backend ${grouped(high)} (kept; measured ${grouped(measured.backend)})`
    );
    expect(res.stdout).toContain(`ui ${grouped(measured.ui)} (was 1)`);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(after).toEqual({
      briefs: {
        recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        // The higher of recorded and measured per group; a group the feature has no brief of stays.
        bytes: {
          backend: high,
          ui: measured.ui,
          legacy: 7,
          verifier: measured.verifier,
          docs: measured.docs,
        },
        sources: {
          backend: 'other-feature',
          ui: NAME,
          legacy: 'old',
          verifier: NAME,
          docs: NAME,
        },
      },
      resumesAfterReport: 0,
      note: 'kept',
    });

    // A second record over the same documents changes no ceiling.
    expect(runCli('feature-brief.mjs', [NAME, '--record'], dir).status).toBe(0);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).briefs.bytes).toEqual(after.briefs.bytes);
  });
});
