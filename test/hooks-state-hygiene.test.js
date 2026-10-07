// ADR-0023 end to end: the SessionStart briefing and the Stop gate against a real git history, and a
// locked parallel worktree under .claude/worktrees/. The hooks run from the sandbox of
// test/fixtures/hook-sandbox.mjs (copies of scripts/, a temp git repository), one per test, so each
// test starts from its own history and its own .pipeline/state-drift.json. The expected counts
// follow research/state-drift.md section 1: a committed STATE names the parent of HEAD (1 behind,
// no drift); two first-parent commits past `Last commit:` are a drift.
import fs from 'node:fs';
import path from 'node:path';
import {
  createSandbox,
  stateDoc,
  SANDBOX_BRANCH,
  SANDBOX_GITIGNORE,
} from './fixtures/hook-sandbox.mjs';
import { projectNow, driftKey, readDriftKey, DRIFT_FILE } from '../scripts/lib/state-now.mjs';

const SESSION = `test-state-hygiene-${process.pid}`;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STOP = { hook_event_name: 'Stop', stop_hook_active: false };
const ADVICE = 'Stop hook advice (ADR-0023, once per drift, nothing is blocked): ';
const UPDATE = 'Update Branch, Last commit and Next in ## Now of docs/STATE.md.';
const TURN_END = { event: 'turn-end', blocked: false };
/** The briefing language of the session that runs the tests must not leak into the hook. */
const EN = { PIPELINE_LANG: 'en' };
/** npm must not look for its own update while the Stop gate runs `npm test` in the sandbox. */
const NO_NPM_NOTIFIER = { npm_config_update_notifier: 'false' };

/**
 * A sandbox after one pipeline commit: its STATE names `init`, the parent of HEAD, so there is no
 * drift until the next commit.
 */
function pipelineSandbox(prefix) {
  const box = createSandbox({ prefix, session: SESSION });
  const init = box.rev();
  const state = (o = {}) => stateDoc({ lastCommit: `${init} init`, ...o });
  box.commit({ 'docs/STATE.md': state() }, 'state');
  return { box, init, state };
}

