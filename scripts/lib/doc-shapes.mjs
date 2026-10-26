/**
 * Shape rules of the documents every agent reads (ADR-0018): docs/STATE.md, and PLAN.md and
 * CONTEXT.md of a feature; the pages of docs/wiki (ADR-0030). Pure functions on text, shared by
 * the PostToolUse check (file-checks.mjs), the Stop gate, scripts/check-feature-docs.mjs,
 * scripts/gen-wiki.mjs and the tests. A shape is a
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

/**
 * Wiki pages (ADR-0030 decision 1): `docs/wiki/[<folder>/]<Title-with-dashes>.md` with a YAML
 * frontmatter of scalars and flat lists, one H1 equal to the title and the `## ` sections of the
 * folder in order. A file starting with WIKI_GENERATED_MARK (scripts/gen-wiki.mjs) and a file
 * named `_*.md` (footer, sidebar) is not a page.
 */
export const WIKI_GENERATED_MARK = '<!-- generated by scripts/gen-wiki.mjs';
/** Areas of a rule id `BR-<AREA>-NNN` (ADR-0030 decision 2); a new area is one more word here. */
export const WIKI_RULE_AREAS = ['ACCESS', 'PRODUCTS', 'DETAILS', 'IMPORT'];
export const WIKI_RULE_STATUSES = ['planned', 'active', 'retired'];
/** Frontmatter keys holding a list; every other key holds one value, `adr` either (see below). */
export const WIKI_LIST_KEYS = ['tags', 'code', 'messages', 'elements', 'sources', 'aliases'];
const WIKI_BASE_KEYS = ['title', 'summary', 'tags'];
/** Per folder ('' is docs/wiki itself): required and optional keys, sections in order (null: free). */
export const WIKI_FOLDERS = {
  '': { required: WIKI_BASE_KEYS, optional: [], sections: null },
  domain: {
    required: [...WIKI_BASE_KEYS, 'code'],
    optional: ['verified'],
    sections: ['## What it is', '## Fields that matter', '## Rules', '## Related'],
  },
  rules: {
    required: [
      ...WIKI_BASE_KEYS,
      'code',
      'id',
      'status',
      'since',
      'messages',
      'elements',
      'sources',
    ],
    optional: ['verified', 'aliases'],
    sections: ['## Rule', '## Why', '## Where it fires', '## History'],
  },
  'how-to': {
    required: [...WIKI_BASE_KEYS, 'code'],
    optional: ['verified'],
    sections: ['## Goal', '## Steps', '## Rules that apply'],
  },
  // A digest names one `adr` and has the four sections; the list page of the pipeline ADRs names
  // them as a list and has free sections (ADR-0030 decision 3).
  decisions: {
    required: [...WIKI_BASE_KEYS, 'adr', 'sources'],
    optional: [],
    sections: ['## Decision', '## Why', '## What it means for the catalog', '## Source'],
  },
  api: { required: WIKI_BASE_KEYS, optional: [], sections: null },
};

