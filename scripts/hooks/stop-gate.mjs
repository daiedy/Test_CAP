/**
 * Stop hook: the session may not end with changed code unless
 *   1. docs/registry is fresh (auto-regenerated via scripts/check-docs-fresh.mjs --fix),
 *   2. docs/STATE.md and docs/CHANGELOG.md were updated,
 *   3. `npm test` passes (skipped with a note while test/ does not exist).
 * Gate state (hash of the porcelain status at the last successful gate) lives in
 * .claude/.gate-state.json so an unchanged tree passes instantly.
 * Bypass: PIPELINE_SKIP_GATE=1. Loop guard: stop_hook_active.
 */
import path from 'node:path';
import fs from 'node:fs';
import {
  readStdinJson,
  repoRoot,
  run,
  sha256,
  lastLines,
  exists,
  truncate,
} from '../lib/hook-utils.mjs';

const CODE_PATHS = ['db', 'srv', 'app', 'test', '_i18n'];
const TEST_TIMEOUT = 10 * 60 * 1000;

function porcelain(root, paths) {
  const res = run('git', ['status', '--porcelain', '-uall', '--', ...paths], {
    cwd: root,
    timeoutMs: 20_000,
  });
  return res.code === 0 ? res.stdout : '';
}

function block(msg) {
  process.stderr.write(msg.trimEnd() + '\n');
  process.exit(2);
}

try {
  const input = readStdinJson();
  if (input.stop_hook_active === true) process.exit(0);
  if (process.env.PIPELINE_SKIP_GATE === '1') {
    process.stdout.write('Stop gate skipped (PIPELINE_SKIP_GATE=1).\n');
    process.exit(0);
  }

  const root = repoRoot();
  const stateFile = path.join(root, '.claude', '.gate-state.json');
  const codeStatus = porcelain(root, CODE_PATHS);
  const hash = sha256(codeStatus);
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    saved = null;
  }

  if (!codeStatus.trim() || saved?.hash === hash) {
    process.exit(0);
  }

  const notes = [];

  // 1. Registry freshness
  const checker = path.join(root, 'scripts', 'check-docs-fresh.mjs');
  if (exists(checker)) {
    const fresh = run('node', [checker], { cwd: root, timeoutMs: 120_000 });
    if (fresh.code !== 0) {
      const fix = run('node', [checker, '--fix'], { cwd: root, timeoutMs: 180_000 });
      if (fix.code !== 0) {
        block(
          `The documentation registry is stale and automatic regeneration failed:\n${truncate(fix.stderr || fix.stdout, 1200)}\nRun \`npm run docs:registry\` and fix the error.`
        );
      }
      notes.push('The docs/registry registry was regenerated automatically.');
    }
  } else {
    notes.push('scripts/check-docs-fresh.mjs is missing: registry freshness check skipped.');
  }

  // 2. STATE.md and CHANGELOG.md must be touched when code changed
  const docsStatus = porcelain(root, ['docs/STATE.md', 'docs/CHANGELOG.md']);
  const touched = new Set(
    docsStatus
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim())
  );
  const missing = ['docs/STATE.md', 'docs/CHANGELOG.md'].filter((f) => !touched.has(f));
  if (missing.length) {
    block(
      `Code changed (db/, srv/, app/, test/, _i18n/), but not updated: ${missing.join(', ')}.\n` +
        'Update docs/STATE.md (current position, open debt) and docs/CHANGELOG.md (what changed), then finish the work.'
    );
  }

  // 3. Tests
  const testDir = path.join(root, 'test');
  const hasTests =
    exists(testDir) && fs.readdirSync(testDir).some((f) => /\.test\.(m?js|ts)$/.test(f));
  if (hasTests) {
    const tests = run('npm', ['test', '--silent'], { cwd: root, timeoutMs: TEST_TIMEOUT });
    if (tests.timedOut)
      block(
        'npm test did not finish within 10 minutes. Sort out the hanging tests and finish again.'
      );
    if (tests.code !== 0) {
      block(
        `npm test failed (exit code ${tests.code}). Last lines of the output:\n${lastLines(tests.stdout + '\n' + tests.stderr, 40)}\nFix the tests or the code and finish again.`
      );
    }
    notes.push('npm test: passed.');
  } else {
    notes.push(
      'The test/ directory has no tests: test run skipped. Add tests for the changed code.'
    );
  }

  // Lessons inbox size (advisory): docs/LESSONS.md should hold only untransferred lessons.
  const lessons = path.join(root, 'docs', 'LESSONS.md');
  if (exists(lessons)) {
    const pending = (fs.readFileSync(lessons, 'utf8').match(/^## /gm) || []).length;
    if (pending > 10)
      notes.push(
        `docs/LESSONS.md holds ${pending} entries; run /retro to move them into rules, hooks, tests or agent prompts.`
      );
  }

  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ hash, at: new Date().toISOString() }, null, 2) + '\n'
  );
  process.stdout.write(`Stop gate passed. ${notes.join(' ')}\n`);
  process.exit(0);
} catch (e) {
  process.stderr.write(`stop-gate hook: internal error (${e.message}); gate skipped.\n`);
  process.exit(0);
}
