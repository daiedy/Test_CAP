#!/usr/bin/env node
// Generates docs/api/<Service>.openapi3.json from the CDS model (ADR-0029 decision 4): the project's
// pinned OpenAPI converter (root devDependency @cap-js/openapi 1.6.0, ADR-0029 amendment A; the
// cds CLI prefers this project-local copy over the one bundled with @sap/cds-dk), English texts
// (-l en), one file per service. The server URL
// comes from the converter and the service's @protocol, never from a path formula here. Every file
// is stamped with the registry sources hash in info['x-sources'], which check-docs-fresh.mjs reads.
// Output is overwritten; never edit it by hand. Run: npm run docs:api (alone) or
// npm run docs:registry (together with docs/registry).
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourcesHash } from './lib/registry-sources.mjs';

/** Folder of the generated OpenAPI documents, relative to the project root. */
export const API_DIR = 'docs/api';
const SUFFIX = '.openapi3.json';

const rel = (root, file) => relative(root, file).split(sep).join('/');
const documentsIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(SUFFIX))
        .sort()
        .map((name) => join(dir, name))
    : [];

/**
 * Stamp an OpenAPI document with the sources hash and serialize it the way it is committed:
 * `info['x-sources']` after the converter's info fields, two-space JSON, trailing newline.
 * @param {string} json the converter's output
 * @param {string} hash sources hash of scripts/lib/registry-sources.mjs
 * @returns {string} the file content
 */
export function stampOpenApi(json, hash) {
  const doc = JSON.parse(json);
  doc.info = { ...doc.info, 'x-sources': hash };
  return JSON.stringify(doc, null, 2) + '\n';
}

/**
 * Export every service of srv/ to `docs/api/<Service>.openapi3.json` and stamp each file; a
 * document of a service that no longer exists is removed.
 * @param {string} root project root
 * @param {string} hash sources hash to record in `info['x-sources']`
 * @returns {Array<string>} the written files, relative to the root
 */
export function writeOpenApi(root, hash) {
  const r = spawnSync(
    'npx',
    ['cds', 'compile', 'srv', '--to', 'openapi', '-l', 'en', '-s', 'all', '-o', API_DIR],
    { cwd: root, encoding: 'utf8', timeout: 120000 }
  );
  if (r.status !== 0) {
    throw new Error(`cds compile --to openapi failed: ${r.stderr || r.error?.message || r.status}`);
  }
  // The CLI prints one path per written file; compare by name, the printed form of the folder may
  // differ from `root` (relative, symlinked temp folders).
  const names = r.stdout
    .split('\n')
    .map((line) => basename(line.trim()))
    .filter((name) => name.endsWith(SUFFIX));
  if (!names.length) throw new Error('cds compile --to openapi wrote no document');
  const dir = join(root, API_DIR);
  for (const name of names) {
    const file = join(dir, name);
    writeFileSync(file, stampOpenApi(readFileSync(file, 'utf8'), hash));
  }
  for (const file of documentsIn(dir)) {
    if (!names.includes(basename(file))) rmSync(file);
  }
  return names.map((name) => `${API_DIR}/${name}`);
}

/**
 * Read the sources hash an OpenAPI document was generated from.
 * @param {string} file path of the document
 * @returns {string|null} `info['x-sources']`, or null when the file is missing, unreadable or
 *   carries no stamp
 */
export function openapiRecordedHash(file) {
  if (!existsSync(file)) return null;
  try {
    const stamp = JSON.parse(readFileSync(file, 'utf8')).info?.['x-sources'];
    return typeof stamp === 'string' && /^[0-9a-f]{16}$/.test(stamp) ? stamp : null;
  } catch {
    return null;
  }
}

/**
 * Freshness of the generated OpenAPI documents against the current sources.
 * @param {string} root project root
 * @returns {Array<string>} one reason per missing, unstamped or stale document; empty when fresh
 */
export function apiDocsStatus(root) {
  const files = documentsIn(join(root, API_DIR));
  if (!files.length) return [`${API_DIR}: no OpenAPI document (*${SUFFIX}) is present`];
  const current = sourcesHash(root);
  const reasons = [];
  for (const file of files) {
    const recorded = openapiRecordedHash(file);
    if (!recorded) reasons.push(`${rel(root, file)}: no info['x-sources'] stamp`);
    else if (recorded !== current) {
      reasons.push(
        `${rel(root, file)}: x-sources ${recorded} does not match the current sources ${current}`
      );
    }
  }
  return reasons;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = process.cwd();
  const HASH = sourcesHash(ROOT);
  try {
    const files = writeOpenApi(ROOT, HASH);
    console.log(`${files.join(', ')} updated (sources ${HASH}).`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
