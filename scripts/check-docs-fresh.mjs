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
    reasons.push('присутствует маркер docs/registry/.stale');
  for (const f of FILES) {
    const rec = recordedHash(join(REGISTRY, f));
    if (!rec) reasons.push(`${f}: файл отсутствует или без заголовка генератора`);
    else if (rec !== current)
      reasons.push(`${f}: хеш ${rec} не совпадает с текущими исходниками ${current}`);
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
    console.error('Регенерация реестра не удалась.');
    process.exit(1);
  }
  reasons = status();
}
if (reasons.length) {
  console.error('Реестр документации устарел:');
  for (const r of reasons) console.error(`  - ${r}`);
  console.error('Запусти: npm run docs:registry (или node scripts/check-docs-fresh.mjs --fix)');
  process.exit(1);
}
console.log('docs/registry актуален.');
