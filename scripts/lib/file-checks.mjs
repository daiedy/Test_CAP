/**
 * Per-file-type quality checks shared by the PostToolUse hook (Edit/Write) and the
 * git-based gates (SubagentStop, Stop), so a file written through Bash is checked too.
 * ADR-0016. Every check is advisory and returns a string note or null. The scopes, the install
 * check and the one JSON-report reader of the linters are exported for the blocking lint gate of
 * SubagentStop (ADR-0029 amendment D-F).
 */
import path from 'node:path';
import fs from 'node:fs';
import { isUnder, run, truncate, findUp, exists } from './hook-utils.mjs';
import {
  stateShapeErrors,
  statePrintedBytes,
  planShapeErrors,
  contextShapeErrors,
  wikiPageShapeErrors,
  STATE_PRINT_BUDGET,
  WIKI_GENERATED_MARK,
} from './doc-shapes.mjs';

const TIMEOUT = 60_000;
const STALE_SCOPE = ['db/**', 'srv/**', 'app/**'];
// An app's package files are not registry sources (sourcesHash in registry-sources.mjs).
const STALE_EXCLUDE = [
  'app/**/webapp/localService/**',
  'app/**/webapp/test/**',
  'app/*/package.json',
  'app/*/package-lock.json',
];
// The UI5 files of the edit checks and of the SubagentStop lint gate (ADR-0029 amendment D): what
// ui5lint lints. Of XML that is views and fragments only (`**/{*.view.xml,*.fragment.xml}` in
// @ui5/linter); a call naming any other XML, such as localService/metadata.xml, fails as a whole.
export const UI5_SCOPE = [
  'app/**/webapp/**/*.{js,html}',
  'app/**/webapp/**/*.{view,fragment}.xml',
  'app/**/webapp/manifest.json',
];
// ADR-0029 decision 7: the app ESLint (JSDoc gate of webapp/ext) runs on the app's own JavaScript.
export const APP_ESLINT_SCOPE = ['webapp/**/*.js'];
export const APP_ESLINT_EXCLUDE = ['webapp/test/**', 'webapp/localService/**'];

function markStale(root, r) {
  const dir = path.join(root, 'docs', 'registry');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, '.stale'), `${new Date().toISOString()} ${r}\n`);
}

function checkCds(root, r) {
  const res = run('npx', ['cds', 'compile', r, '--to', 'json'], { cwd: root, timeoutMs: TIMEOUT });
  if (res.timedOut) return `cds compile ${r}: 60 s limit exceeded.`;
  if (res.code !== 0) return `cds compile ${r} failed:\n${truncate(res.stderr || res.stdout)}`;
  return null;
}

/**
 * Whether the app has `tool` in its own node_modules/.bin. An install in an ancestor directory
 * does not count, and npx would fetch a missing tool from the registry (ADR-0029 amendment F).
 */
export function appHasTool(appDir, tool) {
  return exists(path.join(appDir, 'node_modules', '.bin', tool));
}

/** The note of a skipped check: the app has not installed `tool`. */
export function notInstalledNote(root, appDir, tool) {
  const app = path.relative(root, appDir).split(path.sep).join('/') || '.';
  return `${app}: ${tool} is not installed (no ${app}/node_modules/.bin/${tool}), its check was skipped; run \`npm install\` in ${app}.`;
}

/**
 * The one reader of a linter's JSON report (ESLint, ui5lint) for the edit notes and the SubagentStop
 * gate. A run is clean only when its stdout parses as a report without messages; a run without a
 * report, an empty stdout included, is a failure with the exit code and the end of stderr.
 * @param {{code: number|null, stdout: string, stderr: string, timedOut: boolean}} res the run
 * @param {string} cwd the directory the run started in; ui5lint paths are relative to it
 * @returns {{messages: object[]} | {failure: string}} findings with an absolute `file`, or the failure
 */
export function readLintReport(res, cwd) {
  if (res.timedOut) return { failure: 'failed: time limit exceeded' };
  let report;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    report = null;
  }
  // ESLint: an array with absolute paths; ui5lint: an array or `{ files }`, paths relative to cwd.
  const files = Array.isArray(report) ? report : report?.files;
  if (!Array.isArray(files)) {
    const err = (res.stderr || res.stdout || '').trim() || 'no output';
    const end = err.length > 1000 ? `...${err.slice(-1000)}` : err;
    return { failure: `failed (exit ${res.code}) without a JSON report: ${end}` };
  }
  return {
    messages: files.flatMap((f) =>
      (f.messages || []).map((m) => ({ ...m, file: path.resolve(cwd, f.filePath || '') }))
    ),
  };
}

