/**
 * PostToolBatch hook: the turn note of ADR-0032. A subagent cannot see how many of its `maxTurns`
 * it has used, so after each tool batch of a subagent this hook counts the turns of its current run
 * and, from turn `maxTurns - reserve(maxTurns)` on, returns `turnNote()` as `additionalContext`
 * (probe P1: PostToolBatch fires inside a subagent and its context reaches the agent) and appends
 *   { event: 'turn-note', agent, agentType, turn, maxTurns }
 * to the metrics event log (ADR-0022) for the card and the history line.
 * Count: `runTurns()` of the agent file `subagentTranscript(transcript_path, agent_id)`, the
 * distinct request ids after the last `coordinator` resume, plus 1 when none of the batch's
 * `tool_calls[].tool_use_id` is a `tool_use` id of that run: on Claude Code 2.1.323 the batch's own
 * record can land after this read (VERIFICATION check 1), so the file alone is exact or one short
 * and the batch-id rule makes the count exact or one high (ADR-0032 decision 4 amendment).
 * Limit: `agentMaxTurns()`, the frontmatter of `.claude/agents/<agent_type>.md`.
 * Silent, with no record: the main thread (no `agent_id`; exits before the libraries load, since
 * PostToolBatch fires on every main-thread tool turn too), an agent type without a definition or
 * without `maxTurns` (Claude Code internal agents), a missing transcript, a count below the
 * threshold, malformed input, any internal error. Of `tool_calls` only the `tool_use_id` strings
 * are read and none is logged; `tool_response` (whole tool results) is never read.
 * The event name is echoed from the input, so the script serves another tool event unchanged.
 * Never blocks: no gate, no exit code other than 0.
 */
import { readStdinJson, repoRoot, emitJson } from '../lib/hook-utils.mjs';

async function note() {
  const input = readStdinJson();
  const agentId = input.agent_id;
  if (typeof agentId !== 'string' || !agentId.trim()) return;
  const event = input.hook_event_name;
  const agentType = input.agent_type;
  if (typeof event !== 'string' || !event || typeof agentType !== 'string') return;
  const root = repoRoot();
  const { agentMaxTurns, turnNote, TURN_NOTE_EVENT } = await import('../lib/turn-budget.mjs');
  const limits = agentMaxTurns(root);
  if (!Object.hasOwn(limits, agentType)) return;
  const maxTurns = limits[agentType];
  const { readTranscript, runTurns, subagentTranscript } =
    await import('../lib/transcript-usage.mjs');
  const file = subagentTranscript(input.transcript_path, agentId);
  if (!file) return;
  const calls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
  const batchIds = calls.map((c) => c?.tool_use_id).filter((id) => typeof id === 'string');
  const turn = runTurns(readTranscript(file), batchIds);
  const text = turnNote(turn, maxTurns);
  if (!text) return;
  emitJson({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
  try {
    const { appendMetric, metricsAgent } = await import('../lib/metrics-log.mjs');
    appendMetric(root, input.session_id, {
      event: TURN_NOTE_EVENT,
      agent: metricsAgent(input),
      agentType,
      turn,
      maxTurns,
    });
  } catch {
    // metrics are best effort: the note is already printed
  }
}

try {
  await note();
} catch {
  // silent on any internal error: the note is advice, never a gate
}
