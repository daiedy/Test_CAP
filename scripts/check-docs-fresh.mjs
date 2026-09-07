#!/usr/bin/env node
// Verifies that docs/registry/*.md match the current sources. Exit 0 = fresh, 1 = stale.
// --fix regenerates the registry (runs scripts/gen-registry.mjs) and exits 0 on success.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourcesHash, recordedHash } from './lib/registry-sources.mjs';

const ROOT = process.cwd();
const REGISTRY = join(ROOT, 'docs/registry');
const FILES = [
  'DOMAIN-MODEL.md',
  'SERVICES.md',
  'HANDLERS.md',
  'UI-ARTIFACTS.md',
  'REUSE-CATALOG.md',
];
const fix = process.argv.includes('--fix');

function status() {
  const current = sourcesHash(ROOT);
  const reasons = [];
  if (existsSync(join(REGISTRY, '.stale')))
    reasons.push('the docs/registry/.stale marker is present');
  for (const f of FILES) {
    const rec = recordedHash(join(REGISTRY, f));
    if (!rec) reasons.push(`${f}: file is missing or has no generator header`);
    else if (rec !== current)
      reasons.push(`${f}: hash ${rec} does not match the current sources ${current}`);
  }
  return reasons;
}

let reasons = status();
if (reasons.length && fix) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/gen-registry.mjs')], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  if (r.status !== 0) {
    console.error('Registry regeneration failed.');
    process.exit(1);
  }
  reasons = status();
}
if (reasons.length) {
  console.error('The documentation registry is stale:');
  for (const r of reasons) console.error(`  - ${r}`);
  console.error('Run: npm run docs:registry (or node scripts/check-docs-fresh.mjs --fix)');
  process.exit(1);
}
console.log('docs/registry is fresh.');
