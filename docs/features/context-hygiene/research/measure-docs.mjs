// Scratch measurement for the context-hygiene plan (architect, 2026-11-09): bytes and characters
// per `## ` section of a feature's documents, and the PLAN.md step rows per agent.
// Usage: node docs/features/context-hygiene/research/measure-docs.mjs <feature-name>
import fs from 'node:fs';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);

const name = process.argv[2] || 'products-validations';
const dir = path.resolve('docs', 'features', name);
const bytes = (s) => Buffer.byteLength(s, 'utf8');

function sections(text) {
  const out = [{ heading: '(preamble)', lines: [] }];
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) out.push({ heading: line.trim(), lines: [] });
    else out[out.length - 1].lines.push(line);
  }
  return out;
}

for (const file of ['PLAN.md', 'CONTEXT.md', 'SCREENS.md']) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  print(`\n${file}: ${bytes(text)} bytes, ${text.length} chars`);
  for (const s of sections(text)) {
    const body = [s.heading, ...s.lines].join('\n');
    const sub = s.lines.filter((l) => /^### /.test(l)).length;
    print(
      `  ${String(bytes(body)).padStart(6)} B ${String(body.length).padStart(6)} ch  ${s.heading}` +
        (sub ? `  (${sub} ### subsections)` : '')
    );
  }
  if (file !== 'PLAN.md') continue;
  const secs = sections(text);
  const steps = secs.find((s) => s.heading === '## Steps');
  const rows = steps.lines.filter((l) => l.startsWith('|')).slice(2);
  const header = steps.lines.find((l) => l.startsWith('|'));
  print(`  steps header: ${header}`);
  const cells = (l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
  const cols = cells(header);
  const iAgent = cols.indexOf('Agent');
  const iPhase = cols.indexOf('Phase');
  const byAgent = {};
  const byPhase = {};
  for (const r of rows) {
    const c = cells(r);
    const agents = [...(c[iAgent] || '').matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
    for (const a of agents.length ? agents : [c[iAgent] || '?']) {
      byAgent[a] = byAgent[a] || { rows: 0, chars: 0 };
      byAgent[a].rows++;
      byAgent[a].chars += r.length + 1;
    }
    const ph = c[iPhase] || '?';
    byPhase[ph] = byPhase[ph] || { rows: 0, chars: 0 };
    byPhase[ph].rows++;
    byPhase[ph].chars += r.length + 1;
  }
  print(`  step rows: ${rows.length}`);
  for (const [a, v] of Object.entries(byAgent))
    print(`    agent ${a}: ${v.rows} rows, ${v.chars} ch`);
  for (const [a, v] of Object.entries(byPhase))
    print(`    phase "${a}": ${v.rows} rows, ${v.chars} ch`);
  const crit = secs.find((s) => s.heading === '## Acceptance criteria');
  const items = crit.lines.filter((l) => /^- \[[ xX]\] /.test(l));
  const lens = items.map((l) => l.length).sort((a, b) => a - b);
  print(
    `  criteria: ${items.length} lines, total ${lens.reduce((a, b) => a + b, 0)} ch, median ${lens[Math.floor(lens.length / 2)]}, max ${lens.at(-1)}`
  );
  const named = { test: 0, opa: 0, verification: 0, other: 0 };
  for (const l of items) {
    if (/OPA5|journey|Journey|qunit/i.test(l)) named.opa++;
    else if (/test\/[a-z-]+\.test\.js/.test(l)) named.test++;
    else if (/VERIFICATION|ui-verifier|screenshot/i.test(l)) named.verification++;
    else named.other++;
  }
  print(`  criteria by evidence kind: ${JSON.stringify(named)}`);
}
