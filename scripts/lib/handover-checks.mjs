/**
 * The blocking checks of a subagent's hand-over (ADR-0031 decision 8), one implementation for two
 * hooks: the handback gate (PreToolUse `SubagentHandback`, the report is `tool_input.message`) and
 * SubagentStop on a plain-text end (the report is `last_assistant_message`). Three checks, in this
 * order, the first that finds something decides:
 *   lint       root ESLint, per app ui5lint and the app ESLint over the changed files of the lint
 *              scope (ADR-0029 decision 7, amendment D-F); errors and a run without a report block
 *   protected  a protected path among the changed files no `edit` record explains, unless the
 *              session runs with PIPELINE_ALLOW_PROTECTED=1 or the report names every such path
 *              (ADR-0016 layer 1)
 *   mcp        an edit without its MCP query and without a `## MCP not used` section in the report,
 *              once per agent (ADR-0014)
 * Lint scope: the changed files this agent's `edit` records name, plus the changed files no `edit`
 * record names at all (written outside Edit/Write, linted whoever wrote them); a file only another
 * agent's records explain is skipped. The saved report of an agent (ADR-0031 decision 7 level 2,
 * Q8) is `.pipeline/logs/report-<agent_type>-<agent_id>.md`, written by both hooks.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  changedFiles,
  isUnder,
  truncate,
  findUp,
  exists,
  relay,
  countLines,
  repoRoot,
  LOGS_DIR,
} from './hook-utils.mjs';
import { agentKey, readAudit, appendAudit, mcpGaps } from './mcp-audit.mjs';
import { protectedWriteHit, reasonFor } from './protected-paths.mjs';
import {
  runLinter,
  appHasTool,
  notInstalledNote,
  UI5_SCOPE,
  APP_ESLINT_SCOPE,
  APP_ESLINT_EXCLUDE,
} from './file-checks.mjs';
import { metricsAgent } from './metrics-log.mjs';
import { HANDBACK_TOOL } from './transcript-usage.mjs';

// The tool name is a transcript fact, defined once with its reader (deliveredReports()).
export { HANDBACK_TOOL };

const TIMEOUT = 150_000;
/**
 * Denies of one agent id per session after which the handback gate lets the next attempt pass
 * with a `handback-limit` gate record. Measured (probe fact F9, Claude Code 2.1.322): after a deny
 * Claude Code asks the agent three times to deliver, so a fourth attempt is the last it runs; a
 * fourth deny ends the agent with its report withheld.
 */
export const HANDBACK_DENY_MAX = 3;
/** The audit record of one handback deny: `{ event, agent, agentType, reason }`. */
export const HANDBACK_DENY = 'handback-deny';
const MCP_MARKER = /#{1,4}\s*MCP not used\b/i;
/** One errorLines() finding: `<file>:<line>:<column> <message> (<rule>)` on one line. */
const ERROR_LINE = /^(.+?):(?:\d+|\?):(?:\d+|\?) .* \(([^()]+)\)$/;

/** The blocking lines of one `runLinter` result: errors (severity 2) and a failed run. */
export function errorLines(root, label, result) {
  if (result.failure) return [`${label}: ${result.failure}`];
  return result.messages
    .filter((m) => m.severity === 2)
    .map(
      (m) =>
        `${path.relative(root, m.file)}:${m.line ?? '?'}:${m.column ?? '?'} ${m.message} (${m.ruleId || 'parse'})`
    );
}

export function eslintErrors(root, files) {
  if (!files.length) return [];
  return errorLines(root, 'eslint', runLinter('eslint', root, files, TIMEOUT));
}

/**
 * Per app: ui5lint on the changed UI5 files and one app ESLint pass on the changed JavaScript of
 * `APP_ESLINT_SCOPE` (ADR-0029 amendment E). A tool the app has not installed is not run; it is
 * an advisory, because an agent may not install dependencies (amendment F).
 */
export function appErrors(root, files) {
  const byApp = new Map();
  for (const f of files) {
    const appDir = findUp(path.dirname(path.resolve(root, f)), 'ui5.yaml', root);
    if (!appDir) continue;
    if (!byApp.has(appDir)) byApp.set(appDir, []);
    byApp.get(appDir).push(path.relative(appDir, path.resolve(root, f)).split(path.sep).join('/'));
  }
  const errors = [];
  const notes = [];
  for (const [appDir, rels] of byApp) {
    const app = path.relative(root, appDir);
    const js = rels.filter((r) => isUnder(r, APP_ESLINT_SCOPE) && !isUnder(r, APP_ESLINT_EXCLUDE));
    for (const [tool, targets] of [
      ['ui5lint', rels],
      ['eslint', js],
    ]) {
      if (!targets.length) continue;
      if (!appHasTool(appDir, tool)) notes.push(notInstalledNote(root, appDir, tool));
      else
        errors.push(
          ...errorLines(root, `${tool} (${app})`, runLinter(tool, appDir, targets, TIMEOUT))
        );
    }
  }
  return { errors, notes };
}

