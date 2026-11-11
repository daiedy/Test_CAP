/**
 * PreToolUse hook (matcher `SendMessage`): the resume gate of ADR-0031 decision 7 level 3 (probe
 * fact F7). A `SendMessage` to a subagent whose transcript already holds a delivered report is
 * denied: a resumed agent carries every stale tool result of its first run, so a rework is a fresh
 * agent of the same type with the file list, the exact edits and the path of the saved report. No
 * deny-once: every such resume is denied.
 * Delivered report: `deliveredReports()` of scripts/lib/transcript-usage.mjs, a `SubagentHandback`
 * tool use whose `tool_result` is not an error; an attempt the handback gate denied (F9) leaves an
 * error result and is no report. The same reading feeds the card's resumes after a report (D18).
 * Addressee: `transcript_path` without `.jsonl`, plus `/subagents/agent-<to>.jsonl`, a leading
 * `agent-` stripped from `to`; read through transcript-usage.mjs (the only transcript reader; it
 * drops the `api-request*` records, so a repeated block is not counted).
 * Passes: an agent without a delivered report (stopped at its turn limit, or every attempt denied),
 * an unreadable transcript, an unknown addressee (a name, no file), a call without `to`, any
 * internal error.
 * A deny is counted as `{ event: 'gate', hook: 'resume-gate', reason: 'resume' }` (ADR-0022), then
 * printed.
 */
import os from 'node:os';
import path from 'node:path';
import { readStdinJson, repoRoot, rel, exists, emitJson } from '../lib/hook-utils.mjs';
import {
  sessionFiles,
  readTranscript,
  deliveredReports,
  HANDBACK_TOOL,
} from '../lib/transcript-usage.mjs';
import { recordGate } from '../lib/metrics-log.mjs';
import { reportPath } from '../lib/handover-checks.mjs';

const HOOK = 'resume-gate';

/**
 * The addressee of a `SendMessage` among the session's subagent files.
 * @returns {{id: string, file: string, agentType: string}|null} null without `to` or without a file
 */
function addressee(input) {
  const to = input.tool_input?.to;
  if (typeof to !== 'string' || !to.trim()) return null;
  const main = String(input.transcript_path || '').replace(/^~(?=\/)/, os.homedir());
  if (!main.endsWith('.jsonl')) return null;
  const id = to.trim().replace(/^agent-/, '');
  const { agents } = sessionFiles(path.dirname(main), path.basename(main, '.jsonl'));
  return agents.find((a) => a.id === id) || null;
}

function gate() {
  const input = readStdinJson();
  if (input.tool_name !== 'SendMessage') return;
  const agent = addressee(input);
  if (!agent) return;
  const reports = deliveredReports(readTranscript(agent.file)).length;
  if (!reports) return;
  const root = repoRoot();
  const type = agent.agentType;
  const saved = rel(reportPath(root, type, agent.id), root);
  const where = exists(path.resolve(root, saved))
    ? `Its report is saved at ${saved}`
    : `No report is saved at ${saved} (delivered before the handback hook was registered, or the file was pruned); quote what the new agent needs from the agent's result`;
  recordGate(input, HOOK, 'resume', root);
  emitJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Resume gate (ADR-0031 decision 7): agent ${agent.id} (${type}) already delivered its report through ${HANDBACK_TOOL} ` +
        `(${reports} delivered in its transcript), so a resume would carry every stale tool result of its first run. ` +
        `Launch a fresh ${type} agent instead: its brief comes from the SubagentStart hook; give it the file list and the exact edits ` +
        `(your defect list) and the path of the previous report. ${where}. ` +
        'A resume with SendMessage is only for an agent that stopped mid-step without a report.',
    },
  });
}

try {
  gate();
} catch {
  // an internal error allows the resume
}
