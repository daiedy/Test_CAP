/**
 * The role brief of ADR-0031 decision 2: for an agent type and a `/feature` phase, the slice of a
 * feature's PLAN.md, CONTEXT.md and SCREENS.md that agent needs, with a `## Not included` list that
 * names every omitted section, so nothing is cut silently (ADR-0018). `briefFor()` is pure;
 * `readFeatureDocs()`, `writeBrief()`, `readBudget()` and `recordCeilings()` do the I/O. Read by the
 * SubagentStart hook, scripts/feature-brief.mjs and scripts/check-feature-docs.mjs. The documents
 * are read through doc-shapes.mjs and the Steps rows through `stepRows()`, the reader of D12.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sections, subsections, lineOf, criteriaPhaseOf, readersOf } from './doc-shapes.mjs';
import { stepRows } from './pipeline-metrics.mjs';
import { sha256, BRIEF_DIR } from './hook-utils.mjs';

/** SCREENS.md sections written for the plan gate: in no brief. */
export const PLAN_GATE_SCREENS = Object.freeze([
  '## Floorplan and duplication check',
  '## Alternatives',
  '## Open questions for the user',
]);
const DEVELOPER_SCREENS_EXCLUDE = Object.freeze([...PLAN_GATE_SCREENS, '## Verifier scenarios']);

/**
 * What each agent type receives (CONTEXT "Backend: the brief"). `group` keys the ceiling in
 * test/context-budget.json; `preamble` the PLAN.md text before its first section; `criteria` the
 * phases of the criteria it gets besides `### Every phase` ('own' the launch phase, 'all' every
 * criterion); `readers` the CONTEXT.md reader its subsections need besides `All` (null: no part of
 * CONTEXT.md); `screensExclude` the SCREENS.md sections left out of its reading list (null: none of
 * SCREENS.md). Every other agent type (`reviewer`, `architect`, `ux-designer`) reads whole.
 */
export const BRIEF_ROLES = Object.freeze({
  'cap-backend-dev': { group: 'backend', preamble: true, criteria: 'own', readers: 'Backend' },
  'test-backend': { group: 'backend', preamble: true, criteria: 'own', readers: 'Backend' },
  'fiori-app-dev': {
    group: 'ui',
    preamble: true,
    criteria: 'own',
    readers: 'UI',
    screensExclude: DEVELOPER_SCREENS_EXCLUDE,
  },
  'ui5-freestyle-dev': {
    group: 'ui',
    preamble: true,
    criteria: 'own',
    readers: 'UI',
    screensExclude: DEVELOPER_SCREENS_EXCLUDE,
  },
  'test-ui': {
    group: 'ui',
    preamble: true,
    criteria: 'own',
    readers: 'UI',
    screensExclude: PLAN_GATE_SCREENS,
  },
  'ui-verifier': { group: 'verifier', criteria: ['3', '4'], screensExclude: PLAN_GATE_SCREENS },
  'docs-keeper': { group: 'docs', criteria: 'all' },
});

/** Agent types per role group, derived from BRIEF_ROLES. */
export const ROLE_GROUPS = Object.freeze(
  Object.entries(BRIEF_ROLES).reduce((out, [type, role]) => {
    (out[role.group] ||= []).push(type);
    return out;
  }, {})
);

// Brief files, repo-relative; pruned by SessionStart with the logs. Defined in hook-utils.mjs, so
// the context card of pipeline-metrics.mjs (which this module imports) reads the same folder.
export { BRIEF_DIR };
/** Ceilings of the brief bytes per role group, `--record` of scripts/feature-brief.mjs. */
export const BUDGET_FILE = 'test/context-budget.json';

const FILES = { plan: 'PLAN.md', context: 'CONTEXT.md', screens: 'SCREENS.md' };
const FEATURE_NAME = /^[A-Za-z0-9][\w-]*$/;

const bytesOf = (lines) => Buffer.byteLength(lines.join('\n'));
const isBlank = (lines) => lines.every((l) => !l.trim());

/**
 * A byte count with thousands separators, as the brief and the CLI print it.
 * @param {number} n the count
 * @returns {string} `42,213` for 42213
 */
