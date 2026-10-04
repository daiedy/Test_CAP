/**
 * SubagentStop hook: a subagent may not finish while changed files have lint ERRORS.
 * Warnings pass. Exit 2 blocks with a summary on stderr.
 * MCP audit (ADR-0014): if the agent edited files that expect an MCP query and made no attempt,
 * it is blocked once and asked for a "## MCP not used" section in its report; the reason is logged for /retro.
 * Write route (ADR-0016): changed files with no `edit` audit record were written outside Edit/Write,
 * so post-edit.mjs never saw them; their per-file-type checks run here and a protected path blocks.
 * Generated files (docs/registry/**) are not audited as protected writes; their gate is freshness (ADR-0017).
 * Metrics (ADR-0022): before any check, the agent's transcript aggregate is appended as `agent-stop`
 * (so a blocked stop still records); every exit 2 appends `{ event: 'gate', reason }`. A Claude Code
 * internal agent (`internalAgent`: an `agent_transcript_path` is given but no file exists there, or
 * neither an `agent_type` nor a transcript file exists; pipeline-metrics research/data-flow.md
 * section 2) records no `agent-stop` and no `gate`; its checks and exit codes are unchanged.
 */
import path from 'node:path';
import fs from 'node:fs';
import {
  repoRoot,
  changedFiles,
  isUnder,
  run,
  truncate,
  findUp,
  readStdinJson,
  exists,
  emitJson,
} from '../lib/hook-utils.mjs';
import { agentKey, readAudit, appendAudit, mcpGaps } from '../lib/mcp-audit.mjs';
import { protectedWriteHit, reasonFor } from '../lib/protected-paths.mjs';
import { runFileChecks } from '../lib/file-checks.mjs';
import {
  appendMetric,
  recordGate,
  internalAgent,
  metricsAgent,
  agentTranscriptPath,
} from '../lib/metrics-log.mjs';

const TIMEOUT = 150_000;
const HOOK = 'subagent-stop';