function yamlScalar(raw, where, errors) {
  const s = raw.trim();
  for (const q of ["'", '"']) {
    if (!s.startsWith(q)) continue;
    if (s.length < 2 || !s.endsWith(q)) {
      errors.push(`${where}: unterminated ${q}...${q} value`);
      return s;
    }
    const inner = s.slice(1, -1);
    return q === "'" ? inner.replace(/''/g, "'") : inner.replace(/\\(["\\])/g, '$1');
  }
  if (/^[[\]{}&*!|>%@`]/.test(s) || / #|: |:$/.test(s))
    errors.push(`${where}: quote the value "${s.slice(0, 60)}" ('...'), YAML reads it differently`);
  return s;
}

/**
 * Reads the frontmatter of a wiki page: the block between a first line `---` and the next `---`
 * line, holding `key: value`, `key: [a, b]` and `key:` followed by `  - item` lines. No other YAML
 * is read; an unsupported line is a finding, never a guess. No dependency (ADR-0030).
 * @param {string} text the page
 * @returns {{meta: object|null, body: string, bodyLine: number, errors: string[]}} `meta` maps a key
 *   to a string or an array of strings, null without a frontmatter; `bodyLine` is the 0-based index
 *   of the first body line in the text
 */
export function parseFrontmatter(text) {
  const src = String(text);
  const lines = src.split('\n');
  if (lines[0].trimEnd() !== '---') return { meta: null, body: src, bodyLine: 0, errors: [] };
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  if (end < 0)
    return { meta: null, body: src, bodyLine: 0, errors: ['the frontmatter has no closing ---'] };
  const meta = {};
  const errors = [];
  let listKey = null;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const where = `frontmatter line ${i + 1}`;
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item) {
      if (listKey) meta[listKey].push(yamlScalar(item[1], where, errors));
      else errors.push(`${where}: a list item without its "key:" line`);
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/);
    listKey = null;
    if (!kv) {
      errors.push(`${where}: expected "key: value", "key: [a, b]" or "  - item"`);
      continue;
    }
    const [, key, raw = ''] = kv;
    if (Object.hasOwn(meta, key)) errors.push(`${where}: key ${key} appears twice`);
    const value = raw.trim();
    if (!value) {
      meta[key] = [];
      listKey = key;
    } else if (!value.startsWith('[')) {
      meta[key] = yamlScalar(value, where, errors);
    } else if (!value.endsWith(']')) {
      errors.push(`${where}: a [list] must end with ]`);
      meta[key] = [];
    } else {
      const inner = value.slice(1, -1).trim();
      meta[key] = inner ? inner.split(',').map((s) => yamlScalar(s, where, errors)) : [];
    }
  }
  return { meta, body: lines.slice(end + 1).join('\n'), bodyLine: end + 1, errors };
}

/** File name of a page without `.md`: the title, dashes for spaces, other punctuation dropped. */
export function wikiFileName(title) {
  return String(title)
    .replace(/[^A-Za-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

function outsideFences(text) {
  const out = [];
  let fence = null;
  for (const line of String(text).split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) fence = !fence ? f[1][0] : f[1][0] === fence ? null : fence;
    else if (!fence) out.push(line);
  }
  return out;
}

function wikiKeyErrors(meta, shape, where) {
  const errors = [];
  const allowed = [...shape.required, ...shape.optional];
  for (const k of shape.required)
    if (!Object.hasOwn(meta, k)) errors.push(`missing frontmatter key ${k}`);
  for (const [k, v] of Object.entries(meta)) {
    const list = WIKI_LIST_KEYS.includes(k);
    if (!allowed.includes(k))
      errors.push(`frontmatter key ${k} is not used in ${where}; allowed: ${allowed.join(', ')}`);
    else if (k === 'adr') continue;
    else if (list && !Array.isArray(v)) errors.push(`${k} must be a list: [a, b] or "  - item"`);
    else if (!list && Array.isArray(v)) errors.push(`${k} must be one value, not a list`);
    else if (!list && !v) errors.push(`${k} is empty`);
    else if (list && !v.length && ['code', 'sources'].includes(k))
      errors.push(`${k} must name at least one entry`);
  }
  return errors;
}

function wikiFormatErrors(meta, folder) {
  const errors = [];
  const one = (k) => (typeof meta[k] === 'string' ? meta[k] : '');
  const summary = one('summary');
  if (summary && (!summary.endsWith('.') || /[.!?]["')]?\s+[A-Z]/.test(summary)))
    errors.push('summary must be one sentence ending with a period');
  const id = one('id');
  if (id && !new RegExp(`^BR-(${WIKI_RULE_AREAS.join('|')})-\\d{3}$`).test(id))
    errors.push(
      `id ${id} must be BR-<AREA>-NNN, AREA one of ${WIKI_RULE_AREAS.join(', ')} (node scripts/wiki.mjs next-id <AREA>)`
    );
  const status = one('status');
  if (status && !WIKI_RULE_STATUSES.includes(status))
    errors.push(`status ${status} must be one of ${WIKI_RULE_STATUSES.join(', ')}`);
  if (Object.hasOwn(meta, 'verified') && !/^[0-9a-f]{16}$/.test(one('verified')))
    errors.push('verified must be the 16-hex hash that node scripts/wiki.mjs confirm writes');
  if (folder === 'decisions' && Object.hasOwn(meta, 'adr')) {
    const adr = [meta.adr].flat();
    if (!adr.length || adr.some((a) => !/^ADR-\d{4}$/.test(a)))
      errors.push('adr must be ADR-NNNN, or a list of them on the list page');
  }
  return errors;
}

function wikiSectionErrors(secs, required, where) {
  const found = secs.filter((s) => s.heading).map((s) => s.heading);
  const errors = [];
  for (const h of required) if (!found.includes(h)) errors.push(`missing section ${h}`);
  for (const h of found)
    if (!required.includes(h)) errors.push(`section ${h} is not part of the ${where} shape`);
  if (!errors.length && found.join('|') !== required.join('|'))
    errors.push(`sections must follow the order ${required.join(', ')}`);
  return errors;
}

function wikiHistoryErrors(history) {
  const errors = [];
  for (const l of offending(history, (l) => l.startsWith('|')))
    errors.push(`History: table rows only, found "${l.trim().slice(0, 80)}"`);
  const table = history.lines.filter((l) => l.startsWith('|'));
  if (table.length < 3 || !/^\|(\s*:?-+:?\s*\|)+\s*$/.test(table[1].trim()))
    errors.push('History needs a table: | Date | Change | Source |, its separator and one row');
  for (const row of table.slice(2)) {
    const shown = row.trim().slice(0, 80);
    if (!/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(row))
      errors.push(`History: a row starts with its date YYYY-MM-DD, found "${shown}"`);
    else if (!row.includes(']('))
      errors.push(`History: the row "${shown}" links no source (feature SUMMARY.md or ADR)`);
  }
  return errors;
}

/**
 * Shape findings of one hand-written wiki page (ADR-0030 decision 1): the frontmatter keys of its
 * folder with their formats, a one-sentence summary, the file name derived from the title, one H1
 * equal to the title, the folder's sections in order, and the History table of a rule.
 * @param {string} text the page
 * @param {string} relPath repository path (`docs/wiki/rules/X.md`) or path inside docs/wiki
 * @returns {string[]} findings; empty when the page keeps the shape of its folder
 */
export function wikiPageShapeErrors(text, relPath) {
  const rel = String(relPath)
    .split('\\')
    .join('/')
    .replace(/^docs\/wiki\//, '');
  const parts = rel.split('/');
  const folder = parts.length === 1 ? '' : parts.length === 2 ? parts[0] : null;
  const shape = folder === null ? null : WIKI_FOLDERS[folder];
  if (!shape) {
    const folders = Object.keys(WIKI_FOLDERS).filter(Boolean);
    return [`not a wiki folder: pages live in docs/wiki/ or docs/wiki/{${folders.join(',')}}/`];
  }
  const { meta, body, errors: parsed } = parseFrontmatter(text);
  if (!meta) return [...parsed, 'no frontmatter: the page starts with ---, its keys and ---'];
  const where = folder ? `${folder}/` : 'docs/wiki/';
  const errors = [
    ...parsed,
    ...wikiKeyErrors(meta, shape, where),
    ...wikiFormatErrors(meta, folder),
  ];
  const title = typeof meta.title === 'string' ? meta.title : '';
  const base = parts[parts.length - 1].replace(/\.md$/, '');
  if (title && base !== wikiFileName(title))
    errors.push(
      `file name must be ${wikiFileName(title)}.md: the GitHub Wiki shows it as the title`
    );
  const lines = outsideFences(body);
  const secs = sections(lines.join('\n'));
  const h1 = lines.filter((l) => /^# /.test(l));
  if (h1.length !== 1 || !secs[0].lines.includes(h1[0]))
    errors.push(`the body needs one H1 "# ${title || '<title>'}" before the first section`);
  else if (title && h1[0].trim() !== `# ${title}`) errors.push(`the H1 must be "# ${title}"`);
  const required = folder === 'decisions' && Array.isArray(meta.adr) ? null : shape.sections;
  if (required) errors.push(...wikiSectionErrors(secs, required, where));
  const history = folder === 'rules' && section(secs, '## History');
  if (history) errors.push(...wikiHistoryErrors(history));
  return errors;
}

/** Returns the text whole, or cut at `cap` bytes with a visible marker that names the rest. */
export function capped(text, cap, readHint) {
  const buf = Buffer.from(String(text), 'utf8');
  if (buf.length <= cap) return String(text);
  const head = buf.subarray(0, cap).toString('utf8').replace(/�+$/, '');
  return `${head}\n[truncated at ${cap} bytes, ${buf.length - cap} bytes more: read ${readHint}]\n`;
}
