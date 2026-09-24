/**
 * SessionStart hook: injects the briefing (ADR-0019: language, now, backlog queue from GitHub Issues,
 * recommendation), the project state and the toolchain check into context.
 * Plain stdout is added to Claude's context. Never fails.
 * Reading rule (ADR-0018): sections by heading, never a line count; a section over its budget is
 * cut with a visible marker that names how much is missing and where to read it.
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, run, readSection, exists } from '../lib/hook-utils.mjs';
import { pruneAudit } from '../lib/mcp-audit.mjs';
import { stateShapeErrors, capped, STATE_PRINT_BUDGET } from '../lib/doc-shapes.mjs';
import { collectBriefing, renderBriefing } from '../lib/backlog.mjs';

try {
  const input = readStdinJson();
  const root = repoRoot();
  const out = [];
  pruneAudit(root); // MCP audit files older than 14 days (ADR-0014)

  out.push(`# Test_CAP project context (SessionStart, source=${input.source || 'unknown'})`);
  // ADR-0019: the briefing comes first, in PIPELINE_LANG; the queue comes from GitHub Issues with a cache.
  try {
    out.push('', renderBriefing(collectBriefing(root)));
  } catch (e) {
    out.push('', `## Briefing\nunavailable (${e.message}); run node scripts/backlog.mjs briefing.`);
  }

  const state = path.join(root, 'docs', 'STATE.md');
  if (exists(state)) {
    const printed = ['## Now', '## Open debt']
      .map((h) => readSection(state, h) || `${h}\n\n(section missing, see templates/STATE.md)\n`)
      .join('\n');
    out.push(
      '',
      '## docs/STATE.md, sections Now and Open debt',
      capped(printed, STATE_PRINT_BUDGET, 'docs/STATE.md')
    );
    const errors = stateShapeErrors(fs.readFileSync(state, 'utf8'));
    if (errors.length)
      out.push(
        '',
        `docs/STATE.md breaks the shape of templates/STATE.md (ADR-0018); the Stop gate blocks until it is fixed: ${errors.join('; ')}`
      );
  } else {
    out.push(
      '',
      'docs/STATE.md is missing: create it from templates/STATE.md before finishing the work.'
    );
  }

  const updates = path.join(root, 'docs', 'upstream', 'UPDATES.md');
  if (exists(updates)) {
    const heading = fs
      .readFileSync(updates, 'utf8')
      .split('\n')
      .find((l) => /^##\s+\d{4}-\d{2}-\d{2}/.test(l));
    // ADR-0019: a pointer only; the digest is read on demand by upstream-watcher and /upstream-check.
    if (heading)
      out.push(
        '',
        `Latest upstream digest: ${heading.replace(/^##\s+/, '').trim()} (docs/upstream/UPDATES.md).`
      );
  }

  // Toolchain check against docs/architecture/STACK.md expectations.
  let expectedNode = 22;
  let expectedCds = 10;
  const stack = path.join(root, 'docs', 'architecture', 'STACK.md');
  if (exists(stack)) {
    const text = fs.readFileSync(stack, 'utf8');
    const n = text.match(/Node\.js\s*\|\s*(\d+)/);
    const c = text.match(/cds-dk`?\s*globally\s*\|\s*(\d+)/);
    if (n) expectedNode = Number(n[1]);
    if (c) expectedCds = Number(c[1]);
  }
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const cds = run('cds', ['--version'], { timeoutMs: 8_000 });
  const cdsMatch = cds.stdout.match(/@sap\/cds-dk[^\d]*(\d+)\.(\d+)\.(\d+)/);
  const cdsVersion = cdsMatch ? `${cdsMatch[1]}.${cdsMatch[2]}.${cdsMatch[3]}` : null;
  const warn = [];
  if (nodeMajor !== expectedNode)
    warn.push(`Node ${process.versions.node}, expected ${expectedNode}.x`);
  if (!cdsVersion) warn.push('global `cds` not found: npm i -g @sap/cds-dk@10');
  else if (Number(cdsMatch[1]) !== expectedCds)
    warn.push(`@sap/cds-dk ${cdsVersion}, expected ${expectedCds}.x`);
  out.push(
    '',
    '## Environment',
    `Node ${process.versions.node}, @sap/cds-dk ${cdsVersion || 'not found'}.` +
      (warn.length ? ` WARNING: ${warn.join('; ')}.` : ' Matches STACK.md.')
  );

  out.push(
    '',
    'Protocol: MCP-first (routing in the project-protocol skill, section 3), backlog in GitHub Issues (/backlog, ADR-0019), specification in docs/features/<name>/ before code, registry docs/registry/ before new functions. Rules in CLAUDE.md and .claude/rules/.'
  );

  process.stdout.write(out.join('\n') + '\n');
} catch (e) {
  process.stdout.write(`SessionStart hook: failed to collect context (${e.message}).\n`);
}
process.exit(0);
