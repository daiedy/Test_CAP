#!/usr/bin/env node
/**
 * Lookup CLI of the business-rules wiki (ADR-0030 decisions 5-7). The lookups read the committed
 * docs/wiki/graph.json (npm run docs:wiki); next-id, confirm, audit and export read the pages.
 * Runs from the project root or any folder below it: the root is the nearest folder, from the
 * working directory up to the top of its git checkout, that holds docs/wiki/; without one every
 * command exits 1 instead of answering as for an empty wiki. One command per call:
 *   find <term>         pages whose frontmatter names the term (id, alias, status, tag, message key,
 *                       element, ADR, code entry, source) or whose title or summary contains it
 *   related <page>      the pages it links to and the pages that link to it
 *   for-path <file>     the pages whose `code` names the file: read them before editing it
 *   next-id <AREA>      the next free rule id BR-<AREA>-NNN, never one in use
 *   confirm <page>...   stamp `verified` with the hash of the page's code files, then regenerate
 *   audit               stale pages, message keys and constrained elements without a rule page
 *   export <dir> [--ref <ref>] [--repo-url <url>]
 *                       the wiki for the GitHub Wiki mirror (ADR-0030 decision 7, amendment A-F):
 *                       every Markdown file of docs/wiki flat as <dir>/<basename>, each page's
 *                       frontmatter as a key table under its H1, no graph.json; links wiki-ready:
 *                       a page link as the bare page name, another repository path as
 *                       <url>/blob/<ref>/<path> (tree/ for a folder, raw/ for an image), external
 *                       and #anchor links as written. The ref and the URL come from the options,
 *                       else from GITHUB_SHA and GITHUB_SERVER_URL + GITHUB_REPOSITORY (GitHub
 *                       Actions), else `main` and the repository field of package.json; the base is
 *                       printed. Every link is mapped before the first write: an unmappable one (a
 *                       missing target, one outside the repository, a link to _Sidebar.md or
 *                       _Footer.md, an image of a page or folder) or two files of one basename
 *                       print `<file>:<line>: <target>` and exit 1 with nothing written
 * A <page> is a repository path (docs/wiki/rules/X.md), a path inside docs/wiki, a file name with
 * or without .md, or a rule id. A <file> or <page> path is relative to the project root wherever
 * the CLI runs (an absolute one is made relative; one outside the root is refused); the <dir> of
 * export is relative to the working directory. Exit 0 with an answer, 1 on a usage error (an
 * invalid ref or repository URL included), a missing wiki, an unknown page, an audit finding or an
 * unmappable export link.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  export <dir> [--ref <ref>] [--repo-url <url>]
                      the wiki for the GitHub Wiki mirror into a new or empty folder, flat, page
                      links as page names, repository links as <url>/blob/<ref>/<path>; defaults:
                      GITHUB_SHA and GITHUB_SERVER_URL/GITHUB_REPOSITORY, else main and the
                      repository field of package.json`;
/** The options of `export` and the key each sets. */
const EXPORT_OPTIONS = { '--ref': 'ref', '--repo-url': 'repoUrl' };
// ADR-0030 amendment D: the characters of a ref (and no `..`), and http(s)://<host>/<owner>/<repo>.
const REF_CHARS = /^[A-Za-z0-9._/-]+$/;
const REPO_URL = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;
/** The commands and the number of arguments each needs at least. */
const ARITY = {
  find: 1,
  related: 1,
  'for-path': 1,
  'next-id': 1,
  confirm: 1,
  audit: 0,
  export: 1,
};
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
const usageError = (message) =>
  Object.assign(new Error(message ? `wiki: ${message}\n${USAGE}` : USAGE), { usage: true });

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

/**
 * The project root of the wiki: the nearest folder holding docs/wiki/, from `start` upwards. The
 * walk ends at the top of the git checkout (a folder holding `.git`, a directory or a worktree's
 * file), so a checkout or worktree without a wiki never answers from the wiki of a folder around
 * it; a project without git (a temp copy) is searched up to the file system root.
 * @param {string} start folder to start from, usually the working directory
 * @returns {string} the absolute root
 * @throws {Error} when no folder up to the end of the walk holds docs/wiki/
 */
export function wikiRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (isDir(join(dir, WIKI_DIR))) return dir;
    const parent = dirname(dir);
    if (existsSync(join(dir, '.git')) || parent === dir)
      throw new Error(
        `no ${WIKI_DIR}/ in ${resolve(start)} or a folder above it up to ${dir}; run inside a project with a wiki`
      );
    dir = parent;
  }
}

/**
 * Refuses a root without docs/wiki/, so no command answers as for an empty wiki.
 * @param {string} root project root
 * @throws {Error} when `root` holds no docs/wiki/
 */
