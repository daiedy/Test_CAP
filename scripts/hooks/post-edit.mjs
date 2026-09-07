/**
 * PostToolUse hook (Edit|Write|MultiEdit): advisory quality checks on the edited file.
 * - *.cds: cds compile (syntax), marks registry stale
 * - srv/test/scripts JS: prettier --write, eslint
 * - app/**\/webapp files: ui5lint (JSON), from the nearest dir with ui5.yaml
 * - i18n bundles: key parity between i18n.properties and i18n_ru.properties
 * Always exits 0; findings are returned as additionalContext.
 */
import path from 'node:path';
import fs from 'node:fs';
import {
  readStdinJson,
  repoRoot,
  rel,
  insideRepo,
  isUnder,
  run,
  emitJson,
  truncate,
  findUp,
  exists,
} from '../lib/hook-utils.mjs';

const TIMEOUT = 60_000;
const STALE_SCOPE = ['db/**', 'srv/**', 'app/**'];
const STALE_EXCLUDE = ['app/**/webapp/localService/**', 'app/**/webapp/test/**'];

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

function checkJs(root, r) {
  const notes = [];
  const fmt = run('npx', ['prettier', '--write', r], { cwd: root, timeoutMs: TIMEOUT });
  if (fmt.code !== 0) notes.push(`prettier ${r}: ${truncate(fmt.stderr || fmt.stdout, 600)}`);
  const lint = run('npx', ['eslint', '--format', 'json', r], { cwd: root, timeoutMs: TIMEOUT });
  if (lint.timedOut) return notes.concat('eslint: 60 s limit exceeded.');
  try {
    const report = JSON.parse(lint.stdout || '[]');
    const msgs = report.flatMap((f) => f.messages || []);
    if (msgs.length) {
      const lines = msgs
        .slice(0, 20)
        .map(
          (m) =>
            `  ${m.severity === 2 ? 'error' : 'warn '} ${m.line}:${m.column} ${m.message} (${m.ruleId || 'parse'})`
        );
      notes.push(`eslint ${r}: ${msgs.length} findings\n${lines.join('\n')}`);
    }
  } catch {
    if (lint.code !== 0) notes.push(`eslint ${r}: ${truncate(lint.stderr || lint.stdout, 800)}`);
  }
  return notes;
}

function checkUi5(root, r) {
  const abs = path.resolve(root, r);
  const appDir = findUp(path.dirname(abs), 'ui5.yaml', root);
  if (!appDir) return null;
  const relToApp = path.relative(appDir, abs).split(path.sep).join('/');
  const res = run('npx', ['ui5lint', '--format', 'json', relToApp], {
    cwd: appDir,
    timeoutMs: TIMEOUT,
  });
  if (res.timedOut) return `ui5lint ${r}: 60 s limit exceeded.`;
  try {
    const report = JSON.parse(res.stdout || '[]');
    const files = Array.isArray(report) ? report : report.files || [];
    const msgs = files.flatMap((f) => f.messages || []);
    if (!msgs.length) return null;
    const errors = msgs.filter((m) => m.severity === 2).length;
    const lines = msgs
      .slice(0, 20)
      .map(
        (m) =>
          `  ${m.severity === 2 ? 'error' : 'warn '} ${m.line ?? '?'}:${m.column ?? '?'} ${m.message} (${m.ruleId})`
      );
    return `ui5lint ${r}: ${errors} errors, ${msgs.length - errors} warnings\n${lines.join('\n')}`;
  } catch {
    return res.code !== 0 ? `ui5lint ${r}: ${truncate(res.stderr || res.stdout, 800)}` : null;
  }
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

try {
  const input = readStdinJson();
  const filePath = input.tool_input?.file_path;
  if (!filePath) process.exit(0);
  const root = repoRoot();
  const r = rel(filePath, root);
  if (!insideRepo(r) || !exists(path.resolve(root, r))) process.exit(0);

  const notes = [];
  if (r.endsWith('.cds')) {
    const n = checkCds(root, r);
    if (n) notes.push(n);
  } else if (isUnder(r, ['srv/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'])) {
    notes.push(...checkJs(root, r));
  } else if (isUnder(r, ['app/**/webapp/**/*.{js,xml,html}', 'app/**/webapp/manifest.json'])) {
    const n = checkUi5(root, r);
    if (n) notes.push(n);
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
  ]) {
    const n = check(root, r);
    if (n) notes.push(n);
  }

  if (isUnder(r, STALE_SCOPE) && !isUnder(r, STALE_EXCLUDE)) {
    markStale(root, r);
    notes.push(
      'The docs/registry registry is marked stale; before finishing the task run `npm run docs:registry` and update docs/STATE.md and docs/CHANGELOG.md.'
    );
  }

  if (notes.length) {
    emitJson({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n\n') },
    });
  }
} catch {
  // advisory hook
}
process.exit(0);