export function groupDigits(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
const grouped = groupDigits;

function trimmed(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

/** Last non-blank line number of a section or subsection. */
function lastLine(sec) {
  let i = sec.lines.length - 1;
  while (i >= 0 && !sec.lines[i].trim()) i--;
  return i >= 0 ? lineOf(sec, i) : sec.start;
}

const block = (sec) => (sec.heading ? [sec.heading, ...sec.lines] : sec.lines);

/** Path of the brief of an agent type and phase, repo-relative posix. */
export function briefPath(agentType, phase) {
  return `${BRIEF_DIR}/${agentType}-${phase}.md`;
}

/** Whether a criteria subsection reaches the role. */
function criteriaFor(role, phase, subPhase) {
  if (role.criteria === 'all') return true;
  if (subPhase === 'every') return true;
  if (!subPhase) return false;
  return role.criteria === 'own' ? subPhase === phase : role.criteria.includes(subPhase);
}

/** The PLAN.md part of a brief: own rows, criteria, omitted sections, ADRs and research named by the rows. */
function planPart(plan, file, role, phase, own, table) {
  const omitted = [];
  const secs = sections(plan);
  const preamble = secs[0].lines.filter((l) => !/^# /.test(l));
  const out = { preamble: role.preamble ? trimmed(preamble) : [], criteria: [], omitted };
  if (!role.preamble && !isBlank(preamble))
    omitted.push({ file, heading: '(preamble)', bytes: bytesOf(secs[0].lines) });
  const ownLines = new Set(own.map((r) => r.line));
  const others = table.rows.filter((r) => !ownLines.has(r.line));
  for (const sec of secs.slice(1)) {
    if (sec.heading === '## Steps') {
      if (others.length)
        omitted.push({
          file,
          heading: '## Steps',
          note: `rows of steps ${others.map((r) => r.step).join(', ')}`,
          bytes: bytesOf(others.map((r) => r.line)),
        });
      continue;
    }
    if (sec.heading !== '## Acceptance criteria') {
      omitted.push({ file, heading: sec.heading, bytes: bytesOf(block(sec)) });
      continue;
    }
    for (const sub of subsections(sec)) {
      if (!sub.heading && isBlank(sub.lines)) continue;
      const subPhase = sub.heading ? criteriaPhaseOf(sub.heading) : null;
      if (criteriaFor(role, phase, subPhase)) out.criteria.push(trimmed(block(sub)));
      else
        omitted.push({
          file,
          heading: sub.heading || '(before the first subsection)',
          parent: sec.heading,
          bytes: bytesOf(block(sub)),
        });
    }
  }
  return out;
}

/** The CONTEXT.md part of a brief: sections in file order and the omitted ones. */
function contextPart(context, file, readers) {
  const omitted = [];
  const blocks = [];
  if (!context) return { blocks, omitted };
  const secs = sections(context);
  if (!readers) {
    omitted.push({ file, heading: '(whole file)', bytes: Buffer.byteLength(context) });
    return { blocks, omitted };
  }
  if (!isBlank(secs[0].lines.filter((l) => !/^# /.test(l))))
    omitted.push({ file, heading: '(preamble)', bytes: bytesOf(secs[0].lines) });
  for (const sec of secs.slice(1)) {
    if (sec.heading === '## Open questions') {
      omitted.push({ file, heading: sec.heading, bytes: bytesOf(block(sec)) });
      continue;
    }
    const kept = [];
    for (const sub of subsections(sec)) {
      if (!sub.heading) {
        if (!isBlank(sub.lines)) kept.push(trimmed(sub.lines));
        continue;
      }
      const r = readersOf(sub.heading) || [];
      if (r.includes('All') || r.includes(readers)) kept.push(trimmed(block(sub)));
      else
        omitted.push({
          file,
          heading: sub.heading,
          parent: sec.heading,
          bytes: bytesOf(block(sub)),
        });
    }
    // A section whose every subsection went to `omitted` prints no empty heading.
    if (kept.length) blocks.push([sec.heading, '', ...kept.flatMap((k) => [...k, ''])]);
  }
  return { blocks, omitted };
}

/** SCREENS.md reading list entries and the omitted sections. */
function screensPart(screens, file, exclude) {
  const omitted = [];
  const list = [];
  if (!screens) return { list, omitted };
  const secs = sections(screens);
  if (!exclude) {
    const count = secs.filter((s) => s.heading).length;
    omitted.push({
      file,
      heading: '(whole file)',
      note: `${count} sections`,
      bytes: Buffer.byteLength(screens),
    });
    return { list, omitted };
  }
  for (const sec of secs) {
    if (!sec.heading && isBlank(sec.lines)) continue;
    const heading = sec.heading || '(preamble)';
    const bytes = bytesOf(block(sec));
    if (sec.heading && exclude.includes(sec.heading)) omitted.push({ file, heading, bytes });
    else
      list.push(
        `- \`${file}\` lines ${sec.start}-${lastLine(sec)}: ${sec.heading ? `\`${heading}\`` : heading} (${grouped(bytes)} bytes)`
      );
  }
  return { list, omitted };
}

/** The feature's ADRs (backticked paths under `## Decisions that require an ADR`) by number. */
function featureAdrs(plan) {
  const sec = sections(plan).find((s) => s.heading === '## Decisions that require an ADR');
  const adrs = new Map();
  for (const m of (sec?.lines || [])
    .join('\n')
    .matchAll(/`(?:docs\/decisions\/)?(ADR-(\d{4})[^`]*\.md)`/g))
    if (!adrs.has(m[2])) adrs.set(m[2], `docs/decisions/${m[1]}`);
  return adrs;
}

/** Reading list entries for the feature ADRs and the research files the own rows name. */
function namedByRows(plan, name, own) {
  const adrs = featureAdrs(plan);
  const adrRefs = new Map();
  const research = new Map();
  const add = (map, key, step, what) => {
    if (!map.has(key)) map.set(key, { steps: new Set(), what: new Set() });
    map.get(key).steps.add(step);
    if (what) map.get(key).what.add(what);
  };
  for (const row of own) {
    for (const m of row.line.matchAll(/ADR-(\d{4})((?:\s+(?:decisions?|amendment)\b[^;)|]*)?)/g))
      if (adrs.has(m[1])) add(adrRefs, adrs.get(m[1]), row.step, m[2].trim());
    for (const m of row.line.matchAll(/`(?:docs\/features\/[^/`]+\/)?(research\/[^`\s]+)`/g))
      add(research, `docs/features/${name}/${m[1]}`, row.step);
  }
  const steps = (e) => `step${e.steps.size > 1 ? 's' : ''} ${[...e.steps].join(', ')}`;
  return [
    ...[...adrRefs].map(
      ([p, e]) => `- \`${p}\`: ${e.what.size ? [...e.what].join('; ') : 'whole'} (${steps(e)})`
    ),
    ...[...research].map(([p, e]) => `- \`${p}\` (${steps(e)})`),
  ];
}

function notIncludedLine(o) {
  const where = o.parent ? ` in \`${o.parent}\`` : '';
  const heading = o.heading.startsWith('#') ? `\`${o.heading}\`` : o.heading;
  const note = o.note ? `: ${o.note}` : '';
  return `- \`${o.file}\` ${heading}${where}${note} (${grouped(o.bytes)} bytes)`;
}

/**
 * The brief of one agent type for one phase of a feature (ADR-0031 decision 2): a header with the
 * feature, the phase, the step numbers and the content hashes of the sources; the PLAN.md preamble
 * for the implementer and tester roles; `## Your steps` (the table header and the agent's rows of
 * that phase); `## Acceptance criteria` (the subsections of its phases and `### Every phase`); the
 * CONTEXT.md sections for its readers in file order; `## Reading list` (SCREENS.md sections with line
 * ranges, the feature ADRs and `research/` files its rows name); `## Not included` (file, heading
 * and bytes of every omitted section; for a file the role reads none of, one line for the file).
 * @param {{name: string, plan: string, context?: string|null, screens?: string|null}} docs the
 *   feature name and the texts of its PLAN.md, CONTEXT.md and SCREENS.md (null or absent: no file)
 * @param {string} agentType the agent type of the launch
 * @param {string|number} phase the `/feature` phase of the launch, 0-7
 * @returns {{text: string, bytes: number, chars: number, hash: string, group: string,
 *   steps: string[], sections: number, omitted: {file: string, heading: string, parent?: string,
 *   note?: string, bytes: number}[]}|null} the brief; null for an agent type that reads whole, a
 *   plan without a Steps table, or no step row of the agent type in that phase
 */
export function briefFor(docs, agentType, phase) {
  const role = Object.hasOwn(BRIEF_ROLES, agentType) ? BRIEF_ROLES[agentType] : null;
  const table = role && docs?.plan ? stepRows(docs.plan) : null;
  if (!table) return null;
  const p = String(phase);
  const own = table.rows.filter((r) => r.phase === p && r.agents.includes(agentType));
  if (!own.length) return null;
  const dir = `docs/features/${docs.name}`;
  const file = (k) => `${dir}/${FILES[k]}`;
  const plan = planPart(docs.plan, file('plan'), role, p, own, table);
  const ctx = contextPart(docs.context, file('context'), role.readers || null);
  const scr = screensPart(docs.screens, file('screens'), role.screensExclude || null);
  const reading = [...namedByRows(docs.plan, docs.name, own), ...scr.list];
  const omitted = [...plan.omitted, ...ctx.omitted, ...scr.omitted];
  const hash = (k) => (docs[k] ? sha256(docs[k]).slice(0, 12) : 'absent');
  const steps = own.map((r) => r.step);
  const lines = [
    `# Brief: ${agentType}, phase ${p}`,
    '',
    `Feature \`${docs.name}\`, phase ${p}, step${steps.length > 1 ? 's' : ''} ${steps.join(', ')}. Sources: \`${file('plan')}\` ${hash('plan')}, \`${FILES.context}\` ${hash('context')}, \`${FILES.screens}\` ${hash('screens')} (sha256, first 12).`,
    'Your slice of the feature documents (ADR-0031 decision 2, `scripts/lib/feature-brief.mjs`): read a whole file only for a section listed under "Not included".',
    '',
    ...(plan.preamble.length ? [...plan.preamble, ''] : []),
    '## Your steps',
    '',
    ...table.header,
    ...own.map((r) => r.line),
    '',
    '## Acceptance criteria',
    '',
    ...(plan.criteria.length ? plan.criteria.flatMap((c) => [...c, '']) : ['None.', '']),
    ...ctx.blocks.flat(),
    '## Reading list',
    '',
    ...(reading.length ? reading : ['None.']),
    '',
    '## Not included',
    '',
    ...(omitted.length ? omitted.map(notIncludedLine) : ['Nothing.']),
    '',
  ];
  const text = lines.join('\n');
  return {
    text,
    bytes: Buffer.byteLength(text),
    chars: text.length,
    hash: sha256(text),
    group: role.group,
    steps,
    sections: lines.filter((l) => /^## /.test(l)).length,
    omitted,
  };
}

/**
 * Every brief of a feature: one per agent type with a brief role and phase of its Steps rows, in
 * row order.
 * @param {{name: string, plan: string, context?: string|null, screens?: string|null}} docs as for
 *   `briefFor()`
 * @returns {{agentType: string, phase: string, brief: ReturnType<typeof briefFor>}[]} empty
 *   without a Steps table
 */
export function allBriefs(docs) {
  const table = docs?.plan ? stepRows(docs.plan) : null;
  const seen = new Set();
  const out = [];
  for (const row of table?.rows || []) {
    for (const agentType of row.agents) {
      const key = `${agentType}-${row.phase}`;
      if (seen.has(key) || row.phase === 'none') continue;
      seen.add(key);
      const brief = briefFor(docs, agentType, row.phase);
      if (brief) out.push({ agentType, phase: row.phase, brief });
    }
  }
  return out;
}

/**
 * Reads the documents of a feature folder.
 * @param {string} root repo root
 * @param {string} name feature folder under docs/features, a kebab name
 * @returns {{name: string, plan: string, context: string|null, screens: string|null}|null} null for
 *   a name that is not a folder name or a folder without PLAN.md
 */
export function readFeatureDocs(root, name) {
  if (!FEATURE_NAME.test(String(name ?? ''))) return null;
  const dir = path.join(root, 'docs', 'features', name);
  const read = (f) => {
    try {
      return fs.readFileSync(path.join(dir, f), 'utf8');
    } catch {
      return null;
    }
  };
  const plan = read(FILES.plan);
  return plan === null
    ? null
    : { name, plan, context: read(FILES.context), screens: read(FILES.screens) };
}

/**
 * Builds the brief of an agent type and phase and writes it to `.pipeline/brief/<type>-<phase>.md`.
 * @param {string} root repo root
 * @param {string} name feature folder under docs/features
 * @param {string} agentType the agent type of the launch
 * @param {string|number} phase the `/feature` phase of the launch
 * @returns {(ReturnType<typeof briefFor> & {path: string})|null} the brief with its repo-relative
 *   path; null when there is no brief (see `briefFor()`) or no PLAN.md
 */
export function writeBrief(root, name, agentType, phase) {
  if (!/^[0-7]$/.test(String(phase))) return null;
  const docs = readFeatureDocs(root, name);
  const brief = docs && briefFor(docs, agentType, phase);
  if (!brief) return null;
  const rel = briefPath(agentType, phase);
  fs.mkdirSync(path.join(root, BRIEF_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, rel), brief.text);
  return { ...brief, path: rel };
}

/**
 * Reads test/context-budget.json.
 * @param {string} root repo root
 * @returns {{budget: object|null, error: string|null}} `budget` null when the file is absent (no
 *   ceiling yet) or unparsable, `error` the finding for an unparsable file
 */
export function readBudget(root) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(root, BUDGET_FILE), 'utf8');
  } catch {
    return { budget: null, error: null };
  }
  try {
    return { budget: JSON.parse(raw), error: null };
  } catch (e) {
    return { budget: null, error: `${BUDGET_FILE}: not valid JSON (${e.message})` };
  }
}

/**
 * The largest brief bytes per role group.
 * @param {ReturnType<typeof allBriefs>} briefs from `allBriefs()`
 * @returns {Record<string, number>} group to bytes, only the groups that have a brief
 */
export function largestPerGroup(briefs) {
  const out = {};
  for (const { brief } of briefs) out[brief.group] = Math.max(out[brief.group] || 0, brief.bytes);
  return out;
}

/**
 * Briefs above the ceiling of their role group (`briefs.bytes` of test/context-budget.json); a
 * group without a recorded ceiling is not checked.
 * @param {string} name feature folder, for the command in the finding
 * @param {ReturnType<typeof allBriefs>} briefs from `allBriefs()`
 * @param {object|null} budget parsed test/context-budget.json
 * @returns {string[]} one finding per brief above its ceiling
 */
export function ceilingFindings(name, briefs, budget) {
  const ceilings = budget?.briefs?.bytes || {};
  return briefs
    .filter(({ brief }) => Number.isFinite(ceilings[brief.group]))
    .filter(({ brief }) => brief.bytes > ceilings[brief.group])
    .map(
      ({ agentType, phase, brief }) =>
        `brief ${briefPath(agentType, phase)}: ${grouped(brief.bytes)} bytes, above the ${brief.group} ceiling of ${grouped(ceilings[brief.group])} bytes in ${BUDGET_FILE} (node scripts/feature-brief.mjs ${name} ${agentType} ${phase} writes it)`
    );
}

/**
 * Raises the brief ceilings in test/context-budget.json to the largest brief per role group of a
 * feature (`briefs: { recordedAt, bytes, sources }`, `sources` the feature folder each ceiling was
 * measured on). Merges by maximum (Q10): per group the higher of the recorded and the measured
 * bytes, so a record never lowers a ceiling; a lower ceiling is a retro decision edited by hand. The
 * other keys of the file (`resumesAfterReport`) and the groups the feature has no brief of are kept.
 * A ratchet: run it only by a retro decision with a line in docs/CHANGELOG.md, like
 * scripts/prompt-budget.mjs --record.
 * @param {string} root repo root
 * @param {string} name feature folder the sizes are measured on
 * @returns {{bytes: Record<string, number>, previous: Record<string, number>,
 *   measured: Record<string, number>}|null} the ceilings after the record, before it and the
 *   largest briefs of the feature; null without PLAN.md or with an unparsable budget file
 */
export function recordCeilings(root, name) {
  const docs = readFeatureDocs(root, name);
  const { budget, error } = readBudget(root);
  if (!docs || error) return null;
  const previous = budget?.briefs?.bytes || {};
  const measured = largestPerGroup(allBriefs(docs));
  const bytes = { ...previous };
  const sources = { ...(budget?.briefs?.sources || {}) };
  for (const [group, n] of Object.entries(measured)) {
    if (Number.isFinite(previous[group]) && previous[group] >= n) continue;
    bytes[group] = n;
    sources[group] = name;
  }
  const next = {
    ...(budget || {}),
    briefs: { recordedAt: new Date().toISOString().slice(0, 10), bytes, sources },
  };
  fs.writeFileSync(path.join(root, BUDGET_FILE), JSON.stringify(next, null, 2) + '\n');
  return { bytes, previous, measured };
}