export function requireWiki(root) {
  if (!isDir(join(root, WIKI_DIR)))
    throw new Error(`${resolve(root)} holds no ${WIKI_DIR}/; run inside a project with a wiki`);
}

/**
 * A path argument as a repository path: relative to the root wherever the CLI runs, absolute paths
 * made relative, `./` dropped. A path outside the root is refused, because it can name no page and
 * no code file, and answering "no page" for it would hide a wrong working directory.
 * @param {string} root project root
 * @param {string} p the argument
 * @returns {string} the repository path
 */
function repoPath(root, p) {
  const rel = isAbsolute(p)
    ? relative(root, p).split(sep).join('/')
    : posix.normalize(p).replace(/^\.\//, '');
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel))
    throw new Error(
      `${p} is outside the project root ${root}; give a path relative to the project root`
    );
  return rel;
}

/**
 * The committed link graph.
 * @param {string} root project root
 * @returns {{nodes: Array<object>, edges: Array<object>}} docs/wiki/graph.json
 */
export function readGraph(root) {
  requireWiki(root);
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
  // Without the pages every id looks free: never answer for a root without a wiki.
  requireWiki(root);
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
  requireWiki(root);
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
  requireWiki(root);
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

/**
 * What is wrong with the base of an export's repository links (ADR-0030 amendment D): a missing
 * value, a ref with a character outside `[A-Za-z0-9._/-]` or with `..`, a URL that is not
 * `http(s)://<host>/<owner>/<repo>`.
 * @param {{repoUrl?: string, ref?: string}} base repository URL and ref
 * @returns {Array<string>} one message per problem; empty when the base is usable
 */
export function linkBaseErrors({ repoUrl, ref } = {}) {
  const errors = [];
  if (!ref) errors.push('no ref for the repository links (--ref or GITHUB_SHA)');
  else if (!REF_CHARS.test(ref) || ref.includes('..'))
    errors.push(`ref ${ref} may hold only A-Z, a-z, 0-9, ".", "_", "/", "-" and no ".."`);
  const url = repoUrl && String(repoUrl).match(REPO_URL);
  if (!repoUrl) errors.push('no repository URL for the repository links (--repo-url)');
  else if (!url || url.slice(1).some((segment) => /^\.+$/.test(segment)))
    errors.push(`repository URL ${repoUrl} is not of the form http(s)://<host>/<owner>/<repo>`);
  return errors;
}

/** The `repository` field of package.json as a URL: a string or `{ url }`, no `git+`, no `.git`. */
function packageRepository(root) {
  const file = join(root, 'package.json');
  const field = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).repository : undefined;
  const url = typeof field === 'string' ? field : field?.url;
  if (!url)
    throw new Error(
      'no repository URL: give --repo-url, set GITHUB_SERVER_URL and GITHUB_REPOSITORY, or add a repository field to package.json'
    );
  return String(url)
    .replace(/^git\+/, '')
    .replace(/\.git$/, '');
}

/**
 * The ref and the repository URL of an export's repository links (ADR-0030 amendment D), each
 * from the first source that has it: the option, then the GitHub Actions environment (`GITHUB_SHA`;
 * `GITHUB_SERVER_URL` with `GITHUB_REPOSITORY`, both or neither), then `main` and the repository
 * field of package.json. The values are not checked here: linkBaseErrors() does that.
 * @param {string} root project root
 * @param {{ref?: string, repoUrl?: string}} options the values of --ref and --repo-url
 * @param {object} env the environment, usually process.env
 * @returns {{ref: string, repoUrl: string}} the base
 * @throws {Error} when only one of the two URL variables is set, or no source has a URL
 */
export function exportBase(root, options, env) {
  const ref = options.ref ?? (env.GITHUB_SHA || 'main');
  if (options.repoUrl !== undefined) return { ref, repoUrl: options.repoUrl };
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repository } = env;
  if (server && repository) return { ref, repoUrl: `${server}/${repository}` };
  if (server || repository)
    throw new Error(
      `${server ? 'GITHUB_SERVER_URL' : 'GITHUB_REPOSITORY'} is set without ${server ? 'GITHUB_REPOSITORY' : 'GITHUB_SERVER_URL'}: set both or neither, or give --repo-url`
    );
  return { ref, repoUrl: packageRepository(root) };
}

