/**
 * Stop hook: the session may not end with changed code unless
 *   1. docs/registry is fresh (auto-regenerated via scripts/check-docs-fresh.mjs --fix),
 *   2. docs/STATE.md and docs/CHANGELOG.md were updated,
 *   3. `npm test` passes (skipped with a note while test/ does not exist).
 * Gate state (hash of the porcelain status at the last successful gate) lives in
 * .claude/.gate-state.json so an unchanged tree passes instantly.
 *   4. no protected file was changed outside the sanctioned route (ADR-0016 backstop, whatever wrote it);
 *      generated files (docs/registry/**) are covered by check 1 instead, so the generator's own
 *      output never trips check 4 (ADR-0017).
 *   5. docs/STATE.md keeps the shape of templates/STATE.md whenever it changed (ADR-0018).
 * Advice, never a block (ADR-0023): `## Now` of docs/STATE.md drifting from git (branch, last
 * commit) is reported once per drift key through `additionalContext` on exit 0; so is the
 * docs/LESSONS.md inbox holding more than LESSONS_MAX pending entries, at every full pass.
 * Bypass: PIPELINE_SKIP_GATE=1. Loop guard: stop_hook_active.
 * Metrics (ADR-0022): every block appends `{ event: 'gate', hook: 'stop-gate', reason }`, and every
 * run ends with one `{ event: 'turn-end', blocked }`; the drift advice is not a block.
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
  changedFiles,
  emitJson,
} from '../lib/hook-utils.mjs';
import { protectedWriteHit, reasonFor } from '../lib/protected-paths.mjs';
import { stateShapeErrors, statePrintedBytes, STATE_PRINT_BUDGET } from '../lib/doc-shapes.mjs';
import { appendMetric, recordGate } from '../lib/metrics-log.mjs';
import {
  projectNow,
  stateDrift,
  driftKey,
  readDriftKey,
  writeDriftKey,
} from '../lib/state-now.mjs';
import { loadBundle, renderDriftLine } from '../lib/backlog.mjs';

const CODE_PATHS = ['db', 'srv', 'app', 'test', '_i18n'];
const TEST_TIMEOUT = 10 * 60 * 1000;
const HOOK = 'stop-gate';
/** docs/LESSONS.md is an inbox: more pending one-line entries than this asks for /retro. */
const LESSONS_MAX = 10;

let input = {};

// One `turn-end` per Stop, whichever exit path ends the run; exit code 2 is a block.
process.on('exit', (code) => {
  try {
    appendMetric(repoRoot(), input.session_id, { event: 'turn-end', blocked: code === 2 });
  } catch {
    // metrics are best effort
  }
});

function porcelain(root, paths) {
  const res = run('git', ['status', '--porcelain', '-uall', '--', ...paths], {
    cwd: root,
    timeoutMs: 20_000,
  });
  return res.code === 0 ? res.stdout : '';
}

/** Blocks the stop; `reason` is one of GATE_REASONS (scripts/lib/metrics-log.mjs). */
function block(reason, msg) {
  recordGate(input, HOOK, reason);
  process.stderr.write(msg.trimEnd() + '\n');
  process.exit(2);
}

/**
 * The STATE drift advice when the drift key is not recorded yet (SessionStart records the drift
 * it printed), else null. English: the text is for Claude, not the user. Never throws.
 */
function driftAdvice(root) {
  try {
    const now = projectNow(root);
    const key = driftKey(now);
    if (!key || key === readDriftKey(root)) return null;
    const line = renderDriftLine(loadBundle('en', root), stateDrift(now));
    return {
      key,
      text:
        `Stop hook advice (ADR-0023, once per drift, nothing is blocked): ${line} ` +
        `Git now: branch ${now.branch}, HEAD ${now.lastCommit}.`,
    };
  } catch {
    return null;
  }
}

/**
 * The LESSONS inbox note when docs/LESSONS.md holds more than LESSONS_MAX pending entries (one
 * list item per entry, `- <date>. <title>. Status: Pending ...`; headings and the transferred
 * section do not count), else null. Never throws.
 */
function lessonsNote(root) {
  try {
    const lessons = path.join(root, 'docs', 'LESSONS.md');
    if (!exists(lessons)) return null;
    const pending = (fs.readFileSync(lessons, 'utf8').match(/^- .*\bPending\b/gm) || []).length;
    if (pending <= LESSONS_MAX) return null;
    return (
      `docs/LESSONS.md holds ${pending} pending entries (limit ${LESSONS_MAX}); ` +
      'run /retro to move them into rules, hooks, tests or agent prompts.'
    );
  } catch {
    return null;
  }
}

/**
 * Ends the run unblocked. Plain stdout of a Stop hook reaches only the debug log, so the drift
 * advice and the LESSONS note go to Claude as `additionalContext` (exit 0, under the
 * stop_hook_active loop guard), one per line, and the drift key is recorded; without any advice
 * `text` goes to stdout as before.
 */
