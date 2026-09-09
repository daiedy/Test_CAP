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
import { isUnder } from './hook-utils.mjs';

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
    needs: ['mcp__cds-mcp__search_docs', 'mcp__cds-mcp__search_model'],
  },
];

export function agentKey(input) {
  return input.agent_id || 'main';
}

export function auditFile(root, sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(root, AUDIT_DIR, `mcp-audit-${safe}.jsonl`);
}

export function appendAudit(root, sessionId, record) {
  const file = auditFile(root, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n');
}

export function readAudit(root, sessionId) {
  const file = auditFile(root, sessionId);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

/** `mcp__plugin_<plugin>_<server>__tool` (plugin-bundled server) counts as `mcp__<server>__tool`. */
function normalizeTool(name) {
  return String(name || '').replace(/^mcp__plugin_[^_]+_/, 'mcp__');
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
  const edited = [...new Set(mine.filter((r) => r.event === 'edit').map((r) => r.file))];
  const gaps = [];
  for (const file of edited) {
    const rule = MCP_RULES.find(
      (x) => isUnder(file, x.files) && !(x.exclude && isUnder(file, x.exclude))
    );
    if (!rule) continue;
    if (!rule.needs.some((n) => attempted.has(normalizeTool(n))))
      gaps.push({ file, label: rule.label, needs: rule.needs });
  }
  return gaps;
}

/** Removes audit files older than `maxAgeDays`; called by SessionStart. */
export function pruneAudit(root, maxAgeDays = 14) {
  const dir = path.join(root, AUDIT_DIR);
  if (!fs.existsSync(dir)) return;
  const limit = Date.now() - maxAgeDays * 86_400_000;
  for (const name of fs.readdirSync(dir)) {
    if (!/^mcp-audit-.*\.jsonl$/.test(name)) continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).mtimeMs < limit) fs.unlinkSync(file);
    } catch {
      // best effort
    }
  }
}
