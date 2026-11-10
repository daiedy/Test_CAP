// Scratch estimate for the context-hygiene plan (architect, 2026-11-09): the size of a role brief
// for an unmarked feature, here products-validations (#10), under a stated classification rule.
// An estimate, not the migration: plan step 9 marks the documents by hand and step 10 records the
// measured sizes. Rule for criteria: evidence by OPA5, QUnit or `npm run test:ui` is phase 3; a
// line starting with "Verification:" is phase 4, "Review:" phase 5, "Documentation" phase 6; the
// line "`npm test` is green at every gate" is every phase; everything else is phase 2. Rule for
// CONTEXT.md: `### Preventing controls` is UI, the paragraphs "Message keys", "Seed" and "Contract"
// are Backend, every bullet of "What already exists and is reused", "Applicable patterns" and
// "Relevant lessons" is classified by the paths and words it names, the rest is shared.
// Usage: node docs/features/context-hygiene/research/brief-estimate.mjs [feature-name]
import fs from 'node:fs';
import path from 'node:path';

const print = (s = '') => process.stdout.write(`${s}\n`);
const name = process.argv[2] || 'products-validations';
const dir = path.resolve('docs', 'features', name);
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const len = (lines) => lines.reduce((n, l) => n + l.length + 1, 0);

function sections(text) {
  const out = [{ heading: null, lines: [] }];
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) out.push({ heading: line.trim(), lines: [] });
    else out.at(-1).lines.push(line);
  }
  return out;
}

// ---------- PLAN.md ----------
const plan = sections(read('PLAN.md'));
const sec = (h) => plan.find((s) => s.heading === h) || { lines: [] };
const preamble = len(plan[0].lines);
const criteria = sec('## Acceptance criteria').lines.filter((l) => /^- \[[ xX]\] /.test(l));
const phaseOfCriterion = (l) => {
  if (/^- \[.\] `npm test` is green at every gate/.test(l)) return 'every';
  if (/^- \[.\] Verification:/.test(l)) return '4';
  if (/^- \[.\] Review:/.test(l)) return '5';
  if (/^- \[.\] Documentation/.test(l)) return '6';
  if (/OPA5|QUnit|qunit|npm run test:ui/.test(l)) return '3';
  return '2';
};
const byPhase = {};
for (const l of criteria) {
  const p = phaseOfCriterion(l);
  byPhase[p] = byPhase[p] || { n: 0, chars: 0 };
  byPhase[p].n++;
  byPhase[p].chars += l.length + 1;
}
const rows = sec('## Steps').lines.filter((l) => l.startsWith('|'));
const header = len(rows.slice(0, 2));
const stepChars = (agent) => len(rows.slice(2).filter((r) => r.includes(`\`${agent}\``)));
print(`${name} PLAN.md: preamble ${preamble} ch, criteria by phase ${JSON.stringify(byPhase)}`);

// ---------- CONTEXT.md ----------
const ctx = sections(read('CONTEXT.md'));
const c = (h) => ctx.find((s) => s.heading === h) || { lines: [] };
const BACKEND =
  /\b(db\/|srv\/|_i18n\/|test\/[a-z-]+\.test\.js|@assert|@mandatory|handler|import\b|messages\.properties|draftActivate)/;
const UI =
  /\b(app\/products|webapp|fragment|OPA5|QUnit|Fiori Elements|FieldControl|SCREENS|i18n\/i18n|mockdata|custom form|placeholder)/;
const shared = {
  chars:
    len(ctx[0].lines) +
    len(['## Request', ...c('## Request').lines]) +
    len(['## User decisions', ...c('## User decisions').lines]),
};
const role = { backend: 0, ui: 0, shared: shared.chars };
function classify(lines) {
  for (const l of lines) {
    if (!l.trim()) continue;
    const b = BACKEND.test(l);
    const u = UI.test(l);
    const n = l.length + 1;
    if (b && !u) role.backend += n;
    else if (u && !b) role.ui += n;
    else role.shared += n;
  }
}
const affected = c('## Affected entities and services').lines;
let sub = 'intro';
for (const l of affected) {
  if (/^### /.test(l)) sub = l.trim();
  const n = l.length + 1;
  if (sub === '### Preventing controls' && !/^(Message keys|Seed|Contract)/.test(l)) {
    if (/^(Message keys|Seed|Contract)/.test(l)) role.backend += n;
    else role.ui += n;
  } else if (/^(Message keys|Seed|Contract) /.test(l)) role.backend += n;
  else if (sub === 'intro' && l.startsWith('|') && !/^\|---|^\| Object/.test(l)) classify([l]);
  else role.shared += n;
}
for (const h of [
  '## What already exists and is reused',
  '## Applicable patterns',
  '## Relevant lessons',
])
  classify(c(h).lines);
const openQuestions = len(c('## Open questions').lines);
print(
  `${name} CONTEXT.md: shared ${role.shared} ch, backend-only ${role.backend} ch, ui-only ${role.ui} ch, open questions (left out) ${openQuestions} ch`
);

// ---------- briefs ----------
const whole = read('PLAN.md').length + read('CONTEXT.md').length;
const brief = (agent, phase, group) => {
  const crit = (byPhase[phase]?.chars || 0) + (byPhase.every?.chars || 0);
  const planPart = preamble + header + stepChars(agent) + crit;
  const ctxPart = group ? role.shared + role[group] : 0;
  return { agent, phase, planPart, ctxPart, total: planPart + ctxPart };
};
print(`\nPLAN.md + CONTEXT.md whole: ${whole} ch. Estimated briefs:`);
for (const b of [
  brief('cap-backend-dev', '2', 'backend'),
  brief('test-backend', '2', 'backend'),
  brief('fiori-app-dev', '3', 'ui'),
  brief('test-ui', '3', 'ui'),
  brief('ui-verifier', '4', null),
  brief('docs-keeper', '6', null),
])
  print(
    `  ${b.agent.padEnd(16)} phase ${b.phase}: PLAN part ${String(b.planPart).padStart(6)} + CONTEXT part ${String(b.ctxPart).padStart(6)} = ${String(b.total).padStart(6)} ch (${Math.round((b.total / whole) * 100)}% of whole)`
  );
