/**
 * UserPromptSubmit hook: counts user prompts in the metrics event log (ADR-0022,
 * docs/features/pipeline-metrics/research/data-flow.md section 2). Record:
 *   { event: 'prompt', command?, arg? }
 * `command` is the leading `/<skill>` token without the slash; `arg` is the token after it, kept
 * only when it is an issue id (`#14`) or a lowercase kebab name (`pipeline-metrics`). Nothing else
 * of the prompt is read or stored: a plain prompt yields `{ event: 'prompt' }`.
 * Never blocks and never prints: plain stdout of this event is added to Claude's context.
 */
import { readStdinJson, repoRoot } from '../lib/hook-utils.mjs';
import { appendMetric } from '../lib/metrics-log.mjs';

/** A skill or command token: lowercase, plugin scope allowed (`ui5:ui5-best-practices`). */
const COMMAND = /^\/([a-z][a-z0-9:_-]{0,63})(?=\s|$)/;
const ARG = /^(?:#\d{1,9}|[a-z0-9-]{1,80})$/;

/** The metrics fields of a prompt: the command token and a safe argument, never the text. */
function promptMarker(prompt) {
  const text = typeof prompt === 'string' ? prompt.trimStart() : '';
  const m = text.match(COMMAND);
  if (!m) return {};
  const first = text.slice(m[0].length).trimStart().split(/\s/, 1)[0];
  return ARG.test(first) ? { command: m[1], arg: first } : { command: m[1] };
}

try {
  const input = readStdinJson();
  appendMetric(repoRoot(), input.session_id, { event: 'prompt', ...promptMarker(input.prompt) });
} catch {
  // metrics are best effort: never block a prompt
}
process.exit(0);
