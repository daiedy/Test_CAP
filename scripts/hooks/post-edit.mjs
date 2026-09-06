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
  if (res.timedOut) return `cds compile ${r}: превышен лимит 60 с.`;
  if (res.code !== 0)
    return `cds compile ${r} завершился с ошибкой:\n${truncate(res.stderr || res.stdout)}`;
  return null;
}

function checkJs(root, r) {
  const notes = [];
  const fmt = run('npx', ['prettier', '--write', r], { cwd: root, timeoutMs: TIMEOUT });
  if (fmt.code !== 0) notes.push(`prettier ${r}: ${truncate(fmt.stderr || fmt.stdout, 600)}`);
  const lint = run('npx', ['eslint', '--format', 'json', r], { cwd: root, timeoutMs: TIMEOUT });
  if (lint.timedOut) return notes.concat('eslint: превышен лимит 60 с.');
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
      notes.push(`eslint ${r}: ${msgs.length} замечаний\n${lines.join('\n')}`);
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
  if (res.timedOut) return `ui5lint ${r}: превышен лимит 60 с.`;
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
    return `ui5lint ${r}: ${errors} ошибок, ${msgs.length - errors} предупреждений\n${lines.join('\n')}`;
  } catch {
    return res.code !== 0 ? `ui5lint ${r}: ${truncate(res.stderr || res.stdout, 800)}` : null;
  }
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
    return `i18n: в ${path.relative(root, dir)} нет пары ${family}.properties и ${family}_ru.properties.`;
  const missingRu = [...en].filter((k) => !ru.has(k));
  const missingEn = [...ru].filter((k) => !en.has(k));
  if (!missingRu.length && !missingEn.length) return null;
  const parts = [];
  if (missingRu.length) parts.push(`нет в ${family}_ru.properties: ${missingRu.join(', ')}`);
  if (missingEn.length) parts.push(`нет в ${family}.properties: ${missingEn.join(', ')}`);
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

  if (isUnder(r, STALE_SCOPE) && !isUnder(r, STALE_EXCLUDE)) {
    markStale(root, r);
    notes.push(
      'Реестр docs/registry помечен устаревшим; перед завершением задачи выполни `npm run docs:registry` и обнови docs/STATE.md и docs/CHANGELOG.md.'
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
