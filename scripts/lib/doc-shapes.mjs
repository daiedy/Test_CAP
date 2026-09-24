/**
 * Shape rules of the documents every agent reads (ADR-0018): docs/STATE.md, and PLAN.md and
 * CONTEXT.md of a feature. Pure functions on text, shared by the PostToolUse check
 * (file-checks.mjs), the Stop gate, scripts/check-feature-docs.mjs and the tests. A shape is a
 * set of headings plus the kind of line each section may hold; nothing here counts lines.
 */

export const STATE_HEADINGS = ['## Now', '## Open debt', '## What works', '## Decisions'];
export const STATE_NOW_LABELS = ['Date', 'Branch', 'Feature', 'Phase', 'Last commit', 'Next'];

/**
 * Bytes of `Now` plus `Open debt`, the part SessionStart prints into every session and every
 * agent reads at protocol step 2: about 1,000 tokens. Measured need on 2026-09-24: 3.3 KB.
 * A ratchet: raise it only by a retro decision with a line in docs/CHANGELOG.md.
 */
export const STATE_PRINT_BUDGET = 4096;
/** The latest upstream digest section printed by SessionStart; same derivation. */
export const DIGEST_PRINT_BUDGET = STATE_PRINT_BUDGET;

export const PLAN_REQUIRED = [
  '## Acceptance criteria',
  '## Steps',
  '## Decisions that require an ADR',
  '## Risks',
];
export const CONTEXT_REQUIRED = [
  '## Request',
  '## Affected entities and services',
  '## What already exists and is reused',
  '## Applicable patterns',
  '## Open questions',
];
export const CONTEXT_ALLOWED = [
  '## Request',
  '## User decisions',
  '## Affected entities and services',
  '## What already exists and is reused',
  '## Applicable patterns',
  '## Relevant lessons',
  '## Open questions',
];

/** Splits Markdown into [{ heading, lines }]; the preamble has heading null. */
export function sections(text) {
  const out = [{ heading: null, lines: [] }];
  for (const line of String(text).split('\n')) {
    if (/^## /.test(line)) out.push({ heading: line.trim(), lines: [] });
    else out[out.length - 1].lines.push(line);
  }
  return out;
}

function section(secs, heading) {
  return secs.find((s) => s.heading === heading);
}

function offending(sec, allowed) {
  return sec.lines.filter((l) => l.trim() && !allowed(l));
}

/** @returns {string[]} findings; empty when docs/STATE.md keeps the shape of templates/STATE.md */
export function stateShapeErrors(text) {
  const errors = [];
  const secs = sections(text);
  const found = secs.filter((s) => s.heading).map((s) => s.heading);
  if (found.join('|') !== STATE_HEADINGS.join('|')) {
    errors.push(
      `sections must be exactly ${STATE_HEADINGS.join(', ')}; found ${found.join(', ') || 'none'}`
    );
  }
  const now = section(secs, '## Now');
  if (now) {
    const label = /^- (Date|Branch|Feature|Phase|Last commit|Next): \S/;
    for (const l of offending(now, (l) => label.test(l)))
      errors.push(`Now: only the labeled lines are allowed, found "${l.trim().slice(0, 80)}"`);
    const present = new Set(now.lines.map((l) => (l.match(label) || [])[1]).filter(Boolean));
    const missing = STATE_NOW_LABELS.filter((x) => !present.has(x));
    if (missing.length) errors.push(`Now: missing label(s) ${missing.join(', ')}`);
  }
  const debt = section(secs, '## Open debt');
  if (debt) {
    for (const l of offending(debt, (l) => l.startsWith('|')))
      errors.push(`Open debt: only table rows are allowed, found "${l.trim().slice(0, 80)}"`);
  }
  const works = section(secs, '## What works');
  if (works) {
    for (const l of offending(works, (l) => l.startsWith('- ')))
      errors.push(`What works: only list items are allowed, found "${l.trim().slice(0, 80)}"`);
  }
  return errors;
}

/** Bytes of the sections SessionStart prints. */
export function statePrintedBytes(text) {
  const secs = sections(text);
  return ['## Now', '## Open debt']
    .map((h) => section(secs, h))
    .filter(Boolean)
    .reduce((n, s) => n + Buffer.byteLength([s.heading, ...s.lines].join('\n')), 0);
}

/** @returns {string[]} findings; empty when PLAN.md keeps the shape of templates/feature/PLAN.md */
export function planShapeErrors(text) {
  const errors = [];
  const secs = sections(text);
  for (const h of PLAN_REQUIRED) if (!section(secs, h)) errors.push(`missing section ${h}`);
  const criteria = section(secs, '## Acceptance criteria');
  if (criteria) {
    for (const l of offending(criteria, (l) => /^- \[[ xX]\] /.test(l)))
      errors.push(
        `Acceptance criteria: one criterion per line as "- [ ] ...", found "${l.trim().slice(0, 80)}"`
      );
  }
  const steps = section(secs, '## Steps');
  if (steps) {
    for (const l of offending(steps, (l) => l.startsWith('|')))
      errors.push(`Steps: table rows only, found "${l.trim().slice(0, 80)}"`);
  }
  return errors;
}

/** @returns {string[]} findings; empty when CONTEXT.md holds only the brief sections */
export function contextShapeErrors(text) {
  const errors = [];
  const secs = sections(text);
  for (const h of CONTEXT_REQUIRED) if (!section(secs, h)) errors.push(`missing section ${h}`);
  for (const s of secs) {
    if (!s.heading || CONTEXT_ALLOWED.includes(s.heading)) continue;
    if (/^## Screens/i.test(s.heading))
      errors.push(`${s.heading}: move to SCREENS.md (ux-designer, templates/feature/SCREENS.md)`);
    else
      errors.push(
        `${s.heading}: move to research/<topic>.md; CONTEXT.md holds only ${CONTEXT_ALLOWED.join(', ')}`
      );
  }
  return errors;
}

/** Returns the text whole, or cut at `cap` bytes with a visible marker that names the rest. */
export function capped(text, cap, readHint) {
  const buf = Buffer.from(String(text), 'utf8');
  if (buf.length <= cap) return String(text);
  const head = buf.subarray(0, cap).toString('utf8').replace(/�+$/, '');
  return `${head}\n[truncated at ${cap} bytes, ${buf.length - cap} bytes more: read ${readHint}]\n`;
}
