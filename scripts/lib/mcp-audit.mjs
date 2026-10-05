/**
 * MCP audit log shared by the hooks (CLAUDE.md invariant 8, ADR-0014).
 * One JSONL file per session in .pipeline/ (gitignored). Record shapes:
 *   { ts, event: 'mcp' | 'skill', agent, agentType, tool, ok, subject }
 *   { ts, event: 'edit', agent, agentType, file }
 *   { ts, event: 'justification' | 'skipped-unjustified', agent, agentType, files, text? }
 * `agent` is the hook input's agent_id, or 'main' for the main thread.
 */
import path from 'node:path';
import fs from 'node:fs';
import { isUnder, readJsonl } from './hook-utils.mjs';

export const AUDIT_DIR = '.pipeline';

/**
 * File types that expect an MCP query (or a plugin skill) before the edit, and the attempts that satisfy it.
 * `manifest.json` is not here: it is denied for direct edits by the PreToolUse hook (Fiori MCP only).
 */
export const MCP_RULES = [
  {
    label: 'CDS model and services',
    files: ['db/**/*.cds', 'srv/**/*.cds'],
    needs: ['mcp__cds-mcp__search_model', 'mcp__cds-mcp__search_docs'],
  },
  {
    label: 'CAP handlers',
    files: ['srv/**/*.js'],
    needs: ['mcp__cds-mcp__search_docs', 'mcp__cds-mcp__search_model'],
  },
  {
    label: 'UI annotations',
    files: ['app/**/annotations.cds', 'app/**/annotations/**/*.cds'],
    needs: ['mcp__fiori-mcp__search_docs'],
  },
  {
    label: 'UI5 code',
    files: ['app/**/webapp/**/*.js', 'app/**/webapp/**/*.xml'],
    exclude: ['app/**/webapp/test/**', 'app/**/webapp/localService/**'],
    needs: [
      'mcp__ui5-mcp-server__get_api_reference',
      'mcp__ui5-mcp-server__get_guidelines',
      'mcp__ui5-mcp-server__run_ui5_linter',
      'mcp__fiori-mcp__search_docs',
    ],
  },
  {
    label: 'UI tests',
    files: ['app/**/webapp/test/**/*.js'],
    needs: [
      'mcp__fiori-mcp__search_docs',
      'Skill:ui5:ui5-best-practices-opa5',
      'Skill:ui5:ui5-best-practices-qunit',
    ],
  },
  {
    label: 'backend tests',
    files: ['test/**/*.js'],
    // Pipeline tests call plain functions of scripts/ (no cds.test, no model): repeated justified skips
    exclude: [
      'test/hooks-*.test.js',
      'test/metrics.test.js',
      'test/backlog.test.js',
      'test/doc-shapes.test.js',
      'test/prompt-budget.test.js',
      'test/fixtures/**',
    ],
    needs: ['mcp__cds-mcp__search_docs', 'mcp__cds-mcp__search_model'],
  },
];

export function agentKey(input) {
  return input.agent_id || 'main';
}

/**
 * `.pipeline/<prefix>-<session>.jsonl`: the layout shared by the MCP audit (`mcp-audit`) and the
 * metrics event log (`metrics`, scripts/lib/metrics-log.mjs, ADR-0022).
 */
export function sessionLogFile(root, prefix, sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(root, AUDIT_DIR, `${prefix}-${safe}.jsonl`);
}

/** Appends one record with a leading `ts` (ISO) to a session log file. */
export function appendSessionLog(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n');
}

/** Removes `<prefix>-*.jsonl` files older than `maxAgeDays`; called by SessionStart. */
export function pruneSessionLogs(root, prefix, maxAgeDays) {
  const dir = path.join(root, AUDIT_DIR);
  if (!fs.existsSync(dir)) return;
  const limit = Date.now() - maxAgeDays * 86_400_000;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(`${prefix}-`) || !name.endsWith('.jsonl')) continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).mtimeMs < limit) fs.unlinkSync(file);
    } catch {
      // best effort
    }
  }
}

export function auditFile(root, sessionId) {
  return sessionLogFile(root, 'mcp-audit', sessionId);
}

export function appendAudit(root, sessionId, record) {
  appendSessionLog(auditFile(root, sessionId), record);
}

export function readAudit(root, sessionId) {
  return readJsonl(auditFile(root, sessionId));
}

/** `mcp__plugin_<plugin>_<server>__tool` (plugin-bundled server) counts as `mcp__<server>__tool`. */
function normalizeTool(name) {
  return String(name || '').replace(/^mcp__plugin_[^_]+_/, 'mcp__');
}

/** The `MCP_RULES` entry a repo-relative path falls under, or undefined. */
export function ruleFor(file) {
  return MCP_RULES.find((x) => isUnder(file, x.files) && !(x.exclude && isUnder(file, x.exclude)));
}

/** Distinct files of the agent's `edit` records. */
export function editedFiles(records, agent) {
  return [
    ...new Set(records.filter((r) => r.agent === agent && r.event === 'edit').map((r) => r.file)),
  ];
}

/**
 * Files edited by the agent (Edit/Write records) whose rule has no attempted query by the same agent.
 * Failed attempts count: the rule is "ask MCP", not "get an answer" (server outages must not deadlock).
 * @returns {{file:string, label:string, needs:string[]}[]}
 */
export function mcpGaps(records, agent) {
  const mine = records.filter((r) => r.agent === agent);
  const attempted = new Set(
    mine.filter((r) => r.event === 'mcp' || r.event === 'skill').map((r) => normalizeTool(r.tool))
  );
  const gaps = [];
  for (const file of editedFiles(records, agent)) {
    const rule = ruleFor(file);
    if (!rule) continue;
    if (!rule.needs.some((n) => attempted.has(normalizeTool(n))))
      gaps.push({ file, label: rule.label, needs: rule.needs });
  }
  return gaps;
}

/** Removes audit files older than `maxAgeDays`; called by SessionStart. */
export function pruneAudit(root, maxAgeDays = 14) {
  pruneSessionLogs(root, 'mcp-audit', maxAgeDays);
}
