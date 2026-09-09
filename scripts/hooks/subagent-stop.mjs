/**
 * SubagentStop hook: a subagent may not finish while changed files have lint ERRORS.
 * Warnings pass. Exit 2 blocks with a summary on stderr.
 * MCP audit (ADR-0014): if the agent edited files that expect an MCP query and made no attempt,
 * it is blocked once and asked for a "## MCP not used" section in its report; the reason is logged for /retro.
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

const TIMEOUT = 150_000;

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
  const changed = changedFiles(root)
    .filter((c) => c.status !== 'D' && !c.status.startsWith('D'))
    .map((c) => c.path)
    .filter((p) => exists(path.resolve(root, p)) && fs.statSync(path.resolve(root, p)).isFile());

  const cdsAndSrv = changed.filter(
    (p) => p.endsWith('.cds') || isUnder(p, ['srv/**/*.js', 'test/**/*.js'])
  );
  const ui5 = changed.filter((p) =>
    isUnder(p, ['app/**/webapp/**/*.{js,xml,html}', 'app/**/webapp/manifest.json'])
  );

  const errors = [...eslintErrors(root, cdsAndSrv), ...ui5Errors(root, ui5)];
  if (errors.length) {
    process.stderr.write(
      `The subagent cannot finish: ${errors.length} linter errors in changed files. Fix them and finish again.\n` +
        errors.slice(0, 30).join('\n') +
        '\n'
    );
    process.exit(2);
  }

  // MCP audit (ADR-0014): edits without a prior MCP query need a written reason in the report.
  const agent = agentKey(input);
  const agentType = input.agent_type || 'main';
  const gaps = mcpGaps(readAudit(root, input.session_id), agent);
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
      emitJson({
        systemMessage: `MCP audit: ${agentType} finished without an MCP query and without a "## MCP not used" section for ${files.join(', ')}. Recorded for /retro.`,
      });
    } else {
      const list = gaps.map((g) => `  ${g.file} (${g.label}) → ${g.needs.join(' or ')}`).join('\n');
      process.stderr.write(
        'MCP check (rule pipeline-config.md, ADR-0014): you edited files that expect an MCP query first, but this agent made no attempt:\n' +
          list +
          '\nEither run the query now and re-check your change against the result, or add a section "## MCP not used" to your report with one line per file: `path → reason` (why the query was unnecessary, for example a text fix, or impossible, for example the server was unavailable). Then finish again.\n'
      );
      process.exit(2);
    }
  }
} catch (e) {
  process.stderr.write(`subagent-stop hook: internal error (${e.message}), check skipped.\n`);
}
process.exit(0);