describe('STATE drift and parallel worktrees (ADR-0023)', () => {
  it('SessionStart prints the drift and records its key', () => {
    const { box, init } = pipelineSandbox('state-hygiene-start');
    try {
      const start = () => {
        const res = box.hook(
          'session-start.mjs',
          { hook_event_name: 'SessionStart', source: 'startup' },
          EN
        );
        expect(res.status).toBe(0);
        return JSON.parse(res.stdout);
      };
      const driftFile = path.join(box.root, DRIFT_FILE);

      // STATE names the parent of HEAD: no line, no key.
      let out = start();
      expect(out.systemMessage).not.toContain('STATE drift');
      expect(out.hookSpecificOutput.additionalContext).not.toContain('STATE drift');
      expect(fs.existsSync(driftFile)).toBe(false);

      // Two first-parent commits past `Last commit:` (a commit made outside the pipeline).
      box.commit({ 'docs/notes.md': 'notes\n' }, 'notes');
      out = start();
      const line = `STATE drift: Last commit ${init} is 2 first-parent commits behind HEAD. ${UPDATE}`;
      expect(out.systemMessage.split('\n')).toContain(line);
      const context = out.hookSpecificOutput.additionalContext.split('\n');
      // The last line of the briefing block (it ends at the first empty line after its heading).
      const briefing = context.slice(context.indexOf('## Briefing'));
      expect(briefing[briefing.indexOf('') - 1]).toBe(line);

      // The key of the printed drift is recorded.
      const head = box.git('rev-parse', 'HEAD').stdout.trim();
      expect(readDriftKey(box.root)).toBe(driftKey(projectNow(box.root)));
      expect(readDriftKey(box.root)).toContain(head);
      expect(JSON.parse(fs.readFileSync(driftFile, 'utf8')).at).toMatch(ISO);

      // So the Stop gate does not repeat a drift the briefing already showed.
      const stop = box.appended(() => box.hook('stop-gate.mjs', STOP));
      expect(stop.res.status).toBe(0);
      expect(stop.res.stdout).toBe('');
      expect(stop.records).toEqual([TURN_END]);
    } finally {
      box.remove();
    }
  });

  it('Stop gives drift feedback once and never blocks', () => {
    const { box, init, state } = pipelineSandbox('state-hygiene-stop');
    try {
      const stop = (payload = STOP, env = {}) =>
        box.appended(() => box.hook('stop-gate.mjs', payload, env));
      const feedback = (res) => JSON.parse(res.stdout).hookSpecificOutput;

      // No drift: the clean tree passes silently.
      let out = stop();
      expect(out.res.status).toBe(0);
      expect(out.res.stdout).toBe('');
      expect(readDriftKey(box.root)).toBeNull();

      // A drift that appears during the session, so SessionStart did not report it.
      const head = box.commit({ 'docs/notes.md': 'notes\n' }, 'notes');
      // Under the loop guard: silent, and the key stays unrecorded, so the advice is not lost.
      out = stop({ ...STOP, stop_hook_active: true });
      expect(out.res.status).toBe(0);
      expect(out.res.stdout).toBe('');
      expect(readDriftKey(box.root)).toBeNull();

      const behind2 = `STATE drift: Last commit ${init} is 2 first-parent commits behind HEAD.`;
      out = stop();
      expect(out.res.status).toBe(0);
      expect(out.res.stderr).toBe('');
      expect(feedback(out.res)).toEqual({
        hookEventName: 'Stop',
        additionalContext: `${ADVICE}${behind2} ${UPDATE} Git now: branch ${SANDBOX_BRANCH}, HEAD ${head} notes.`,
      });
      // Not a block: no `gate` record.
      expect(out.records).toEqual([TURN_END]);
      const key = readDriftKey(box.root);
      expect(key).toBe(driftKey(projectNow(box.root)));

      // Once: the same drift stays silent at the next stop.
      out = stop();
      expect(out.res.status).toBe(0);
      expect(out.res.stdout).toBe('');
      expect(out.records).toEqual([TURN_END]);

      // A new drift (git moved to another branch) while a block of the gate wins: the block is
      // the only output, and the key stays unrecorded for the next stop that passes.
      box.git('checkout', '-qb', 'feature/other');
      box.put({ 'srv/service.js': 'export default 1;\n' });
      out = stop();
      expect(out.res.status).toBe(2);
      expect(out.res.stdout).toBe('');
      expect(out.records.map((r) => r.reason || r.event)).toEqual(['docs', 'turn-end']);
      expect(readDriftKey(box.root)).toBe(key);
      box.resetTree();
      const branch = `STATE drift: Branch ${SANDBOX_BRANCH}, but git is on feature/other;`;
      out = stop();
      expect(out.res.status).toBe(0);
      expect(feedback(out.res).additionalContext).toBe(
        `${ADVICE}${branch} Last commit ${init} is 2 first-parent commits behind HEAD. ${UPDATE} ` +
          `Git now: branch feature/other, HEAD ${head} notes.`
      );
      expect(out.records).toEqual([TURN_END]);

      // The full gate passes (docs touched, `npm test` green): the advice replaces the pass text.
      const runner = box.commit(
        {
          'package.json': '{ "private": true, "scripts": { "test": "node -e 0" } }\n',
          'test/a.test.js': '',
        },
        'runner'
      );
      box.put({
        'srv/service.js': 'export default 1;\n',
        'docs/STATE.md': state({ phase: '2: backend, tests' }),
        'docs/CHANGELOG.md': '# Changelog\n\n- a line\n',
      });
      out = stop(STOP, NO_NPM_NOTIFIER);
      expect(out.res.status, out.res.stderr).toBe(0);
      expect(feedback(out.res).additionalContext).toBe(
        `${ADVICE}${branch} Last commit ${init} is 3 first-parent commits behind HEAD. ${UPDATE} ` +
          `Git now: branch feature/other, HEAD ${runner} runner.`
      );
      expect(out.res.stdout).not.toContain('Stop gate passed');
      expect(out.records).toEqual([TURN_END]);
    } finally {
      box.remove();
    }
  });

  it('a parallel worktree passes the Stop gate', () => {
    const { box } = pipelineSandbox('state-hygiene-worktree');
    try {
      // What Claude Code does for `claude --worktree demo`: a checkout on its own branch, locked
      // while the other session runs, holding that session's uncommitted work.
      const rel = path.posix.join('.claude', 'worktrees', 'demo');
      const worktree = path.join(box.root, rel);
      let res = box.git('worktree', 'add', '-q', '-b', 'worktree-demo', rel);
      expect(res.status, res.stderr).toBe(0);
      fs.writeFileSync(path.join(worktree, 'notes.md'), 'work of another session\n');
      res = box.git('worktree', 'lock', '--reason', 'claude agent demo', rel);
      expect(res.status, res.stderr).toBe(0);
      expect(box.git('worktree', 'list', '--porcelain').stdout).toContain(
        'locked claude agent demo'
      );
      const stop = () => box.appended(() => box.hook('stop-gate.mjs', STOP));

      // Without the .gitignore line git shows the checkout as one untracked entry; it passes.
      expect(box.git('status', '--porcelain', '-uall').stdout).toBe(`?? ${rel}/\n`);
      let out = stop();
      expect(out.res.status, out.res.stderr).toBe(0);
      expect(out.records).toEqual([TURN_END]);

      // An untracked protected entry still blocks, without the `git checkout --` advice, and the
      // worktree is not listed with it; a changed tracked one keeps the advice.
      box.put({ '.claude/agents/helper.md': '# helper\n' });
      fs.appendFileSync(path.join(box.root, 'scripts/hooks/session-start.mjs'), '// changed\n');
      out = stop();
      expect(out.res.status).toBe(2);
      expect(out.records[0]).toEqual({
        event: 'gate',
        hook: 'stop-gate',
        agent: 'main',
        agentType: 'main',
        reason: 'protected',
      });
      const both = out.res.stderr.split('\n');
      expect(both).toContain(
        '  scripts/hooks/session-start.mjs (hook scripts are changed only by a human; ask the user)'
      );
      expect(both).toContain(
        '  .claude/agents/helper.md (untracked; agent configuration is protected; ask the user to make the change)'
      );
      expect(out.res.stderr).toContain('Revert the changed ones (`git checkout -- <path>`).');
      expect(out.res.stderr).toContain(
        'Do not delete an untracked one before the user says whose it is: it may be the work of another session or the output of a tool.'
      );
      expect(out.res.stderr).not.toContain('worktrees');
      box.git('checkout', '-q', '--', 'scripts/hooks/session-start.mjs');
      out = stop();
      expect(out.res.status).toBe(2);
      expect(out.res.stderr).toContain('  .claude/agents/helper.md (untracked;');
      expect(out.res.stderr).not.toContain('git checkout');
      expect(out.res.stderr).not.toContain('worktrees');
      fs.rmSync(path.join(box.root, '.claude', 'agents'), { recursive: true });

      // With the .gitignore line git does not show the checkout at all; it passes.
      box.put({ '.gitignore': `${SANDBOX_GITIGNORE}.claude/worktrees/\n` });
      expect(box.git('status', '--porcelain', '-uall').stdout).toBe(' M .gitignore\n');
      expect(box.git('check-ignore', '-q', `${rel}/notes.md`).status).toBe(0);
      out = stop();
      expect(out.res.status, out.res.stderr).toBe(0);
      expect(out.records).toEqual([TURN_END]);

      // The PreToolUse guard still denies this session a write into the other checkout.
      out = box.appended(() =>
        box.hook('protect-files.mjs', {
          hook_event_name: 'PreToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: path.join(worktree, 'notes.md') },
        })
      );
      const decision = JSON.parse(out.res.stdout).hookSpecificOutput;
      expect(decision.permissionDecision).toBe('deny');
      expect(decision.permissionDecisionReason).toContain(`"${rel}/notes.md"`);
      expect(out.records.map((r) => [r.hook, r.reason])).toEqual([['protect-files', 'protected']]);
    } finally {
      box.remove();
    }
  });
});
