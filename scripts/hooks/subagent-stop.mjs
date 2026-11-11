/**
 * SubagentStop hook: the hand-over gate of a plain-text end, the write-route advisories and the
 * `agent-stop` record.
 * Blocking (exit 2, block text on stderr) only when the input has `last_assistant_message`, i.e. the
 * agent ended in plain text (a non-auto session, or a turn before any report). After a report
 * through `SubagentHandback` the key is absent (probe fact F8) and an exit 2 reaches nobody (F6), so
 * the same checks run earlier, in the handback gate (scripts/hooks/handback-gate.mjs, ADR-0031
 * decision 8). The checks live once, in scripts/lib/handover-checks.mjs: lint errors in the agent's
 * changed files (ADR-0029 decision 7, amendment D-F), a protected path written outside Edit/Write
 * (ADR-0016) and an MCP gap without a "## MCP not used" section (ADR-0014; blocked once, the stop
 * after it passes through `stop_hook_active`). The block text is blockText() of the same library,
 * relayed by relay(): every finding up to HOOK_OUTPUT_MAX, else the counts per rule and file with
 * the path of the whole under .pipeline/logs/ (ADR-0031 decision 4).
 * Report (ADR-0031 decision 7 level 2, Q8): `last_assistant_message` is written whole to
 * `.pipeline/logs/report-<agent_type>-<agent_id>.md` when the key exists, on a pass and a block alike.
 * Write route (ADR-0016): the per-file-type checks of scripts/lib/file-checks.mjs run over the
 * changed files with no `edit` audit record (up to CHECK_LIMIT) and are printed as `systemMessage`.
 * Generated files (docs/registry/**) are not audited as protected writes; their gate is freshness (ADR-0017).
 * Metrics (ADR-0022): before any check, the agent's transcript aggregate is appended as `agent-stop`
 * (so a blocked stop still records); every exit 2 appends `{ event: 'gate', reason }`. A Claude Code
 * internal agent (`internalAgent`: an `agent_transcript_path` is given but no file exists there, or
 * neither an `agent_type` nor a transcript file exists; pipeline-metrics docs/metrics/data-flow.md
 * section 2) records no `agent-stop`, no `gate` and no report; its checks and exit codes are unchanged.
 */
import { readStdinJson, repoRoot, emitJson } from '../lib/hook-utils.mjs';
import { runFileChecks } from '../lib/file-checks.mjs';
import {
  appendMetric,
  recordGate,
  internalAgent,
  metricsAgent,
  agentTranscriptPath,
} from '../lib/metrics-log.mjs';
import { handoverFindings, blockText, writeRoute, saveReport } from '../lib/handover-checks.mjs';

const HOOK = 'subagent-stop';
const CHECK_LIMIT = 12;

/**
 * The `agent-stop` record (docs/metrics/data-flow.md section 2 of pipeline-metrics): the subagent's own
 * transcript through transcript-usage.mjs, priced and timed with pipeline-metrics.mjs (D1-D6, default
 * caps). The transcript is cumulative, so a resumed agent's last record wins. Best effort: the libs
 * load lazily, and any failure only loses the record, never the checks below.
 */
async function recordAgentStop(root, input) {
  try {
    const { readTranscript, requests, usageByModel, timelinePoints, toolUses, TOKEN_KINDS } =
      await import('../lib/transcript-usage.mjs');
    const { costOf, activeTime, loadPricing } = await import('../lib/pipeline-metrics.mjs');
    let pricing = null;
    try {
      pricing = loadPricing(root);
    } catch {
      // no table: costUSD stays null (D4), never zero
    }
    const file = agentTranscriptPath(input);
    const records = readTranscript(file);
    const models = Object.entries(usageByModel(requests(records)).byModel).sort(
      (a, b) => b[1].calls - a[1].calls
    );
    const sum = (k) => models.reduce((s, [, u]) => s + u[k], 0);
    const cost = costOf(Object.fromEntries(models), pricing).costUSD;
    const points = timelinePoints(records);
    const first = points[0]?.t;
    const last = points.at(-1)?.t;
    const min = (ms) => Number((ms / 60_000).toFixed(1));
    const iso = (t) => (t == null ? undefined : new Date(t).toISOString());
    appendMetric(root, input.session_id, {
      event: 'agent-stop',
      agent: metricsAgent(input),
      agentType: input.agent_type || 'main',
      transcriptPath: file || undefined,
      model: models[0]?.[0] ?? null,
      requests: sum('calls'),
      tokens: Object.fromEntries(TOKEN_KINDS.map((k) => [k, sum(k)])),
      costUSD: cost == null ? null : Number(cost.toFixed(4)),
      activeMin: min(activeTime(points)),
      leadMin: first == null ? 0 : min(last - first),
      toolCalls: toolUses(records).length,
      firstTs: iso(first),
      lastTs: iso(last),
    });
  } catch {
    // metrics are best effort
  }
}

try {
  const input = readStdinJson();
  const root = repoRoot();
  // Metrics for pipeline agents only; an internal agent passes the same checks without records.
  const metered = !internalAgent(input);
  if (metered) await recordAgentStop(root, input);
  const plainEnd = typeof input.last_assistant_message === 'string';
  if (metered && plainEnd) {
    try {
      saveReport(root, input, input.last_assistant_message);
    } catch {
      // the report file is best effort, the checks below are not
    }
  }

  let route;
  let notes = [];
  const advisories = [];
  if (plainEnd) {
    const findings = handoverFindings(root, input, input.last_assistant_message);
    if (findings.reason) {
      if (metered) recordGate(input, HOOK, findings.reason, root);
      process.stderr.write(blockText(findings, 'finish again'));
      process.exit(2);
    }
    ({ route, notes } = findings);
    advisories.push(...findings.advisories);
  } else {
    // The report went through SubagentHandback and the handback gate checked the same files.
    route = writeRoute(root, input);
  }

  for (const p of route.unrecorded.slice(0, CHECK_LIMIT)) {
    // A "not installed" note of the lint gate is not repeated per file.
    const fileNotes = runFileChecks(root, p).filter((n) => !notes.includes(n));
    advisories.push(...fileNotes.map((n) => `${p}: ${n}`));
  }
  if (route.unrecorded.length > CHECK_LIMIT) {
    advisories.push(
      `${route.unrecorded.length - CHECK_LIMIT} further files written outside Edit/Write were not checked here (limit ${CHECK_LIMIT}); run the checks by hand if they matter.`
    );
  }
  if (advisories.length) emitJson({ systemMessage: advisories.join('\n\n') });
} catch (e) {
  process.stderr.write(`subagent-stop hook: internal error (${e.message}), check skipped.\n`);
}
process.exit(0);
