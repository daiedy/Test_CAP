/**
 * SubagentStop hook: a subagent may not finish while changed files have lint ERRORS.
 * Warnings pass. Exit 2 blocks with a Russian summary on stderr.
 */
import path from 'node:path';
import fs from 'node:fs';
import {
  repoRoot,
  changedFiles,
  isUnder,
  run,
  truncate,
  findUp,
  readStdinJson,
  exists,
} from '../lib/hook-utils.mjs';

const TIMEOUT = 150_000;

function eslintErrors(root, files) {
  if (!files.length) return [];
  const res = run('npx', ['eslint', '--format', 'json', ...files], {
    cwd: root,
    timeoutMs: TIMEOUT,
  });
  if (res.timedOut) return ['eslint: превышен лимит времени'];
  try {
    const report = JSON.parse(res.stdout || '[]');
    return report.flatMap((f) =>
      (f.messages || [])
        .filter((m) => m.severity === 2)
        .map(
          (m) =>
            `${path.relative(root, f.filePath)}:${m.line}:${m.column} ${m.message} (${m.ruleId || 'parse'})`
        )
    );
  } catch {
    return res.code !== 0 && res.code !== 1
      ? [`eslint: ${truncate(res.stderr || res.stdout, 600)}`]
      : [];
  }
}

function ui5Errors(root, files) {
  const byApp = new Map();
  for (const f of files) {
    const appDir = findUp(path.dirname(path.resolve(root, f)), 'ui5.yaml', root);
    if (!appDir) continue;
    if (!byApp.has(appDir)) byApp.set(appDir, []);
    byApp.get(appDir).push(path.relative(appDir, path.resolve(root, f)).split(path.sep).join('/'));
  }
  const errors = [];
  for (const [appDir, rels] of byApp) {
    const res = run('npx', ['ui5lint', '--format', 'json', ...rels], {
      cwd: appDir,
      timeoutMs: TIMEOUT,
    });
    if (res.timedOut) {
      errors.push(`ui5lint (${path.relative(root, appDir)}): превышен лимит времени`);
      continue;
    }
    try {
      const report = JSON.parse(res.stdout || '[]');
      const list = Array.isArray(report) ? report : report.files || [];
      for (const f of list) {
        for (const m of f.messages || []) {
          if (m.severity === 2)
            errors.push(
              `${path.relative(root, path.resolve(appDir, f.filePath))}:${m.line ?? '?'}:${m.column ?? '?'} ${m.message} (${m.ruleId})`
            );
        }
      }
    } catch {
      if (res.code !== 0)
        errors.push(
          `ui5lint (${path.relative(root, appDir)}): ${truncate(res.stderr || res.stdout, 600)}`
        );
    }
  }
  return errors;
}

try {
  readStdinJson();
  const root = repoRoot();
  const changed = changedFiles(root)
    .filter((c) => c.status !== 'D' && !c.status.startsWith('D'))
    .map((c) => c.path)
    .filter((p) => exists(path.resolve(root, p)) && fs.statSync(path.resolve(root, p)).isFile());

  const cdsAndSrv = changed.filter(
    (p) => p.endsWith('.cds') || isUnder(p, ['srv/**/*.js', 'test/**/*.js'])
  );
  const ui5 = changed.filter((p) =>
    isUnder(p, ['app/**/webapp/**/*.{js,xml,html}', 'app/**/webapp/manifest.json'])
  );

  const errors = [...eslintErrors(root, cdsAndSrv), ...ui5Errors(root, ui5)];
  if (errors.length) {
    process.stderr.write(
      `Субагент не может завершить работу: ${errors.length} ошибок линтера в изменённых файлах. Исправь их и заверши снова.\n` +
        errors.slice(0, 30).join('\n') +
        '\n'
    );
    process.exit(2);
  }
} catch (e) {
  process.stderr.write(
    `subagent-stop hook: внутренняя ошибка (${e.message}), проверка пропущена.\n`
  );
}
process.exit(0);
