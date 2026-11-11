/**
 * PreToolUse hook (matcher `Read`): the soft read gate of ADR-0031 decision 3 (Q1). A whole-file
 * Read (no `offset`, `limit`, `pages`: the keys are absent on a whole read, probe fact F3) of a
 * repository file is denied once per agent, file and content hash when the same agent already read
 * that content whole (`reread`), and once per agent and file when an agent that received a brief
 * reads the active feature's PLAN.md or CONTEXT.md whole (`brief`, ADR-0031 decision 2); the
 * identical retry passes (F4). The ledger and the rule live in scripts/lib/read-ledger.mjs; the
 * brief comes from the `brief` record SubagentStart wrote to the metrics log.
 * Never denied: a partial read, a changed file, another agent id, a file outside the repository,
 * an agent type that reads whole (`reviewer`, `architect`, `ux-designer`), an unreadable ledger, any
 * internal error. A deny is written to the ledger first (a deny the ledger cannot hold would repeat
 * forever, so a failed write allows), then counted as `{ event: 'gate', hook: 'read-gate',
 * reason }` (ADR-0022), then printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readStdinJson, repoRoot, rel, insideRepo, sha256, emitJson } from '../lib/hook-utils.mjs';
import { metricsAgent, readMetrics, recordGate } from '../lib/metrics-log.mjs';
import { activeFeature } from '../lib/state-now.mjs';
import { readLedger, appendLedger, readVerdict } from '../lib/read-ledger.mjs';

const HOOK = 'read-gate';
const RETRY =
  'If you need the whole file anyway, repeat this Read: the second attempt passes. A Read with offset and limit always passes.';

/**
 * The brief rule's input: the agent's latest `brief` record of the active feature, when the file is
 * that feature's PLAN.md or CONTEXT.md and the agent type has a brief role.
 * @returns {Promise<object|null>} the record with its brief `path`, or null
 */
async function briefOf(root, input, agent, file) {
  const { name } = activeFeature(root);
  if (!name) return null;
  const dir = `docs/features/${name}/`;
  if (file !== `${dir}PLAN.md` && file !== `${dir}CONTEXT.md`) return null;
  // Loaded only for a feature document: every other Read stays off the brief builder.
  const { BRIEF_ROLES, briefPath } = await import('../lib/feature-brief.mjs');
  if (!Object.hasOwn(BRIEF_ROLES, input.agent_type || '')) return null;
  const last = readMetrics(root, input.session_id)
    .filter((r) => r.event === 'brief' && r.agent === agent && r.feature === name)
    .at(-1);
  return last ? { ...last, path: briefPath(last.agentType, last.phase) } : null;
}

function reasonText(verdict, file, hash, brief) {
  if (verdict.deny === 'brief') {
    const where =
      brief.mode === 'inline'
        ? `whole in your context since your start, also at ${brief.path}`
        : `at ${brief.path}, named at your start`;
    return `Read gate (ADR-0031 decision 2): your brief of feature ${brief.feature}, phase ${brief.phase} is ${where}. It holds your steps, your criteria and the CONTEXT sections of your role; read a whole ${path.basename(file)} only for a section the brief lists under "Not included". ${RETRY}`;
  }
  return `Read gate (ADR-0031 decision 3): you already read ${file} whole at ${verdict.first.ts} and it is unchanged since (sha256 ${hash.slice(0, 12)}), so its content is still in your context; use that copy. ${RETRY}`;
}

async function gate() {
  const input = readStdinJson();
  const ti = input.tool_input || {};
  if (input.tool_name !== 'Read' || typeof ti.file_path !== 'string' || !ti.file_path) return;
  if (['offset', 'limit', 'pages'].some((k) => ti[k] != null)) return;
  const root = repoRoot();
  const file = rel(ti.file_path, root);
  if (!insideRepo(file)) return;
  let content;
  try {
    content = fs.readFileSync(path.resolve(root, file));
  } catch {
    return; // missing, a directory, unreadable: the Read tool answers itself
  }
  const records = readLedger(root, input.session_id);
  if (!records) return;
  const agent = metricsAgent(input);
  const agentType = input.agent_type || 'main';
  const hash = sha256(content);
  const brief = await briefOf(root, input, agent, file);
  const verdict = readVerdict(records, { agent, file, hash, brief: brief?.path ?? null });
  if (verdict.deny) {
    const reason = verdict.deny;
    appendLedger(root, input.session_id, { event: 'deny', agent, agentType, file, hash, reason });
    recordGate(input, HOOK, reason, root);
    emitJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reasonText(verdict, file, hash, brief),
      },
    });
  } else if (verdict.record) {
    appendLedger(root, input.session_id, {
      event: 'read',
      agent,
      agentType,
      file,
      hash,
      bytes: content.length,
    });
  }
}

try {
  await gate();
} catch {
  // a soft gate: an internal error allows the read
}