/**
 * The wiki-ready form of one link target of an exported file (ADR-0030 amendment A), in this
 * order: an external or `#anchor` target as written; a Markdown file of docs/wiki (a page, a
 * generated index, the API page) as its bare page name with query and anchor; any other existing
 * repository path as `<repoUrl>/<route>/<ref>/<path>` with each path segment encoded, the route
 * `tree` for a folder, `raw` for a file in an image and `blob` otherwise. Angle brackets stay.
 * @param {string} root project root
 * @param {Map<string, {special: boolean}>} files the Markdown files of docs/wiki by repository path
 * @param {string} fromPath repository path of the file holding the link
 * @param {string} raw the target as written, `<...>` included
 * @param {boolean} image whether the target belongs to an image
 * @param {{repoUrl: string, ref: string}} base repository URL and ref
 * @returns {{target: string}|{problem: string}} the target to write, or why it cannot be mapped
 */
export function wikiTarget(root, files, fromPath, raw, image, { repoUrl, ref }) {
  const bracketed = raw.startsWith('<') && raw.endsWith('>');
  const written = bracketed ? raw.slice(1, -1) : raw;
  const link = resolveLink(fromPath, written);
  if (link.kind === 'external' || link.kind === 'anchor') return { target: raw };
  if (link.path === '..' || link.path.startsWith('../') || posix.isAbsolute(link.path))
    return { problem: 'the target is outside the repository' };
  const abs = join(root, link.path);
  if (!existsSync(abs)) return { problem: 'the target does not exist in the checkout' };
  const beforeAnchor = written.split('#')[0];
  const query = beforeAnchor.includes('?') ? beforeAnchor.slice(beforeAnchor.indexOf('?')) : '';
  const wrap = (target) => ({ target: bracketed ? `<${target}>` : target });
  const file = files.get(link.path);
  if (file?.special)
    return { problem: `${posix.basename(link.path)} frames the wiki pages and is no page` };
  if (file && image) return { problem: 'an image of a page' };
  if (file)
    return wrap(`${encodeURIComponent(posix.basename(link.path, '.md'))}${query}${link.anchor}`);
  const folder = statSync(abs).isDirectory();
  if (folder && image) return { problem: 'an image of a folder' };
  const route = folder ? 'tree' : image ? 'raw' : 'blob';
  const segments = link.path.split('/').filter((s) => s && s !== '.');
  return wrap(
    `${[repoUrl, route, ref, ...segments.map(encodeURIComponent)].join('/')}${query}${link.anchor}`
  );
}

/** The 1-based line of a frontmatter key, or of its list item that holds `item`. */
function frontmatterLine(text, key, item) {
  const lines = text.split('\n');
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  const at = lines.findIndex((l, i) => i > 0 && i < end && l.startsWith(`${key}:`));
  if (at < 0) return 1;
  for (let i = at + 1; i < end && /^\s*-\s+/.test(lines[i]); i++)
    if (lines[i].includes(item)) return i + 1;
  return at + 1;
}

