#!/usr/bin/env node
/**
 * Shape check of a feature's documents (ADR-0018, ADR-0031): PLAN.md holds one criterion per line
 * under its phase markers and steps as table rows with `<N>: ` Phase cells, CONTEXT.md holds only
 * the brief sections with reader subsections, and no role brief is above the ceiling of its group
 * in test/context-budget.json (absent file: no ceiling yet). Run by the /feature orchestrator at
 * the phase 1 gate and by /spec: `node scripts/check-feature-docs.mjs <feature-name>`.
 * Exit 1 with the list of findings, exit 0 when everything passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { planShapeErrors, contextShapeErrors } from './lib/doc-shapes.mjs';
import {
  BUDGET_FILE,
  allBriefs,
  ceilingFindings,
  readBudget,
  readFeatureDocs,
} from './lib/feature-brief.mjs';

const name = process.argv[2];
if (!name) {
  process.stderr.write('usage: node scripts/check-feature-docs.mjs <feature-name>\n');
  process.exit(2);
}
const root = process.cwd();
const dir = path.resolve(root, 'docs', 'features', name);
const findings = [];
for (const [file, check] of [
  ['PLAN.md', planShapeErrors],
  ['CONTEXT.md', contextShapeErrors],
]) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    findings.push(`${file}: missing`);
    continue;
  }
  for (const e of check(fs.readFileSync(p, 'utf8'))) findings.push(`${file}: ${e}`);
}
const { budget, error } = readBudget(root);
const docs = readFeatureDocs(root, name);
const briefs = budget && docs ? allBriefs(docs) : [];
if (error) findings.push(error);
findings.push(...ceilingFindings(name, briefs, budget));
if (findings.length) {
  process.stdout.write(findings.map((f) => `- ${f}`).join('\n') + '\n');
  process.exit(1);
}
const ceilings = budget
  ? ` ${briefs.length} brief(s) within the ceilings of ${BUDGET_FILE}.`
  : ` No brief ceiling checked: ${BUDGET_FILE} is absent.`;
process.stdout.write(
  `docs/features/${name}: PLAN.md and CONTEXT.md keep the shape of the templates.${ceilings}\n`
);