/** `npx <tool> --format json <targets>` in `cwd`, read by `readLintReport`. */
export function runLinter(tool, cwd, targets, timeoutMs = TIMEOUT) {
  const res = run('npx', [tool, '--format', 'json', ...targets], { cwd, timeoutMs });
  return readLintReport(res, cwd);
}

/** The advisory note of one linted file `r` (repo path); null without findings. */
function lintNote(tool, r, result) {
  if (result.failure) return `${tool} ${r}: ${result.failure}`;
  const msgs = result.messages;
  if (!msgs.length) return null;
  const errors = msgs.filter((m) => m.severity === 2).length;
  const head =
    tool === 'ui5lint'
      ? `${errors} errors, ${msgs.length - errors} warnings`
      : `${msgs.length} findings`;
  const lines = msgs
    .slice(0, 20)
    .map(
      (m) =>
        `  ${m.severity === 2 ? 'error' : 'warn '} ${m.line ?? '?'}:${m.column ?? '?'} ${m.message} (${m.ruleId || 'parse'})`
    );
  return `${tool} ${r}: ${head}\n${lines.join('\n')}`;
}

function checkJs(root, r) {
  const notes = [];
  const fmt = run('npx', ['prettier', '--write', r], { cwd: root, timeoutMs: TIMEOUT });
  if (fmt.code !== 0) notes.push(`prettier ${r}: ${truncate(fmt.stderr || fmt.stdout, 600)}`);
  // The root install is the precondition of every hook: no install check here (amendment F).
  const lint = lintNote('eslint', r, runLinter('eslint', root, [r]));
  if (lint) notes.push(lint);
  return notes;
}

function checkUi5(root, r) {
  const abs = path.resolve(root, r);
  const appDir = findUp(path.dirname(abs), 'ui5.yaml', root);
  if (!appDir) return [];
  const relToApp = path.relative(appDir, abs).split(path.sep).join('/');
  const lint = (tool) =>
    appHasTool(appDir, tool)
      ? lintNote(tool, r, runLinter(tool, appDir, [relToApp]))
      : notInstalledNote(root, appDir, tool);
  const notes = [lint('ui5lint')];
  if (isUnder(relToApp, APP_ESLINT_SCOPE) && !isUnder(relToApp, APP_ESLINT_EXCLUDE))
    notes.push(lint('eslint'));
  return notes.filter(Boolean);
}

// Project language rule (CONVENTIONS, Languages): code and docs are English. Cyrillic is allowed
// only in i18n bundles, .texts.csv data and asserted test values (test files are skipped here).
const CYRILLIC_SCOPE = [
  'db/**',
  'srv/**',
  'app/**/annotations/**',
  'app/**/annotations.cds',
  'app/**/webapp/ext/**',
  'scripts/**',
  'templates/**',
  'docs/**',
  'CLAUDE.md',
  'README.md',
  '.claude/**',
];
const CYRILLIC_EXCLUDE = [
  '**/*_ru.properties',
  '**/*.texts.csv',
  '**/*.snap',
  'docs/ai-pipeline-plan.md',
  'scripts/build-plan-page.py',
  'test/**',
  'app/**/webapp/test/**',
  // quoted rendered UI is the evidence of a verification scenario (CONVENTIONS, Languages)
  'docs/features/*/VERIFICATION.md',
  'app/**/webapp/i18n/**',
  '_i18n/**',
  'docs/registry/**',
];

function checkCyrillic(root, r) {
  if (!isUnder(r, CYRILLIC_SCOPE) || isUnder(r, CYRILLIC_EXCLUDE)) return null;
  const lines = fs.readFileSync(path.resolve(root, r), 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    // skill/agent descriptions keep Russian trigger words in parentheses on purpose
    if (/^description:/.test(l)) return;
    if (/[\u0400-\u04FF]/.test(l)) hits.push(i + 1);
  });
  if (!hits.length) return null;
  const shown = hits.slice(0, 10).join(', ');
  return `Language rule: ${r} contains Cyrillic on line(s) ${shown}${hits.length > 10 ? ` and ${hits.length - 10} more` : ''}. Code, comments and docs must be English (CONVENTIONS, Languages); only i18n bundles, .texts.csv and asserted test values may hold Russian.`;
}

