#!/usr/bin/env node
// Verifies that docs/registry/*.md, the OpenAPI documents of docs/api and the generated files of
// docs/wiki match the current sources, and lints the wiki pages (wikiStatus, ADR-0030 decision 4).
// Exit 0 = fresh, 1 = stale.
// --fix regenerates all three (runs scripts/gen-registry.mjs) and exits 0 on success; a wiki page
// finding (shape, link, orphan, basename, Cyrillic) stays until the page is fixed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourcesHash, recordedHash } from './lib/registry-sources.mjs';
import { apiDocsStatus } from './gen-api-docs.mjs';
import { wikiStatus } from './gen-wiki.mjs';

const ROOT = process.cwd();
const REGISTRY = join(ROOT, 'docs/registry');
const FILES = [
  'DOMAIN-MODEL.md',
  'SERVICES.md',
  'HANDLERS.md',
  'UI-ARTIFACTS.md',
  'REUSE-CATALOG.md',
  'JSDOC.md',
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
  reasons.push(...apiDocsStatus(ROOT));
  reasons.push(...wikiStatus(ROOT));
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
