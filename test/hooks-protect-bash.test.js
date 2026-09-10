// The PreToolUse Bash guardrail (ADR-0016) is the one hook whose behaviour is a decision table,
// so it is pinned here instead of being re-checked by hand. It must catch a shell write to a
// protected path, leave reads alone, deny a subagent, ask the main thread, and always yield to
// PIPELINE_ALLOW_PROTECTED, which only the user can set.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hook = path.join(root, 'scripts', 'hooks', 'protect-files-bash.mjs');

function decide(command, { agentId, allowProtected } = {}) {
  const env = { ...process.env };
  delete env.PIPELINE_ALLOW_PROTECTED;
  if (allowProtected) env.PIPELINE_ALLOW_PROTECTED = '1';
  const payload = { tool_name: 'Bash', cwd: root, tool_input: { command } };
  if (agentId) payload.agent_id = agentId;
  const res = spawnSync('node', [hook], { input: JSON.stringify(payload), encoding: 'utf8', env });
  const out = res.stdout || '';
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

describe('PreToolUse Bash guardrail', () => {
  it('asks the main thread before a shell write to a protected path', () => {
    expect(decide('echo x > .claude/settings.json')).toBe('ask');
    expect(decide("sed -i '' 's/a/b/' scripts/hooks/post-edit.mjs")).toBe('ask');
    expect(decide('tee .claude/settings.json < /tmp/new.json')).toBe('ask');
    expect(decide('cp /tmp/a.json .mcp.json')).toBe('ask');
    expect(decide('git checkout -- .claude/settings.json')).toBe('ask');
  });

  it('denies a subagent outright, so an unattended run never stalls on a prompt', () => {
    expect(decide('echo x > .claude/settings.json', { agentId: 'sub-1' })).toBe('deny');
    expect(decide('printf x >> scripts/lib/mcp-audit.mjs', { agentId: 'sub-1' })).toBe('deny');
  });

  it('sees a write hidden in a heredoc or an inline script', () => {
    expect(
      decide("python3 - <<'PY'\nimport io\nio.open('.claude/rules/x.md','w').write('hi')\nPY")
    ).toBe('ask');
    expect(decide("node -e \"require('fs').writeFileSync('.mcp.json','{}')\"")).toBe('ask');
  });

  it('leaves reads and unprotected writes alone', () => {
    expect(decide('cat .claude/settings.json')).toBe('allow');
    expect(decide("sed -n '1,20p' scripts/hooks/post-edit.mjs")).toBe('allow');
    expect(decide('grep foo .claude/settings.json > /tmp/x')).toBe('allow');
    // cp reads its source: copying a protected file out of the repo is not a write to it.
    expect(decide('cp scripts/hooks/post-edit.mjs /tmp/probe.mjs')).toBe('allow');
    expect(decide("python3 - <<'PY'\nimport io\nio.open('docs/STATE.md','w').write('x')\nPY")).toBe(
      'allow'
    );
    expect(decide('npm test')).toBe('allow');
    expect(decide('npm run docs:registry')).toBe('allow');
  });

  it('mv counts as a write to its source too, because it removes it', () => {
    expect(decide('mv docs/registry/ENTITIES.md /tmp/z.md')).toBe('ask');
  });

  it('yields to PIPELINE_ALLOW_PROTECTED, which an agent cannot set for itself', () => {
    expect(decide('echo x > .mcp.json', { allowProtected: true })).toBe('allow');
    expect(decide('echo x > .mcp.json', { allowProtected: true, agentId: 'sub-1' })).toBe('allow');
  });
});