/**
 * The `agent-stop` record (research/data-flow.md section 2 of pipeline-metrics): the subagent's own
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

function eslintErrors(root, files) {
  if (!files.length) return [];
  const res = run('npx', ['eslint', '--format', 'json', ...files], {
    cwd: root,
    timeoutMs: TIMEOUT,
  });
  if (res.timedOut) return ['eslint: time limit exceeded'];
  try {
    const report = JSON.parse(res.stdout || '[]');
    return report.flatMap((f) =>
      (f.messages || [])
        .filter((m) => m.severity === 2)
        .map(
          (m) =>
            `${path.relative(root, f.filePath)}:${m.line}:${m.column} ${m.message} (${m.ruleId || 'parse'})`
        )
    );
  } catch {
    return res.code !== 0 && res.code !== 1
      ? [`eslint: ${truncate(res.stderr || res.stdout, 600)}`]
      : [];
  }
}

function ui5Errors(root, files) {
  const byApp = new Map();
  for (const f of files) {
    const appDir = findUp(path.dirname(path.resolve(root, f)), 'ui5.yaml', root);
    if (!appDir) continue;
    if (!byApp.has(appDir)) byApp.set(appDir, []);
    byApp.get(appDir).push(path.relative(appDir, path.resolve(root, f)).split(path.sep).join('/'));
  }
  const errors = [];
  for (const [appDir, rels] of byApp) {
    const res = run('npx', ['ui5lint', '--format', 'json', ...rels], {
      cwd: appDir,
      timeoutMs: TIMEOUT,
    });
    if (res.timedOut) {
      errors.push(`ui5lint (${path.relative(root, appDir)}): time limit exceeded`);
      continue;
    }
    try {
      const report = JSON.parse(res.stdout || '[]');
      const list = Array.isArray(report) ? report : report.files || [];
      for (const f of list) {
        for (const m of f.messages || []) {
          if (m.severity === 2)
            errors.push(
              `${path.relative(root, path.resolve(appDir, f.filePath))}:${m.line ?? '?'}:${m.column ?? '?'} ${m.message} (${m.ruleId})`
            );
        }
      }
    } catch {
      if (res.code !== 0)
        errors.push(
          `ui5lint (${path.relative(root, appDir)}): ${truncate(res.stderr || res.stdout, 600)}`
        );
    }
  }
  return errors;
}

try {
  const input = readStdinJson();
  const root = repoRoot();
  // Metrics for pipeline agents only; an internal agent passes the same checks without records.
  const metered = !internalAgent(input);
  const gate = (reason) => metered && recordGate(input, HOOK, reason, root);
  if (metered) await recordAgentStop(root, input);
  const changed = changedFiles(root)
    .filter((c) => c.status !== 'D' && !c.status.startsWith('D'))
    .map((c) => c.path)
    .filter((p) => exists(path.resolve(root, p)) && fs.statSync(path.resolve(root, p)).isFile());

  const cdsAndSrv = changed.filter(
    (p) =>
      p.endsWith('.cds') ||
      isUnder(p, ['srv/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'])
  );
  const ui5 = changed.filter((p) =>
    isUnder(p, ['app/**/webapp/**/*.{js,xml,html}', 'app/**/webapp/manifest.json'])
  );

  const errors = [...eslintErrors(root, cdsAndSrv), ...ui5Errors(root, ui5)];
  if (errors.length) {
    gate('lint');
    process.stderr.write(
      `The subagent cannot finish: ${errors.length} linter errors in changed files. Fix them and finish again.\n` +
        errors.slice(0, 30).join('\n') +
        '\n'
    );
    process.exit(2);
  }

  // ADR-0016: a file written through Bash (redirection, heredoc, a script) has no `edit` record,
  // so it skipped protect-files.mjs and post-edit.mjs. git shows it anyway; check it here.
  const auditRecords = readAudit(root, input.session_id);
  const recorded = new Set(
    auditRecords.filter((e) => e.event === 'edit' && e.file).map((e) => e.file)
  );
  const unrecorded = changed.filter((p) => !recorded.has(p));
  const advisories = [];

  const protectedWrites = unrecorded
    .map((p) => ({ p, hit: protectedWriteHit(root, p) }))
    .filter((x) => x.hit);
  if (protectedWrites.length) {
    // Only the environment variable counts as sanction: a branch name is not a boundary,
    // any agent can create `chore/x` (ADR-0016).
    const allowedRoute = process.env.PIPELINE_ALLOW_PROTECTED === '1';
    const list = protectedWrites.map((x) => `  ${x.p} (${reasonFor(x.hit)})`).join('\n');
    if (!allowedRoute) {
      gate('protected');
      process.stderr.write(
        'Protected files were changed outside Edit/Write, so the PreToolUse guard never saw them ' +
          '(rule pipeline-config.md, ADR-0016):\n' +
          list +
          '\nDo not revert them yourself: the Bash guard denies `git checkout` to a subagent. Stop, list them ' +
          'in your report under "## Open questions", and let the orchestrator and the user decide. A deliberate ' +
          'change needs a session started with PIPELINE_ALLOW_PROTECTED=1, which only the user can set.\n'
      );
      process.exit(2);
    }
    advisories.push(`Protected files changed with PIPELINE_ALLOW_PROTECTED=1:\n${list}`);
  }

  const CHECK_LIMIT = 12;
  for (const p of unrecorded.slice(0, CHECK_LIMIT)) {
    advisories.push(...runFileChecks(root, p).map((n) => `${p}: ${n}`));
  }
  if (unrecorded.length > CHECK_LIMIT) {
    advisories.push(
      `${unrecorded.length - CHECK_LIMIT} further files written outside Edit/Write were not checked here (limit ${CHECK_LIMIT}); run the checks by hand if they matter.`
    );
  }

  // MCP audit (ADR-0014): edits without a prior MCP query need a written reason in the report.
  const agent = agentKey(input);
  const agentType = input.agent_type || 'main';
  const gaps = mcpGaps(auditRecords, agent);
  if (gaps.length) {
    const report = input.last_assistant_message || '';
    const marker = /#{1,4}\s*MCP not used\b/i;
    const files = gaps.map((g) => g.file);
    if (marker.test(report)) {
      const idx = report.search(marker);
      appendAudit(root, input.session_id, {
        event: 'justification',
        agent,
        agentType,
        files,
        text: truncate(report.slice(idx, idx + 800), 800),
      });
    } else if (input.stop_hook_active) {
      appendAudit(root, input.session_id, {
        event: 'skipped-unjustified',
        agent,
        agentType,
        files,
      });
      advisories.push(
        `MCP audit: ${agentType} finished without an MCP query and without a "## MCP not used" section for ${files.join(', ')}. Recorded for /retro.`
      );
    } else {
      const list = gaps.map((g) => `  ${g.file} (${g.label}) → ${g.needs.join(' or ')}`).join('\n');
      gate('mcp');
      process.stderr.write(
        'MCP check (rule pipeline-config.md, ADR-0014): you edited files that expect an MCP query first, but this agent made no attempt:\n' +
          list +
          '\nEither run the query now and re-check your change against the result, or add a section "## MCP not used" to your report with one line per file: `path → reason` (why the query was unnecessary, for example a text fix, or impossible, for example the server was unavailable). Then finish again.\n'
      );
      process.exit(2);
    }
  }
  if (advisories.length) emitJson({ systemMessage: advisories.join('\n\n') });
} catch (e) {
  process.stderr.write(`subagent-stop hook: internal error (${e.message}), check skipped.\n`);
}
process.exit(0);
