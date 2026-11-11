/**
 * SubagentStart hook: marks a subagent launch or resume in the metrics event log (ADR-0022,
 * docs/metrics/data-flow.md section 2) and hands the agent its role brief (ADR-0031 decision 2).
 * Records:
 *   { event: 'agent-start', agent, agentType }                         every launch and resume
 *   { event: 'brief', agent, agentType, feature, phase, bytes, mode, hash }   a brief handed
 * Claude Code fires it on a launch and again on every resume of the same agent. `agent` is the bare
 * id (`metricsAgent`), so it joins the `agent-stop` record, the read ledger and the transcript file.
 * The brief follows the `Feature:` and `Phase:` lines of docs/STATE.md (`activeFeature()`): it holds
 * the agent type's step rows of that phase, or of the phase `briefPhase()` of
 * scripts/lib/feature-brief.mjs falls back to when the type has none there (a review rework in
 * phase 5 gets its phase 2 rows, the header says so). It is written to
 * `.pipeline/brief/<agent-type>-<brief phase>.md`, and the `brief` record carries that phase; its
 * text is the `additionalContext` whole when it has at most HOOK_OUTPUT_MAX characters (probe fact
 * F2, `mode: 'inline'`), otherwise one pointer line with the path and the bytes (`mode: 'path'`).
 * Prints nothing for an agent type that reads whole, `Feature: none`, a phase without a number, a
 * feature folder without PLAN.md, no step row of the agent type in any phase, and a resume (an agent
 * id with an earlier `agent-start` record of the session): a resumed agent gets no SubagentStart
 * context (F5), so a resume writes no brief file and no `brief` record, and the read gate never
 * points it to a brief it did not receive. Never blocks.
 */
import { readStdinJson, repoRoot, emitJson, HOOK_OUTPUT_MAX } from '../lib/hook-utils.mjs';
import { appendMetric, metricsAgent, readMetrics } from '../lib/metrics-log.mjs';
import { activeFeature } from '../lib/state-now.mjs';

/** Builds, writes and records the brief; returns the `additionalContext`, or null for silence. */
async function handBrief(root, input, agent, agentType) {
  const { name, phase } = activeFeature(root);
  if (!name || !/^[0-7]$/.test(phase)) return null;
  // Loaded lazily: a broken brief builder must not cost the agent-start record.
  const { readFeatureDocs, briefPhase, phaseLabel, writeBrief, groupDigits } =
    await import('../lib/feature-brief.mjs');
  const docs = readFeatureDocs(root, name);
  const own = docs && briefPhase(docs, agentType, phase);
  if (!own) return null;
  const written = writeBrief(root, name, agentType, own, phase);
  if (!written) return null;
  const inline = written.chars <= HOOK_OUTPUT_MAX;
  appendMetric(root, input.session_id, {
    event: 'brief',
    agent,
    agentType,
    feature: name,
    phase: own,
    bytes: written.bytes,
    mode: inline ? 'inline' : 'path',
    hash: written.hash,
  });
  if (inline) return written.text;
  return `Your brief of feature ${name}, ${phaseLabel(own, phase)}: ${written.path} (${groupDigits(written.bytes)} bytes, ${written.sections} sections; above the ${groupDigits(HOOK_OUTPUT_MAX)}-character limit of a hook string, so handed by path). Read it whole as protocol step 1; read a whole feature document only for a section the brief lists under "Not included".`;
}

const input = readStdinJson();
const root = repoRoot();
const agent = metricsAgent(input);
const agentType = input.agent_type || 'main';
let resumed = false;
try {
  resumed = readMetrics(root, input.session_id).some(
    (r) => r.event === 'agent-start' && r.agent === agent
  );
} catch {
  // an unreadable log counts as a launch: the brief is handed as before
}
try {
  appendMetric(root, input.session_id, { event: 'agent-start', agent, agentType });
} catch {
  // metrics are best effort: never block a subagent
}
try {
  const context = resumed ? null : await handBrief(root, input, agent, agentType);
  // No process.exit after the write: a long stdout on a pipe must drain before the process ends.
  if (context)
    emitJson({
      hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: context },
    });
} catch {
  // the brief is best effort: the agent then reads the feature documents as before
}