function pass(root, advice, note = null, text = '') {
  const context = [advice?.text, note].filter(Boolean).join('\n');
  if (context) {
    if (advice) writeDriftKey(root, advice.key);
    emitJson({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: context } });
  } else if (text) {
    process.stdout.write(text);
  }
  process.exit(0);
}

try {
  input = readStdinJson();
  if (input.stop_hook_active === true) process.exit(0);
  if (process.env.PIPELINE_SKIP_GATE === '1') {
    process.stdout.write('Stop gate skipped (PIPELINE_SKIP_GATE=1).\n');
    process.exit(0);
  }

  const root = repoRoot();

  // ADR-0016 backstop: a protected file may have been written through Bash, which neither
  // protect-files.mjs nor post-edit.mjs can see. git shows the result whoever wrote it.
  const protectedChanged = changedFiles(root)
    .filter((c) => !c.status.startsWith('D'))
    .map((c) => ({ p: c.path, untracked: c.status === '??', hit: protectedWriteHit(root, c.path) }))
    .filter((x) => x.hit);
  if (protectedChanged.length) {
    // A branch name is not a boundary (any agent can create `chore/x`); only the user-held
    // environment variable counts as sanction (ADR-0016).
    if (process.env.PIPELINE_ALLOW_PROTECTED !== '1') {
      // `git checkout --` cannot revert an untracked entry, and the advice invited deleting it,
      // though it may be another session's or a tool's work (ADR-0023).
      const changed = protectedChanged.filter((x) => !x.untracked);
      const untracked = protectedChanged.filter((x) => x.untracked);
      const steps = [];
      if (changed.length) steps.push('Revert the changed ones (`git checkout -- <path>`).');
      if (untracked.length)
        steps.push(
          'Do not delete an untracked one before the user says whose it is: it may be the work of ' +
            'another session or the output of a tool.'
        );
      block(
        'protected',
        'Protected files are changed in the working tree and this is not the sanctioned route ' +
          '(rule pipeline-config.md, ADR-0016):\n' +
          changed.map((x) => `  ${x.p} (${reasonFor(x.hit)})\n`).join('') +
          untracked.map((x) => `  ${x.p} (untracked; ${reasonFor(x.hit)})\n`).join('') +
          steps.join(' ') +
          ' If the user asked for the change, re-run the session with PIPELINE_ALLOW_PROTECTED=1 ' +
          '(only the user can set it).'
      );
    }
  }

  // ADR-0018: docs/STATE.md is a dashboard; a narrative or an extra section cannot accumulate there.
  const stateDoc = path.join(root, 'docs', 'STATE.md');
  if (exists(stateDoc) && porcelain(root, ['docs/STATE.md']).trim()) {
    const text = fs.readFileSync(stateDoc, 'utf8');
    const errors = stateShapeErrors(text);
    const shapeBroken = errors.length > 0;
    const bytes = statePrintedBytes(text);
    if (bytes > STATE_PRINT_BUDGET)
      errors.push(
        `Now plus Open debt is ${bytes} bytes, budget ${STATE_PRINT_BUDGET}: shorten, or move items to docs/CHANGELOG.md`
      );
    if (errors.length)
      block(
        shapeBroken ? 'state-shape' : 'state-budget',
        'docs/STATE.md does not keep the shape of templates/STATE.md (ADR-0018):\n' +
          errors.map((e) => `  ${e}`).join('\n') +
          '\nKeep only the template sections; narrative belongs in docs/CHANGELOG.md or the feature SUMMARY.md.'
      );
  }

  // ADR-0023: STATE drift is advice. Found here, delivered by pass(); a block below wins and
  // leaves the key unrecorded, so the advice comes at the next stop that passes.
  const advice = driftAdvice(root);

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
    pass(root, advice);
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
          'registry',
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
      'docs',
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
        'tests-timeout',
        'npm test did not finish within 10 minutes. Sort out the hanging tests and finish again.'
      );
    if (tests.code !== 0) {
      block(
        'tests',
        `npm test failed (exit code ${tests.code}). Last lines of the output:\n${lastLines(tests.stdout + '\n' + tests.stderr, 40)}\nFix the tests or the code and finish again.`
      );
    }
    notes.push('npm test: passed.');
  } else {
    notes.push(
      'The test/ directory has no tests: test run skipped. Add tests for the changed code.'
    );
  }

  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ hash, at: new Date().toISOString() }, null, 2) + '\n'
  );
  // Lessons inbox size (advisory, PATTERNS "Advisory from a Stop hook"): checked on the full pass
  // only, so a turn without a code change stays silent.
  pass(root, advice, lessonsNote(root), `Stop gate passed. ${notes.join(' ')}\n`);
} catch (e) {
  process.stderr.write(`stop-gate hook: internal error (${e.message}); gate skipped.\n`);
  process.exit(0);
}
