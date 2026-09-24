// ADR-0018: reading rules cut by structure, not by line counts. The shape checks of STATE.md,
// PLAN.md and CONTEXT.md live in scripts/lib/doc-shapes.mjs and run on PostToolUse and in the
// Stop gate; readSection() replaces readLines() in the SessionStart hook and never cuts silently.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  stateShapeErrors,
  planShapeErrors,
  contextShapeErrors,
  capped,
  STATE_PRINT_BUDGET,
} from '../scripts/lib/doc-shapes.mjs';
import { readSection } from '../scripts/lib/hook-utils.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('STATE.md shape', () => {
  it('accepts the template and the live file', () => {
    expect(stateShapeErrors(read('templates/STATE.md'))).toEqual([]);
    expect(stateShapeErrors(read('docs/STATE.md'))).toEqual([]);
  });

  it('rejects a narrative paragraph under Now and a non-table line under Open debt', () => {
    const narrative = read('templates/STATE.md').replace(
      '- Next: <one sentence: the next step for the next session>',
      '- Next: x\n\nOn 2026-09-23 the feature was merged and the retro transferred three lessons.'
    );
    expect(stateShapeErrors(narrative).join('\n')).toMatch(/Now/);
    const debt = read('templates/STATE.md').replace(
      '## What works',
      'Some prose about debt.\n\n## What works'
    );
    expect(stateShapeErrors(debt).join('\n')).toMatch(/Open debt/);
  });

  it('rejects an extra section and a missing label', () => {
    const extra = read('templates/STATE.md') + '\n## Sessions\n- 2026-09-07: compaction\n';
    expect(stateShapeErrors(extra).join('\n')).toMatch(/Sessions/);
    const missing = read('templates/STATE.md').replace(/- Phase: .*\n/, '');
    expect(stateShapeErrors(missing).join('\n')).toMatch(/Phase/);
  });

  it('keeps the printed sections of the live file within the session budget', () => {
    const text = read('docs/STATE.md');
    const now = readSection(path.join(root, 'docs/STATE.md'), '## Now');
    const debt = readSection(path.join(root, 'docs/STATE.md'), '## Open debt');
    expect(now.length + debt.length).toBeLessThanOrEqual(STATE_PRINT_BUDGET);
    expect(text).toContain(now);
  });
});

describe('feature document shapes', () => {
  it('accept the templates', () => {
    expect(planShapeErrors(read('templates/feature/PLAN.md'))).toEqual([]);
    expect(contextShapeErrors(read('templates/feature/CONTEXT.md'))).toEqual([]);
  });

  it('reject a paragraph among the criteria and prose among the steps', () => {
    const plan = read('templates/feature/PLAN.md');
    const prose = plan.replace(
      '- [ ] Behavior 2',
      'Measured on a scratchpad copy: +50 lines.\n- [ ] Behavior 2'
    );
    expect(planShapeErrors(prose).join('\n')).toMatch(/Acceptance criteria/);
    const steps = plan.replace(
      '| 3 | Backend: logic',
      'Note: step 3 depends on step 2.\n| 3 | Backend: logic'
    );
    expect(planShapeErrors(steps).join('\n')).toMatch(/Steps/);
  });

  it('reject a Screens or experiment section in CONTEXT.md and name the destination', () => {
    const ctx =
      read('templates/feature/CONTEXT.md') +
      '\n## Screens (if there is a UI)\n...\n\n## Verified by experiment (2026-09-07)\n...\n';
    const errors = contextShapeErrors(ctx).join('\n');
    expect(errors).toMatch(/SCREENS\.md/);
    expect(errors).toMatch(/research\//);
  });
});

describe('readSection and the visible cap', () => {
  it('returns a whole section by heading and nothing past the next heading', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-shapes-'));
    const file = path.join(dir, 'x.md');
    fs.writeFileSync(file, '# T\n\nintro\n\n## A\n\nline 1\n| row |\n\n## B\n\nother\n');
    expect(readSection(file, '## A')).toBe('## A\n\nline 1\n| row |\n');
    expect(readSection(file, '## B')).toBe('## B\n\nother\n');
    expect(readSection(file, '## C')).toBe('');
  });

  it('marks a cut instead of hiding it', () => {
    const text = 'x'.repeat(100);
    expect(capped(text, 200, 'docs/STATE.md')).toBe(text);
    const cut = capped(text, 40, 'docs/STATE.md');
    expect(cut.startsWith('x'.repeat(40))).toBe(true);
    expect(cut).toMatch(/truncated .*60 bytes.*docs\/STATE\.md/);
  });
});
