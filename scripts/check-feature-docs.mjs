#!/usr/bin/env node
/**
 * Shape check of a feature's documents (ADR-0018): PLAN.md holds one criterion per line and
 * steps as table rows, CONTEXT.md holds only the brief sections. Run by the /feature orchestrator
 * at the phase 1 gate and by /spec: `node scripts/check-feature-docs.mjs <feature-name>`.
 * Exit 1 with the list of findings, exit 0 when both files pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { planShapeErrors, contextShapeErrors } from './lib/doc-shapes.mjs';

const name = process.argv[2];
if (!name) {
  process.stderr.write('usage: node scripts/check-feature-docs.mjs <feature-name>\n');
  process.exit(2);
}
const dir = path.resolve(process.cwd(), 'docs', 'features', name);
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
if (findings.length) {
  process.stdout.write(findings.map((f) => `- ${f}`).join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(
  `docs/features/${name}: PLAN.md and CONTEXT.md keep the shape of the templates.\n`
);