// sap-fe-mockserver (@sap-ux/fe-mockserver-core) iterates every mockdata file with forEach, so a
// singleton fixture is a one-element array too. The object form answers a bare GET correctly and
// throws "tenantJsonData.forEach is not a function" on FE's $batch path (measured 2026-09-16,
// catalog-authorization scenario 6: Create and Delete stayed, Edit vanished).
function checkMockdata(root, r) {
  if (!isUnder(r, ['app/**/webapp/localService/mockdata/*.json'])) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.resolve(root, r), 'utf8'));
  } catch (e) {
    return `${r}: not valid JSON (${e.message}).`;
  }
  if (Array.isArray(data)) return null;
  return `${r}: mock data must be a JSON array, also for a singleton (\`[{ ... }]\`): sap-fe-mockserver calls forEach on the file, and an object form throws on the $batch path Fiori elements uses while a bare GET still looks fine (rule ui5-webapp.md).`;
}

// Lessons turned into checks (docs/LESSONS.md triage, 2026-09-07).
function checkSandboxHtml(root, r) {
  if (!/webapp\/(test\/)?(flpSandbox|index)\.html$/.test(r)) return null;
  const html = fs.readFileSync(path.resolve(root, r), 'utf8');
  const notes = [];
  if (/ushell\/bootstrap\/sandbox\.js/.test(html) && !/id="sap-ushell-bootstrap"/.test(html)) {
    notes.push(
      `${r}: the sandbox bootstrap <script> needs id="sap-ushell-bootstrap"; without it sandbox.js takes the last script tag (livereload) and the config URL breaks on :8080.`
    );
  }
  return notes.length ? notes.join('\n') : null;
}

function checkSandboxConfig(root, r) {
  if (!/webapp\/(test\/flpSandboxConfig|sandboxConfig)\.js$/.test(r)) return null;
  const src = fs.readFileSync(path.resolve(root, r), 'utf8');
  const notes = [];
  if (/"url":\s*"\/products\/webapp"/.test(src))
    notes.push(
      `${r}: the app intent url must be relative ("../" or "./"), an absolute /products/webapp only works behind CAP.`
    );
  if (/"LaunchPage"/.test(src))
    notes.push(
      `${r}: tile groups belong in webapp/appconfig/fioriSandboxConfig.json (merged last); a LaunchPage block here is overridden by the SAP demo tiles.`
    );
  return notes.length ? notes.join('\n') : null;
}

function checkUi5Yaml(root, r) {
  if (!/app\/[^/]+\/ui5[^/]*\.ya?ml$/.test(r)) return null;
  const appDir = path.dirname(path.resolve(root, r));
  const yaml = fs.readFileSync(path.resolve(root, r), 'utf8');
  const known = {
    'fiori-tools-proxy': '@sap/ux-ui5-tooling',
    'fiori-tools-appreload': '@sap/ux-ui5-tooling',
    'sap-fe-mockserver': '@sap-ux/ui5-middleware-fe-mockserver',
  };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const ui5deps = (pkg.ui5 && pkg.ui5.dependencies) || [];
  const notes = [];
  for (const m of yaml.matchAll(/^\s*-\s*name:\s*([\w-]+)/gm)) {
    const name = m[1];
    const provider = known[name];
    if (!provider) continue;
    if (!deps[provider])
      notes.push(`${r}: middleware "${name}" needs "${provider}" in devDependencies.`);
    else if (!ui5deps.includes(provider))
      notes.push(
        `${r}: "${provider}" must also be listed in package.json > ui5.dependencies, otherwise the UI5 tooling does not load "${name}".`
      );
  }
  return notes.length ? notes.join('\n') : null;
}

function checkTemplateNamespace(root, r) {
  if (!/^templates\/.*\.cds$/.test(r)) return null;
  const src = fs.readFileSync(path.resolve(root, r), 'utf8');
  const m = src.match(/^namespace\s+([\w.]+)\s*;/m);
  if (!m)
    return `${r}: a standalone .cds template needs its own namespace (my.catalog.tpl.<name>); cds-mcp compiles every .cds in the project and fails on duplicate definitions.`;
  const dir = path.join(root, 'templates');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.cds') || path.join(dir, f) === path.resolve(root, r)) continue;
    const other = fs.readFileSync(path.join(dir, f), 'utf8').match(/^namespace\s+([\w.]+)\s*;/m);
    if (other && other[1] === m[1])
      return `${r}: namespace ${m[1]} is also used by templates/${f}; templates must not share a namespace.`;
  }
  return null;
}

