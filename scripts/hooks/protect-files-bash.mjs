/**
 * PreToolUse hook (Bash): a guardrail, not a boundary. It intercepts a shell command that
 * looks like it writes to a pipeline-protected path, because Bash writes are invisible to
 * protect-files.mjs (which only sees Edit/Write) and to post-edit.mjs. ADR-0016.
 *
 * A subagent is denied: an unattended /feature run must not stall on a prompt, and a subagent
 * has no business editing the pipeline's own configuration. The main thread gets "ask", so the
 * user can approve a deliberate maintenance edit in the moment instead of restarting the session.
 * Either way the decision is the user's: PIPELINE_ALLOW_PROTECTED=1 is read from the Claude Code
 * process environment, which an agent cannot set for itself.
 *
 * False negatives are expected and accepted (a path built at runtime, a generator, base64): the
 * boundary is the git-based audit in subagent-stop.mjs / stop-gate.mjs, which sees the result of
 * a write however it was produced.
 */
import path from 'node:path';
import { readStdinJson, repoRoot, rel, insideRepo, emitJson } from '../lib/hook-utils.mjs';
import { protectedHit, reasonFor } from '../lib/protected-paths.mjs';

/** Commands that write to every path they are given (in place or by applying a patch). */
const IN_PLACE = [
  /\btee\b/,
  /\bsed\s+(?:-[^\s]*\s+)*-i/,
  /\bperl\s+(?:-[^\s]*\s+)*-i/,
  /\bpatch\b/,
  /\bgit\s+apply\b/,
  /\bgit\s+(?:checkout|restore)\s+--(?:\s|$)/,
  /\btruncate\b/,
  /\bdd\b[^|;]*\bof=/,
  // `mv a b` writes b and removes a, so both ends are a mutation, unlike `cp`.
  /\bmv\b/,
];

/** Commands whose LAST path argument is the destination; earlier ones are only read. */
const LAST_ARG_IS_TARGET = /\b(?:cp|install|rsync|ln)\b/;

const WRITE_API =
  /writeFileSync|appendFileSync|createWriteStream|\.write\s*\(|write_text|open\s*\([^)]*['"][wa]/;

/** Tokens that look like a path to a file inside the repo. */
function pathTokens(cmd) {
  return (
    cmd.match(/[A-Za-z0-9_@./*-]*\/[A-Za-z0-9_@./*-]+|[.\w-]+\.(?:json|ya?ml|md|mjs|cjs|js)\b/g) ||
    []
  )
    .map((t) => t.replace(/^['"]|['"]$/g, ''))
    .filter((t) => t && !t.startsWith('http') && !t.startsWith('/dev/'));
}

/** Explicit redirection targets: `> file`, `>> file`, but not `2>&1` or `&>`. */
function redirectTargets(cmd) {
  const out = [];
  const re = /(^|[^0-9&>])>{1,2}\s*(['"]?)([^\s'";|&)]+)\2/g;
  let m;
  while ((m = re.exec(cmd)) !== null) out.push(m[3]);
  return out;
}

function candidates(cmd) {
  const set = new Set(redirectTargets(cmd));
  const tokens = pathTokens(cmd);
  const heredoc = /<<-?\s*['"]?\w+/.test(cmd);
  const inlineScript = /\b(?:node|python3?|perl|ruby)\b[^|;]*\s-(?:e|c)\b/.test(cmd);

  // A script fed through a heredoc or -e/-c can write anywhere; treat every path it names as a
  // candidate, but only when the script actually calls a write API.
  if ((heredoc || inlineScript) && WRITE_API.test(cmd)) for (const t of tokens) set.add(t);
  if (IN_PLACE.some((re) => re.test(cmd))) for (const t of tokens) set.add(t);
  // `cp a b` reads a and writes b: only the destination counts, or copying a protected file out
  // of the repo would be blocked as if it were a write.
  if (LAST_ARG_IS_TARGET.test(cmd) && tokens.length) set.add(tokens[tokens.length - 1]);
  return [...set];
}

try {
  if (process.env.PIPELINE_ALLOW_PROTECTED === '1') process.exit(0);
  const input = readStdinJson();
  if ((input.tool_name || '') !== 'Bash') process.exit(0);
  const cmd = input.tool_input?.command || '';
  if (!cmd) process.exit(0);

  const root = repoRoot();
  const cwd = input.cwd || root;
  const hits = [];
  for (const token of candidates(cmd)) {
    const abs = path.isAbsolute(token) ? token : path.resolve(cwd, token);
    const r = rel(abs, root);
    if (!insideRepo(r)) continue;
    const hit = protectedHit(r);
    if (hit) hits.push({ r, hit });
  }
  if (!hits.length) process.exit(0);

  const isSubagent = Boolean(input.agent_id);
  const list = hits.map((h) => `"${h.r}" (${reasonFor(h.hit)})`).join('; ');
  const shared =
    `This Bash command looks like it writes to a protected path: ${list}. ` +
    'A shell write also bypasses the per-file-type checks, so use Edit/Write for ordinary files. ' +
    'If the command only reads the file, rewrite it so the protected path is not an argument of a writing command.';

  emitJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: isSubagent ? 'deny' : 'ask',
      permissionDecisionReason: isSubagent
        ? `${shared} A subagent may not change the pipeline configuration; report the need instead, and the user decides.`
        : `${shared} Approve only if this change was asked for.`,
    },
  });
} catch {
  // guardrail: never break a tool call on an internal error
}
process.exit(0);
