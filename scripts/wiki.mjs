#!/usr/bin/env node
/**
 * Lookup CLI of the business-rules wiki (ADR-0030 decisions 5-7). The lookups read the committed
 * docs/wiki/graph.json (npm run docs:wiki); next-id, confirm, audit and export read the pages.
 * Run from the project root, one command per call:
 *   find <term>         pages whose frontmatter names the term (id, alias, status, tag, message key,
 *                       element, ADR, code entry, source) or whose title or summary contains it
 *   related <page>      the pages it links to and the pages that link to it
 *   for-path <file>     the pages whose `code` names the file: read them before editing it
 *   next-id <AREA>      the next free rule id BR-<AREA>-NNN, never one in use
 *   confirm <page>...   stamp `verified` with the hash of the page's code files, then regenerate
 *   audit               stale pages, message keys and constrained elements without a rule page
 *   export <dir>        the wiki for the GitHub Wiki mirror: each page's frontmatter as a key table
 *                       under its H1, generated files and _*.md as they are, no graph.json
 * A <page> is a repository path (docs/wiki/rules/X.md), a path inside docs/wiki, a file name with
 * or without .md, or a rule id. Exit 0 with an answer, 1 on a usage error, an unknown page or an
 * audit finding.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUnder } from './lib/hook-utils.mjs';
import { WIKI_RULE_AREAS, parseFrontmatter } from './lib/doc-shapes.mjs';
import {
  GRAPH,
  WIKI_DIR,
  buildGraph,
  codeFiles,
  mapLinkTargets,
  readPages,
  readWikiFiles,
  resolveLink,
  writeWiki,
} from './gen-wiki.mjs';

const MESSAGES = '_i18n/messages.properties';
const USAGE = `usage: node scripts/wiki.mjs <command>
  find <term>         pages naming the term in their frontmatter, title or summary
  related <page>      pages the page links to and pages linking to it
  for-path <file>     pages whose code names the file (read them before editing it)
  next-id <AREA>      next free rule id, AREA one of ${WIKI_RULE_AREAS.join(', ')}
  confirm <page>...   stamp verified with the current hash of the page's code files
  audit               stale pages, uncovered message keys and constrained elements
  export <dir>        the wiki for the GitHub Wiki mirror into a new or empty folder`;
const LABELS = {
  summary: 'Summary',
  tags: 'Tags',
  id: 'Id',
  status: 'Status',
  since: 'Since',
  aliases: 'Aliases',
  code: 'Code',
  messages: 'Messages',
  elements: 'Elements',
  adr: 'ADR',
  sources: 'Sources',
};
// The title is the H1 and `verified` a machine stamp: neither goes into the exported key table.
const HIDDEN = new Set(['title', 'verified']);
const AS_CODE = new Set(['id', 'code', 'messages', 'elements', 'adr', 'aliases']);
const isUrl = (s) => /^[a-z][a-z0-9+.-]*:/i.test(s);
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** A path argument as a repository path: absolute paths made relative, `./` dropped. */
const repoPath = (root, p) =>
  isAbsolute(p) ? relative(root, p).split(sep).join('/') : posix.normalize(p).replace(/^\.\//, '');

/**
 * The committed link graph.
 * @param {string} root project root
 * @returns {{nodes: Array<object>, edges: Array<object>}} docs/wiki/graph.json
 */
export function readGraph(root) {
  const file = join(root, GRAPH);
  if (!existsSync(file)) throw new Error(`${GRAPH} is missing: run npm run docs:wiki`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * The node a page reference names.
 * @param {Array<object>} nodes graph nodes
 * @param {string} ref repository path, path inside docs/wiki, file name with or without .md, or id
 * @returns {object|null} the node, null when no page matches
 */
export function findPage(nodes, ref) {
  const r = String(ref).replace(/^\.\//, '');
  const lower = r.toLowerCase();
  return (
    nodes.find(
      (n) =>
        n.path === r ||
        n.path === `${WIKI_DIR}/${r}` ||
        n.id?.toLowerCase() === lower ||
        posix.basename(n.path).toLowerCase() === lower ||
        posix.basename(n.path, '.md').toLowerCase() === lower
    ) ?? null
  );
}

/**
 * Pages matching a term: an exact (case-insensitive) frontmatter value first, then a title or
 * summary containing it.
 * @param {{nodes: Array<object>}} graph the link graph
 * @param {string} term what to look for
 * @returns {Array<object>} matching nodes
 */
export function findPages(graph, term) {
  const t = String(term).toLowerCase();
  const values = (n) => [
    n.id,
    n.status,
    ...n.aliases,
    ...n.tags,
    ...n.messages,
    ...n.elements,
    ...n.adr,
    ...n.code,
    ...n.sources,
  ];
  const exact = (n) => values(n).some((v) => v && String(v).toLowerCase() === t);
  const partial = (n) => [n.title, n.summary].some((v) => v?.toLowerCase().includes(t));
  return [...graph.nodes.filter(exact), ...graph.nodes.filter((n) => !exact(n) && partial(n))];
}

/**
 * The pages one page links to and the pages that link to it.
 * @param {{nodes: Array<object>, edges: Array<object>}} graph the link graph
 * @param {object} node the page
 * @returns {{linksTo: Array<object>, linkedFrom: Array<object>}} nodes on both sides
 */
export function relatedPages(graph, node) {
  const byPath = new Map(graph.nodes.map((n) => [n.path, n]));
  return {
    linksTo: graph.edges.filter((e) => e.from === node.path).map((e) => byPath.get(e.to)),
    linkedFrom: graph.edges.filter((e) => e.to === node.path).map((e) => byPath.get(e.from)),
  };
}

/**
 * The pages whose `code` names a file, rules first by id; decision digests never.
 * @param {{nodes: Array<object>}} graph the link graph
 * @param {string} file repository path
 * @returns {Array<object>} matching nodes
 */
export function pagesForPath(graph, file) {
  const order = (n) => `${n.folder === 'rules' ? 0 : 1} ${n.id ?? ''} ${n.path}`;
  return graph.nodes
    .filter((n) => n.folder !== 'decisions' && n.code.some((glob) => isUnder(file, glob)))
    .sort((a, b) => (order(a) < order(b) ? -1 : 1));
}

/**
 * The next rule id of an area: one above the highest `id` of that area in the frontmatter of the
 * pages. A rule is retired, never deleted (ADR-0030 decision 2), so its number is never given
 * again; an id quoted in prose (an example) does not count.
 * @param {string} root project root
 * @param {string} area one of WIKI_RULE_AREAS, any case
 * @returns {string} `BR-<AREA>-NNN`
 */
export function nextId(root, area) {
  const a = String(area).toUpperCase();
  if (!WIKI_RULE_AREAS.includes(a))
    throw new Error(`unknown area ${area}; areas: ${WIKI_RULE_AREAS.join(', ')}`);
  const pattern = new RegExp(`^BR-${a}-(\\d{3})$`);
  let max = 0;
  for (const f of readWikiFiles(root)) {
    const id = parseFrontmatter(f.text).meta?.id;
    const m = typeof id === 'string' && id.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  if (max >= 999) throw new Error(`area ${a} has no free id left`);
  return `BR-${a}-${String(max + 1).padStart(3, '0')}`;
}

function withVerified(text, hash) {
  const lines = text.split('\n');
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  const at = lines.findIndex((l, i) => i > 0 && i < end && /^verified:/.test(l));
  if (at > 0) lines[at] = `verified: ${hash}`;
  else lines.splice(end, 0, `verified: ${hash}`);
  return lines.join('\n');
}

/**
 * Stamps `verified` of each page with the current hash of its code files and regenerates the
 * wiki. A page without `code`, or with an entry that matches no file, is refused.
 * @param {string} root project root
 * @param {Array<string>} refs page references
 * @returns {Array<{path: string, hash: string}>} the stamped pages
 */
export function confirmPages(root, refs) {
  const pages = readPages(root);
  const nodes = buildGraph(pages).nodes;
  const stamped = [];
  for (const ref of refs) {
    const node = findPage(nodes, repoPath(root, ref));
    if (!node) throw new Error(`no wiki page ${ref}`);
    const page = pages.find((p) => p.path === node.path);
    if (!page.text.startsWith('---') || !node.code.length)
      throw new Error(`${node.path} names no code in its frontmatter; nothing to confirm`);
    const missing = node.code.filter((glob) => !codeFiles(root, [glob]).length);
    if (missing.length) throw new Error(`${node.path}: code ${missing.join(', ')} matches no file`);
    const text = withVerified(page.text, page.codeHash);
    if (text !== page.text) writeFileSync(join(root, page.path), text);
    stamped.push({ path: page.path, hash: page.codeHash });
  }
  writeWiki(root);
  return stamped;
}

function messageKeys(root) {
  const file = join(root, MESSAGES);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
    .map((line) => line.match(/^([^=:\s]+)\s*[=:]/)?.[1])
    .filter(Boolean);
}

/**
 * The elements of the service entities, `<Entity>.<element>`, and those carrying `@mandatory`,
 * `@assert` or `@assert.*` (ADR-0030 decision 6), from `cds.load('*')` of the project.
 * @param {string} root project root
 * @returns {Promise<{all: Set<string>, constrained: Array<{name: string, annotations: string[]}>}>}
 *   the element names and the constrained ones with their annotations
 */
export async function serviceElements(root) {
  const { default: cds } = await import('@sap/cds');
  cds.root = root;
  const all = new Set();
  const constrained = [];
  if (!cds.resolve('*')?.length) return { all, constrained };
  const { definitions } = await cds.load('*');
  const services = Object.keys(definitions).filter((n) => definitions[n].kind === 'service');
  for (const [name, def] of Object.entries(definitions)) {
    const service = def.kind === 'entity' && services.find((s) => name.startsWith(`${s}.`));
    const entity = service && name.slice(service.length + 1);
    if (!entity || entity.includes('.')) continue;
    for (const [element, el] of Object.entries(def.elements || {})) {
      all.add(`${entity}.${element}`);
      const annotations = Object.keys(el).filter(
        (k) => k === '@mandatory' || k === '@assert' || k.startsWith('@assert.')
      );
      if (annotations.length && !el.virtual)
        constrained.push({ name: `${entity}.${element}`, annotations });
    }
  }
  return { all, constrained };
}

/**
 * Staleness and coverage of the wiki (ADR-0030 decision 6): a page with `code` (not planned, not
 * retired) whose `verified` is missing or differs from the current hash, or whose code entry
 * matches no file; a message key in no rule page's `messages`; a constrained service element in no
 * rule page's `elements`; an active rule naming a key or element that does not exist.
 * @param {string} root project root
 * @returns {Promise<Array<string>>} findings; empty when the wiki is current
 */
export async function auditWiki(root) {
  const pages = readPages(root);
  const findings = [];
  for (const p of pages) {
    const code = asList(p.meta.code);
    if (!code.length || ['planned', 'retired'].includes(p.meta.status)) continue;
    for (const glob of code) {
      if (!codeFiles(root, [glob]).length)
        findings.push(`${p.path}: code entry ${glob} matches no file`);
    }
    const fix = `update the page to the code, then node scripts/wiki.mjs confirm ${p.path}`;
    if (!p.meta.verified) findings.push(`${p.path}: no verified stamp; ${fix}`);
    else if (p.meta.verified !== p.codeHash)
      findings.push(`${p.path}: code changed since verified (${p.meta.verified}); ${fix}`);
  }
  const rules = pages.filter((p) => p.folder === 'rules' && p.meta.status !== 'retired');
  const active = rules.filter((p) => p.meta.status === 'active');
  const keys = messageKeys(root);
  const namedKeys = new Set(rules.flatMap((p) => asList(p.meta.messages)));
  for (const key of keys) {
    if (!namedKeys.has(key)) findings.push(`${MESSAGES}: ${key} is in no rule page's messages`);
  }
  for (const p of active) {
    for (const key of asList(p.meta.messages))
      if (!keys.includes(key)) findings.push(`${p.path}: message ${key} is not in ${MESSAGES}`);
  }
  const model = await serviceElements(root);
  const namedElements = new Set(rules.flatMap((p) => asList(p.meta.elements)));
  for (const { name, annotations } of model.constrained) {
    if (!namedElements.has(name))
      findings.push(`${name} (${annotations.join(', ')}) is in no rule page's elements`);
  }
  for (const p of active) {
    for (const element of asList(p.meta.elements))
      if (!model.all.has(element))
        findings.push(`${p.path}: element ${element} is no element of a service entity`);
  }
  return findings;
}

function keyTable(meta, pagePath, root) {
  const format = (key, item) => {
    const text = String(item).replace(/\|/g, '\\|');
    if (key === 'sources' && !isUrl(item) && existsSync(join(root, item)))
      return `[${text}](${posix.relative(posix.dirname(pagePath), item)})`;
    return AS_CODE.has(key) ? `\`${text}\`` : text;
  };
  const rows = Object.entries(meta)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, value]) => {
      const items = asList(value).map((item) => format(key, item));
      return `| ${LABELS[key] ?? key} | ${items.join(', ') || '-'} |`;
    });
  return ['| Key | Value |', '|---|---|', ...rows].join('\n');
}

function withKeyTable(text, pagePath, root) {
  const { meta, body } = parseFrontmatter(text);
  if (!meta) return text;
  const lines = body.split('\n');
  const h1 = lines.findIndex((l) => /^# /.test(l));
  lines.splice(h1 + 1, 0, '', keyTable(meta, pagePath, root), '');
  return lines.join('\n');
}

/** Rewrites the repository links of a file moved from `fromPath` to the absolute `target`. */
function rebaseLinks(text, fromPath, root, target) {
  return mapLinkTargets(text, (raw) => {
    const link = resolveLink(fromPath, raw.replace(/^<|>$/g, ''));
    if (link.kind !== 'repo') return raw;
    const moved = relative(dirname(target), join(root, link.path)).split(sep).join('/');
    return raw.startsWith('<') ? `<${moved}${link.anchor}>` : `${moved}${link.anchor}`;
  });
}

/**
 * Writes the wiki for the GitHub Wiki mirror (ADR-0030 decision 7): the folder structure of
 * docs/wiki, each page's frontmatter as a key table under its H1 (the wiki shows YAML raw),
 * generated Markdown and `_*.md` as they are, no graph.json. Links into the repository are rebased
 * to the new location, so the mirror action can turn them into blob/ URLs; a folder inside the
 * repository keeps them valid.
 * @param {string} root project root
 * @param {string} dir target folder, new or empty, outside docs/wiki
 * @returns {Array<string>} the written files, relative to the target folder
 */
export function exportWiki(root, dir) {
  const out = resolve(root, dir);
  const wiki = resolve(root, WIKI_DIR);
  if (out === wiki || out.startsWith(wiki + sep) || wiki.startsWith(out + sep))
    throw new Error('export into a folder that neither is nor contains docs/wiki');
  if (existsSync(out) && readdirSync(out).length)
    throw new Error(`${dir} is not empty; export into a new or empty folder`);
  const written = [];
  for (const f of readWikiFiles(root)) {
    const inner = f.path.slice(WIKI_DIR.length + 1);
    const target = join(out, inner);
    const text = f.generated || f.special ? f.text : withKeyTable(f.text, f.path, root);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, rebaseLinks(text, f.path, root, target));
    written.push(inner);
  }
  return written;
}

const describe = (n) =>
  `- ${n.path} (${[n.id, n.status].filter(Boolean).join(', ') || n.folder || 'top'}): ${n.summary ?? ''}`;

async function main(root, [command, ...args]) {
  const need = (n) => {
    if (args.length < n) throw Object.assign(new Error(USAGE), { usage: true });
  };
  switch (command) {
    case 'find': {
      need(1);
      const hits = findPages(readGraph(root), args.join(' '));
      console.log(
        hits.length ? hits.map(describe).join('\n') : `No page matches "${args.join(' ')}".`
      );
      return 0;
    }
    case 'related': {
      need(1);
      const graph = readGraph(root);
      const node = findPage(graph.nodes, repoPath(root, args[0]));
      if (!node) throw new Error(`no wiki page ${args[0]}`);
      const { linksTo, linkedFrom } = relatedPages(graph, node);
      const list = (nodes) => (nodes.length ? nodes.map(describe).join('\n') : '- none');
      console.log(
        `${describe(node).slice(2)}\nLinks to:\n${list(linksTo)}\nLinked from:\n${list(linkedFrom)}`
      );
      return 0;
    }
    case 'for-path': {
      need(1);
      const file = repoPath(root, args[0]);
      const hits = pagesForPath(readGraph(root), file);
      console.log(
        hits.length
          ? `Wiki pages for ${file}; read them before the edit:\n${hits.map(describe).join('\n')}`
          : `No wiki page names ${file} in its code.`
      );
      return 0;
    }
    case 'next-id':
      need(1);
      console.log(nextId(root, args[0]));
      return 0;
    case 'confirm': {
      need(1);
      for (const { path, hash } of confirmPages(root, args))
        console.log(`${path}: verified ${hash}`);
      console.log(`${WIKI_DIR} regenerated.`);
      return 0;
    }
    case 'audit': {
      const findings = await auditWiki(root);
      for (const f of findings) console.log(`- ${f}`);
      console.log(
        findings.length ? `wiki audit: ${findings.length} findings` : 'wiki audit: clean'
      );
      return findings.length ? 1 : 0;
    }
    case 'export': {
      need(1);
      const files = exportWiki(root, args[0]);
      console.log(`Exported ${files.length} files of ${WIKI_DIR} to ${args[0]}.`);
      return 0;
    }
    default:
      throw Object.assign(new Error(USAGE), { usage: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.cwd(), process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err.usage ? err.message : `wiki: ${err.message}`);
      process.exitCode = 1;
    });
}