/** The frontmatter of a page as a key table; `sources` paths of the repository become links. */
function keyTable(meta, page, root, map) {
  const format = (key, item) => {
    const text = String(item).replace(/\|/g, '\\|');
    if (key === 'sources' && !isUrl(item) && existsSync(join(root, item))) {
      const relativeTarget = posix.relative(posix.dirname(page.path), item);
      const line = frontmatterLine(page.text, key, item);
      return `[${text}](${map(page.path, line, relativeTarget, false, item)})`;
    }
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

/**
 * The exported text of one wiki file with its links mapped by `map`: a hand-written page loses
 * its frontmatter, which becomes a key table under the H1; generated files and `_*.md` keep their
 * text apart from the links. Line numbers given to `map` are those of the source file.
 */
function exportText(root, file, map) {
  const visit = (offset) => (target, i, image) => map(file.path, offset + i + 1, target, image);
  if (file.generated || file.special) return mapLinkTargets(file.text, visit(0));
  const { meta, body, bodyLine } = parseFrontmatter(file.text);
  const mapped = mapLinkTargets(body, visit(bodyLine));
  if (!meta) return mapped;
  const lines = mapped.split('\n');
  const h1 = lines.findIndex((l) => /^# /.test(l));
  lines.splice(h1 + 1, 0, '', keyTable(meta, file, root, map), '');
  return lines.join('\n');
}

/**
 * Writes the wiki for the GitHub Wiki mirror (ADR-0030 decision 7, amendment A-F): every Markdown
 * file of docs/wiki flat as `<dir>/<basename>`, each hand-written page's frontmatter as a key table
 * under its H1 (the wiki shows YAML raw), no graph.json, every link wiki-ready (wikiTarget(), the
 * `sources` links of the key tables included). Every file is mapped before the first write: an
 * unmappable link or two files of one basename (case-insensitive) throw with one line per finding,
 * `<file>:<line>: <target> (<why>)` or `<file>: <basename> (<why>)`, and nothing is written.
 * @param {string} root project root
 * @param {string} dir target folder, new or empty, outside docs/wiki
 * @param {{repoUrl: string, ref: string}} base repository URL and ref of the repository links,
 *   both required
 * @returns {Array<string>} the written file names, by source path
 * @throws {Error} on a missing or invalid base, a target folder in use, or an unmappable link (the
 *   error's `findings` holds the lines)
 */
export function exportWiki(root, dir, { repoUrl, ref } = {}) {
  requireWiki(root);
  const baseErrors = linkBaseErrors({ repoUrl, ref });
  if (baseErrors.length) throw new Error(`export needs a valid base: ${baseErrors.join('; ')}`);
  const out = resolve(root, dir);
  const wiki = resolve(root, WIKI_DIR);
  if (out === wiki || out.startsWith(wiki + sep) || wiki.startsWith(out + sep))
    throw new Error('export into a folder that neither is nor contains docs/wiki');
  if (existsSync(out) && readdirSync(out).length)
    throw new Error(`${dir} is not empty; export into a new or empty folder`);
  const sourceFiles = readWikiFiles(root);
  const files = new Map(sourceFiles.map((f) => [f.path, f]));
  const findings = [];
  const byName = new Map();
  for (const f of sourceFiles) {
    const name = posix.basename(f.path).toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), f.path]);
  }
  for (const paths of byName.values()) {
    if (paths.length < 2) continue;
    for (const p of paths)
      findings.push(
        `${p}: ${posix.basename(p)} (basename shared with ${paths.filter((o) => o !== p).join(', ')}; the mirror is flat)`
      );
  }
  const map = (fromPath, line, target, image, shown = target) => {
    const mapped = wikiTarget(root, files, fromPath, target, image, { repoUrl, ref });
    if (!mapped.problem) return mapped.target;
    findings.push(`${fromPath}:${line}: ${shown} (${mapped.problem})`);
    return target;
  };
  const exported = sourceFiles.map((f) => ({
    name: posix.basename(f.path),
    text: exportText(root, f, map),
  }));
  if (findings.length)
    throw Object.assign(
      new Error(`${findings.length} findings, nothing exported:\n${findings.join('\n')}`),
      { findings }
    );
  mkdirSync(out, { recursive: true });
  for (const { name, text } of exported) writeFileSync(join(out, name), text);
  return exported.map((e) => e.name);
}

/**
 * The arguments of `export`: one `<dir>` and the options of EXPORT_OPTIONS, each at most once,
 * in any order.
 * @param {Array<string>} args the arguments after `export`
 * @returns {{dir: string, options: {ref?: string, repoUrl?: string}}} the folder and the options
 */
function exportArgs(args) {
  const options = {};
  const dirs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const key = EXPORT_OPTIONS[arg];
    if (key) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) throw usageError(`${arg} needs a value`);
      if (Object.hasOwn(options, key)) throw usageError(`${arg} is given twice`);
      options[key] = value;
      i++;
    } else if (arg.startsWith('--')) throw usageError(`unknown option ${arg}`);
    else dirs.push(arg);
  }
  if (dirs.length !== 1) throw usageError('export takes exactly one <dir>');
  return { dir: dirs[0], options };
}

const describe = (n) =>
  `- ${n.path} (${[n.id, n.status].filter(Boolean).join(', ') || n.folder || 'top'}): ${n.summary ?? ''}`;

async function main(cwd, [command, ...args]) {
  if (!Object.hasOwn(ARITY, command) || args.length < ARITY[command]) throw usageError();
  const exportCall = command === 'export' ? exportArgs(args) : null;
  const root = wikiRoot(cwd);
  switch (command) {
    case 'find': {
      const hits = findPages(readGraph(root), args.join(' '));
      console.log(
        hits.length ? hits.map(describe).join('\n') : `No page matches "${args.join(' ')}".`
      );
      return 0;
    }
    case 'related': {
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
      console.log(nextId(root, args[0]));
      return 0;
    case 'confirm': {
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
      const { dir, options } = exportCall;
      let base;
      try {
        base = exportBase(root, options, process.env);
      } catch (err) {
        throw usageError(err.message);
      }
      const baseErrors = linkBaseErrors(base);
      if (baseErrors.length) throw usageError(baseErrors.join('\nwiki: '));
      // Printed before the export, so the run log shows the ref even when a link fails.
      console.log(`links pinned to ${base.repoUrl}/blob/${base.ref}`);
      const files = exportWiki(root, resolve(cwd, dir), base);
      console.log(`Exported ${files.length} files of ${WIKI_DIR} flat to ${dir}.`);
      return 0;
    }
    default:
      throw usageError();
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