/**
 * The write route of the hand-over (ADR-0016 layer 1): the session's audit, the changed files that
 * exist, those no `edit` record names (`unrecorded`), the lint scope of this agent, and the
 * protected paths among the unrecorded files.
 * @param {string} root repo root
 * @param {object} input hook input (session_id, agent_id)
 * @returns {{records: object[], changed: string[], unrecorded: string[], lintScope: string[],
 *   protectedWrites: {p: string, hit: string}[]}}
 */
export function writeRoute(root, input) {
  const changed = changedFiles(root)
    .filter((c) => c.status !== 'D' && !c.status.startsWith('D'))
    .map((c) => c.path)
    .filter((p) => exists(path.resolve(root, p)) && fs.statSync(path.resolve(root, p)).isFile());
  const records = readAudit(root, input.session_id);
  const edits = records.filter((e) => e.event === 'edit' && e.file);
  const recorded = new Set(edits.map((e) => e.file));
  const agent = agentKey(input);
  const mine = new Set(edits.filter((e) => e.agent === agent).map((e) => e.file));
  const unrecorded = changed.filter((p) => !recorded.has(p));
  return {
    records,
    changed,
    unrecorded,
    lintScope: changed.filter((p) => mine.has(p) || !recorded.has(p)),
    protectedWrites: unrecorded
      .map((p) => ({ p, hit: protectedWriteHit(root, p) }))
      .filter((x) => x.hit),
  };
}

/** The protected writes as list lines, `  <path> (<reason>)`. */
function protectedList(writes) {
  return writes.map((x) => `  ${x.p} (${reasonFor(x.hit)})`);
}

/**
 * Runs the three hand-over checks for the agent of `input` against its `report`. Writes the
 * ADR-0014 records of a hand-over that passes the lint and protected checks: `justification` when
 * the report has the `## MCP not used` section, `skipped-unjustified` on an attempt after the one
 * MCP block (an earlier `handback-deny` with reason `mcp` of this agent; SubagentStop also
 * `stop_hook_active`). Prints nothing, exits nothing: the hook decides.
 * @param {string} root repo root
 * @param {object} input hook input (session_id, agent_id, agent_type, hook_event_name,
 *   stop_hook_active)
 * @param {string} report the report text the checks read
 * @returns {{reason: 'lint'|'protected'|'mcp'|null, lines: string[], notes: string[],
 *   advisories: string[], route: object, root: string}} `reason` the first check that blocks, null
 *   for a pass; `lines` its findings; `notes` the "not installed" notes of the lint check;
 *   `advisories` every non-blocking note including `notes`; `route` the result of writeRoute();
 *   `root` where blockText() writes the log of a long text
 */
export function handoverFindings(root, input, report) {
  const text = typeof report === 'string' ? report : '';
  const route = writeRoute(root, input);
  const scope = route.lintScope;
  const cdsAndSrv = scope.filter(
    (p) =>
      p.endsWith('.cds') ||
      isUnder(p, ['srv/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'])
  );
  const app = appErrors(
    root,
    scope.filter((p) => isUnder(p, UI5_SCOPE))
  );
  const notes = app.notes;
  const advisories = [...notes];
  const result = (reason, lines = []) => ({ reason, lines, notes, advisories, route, root });

  const errors = [...eslintErrors(root, cdsAndSrv), ...app.errors];
  if (errors.length) return result('lint', errors);

  if (route.protectedWrites.length) {
    // Only the environment variable counts as sanction: a branch name is not a boundary, any
    // agent can create `chore/x` (ADR-0016).
    const list = protectedList(route.protectedWrites).join('\n');
    if (process.env.PIPELINE_ALLOW_PROTECTED === '1')
      advisories.push(`Protected files changed with PIPELINE_ALLOW_PROTECTED=1:\n${list}`);
    else if (route.protectedWrites.every((x) => text.includes(x.p)))
      advisories.push(
        `Protected files changed outside Edit/Write, named in the report for the user:\n${list}`
      );
    else return result('protected', protectedList(route.protectedWrites));
  }

  const agent = agentKey(input);
  const agentType = input.agent_type || 'main';
  const gaps = mcpGaps(route.records, agent);
  if (gaps.length) {
    const files = gaps.map((g) => g.file);
    // Once per agent across both hooks: a plain-text end between two denied handbacks (F9) is a
    // SubagentStop after the handback gate's MCP deny.
    const repeat =
      route.records.some(
        (r) => r.event === HANDBACK_DENY && r.agent === agent && r.reason === 'mcp'
      ) ||
      (input.hook_event_name !== 'PreToolUse' && Boolean(input.stop_hook_active));
    if (MCP_MARKER.test(text)) {
      const idx = text.search(MCP_MARKER);
      appendAudit(root, input.session_id, {
        event: 'justification',
        agent,
        agentType,
        files,
        text: truncate(text.slice(idx, idx + 800), 800),
      });
    } else if (repeat) {
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
      return result(
        'mcp',
        gaps.map((g) => `  ${g.file} (${g.label}) → ${g.needs.join(' or ')}`)
      );
    }
  }
  return result(null);
}