function readKeys(file) {
  if (!exists(file)) return null;
  const keys = new Set();
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const m = line.match(/^([^=:\s]+)\s*[=:]/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function checkI18n(root, r) {
  const dir = path.dirname(path.resolve(root, r));
  const base = path.basename(r);
  const isBundle = /^(i18n|messages)(_[a-z]{2}(_[A-Z]{2})?)?\.properties$/.test(base);
  if (!isBundle) return null;
  const family = base.replace(/(_[a-z]{2}(_[A-Z]{2})?)?\.properties$/, '');
  const en = readKeys(path.join(dir, `${family}.properties`));
  const ru = readKeys(path.join(dir, `${family}_ru.properties`));
  if (!en || !ru)
    return `i18n: ${path.relative(root, dir)} lacks the pair ${family}.properties and ${family}_ru.properties.`;
  const missingRu = [...en].filter((k) => !ru.has(k));
  const missingEn = [...ru].filter((k) => !en.has(k));
  if (!missingRu.length && !missingEn.length) return null;
  const parts = [];
  if (missingRu.length) parts.push(`missing in ${family}_ru.properties: ${missingRu.join(', ')}`);
  if (missingEn.length) parts.push(`missing in ${family}.properties: ${missingEn.join(', ')}`);
  return `i18n ${path.relative(root, dir)}: ${parts.join('; ')}`;
}

// ADR-0018: the documents every agent reads keep a shape, so narrative cannot accumulate in them.
function checkDocShapes(root, r) {
  const text = () => fs.readFileSync(path.resolve(root, r), 'utf8');
  if (r === 'docs/STATE.md') {
    const errors = stateShapeErrors(text());
    const bytes = statePrintedBytes(text());
    if (bytes > STATE_PRINT_BUDGET)
      errors.push(
        `Now plus Open debt is ${bytes} bytes, budget ${STATE_PRINT_BUDGET}: shorten, or move items to docs/CHANGELOG.md`
      );
    return errors.length
      ? `docs/STATE.md must keep the shape of templates/STATE.md (ADR-0018); the Stop gate blocks until it does:\n  ${errors.join('\n  ')}`
      : null;
  }
  // ADR-0030 decision 6: a wiki page keeps its folder's shape; generated files and _*.md are no pages.
  if (isUnder(r, ['docs/wiki/**/*.md'])) {
    const t = text();
    if (path.posix.basename(r).startsWith('_') || t.startsWith(WIKI_GENERATED_MARK)) return null;
    const errors = wikiPageShapeErrors(t, r);
    return errors.length
      ? `${r} must keep the page shape of its wiki folder (ADR-0030 decision 1); node scripts/check-docs-fresh.mjs blocks until it does:\n  ${errors.join('\n  ')}`
      : null;
  }
  const m = r.match(/^docs\/features\/[^/]+\/(PLAN|CONTEXT)\.md$/);
  if (!m) return null;
  const errors = m[1] === 'PLAN' ? planShapeErrors(text()) : contextShapeErrors(text());
  return errors.length
    ? `${r} must keep the shape of templates/feature/${m[1]}.md (ADR-0018); the phase 1 gate runs node scripts/check-feature-docs.mjs:\n  ${errors.join('\n  ')}`
    : null;
}

/**
 * Runs every check that applies to one repo-relative file and returns the notes.
 * markRegistryStale=false is used by the late gates, where the marker is already set.
 */
export function runFileChecks(root, r, { markRegistryStale = true } = {}) {
  const notes = [];
  if (!exists(path.resolve(root, r))) return notes;

  if (r.endsWith('.cds')) {
    const n = checkCds(root, r);
    if (n) notes.push(n);
  } else if (isUnder(r, ['srv/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'])) {
    notes.push(...checkJs(root, r));
  } else if (isUnder(r, UI5_SCOPE)) {
    notes.push(...checkUi5(root, r));
  }
  if (isUnder(r, ['_i18n/**/*.properties', 'app/**/webapp/i18n/**/*.properties'])) {
    const n = checkI18n(root, r);
    if (n) notes.push(n);
  }
  {
    const n = checkCyrillic(root, r);
    if (n) notes.push(n);
  }
  for (const check of [
    checkSandboxHtml,
    checkSandboxConfig,
    checkUi5Yaml,
    checkTemplateNamespace,
    checkMockdata,
    checkDocShapes,
  ]) {
    const n = check(root, r);
    if (n) notes.push(n);
  }

  if (isUnder(r, STALE_SCOPE) && !isUnder(r, STALE_EXCLUDE)) {
    if (markRegistryStale) markStale(root, r);
    notes.push(
      'The docs/registry registry is marked stale; before finishing the task run `npm run docs:registry` and update docs/STATE.md and docs/CHANGELOG.md.'
    );
  }
  return notes;
}
