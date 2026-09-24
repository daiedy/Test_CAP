#!/usr/bin/env node
/**
 * Prompt budget ratchet (ADR-0018). Lists the byte size of every file that lands in an agent's
 * context unconditionally or by path rule: CLAUDE.md, the protocol and the other skills, the agent
 * prompts, the path rules. `--record` writes the sizes into test/prompt-budget.json, which
 * test/prompt-budget.test.js treats as the ceiling; run it only after a retro decision to grow a
 * prompt, and note the decision in docs/CHANGELOG.md.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
export const BUDGET_FILE = path.join(root, 'test', 'prompt-budget.json');

function list(dir, suffix) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((d) => {
      const rel = path.join(dir, d.name);
      if (d.isDirectory()) return list(rel, suffix);
      return d.name.endsWith(suffix) ? [rel] : [];
    })
    .map((p) => p.split(path.sep).join('/'));
}

/** Files whose size is pinned, repo-relative, sorted. */
export function budgetedFiles() {
  return [
    'CLAUDE.md',
    ...list('.claude/skills', 'SKILL.md'),
    ...list('.claude/agents', '.md'),
    ...list('.claude/rules', '.md'),
  ].sort();
}

export function measure() {
  const out = {};
  for (const f of budgetedFiles()) out[f] = fs.statSync(path.join(root, f)).size;
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const sizes = measure();
  if (process.argv.includes('--record')) {
    fs.writeFileSync(
      BUDGET_FILE,
      JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), bytes: sizes }, null, 2) +
        '\n'
    );
    process.stdout.write(
      `recorded ${Object.keys(sizes).length} files into test/prompt-budget.json\n`
    );
  } else {
    let total = 0;
    for (const [f, n] of Object.entries(sizes)) {
      total += n;
      process.stdout.write(`${String(n).padStart(7)}  ${f}\n`);
    }
    process.stdout.write(`${String(total).padStart(7)}  total\n`);
  }
}
