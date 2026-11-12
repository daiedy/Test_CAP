/**
 * Turn budget of a subagent (ADR-0032): the `maxTurns` of every agent definition, the reserve of
 * turns before that limit, and the note the PostToolBatch hook `scripts/hooks/turn-budget.mjs`
 * hands the agent from the threshold `maxTurns - reserve(maxTurns)` on. The turn count itself is
 * `runTurns()` of scripts/lib/transcript-usage.mjs (the only transcript reader). The note is
 * model-facing text, so it is English (invariant 10) and not an i18n key. Node built-ins only, so
 * the hook loads it cheaply; never throws on a missing or unreadable agent file.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Agent definitions, relative to the repository root. */
export const AGENTS_DIR = path.join('.claude', 'agents');
/** The smallest reserve in turns: the note starts at least this many turns before the limit. */
export const TURN_RESERVE_MIN = 6;
/** The reserve as a share of `maxTurns`, rounded up; above 60 turns it outgrows TURN_RESERVE_MIN. */
export const TURN_RESERVE_SHARE = 0.1;
/**
 * Turns left (`K`) at which the note asks for the handback in this turn. 3, not 2: the probe never
 * exercised a handback in the last allowed turn (probe P6 fallback, ADR-0032 decision 4).
 */
export const TURN_LAST_CALL = 3;
/** `event` of the metrics record the hook appends per note (docs/metrics/data-flow.md section 2). */
export const TURN_NOTE_EVENT = 'turn-note';

/**
 * `maxTurns` of every agent definition, from the frontmatter of `.claude/agents/<type>.md`; the
 * only frontmatter reader of the limit (scripts/metrics.mjs and the turn-budget hook use it). An
 * agent type without a file or without `maxTurns` (Claude Code internal agents such as `claude`,
 * `general-purpose`) has no key; an unreadable file is skipped.
 * @param {string} root repository root
 * @returns {Record<string, number>} agent type to `maxTurns`
 */
export function agentMaxTurns(root) {
  const dir = path.join(root, AGENTS_DIR);
  const out = {};
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch {
      continue;
    }
    const head = text.match(/^---\n([\s\S]*?)\n---/);
    const n = head?.[1].match(/^maxTurns:\s*(\d+)/m);
    if (n) out[path.basename(name, '.md')] = Number(n[1]);
  }
  return out;
}

/**
 * The reserve of turns before the limit: `max(TURN_RESERVE_MIN, ceil(maxTurns * TURN_RESERVE_SHARE))`,
 * so 30 and 60 give 6, 70 gives 7, 80 gives 8 (every multiple of 10 up to 1,000 gives an exact
 * product, measured).
 * @param {number} maxTurns the agent type's limit
 * @returns {number}
 */
export function reserve(maxTurns) {
  return Math.max(TURN_RESERVE_MIN, Math.ceil(maxTurns * TURN_RESERVE_SHARE));
}

/**
 * The note for turn `turn` of `maxTurns`, or null below the threshold `maxTurns - reserve(maxTurns)`
 * and for anything but two positive integers (no transcript yet: turn 0). With `K = maxTurns - turn`
 * left, the note lists the closing steps; at `K <= TURN_LAST_CALL` it asks for the handback in this
 * turn, because a denied handback needs a turn to fix.
 * @param {number} turn requests of the agent's current run (`runTurns()`), the current one included
 * @param {number} maxTurns the agent type's limit (`agentMaxTurns()`)
 * @returns {string|null}
 */
export function turnNote(turn, maxTurns) {
  if (!Number.isInteger(turn) || !Number.isInteger(maxTurns) || turn < 1 || maxTurns < 1)
    return null;
  if (turn < maxTurns - reserve(maxTurns)) return null;
  const left = maxTurns - turn;
  if (left <= TURN_LAST_CALL)
    return `Turn ${turn} of ${maxTurns}: hand back your report through SubagentHandback in this turn; a denied handback needs a turn to fix.`;
  return `Turn ${turn} of ${maxTurns} (${left} left): start no new item; write the current state into your document (mark an unfinished row), stop the processes you started, hand back your report through SubagentHandback.`;
}
