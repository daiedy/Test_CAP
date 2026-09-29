/**
 * SubagentStart hook: marks a subagent launch or resume in the metrics event log (ADR-0022,
 * docs/features/pipeline-metrics/research/data-flow.md section 2). Record:
 *   { event: 'agent-start', agent, agentType }
 * Claude Code fires it on a launch and again on every resume of the same agent. `agent` is the bare
 * id (`metricsAgent`), so it joins the `agent-stop` record and the transcript file. Never blocks and
 * never prints (a JSON `additionalContext` here would reach the subagent's context).
 */
import { readStdinJson, repoRoot } from '../lib/hook-utils.mjs';
import { appendMetric, metricsAgent } from '../lib/metrics-log.mjs';

try {
  const input = readStdinJson();
  appendMetric(repoRoot(), input.session_id, {
    event: 'agent-start',
    agent: metricsAgent(input),
    agentType: input.agent_type || 'main',
  });
} catch {
  // metrics are best effort: never block a subagent
}
process.exit(0);
