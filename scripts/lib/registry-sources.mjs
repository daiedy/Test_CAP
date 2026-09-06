// Shared source discovery and hashing for the generated registry (docs/registry).
// Used by scripts/gen-registry.mjs and scripts/check-docs-fresh.mjs.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'gen',
  'localService',
  'test',
  '.git',
  'coverage',
]);

/** Recursively list files under dir, skipping build and test folders. */
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

/** Source files whose content defines the registry: model, services, annotations, UI artifacts, i18n. */
export function collectSourceFiles(root) {
  const files = [
    ...walk(join(root, 'db')),
    ...walk(join(root, 'srv')),
    ...walk(join(root, '_i18n')),
  ];
  const appDir = join(root, 'app');
  if (existsSync(appDir)) {
    for (const app of readdirSync(appDir)) {
      const base = join(appDir, app);
      if (!statSync(base).isDirectory()) continue;
      for (const f of walk(base)) {
        const rel = relative(base, f).split(sep).join('/');
        const keep =
          rel.endsWith('.cds') ||
          rel === 'webapp/manifest.json' ||
          rel.startsWith('webapp/ext/') ||
          rel.startsWith('webapp/model/') ||
          rel.startsWith('webapp/i18n/') ||
          rel.endsWith('.fragment.xml') ||
          rel.endsWith('.view.xml') ||
          rel === 'webapp/Component.js';
        if (keep) files.push(f);
      }
    }
  }
  return files.filter((f) => !f.endsWith('.csv') && !f.endsWith('.DS_Store')).sort();
}

/** Stable hash of all registry sources (paths + contents). */
export function sourcesHash(root) {
  const h = createHash('sha256');
  for (const f of collectSourceFiles(root)) {
    h.update(relative(root, f).split(sep).join('/'));
    h.update('\n');
    h.update(readFileSync(f));
    h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}

/** Read the sources hash recorded in a generated registry file header, or null. */
export function recordedHash(file) {
  if (!existsSync(file)) return null;
  const first = readFileSync(file, 'utf8').split('\n')[0];
  const m = first.match(/sources:\s*([0-9a-f]{16})/);
  return m ? m[1] : null;
}