/** The text around the findings of each block reason; `next` is what the agent does after the fix. */
function blockFrame(reason, count, next) {
  if (reason === 'lint')
    return {
      head: `The subagent cannot finish: ${count} linter errors in changed files. Fix them and ${next}.\n`,
      foot: '',
    };
  if (reason === 'protected')
    return {
      head:
        'Protected files were changed outside Edit/Write, so the PreToolUse guard never saw them ' +
        '(rule pipeline-config.md, ADR-0016):\n',
      foot:
        'Do not revert them yourself: the Bash guard denies `git checkout` to a subagent. List every one of these ' +
        'paths in your report under "## Open questions" and let the orchestrator and the user decide; then ' +
        `${next}. A deliberate change needs a session started with PIPELINE_ALLOW_PROTECTED=1, which only the user can set.\n`,
    };
  if (reason === 'mcp')
    return {
      head: 'MCP check (rule pipeline-config.md, ADR-0014): you edited files that expect an MCP query first, but this agent made no attempt:\n',
      foot: `Either run the query now and re-check your change against the result, or add a section "## MCP not used" to your report with one line per file: \`path → reason\` (why the query was unnecessary, for example a text fix, or impossible, for example the server was unavailable). Then ${next}.\n`,
    };
  return null;
}

/**
 * The summary by structure of block findings that do not fit HOOK_OUTPUT_MAX: for `lint` the
 * errors per rule and per file plus every linter run without a report, for `protected` and `mcp`
 * the paths per reason or rule-table row (the first parenthesised part of a line).
 */
function findingsSummary(reason, lines) {
  if (reason !== 'lint') {
    const keys = lines.map((l) => l.match(/\(([^()]+)\)/)?.[1] || 'other');
    return `${lines.length} paths, counted by ${reason === 'mcp' ? 'rule' : 'reason'}:\n${countLines(keys)}`;
  }
  const parsed = lines.map((l) => l.match(ERROR_LINE));
  const found = parsed.filter(Boolean);
  const failed = lines.filter((l, i) => !parsed[i]);
  const parts = [];
  if (found.length)
    parts.push(
      `Errors per rule:\n${countLines(found.map((m) => m[2]))}`,
      `Errors per file:\n${countLines(found.map((m) => m[1]))}`
    );
  if (failed.length)
    parts.push(
      `Linter runs without a JSON report or other lines:\n${failed
        .map((l) => `  ${l.split(':')[0]}: ${l.length} characters`)
        .join('\n')}`
    );
  return parts.join('\n');
}

/**
 * The block text of handoverFindings() with a reason, the same for both hooks, relayed by relay():
 * every finding when the text has at most HOOK_OUTPUT_MAX characters, otherwise findingsSummary()
 * with the path of a log under .pipeline/logs/ holding the whole (ADR-0031 decisions 4 and 8).
 * @param {{reason: string, lines: string[], root?: string}} findings
 * @param {string} next what the agent does after the fix: "finish again" (SubagentStop) or "call
 *   SubagentHandback again" (handback gate)
 * @returns {string} the text, '' for a pass
 */
export function blockText(findings, next) {
  const { reason, lines } = findings;
  const frame = blockFrame(reason, lines.length, next);
  if (!frame) return '';
  return relay(
    findings.root || repoRoot(),
    `handover-${reason}`,
    `${frame.head}${lines.join('\n')}\n${frame.foot}`,
    () => `${frame.head}${findingsSummary(reason, lines)}\n${frame.foot}`
  );
}

/**
 * Path of an agent's saved report.
 * @param {string} root repo root
 * @param {string} agentType the agent type (`unknown` when empty)
 * @param {string} agentId the agent id, with or without a leading `agent-`
 * @returns {string} absolute path `.pipeline/logs/report-<agent_type>-<agent_id>.md`
 */
export function reportPath(root, agentType, agentId) {
  const safe = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_');
  const id = String(agentId || 'unknown').replace(/^agent-/, '');
  return path.join(root, LOGS_DIR, `report-${safe(agentType || 'unknown')}-${safe(id)}.md`);
}

/**
 * Writes the report of the agent of `input` whole to its reportPath(); a later report of the same
 * agent id overwrites it. Throws when the file cannot be written.
 * @param {string} root repo root
 * @param {object} input hook input (agent_id, agent_type)
 * @param {string} text the report
 * @returns {string} the path written
 */
export function saveReport(root, input, text) {
  const file = reportPath(root, input.agent_type, metricsAgent(input));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}
