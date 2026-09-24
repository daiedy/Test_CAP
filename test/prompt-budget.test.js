// ADR-0018: the fixed cost of an agent's context (CLAUDE.md, the preloaded protocol, its prompt,
// the path rules) is a ratchet, not a guess. test/prompt-budget.json holds the recorded byte size
// of every file; growth fails here until a retro records the new size with
// `node scripts/prompt-budget.mjs --record` and a line in docs/CHANGELOG.md. A retro lesson goes
// into a prompt as a rule, never as a dated story: a date is allowed only as a pointer.
import fs from 'node:fs';
import path from 'node:path';
import { measure, budgetedFiles } from '../scripts/prompt-budget.mjs';

const root = path.resolve(import.meta.dirname, '..');
const recorded = JSON.parse(fs.readFileSync(path.join(root, 'test', 'prompt-budget.json'), 'utf8'));

describe('prompt budget ratchet', () => {
  it('has every budgeted file recorded', () => {
    const missing = budgetedFiles().filter((f) => !(f in recorded.bytes));
    expect(missing).toEqual([]);
  });

  it('lets no prompt, rule or skill grow past its recorded size', () => {
    const grown = Object.entries(measure())
      .filter(([f, n]) => f in recorded.bytes && n > recorded.bytes[f])
      .map(
        ([f, n]) =>
          `${f}: ${n} > ${recorded.bytes[f]} (record the new size with node scripts/prompt-budget.mjs --record after a retro decision)`
      );
    expect(grown).toEqual([]);
  });

  it('carries no dated stories: a date appears only as a pointer or in a description', () => {
    const DATE = /\b20\d{2}-\d{2}-\d{2}\b/;
    const POINTER = /\((?:see )?(?:CHANGELOG|LESSONS|ADR-\d{4})[^)]*20\d{2}-\d{2}-\d{2}[^)]*\)/;
    const findings = [];
    for (const f of budgetedFiles()) {
      fs.readFileSync(path.join(root, f), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!DATE.test(line) || /^description:/.test(line)) return;
          if (line.replace(POINTER, '').match(DATE)) findings.push(`${f}:${i + 1}`);
        });
    }
    expect(findings).toEqual([]);
  });
});
