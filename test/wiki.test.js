// business-rules-wiki (ADR-0030): the generated files of docs/wiki, their freshness and lint check
// (wikiStatus of scripts/gen-wiki.mjs, run by scripts/check-docs-fresh.mjs) and the lookup CLI
// scripts/wiki.mjs. Tests on the committed wiki only read the repository; every test that writes
// (status findings, audit and confirm, check-docs-fresh --fix, next-id, export) works in a folder
// under the OS temp dir and runs the CLI, `npm run docs:wiki` and check-docs-fresh.mjs with that
// folder or a subfolder as cwd; every export spawn passes --ref and --repo-url or an environment
// without GITHUB_* (CI sets GITHUB_SHA during npm test). The mirror workflow
// .github/workflows/wiki.yml is parsed with yaml (PLAN step 4, ADR-0030 amendment A-F).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { API_DIR, stampOpenApi } from '../scripts/gen-api-docs.mjs';
import {
  GRAPH,
  WIKI_DIR,
  WIKI_INDEXES,
  buildGraph,
  codeFiles,
  readPages,
  readWikiFiles,
  renderWiki,
  wikiSourcesHash,
  wikiStatus,
  writeWiki,
} from '../scripts/gen-wiki.mjs';
import { WIKI_GENERATED_MARK, WIKI_RULE_AREAS } from '../scripts/lib/doc-shapes.mjs';
import { recordedHash, sourcesHash } from '../scripts/lib/registry-sources.mjs';
import { exportWiki, nextId, pagesForPath, readGraph, wikiRoot } from '../scripts/wiki.mjs';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const CLI = path.join(root, 'scripts/wiki.mjs');
const HOME = `${WIKI_DIR}/Home.md`;
const SUBCATEGORY_RULE = `${WIKI_DIR}/rules/The-subcategory-belongs-to-the-products-category.md`;
// The pages PLAN acceptance criteria 5 and 6 name around SUBCATEGORY_RULE.
const MANDATORY_RULE = `${WIKI_DIR}/rules/A-product-needs-a-name-price-currency-stock-category-and-subcategory.md`;
const PRODUCTS_DOMAIN = `${WIKI_DIR}/domain/Products.md`;
const CASCADE_HOW_TO = `${WIKI_DIR}/how-to/Choose-a-category-and-subcategory.md`;
const ADR_0024_DIGEST = `${WIKI_DIR}/decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md`;
// The keys of a graph node (PLAN acceptance criterion 5).
const NODE_KEYS = [
  'path',
  'folder',
  'id',
  'title',
  'summary',
  'tags',
  'code',
  'messages',
  'elements',
  'status',
  'sources',
  'verified',
  'codeHash',
];
// The generated files of the committed wiki: graph.json, the five folder indexes, the sidebar and
// the API page of the one OpenAPI document.
const GENERATED = [
  GRAPH,
  ...Object.entries(WIKI_INDEXES).map(([folder, { file }]) => `${WIKI_DIR}/${folder}/${file}`),
  `${WIKI_DIR}/_Sidebar.md`,
  `${WIKI_DIR}/api/Catalog-service-API.md`,
].sort();
const REGISTRY_FILES = [
  'DOMAIN-MODEL.md',
  'SERVICES.md',
  'HANDLERS.md',
  'UI-ARTIFACTS.md',
  'REUSE-CATALOG.md',
  'JSDOC.md',
];
// A Russian word built from code points, so this file stays English.
const CYRILLIC_WORD = String.fromCodePoint(0x442, 0x43e, 0x432, 0x430, 0x440);

const readRepo = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
/** Every file under `dir`/docs/wiki, relative to `dir`, sorted. */
const wikiTree = (dir) =>
  fs
    .readdirSync(path.join(dir, WIKI_DIR), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
/** The `- ` lines of a CLI answer. */
const listed = (stdout) => stdout.split('\n').filter((line) => line.startsWith('- '));
/** Runs scripts/wiki.mjs with `cwd` as the project root. */
const wiki = (cwd, ...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

/** A project folder under the OS temp dir (realpath: macOS tmpdir is a symlink). */
function tempProject(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`)));
  const put = (entries) => {
    for (const [rel, text] of Object.entries(entries)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    }
  };
  const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const remove = () => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, put, read, remove };
}

/** A page of docs/wiki or docs/wiki/api (title, summary, tags, free sections). */
function page({ title, summary, body }) {
  return `---\ntitle: ${title}\nsummary: ${summary}\ntags: [test]\n---\n\n# ${title}\n\n${body}\n`;
}

/** A rule page in the shape of docs/wiki/rules. */
function rulePage({ title, id, summary, code, messages = [], elements = [], verified }) {
  return [
    '---',
    `title: ${title}`,
    `summary: ${summary}`,
    'tags: [items]',
    `id: ${id}`,
    'status: active',
    'since: 2026-10-26',
    `code: [${code.join(', ')}]`,
    `messages: [${messages.join(', ')}]`,
    `elements: [${elements.join(', ')}]`,
    'sources: [https://example.invalid/adr]',
    ...(verified ? [`verified: ${verified}`] : []),
    '---',
    '',
    `# ${title}`,
    '',
    '## Rule',
    '',
    'An item carries a name.',
    '',
    '## Why',
    '',
    'A list without names tells nothing.',
    '',
    '## Where it fires',
    '',
    '- Save.',
    '',
    '## History',
    '',
    '| Date | Change | Source |',
    '|---|---|---|',
    '| 2026-10-26 | Introduced. | [ADR](https://example.invalid/adr) |',
    '',
  ].join('\n');
}

/** The hand-written pages of the committed wiki, read without the generator's helpers. */
function committedPages() {
  return fs
    .readdirSync(path.join(root, WIKI_DIR), { recursive: true })
    .map((f) => `${WIKI_DIR}/${f.split(path.sep).join('/')}`)
    .filter((p) => p.endsWith('.md') && !path.posix.basename(p).startsWith('_'))
    .filter((p) => !readRepo(p).startsWith(WIKI_GENERATED_MARK))
    .sort();
}

/** The link targets of a page body as written: inline links and reference definitions. */
function writtenTargets(text) {
  const lines = text.split('\n');
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  const targets = [];
  let fenced = false;
  for (const line of lines.slice(end + 1)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const ref = line.match(/^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/);
    if (ref) targets.push(ref[1]);
    const prose = line.replace(/`[^`]*`/g, '');
    for (const m of prose.matchAll(/\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g))
      targets.push(m[1]);
  }
  return targets;
}

/** The relative link targets of a page body: no URL, no in-page anchor. */
const linkTargets = (text) =>
  writtenTargets(text).filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t) && !t.startsWith('#'));

describe('Generated wiki files (ADR-0030 decision 4)', () => {
  it('reports broken links, orphans, duplicate basenames and Cyrillic, and accepts the committed wiki', () => {
    expect(wikiStatus(root)).toEqual([]);

    const p = tempProject('wiki-status');
    try {
      const home = page({
        title: 'Home',
        summary: 'Entry page of the test wiki.',
        body: '- [Glossary](Glossary.md)\n- [API terms](api/Glossary.md)\n- [Missing](rules/Missing-rule.md)',
      });
      p.put({
        [HOME]: home,
        [`${WIKI_DIR}/Glossary.md`]: page({
          title: 'Glossary',
          summary: 'Terms of the test wiki.',
          body: `A product is an item of the catalog.\nIn Russian: ${CYRILLIC_WORD}.`,
        }),
        [`${WIKI_DIR}/api/Glossary.md`]: page({
          title: 'Glossary',
          summary: 'Terms of the test API.',
          body: 'An entity set is a collection.',
        }),
        [`${WIKI_DIR}/Orphan-page.md`]: page({
          title: 'Orphan page',
          summary: 'A page no other page links to.',
          body: 'Nobody reads this.',
        }),
      });
      // Before the first run every generated file is missing; the findings follow them.
      const missing = wikiStatus(p.dir).filter((r) =>
        r.endsWith(': missing; run npm run docs:wiki')
      );
      expect(missing.map((r) => r.split(':')[0]).sort()).toEqual(
        GENERATED.filter((f) => !f.includes('Catalog-service-API'))
      );

      writeWiki(p.dir);
      const brokenLine = home.split('\n').findIndex((l) => l.includes('Missing-rule')) + 1;
      const cyrillicLine =
        p
          .read(`${WIKI_DIR}/Glossary.md`)
          .split('\n')
          .findIndex((l) => l.includes(CYRILLIC_WORD)) + 1;
      expect(wikiStatus(p.dir)).toEqual([
        `${HOME}:${brokenLine}: broken link rules/Missing-rule.md`,
        expect.stringMatching(/^docs\/wiki\/Orphan-page\.md: orphan, no other page links to it/),
        expect.stringMatching(
          /^docs\/wiki\/Glossary\.md, docs\/wiki\/api\/Glossary\.md: basename glossary\.md is used more than once/
        ),
        expect.stringMatching(
          new RegExp(`^docs/wiki/Glossary\\.md: Cyrillic on line\\(s\\) ${cyrillicLine};`)
        ),
      ]);
    } finally {
      p.remove();
    }
  });

  it('keeps the generated wiki files in sync with the pages and the OpenAPI document', () => {
    const hash = wikiSourcesHash(root);
    for (const file of GENERATED) {
      const stamp =
        file === GRAPH
          ? JSON.parse(readRepo(file))['x-sources']
          : recordedHash(path.join(root, file));
      expect(stamp, file).toBe(hash);
    }
    expect([...renderWiki(root).files.keys()].sort()).toEqual(GENERATED);

    // A fresh writeWiki() from the inputs alone: the hand-written files, the OpenAPI documents and
    // the code files the pages name, copied as bytes (a page may name a binary file, an .xlsx).
    const p = tempProject('wiki-sync');
    try {
      const inputs = [
        ...readWikiFiles(root)
          .filter((f) => !f.generated)
          .map((f) => f.path),
        ...fs
          .readdirSync(path.join(root, API_DIR))
          .filter((name) => name.endsWith('.openapi3.json'))
          .map((name) => `${API_DIR}/${name}`),
        ...codeFiles(
          root,
          readPages(root).flatMap((pg) => asList(pg.meta.code))
        ),
      ];
      p.put(
        Object.fromEntries(inputs.map((file) => [file, fs.readFileSync(path.join(root, file))]))
      );
      expect(wikiSourcesHash(p.dir)).toBe(hash);
      expect(writeWiki(p.dir).sort()).toEqual(GENERATED);
      for (const file of GENERATED) expect(p.read(file), file).toBe(readRepo(file));

      // A second run, through `npm run docs:wiki` of a copy of package.json and scripts/, leaves
      // every file of docs/wiki byte for byte as committed: the copy stands in for the working
      // tree, so `git status docs/wiki` stays empty without the test writing the repository.
      fs.symlinkSync(path.join(root, 'node_modules'), path.join(p.dir, 'node_modules'), 'dir');
      fs.cpSync(path.join(root, 'scripts'), path.join(p.dir, 'scripts'), { recursive: true });
      fs.copyFileSync(path.join(root, 'package.json'), path.join(p.dir, 'package.json'));
      const second = spawnSync('npm', ['run', '--silent', 'docs:wiki'], {
        cwd: p.dir,
        encoding: 'utf8',
        env: { ...process.env, npm_config_update_notifier: 'false' },
      });
      expect(second.status, second.stderr).toBe(0);
      expect(wikiTree(p.dir)).toEqual(wikiTree(root));
      for (const file of wikiTree(root))
        expect(
          fs.readFileSync(path.join(p.dir, file)).equals(fs.readFileSync(path.join(root, file))),
          file
        ).toBe(true);
    } finally {
      p.remove();
    }
  });

  it('builds one node per page and one edge per page link', () => {
    const graph = readGraph(root);
    const pages = committedPages();
    expect(graph.nodes.map((n) => n.path)).toEqual(pages);
    for (const node of graph.nodes) {
      for (const key of NODE_KEYS) expect(node, node.path).toHaveProperty(key);
      expect(node.folder, node.path).toBe(
        node.path
          .slice(WIKI_DIR.length + 1)
          .split('/')
          .slice(0, -1)
          .join('/')
      );
    }

    // Every relative link from a page to another page is one `link` edge; a second link to the
    // same page, a self link, a generated index and a repository file are none.
    const known = new Set(pages);
    const expected = new Set();
    for (const from of pages) {
      for (const target of linkTargets(readRepo(from))) {
        const to = path.posix.normalize(
          path.posix.join(path.posix.dirname(from), decodeURI(target.split('#')[0]))
        );
        if (to !== from && known.has(to)) expected.add(`${from} -> ${to}`);
      }
    }
    expect(graph.edges.every((e) => e.type === 'link')).toBe(true);
    expect(graph.edges.map((e) => `${e.from} -> ${e.to}`).sort()).toEqual([...expected].sort());
    expect(graph.edges).toContainEqual({ from: HOME, to: SUBCATEGORY_RULE, type: 'link' });

    const synthetic = buildGraph([
      {
        path: `${WIKI_DIR}/A.md`,
        folder: '',
        meta: { title: 'A' },
        codeHash: null,
        links: [
          { kind: 'wiki', path: `${WIKI_DIR}/B.md` },
          { kind: 'wiki', path: `${WIKI_DIR}/B.md` },
          { kind: 'wiki', path: `${WIKI_DIR}/A.md` },
          { kind: 'wiki', path: `${WIKI_DIR}/rules/Business-rules.md` },
          { kind: 'repo', path: 'srv/catalog-service.js' },
        ],
      },
      { path: `${WIKI_DIR}/B.md`, folder: '', meta: { title: 'B' }, codeHash: null, links: [] },
    ]);
    expect(synthetic.nodes).toHaveLength(2);
    expect(synthetic.edges).toEqual([
      { from: `${WIKI_DIR}/A.md`, to: `${WIKI_DIR}/B.md`, type: 'link' },
    ]);

    // The backlinks of the subcategory rule include its domain page and a how-to page.
    const backlinks = graph.edges.filter((e) => e.to === SUBCATEGORY_RULE).map((e) => e.from);
    expect(backlinks).toEqual(expect.arrayContaining([PRODUCTS_DOMAIN, CASCADE_HOW_TO]));
  });
});

describe('Wiki lookup CLI (ADR-0030 decision 5)', () => {
  it('answers for-path, find and related on the committed wiki', () => {
    const graph = readGraph(root);
    const rule = graph.nodes.find((n) => n.path === SUBCATEGORY_RULE);
    expect(rule).toMatchObject({ id: 'BR-PRODUCTS-001', status: 'active' });
    const ruleLine = `- ${SUBCATEGORY_RULE} (BR-PRODUCTS-001, active): ${rule.summary}`;

    const mandatory = graph.nodes.find(
      (n) => n.title === 'A product needs a name, price, currency, stock, category and subcategory'
    );
    expect(mandatory).toMatchObject({
      path: MANDATORY_RULE,
      id: 'BR-PRODUCTS-003',
      status: 'active',
    });
    expect(mandatory.summary).toMatch(/^\S.*\.$/);

    const forPath = wiki(root, 'for-path', 'srv/annotations/Products.cds');
    expect(forPath.status, forPath.stderr).toBe(0);
    expect(listed(forPath.stdout)).toEqual(
      expect.arrayContaining([
        ruleLine,
        `- ${MANDATORY_RULE} (BR-PRODUCTS-003, active): ${mandatory.summary}`,
      ])
    );
    expect(listed(forPath.stdout).filter((l) => l.includes(`${WIKI_DIR}/decisions/`))).toEqual([]);
    // A decision digest never answers for-path, even when its code names the file.
    const digest = { path: `${WIKI_DIR}/decisions/D.md`, folder: 'decisions', code: ['srv/**'] };
    const rulesOnly = { path: `${WIKI_DIR}/rules/R.md`, folder: 'rules', code: ['srv/**/*.cds'] };
    expect(
      pagesForPath({ nodes: [digest, rulesOnly] }, 'srv/annotations/Products.cds').map(
        (n) => n.path
      )
    ).toEqual([rulesOnly.path]);

    const find = wiki(root, 'find', 'PRODUCTS_SUBCATEGORY_MISMATCH');
    expect(find.status, find.stderr).toBe(0);
    expect(listed(find.stdout)[0]).toBe(ruleLine);

    const related = wiki(root, 'related', SUBCATEGORY_RULE);
    expect(related.status, related.stderr).toBe(0);
    const [, linksTo = '', linkedFrom = ''] = related.stdout.split(/^Links to:$|^Linked from:$/m);
    const pathsOf = (section) =>
      listed(section)
        .filter((l) => l !== '- none')
        .map((l) => l.slice(2, l.indexOf(' (')));
    expect(pathsOf(linksTo).every((p) => p.startsWith(`${WIKI_DIR}/`))).toBe(true);
    // The rule links the ADR-0024 digest; its domain page and the how-to link the rule, so they
    // are listed under "Linked from" together with Home.
    expect(pathsOf(linksTo)).toContain(ADR_0024_DIGEST);
    expect(listed(linksTo).find((l) => l.startsWith(`- ${ADR_0024_DIGEST} `))).toMatch(
      /\(ADR-0024\)\.$/
    );
    expect(pathsOf(linkedFrom)).toEqual(
      expect.arrayContaining([HOME, PRODUCTS_DOMAIN, CASCADE_HOW_TO])
    );
    // The id names the same page.
    expect(wiki(root, 'related', 'BR-PRODUCTS-001').stdout).toBe(related.stdout);
  });

  it('resolves the project root from a subfolder and refuses a folder without a wiki', () => {
    const p = tempProject('wiki-root');
    const empty = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-no-root-')));
    const A = `${WIKI_DIR}/rules/A.md`;
    const B = `${WIKI_DIR}/rules/B.md`;
    try {
      p.put({
        [HOME]: page({
          title: 'Home',
          summary: 'Entry page.',
          body: `- [A](rules/A.md)\n- [B](rules/B.md)`,
        }),
        [A]: rulePage({
          title: 'A',
          id: 'BR-PRODUCTS-001',
          summary: 'Rule A.',
          code: ['srv/service.cds'],
        }),
        [B]: rulePage({
          title: 'B',
          id: 'BR-PRODUCTS-003',
          summary: 'Rule B.',
          code: ['srv/*.cds'],
        }),
        'srv/service.cds': 'service S {}\n',
        'app/products/webapp/index.html': '<!doctype html>\n',
        // A checkout nested in the project: the walk stops at its .git and never answers from
        // the wiki of the folder around it.
        'nested/.git/HEAD': 'ref: refs/heads/main\n',
      });
      writeWiki(p.dir);

      for (const sub of ['docs', 'app/products']) {
        const r = wiki(path.join(p.dir, sub), 'next-id', 'PRODUCTS');
        expect(r.status, `${sub}: ${r.stderr}`).toBe(0);
        expect(r.stdout, sub).toBe('BR-PRODUCTS-004\n');
      }
      const atRoot = wiki(p.dir, 'for-path', 'srv/service.cds');
      expect(atRoot.status, atRoot.stderr).toBe(0);
      expect(listed(atRoot.stdout).sort()).toEqual([
        `- ${A} (BR-PRODUCTS-001, active): Rule A.`,
        `- ${B} (BR-PRODUCTS-003, active): Rule B.`,
      ]);
      const fromSub = wiki(path.join(p.dir, 'app/products'), 'for-path', 'srv/service.cds');
      expect(fromSub.status, fromSub.stderr).toBe(0);
      expect(fromSub.stdout).toBe(atRoot.stdout);
      expect(wikiRoot(path.join(p.dir, WIKI_DIR, 'rules'))).toBe(p.dir);

      const outside = wiki(path.join(p.dir, 'docs'), 'for-path', '../x.cds');
      expect(outside.status).toBe(1);
      expect(outside.stderr).toMatch(/outside the project root/);
      expect(outside.stdout).toBe('');

      for (const cwd of [empty, path.join(p.dir, 'nested')]) {
        const r = wiki(cwd, 'next-id', 'PRODUCTS');
        expect(r.status, cwd).toBe(1);
        expect(r.stderr, cwd).toMatch(/no docs\/wiki\/ in /);
        expect(r.stdout, cwd).toBe('');
      }
      expect(() => nextId(empty, 'PRODUCTS')).toThrow(/no docs\/wiki\//);
    } finally {
      p.remove();
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('next-id skips every id in use', () => {
    const p = tempProject('wiki-next-id');
    try {
      p.put({
        [HOME]: page({
          title: 'Home',
          summary: 'Entry page.',
          body: 'An example id in prose, BR-PRODUCTS-009, is no id in use.',
        }),
        [`${WIKI_DIR}/rules/A.md`]: '---\nid: BR-PRODUCTS-001\nstatus: active\n---\n# A\n',
        [`${WIKI_DIR}/rules/B.md`]: '---\nid: BR-PRODUCTS-003\nstatus: retired\n---\n# B\n',
        [`${WIKI_DIR}/rules/C.md`]: '---\nid: BR-IMPORT-007\nstatus: planned\n---\n# C\n',
      });
      const r = wiki(p.dir, 'next-id', 'PRODUCTS');
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe('BR-PRODUCTS-004\n');
      expect(nextId(p.dir, 'products')).toBe('BR-PRODUCTS-004');
      expect(nextId(p.dir, 'IMPORT')).toBe('BR-IMPORT-008');
      expect(nextId(p.dir, 'ACCESS')).toBe('BR-ACCESS-001');

      const unknown = wiki(p.dir, 'next-id', 'PRICES');
      expect(unknown.status).toBe(1);
      expect(unknown.stderr).toMatch(/unknown area PRICES/);
      const usage = wiki(p.dir, 'next-id');
      expect(usage.status).toBe(1);
      expect(usage.stderr).toMatch(/^usage: node scripts\/wiki\.mjs/);
    } finally {
      p.remove();
    }

    const inUse = new Set(
      readGraph(root)
        .nodes.map((n) => n.id)
        .filter(Boolean)
    );
    for (const area of WIKI_RULE_AREAS) {
      const id = nextId(root, area);
      expect(id).toMatch(new RegExp(`^BR-${area}-\\d{3}$`));
      expect(inUse.has(id), id).toBe(false);
    }
  });

  it('audits stale pages, uncovered message keys and uncovered constrained elements, and confirm re-stamps a page', () => {
    const p = tempProject('wiki-audit');
    const RULE = `${WIKI_DIR}/rules/The-item-name-is-mandatory.md`;
    const rule = (extra) =>
      rulePage({
        title: 'The item name is mandatory',
        id: 'BR-PRODUCTS-001',
        summary: 'An item is saved only with a name.',
        code: ['srv/handler.js'],
        ...extra,
      });
    try {
      p.put({
        'srv/service.cds': [
          'service S {',
          '  entity Items {',
          '    key ID : Integer;',
          '        name : String(40);',
          '        note : String(100);',
          '  }',
          '}',
          'annotate S.Items with {',
          '  name @mandatory;',
          '};',
          '',
        ].join('\n'),
        'srv/handler.js': 'export const rule = 1;\n',
        '_i18n/messages.properties': 'ITEMS_NAME_TAKEN=The name is already taken.\n',
        [RULE]: rule({}),
      });

      const first = wiki(p.dir, 'confirm', RULE);
      expect(first.status, first.stderr).toBe(0);
      const stamped = p.read(RULE).match(/^verified: ([0-9a-f]{16})$/m)?.[1];
      expect(first.stdout).toContain(`${RULE}: verified ${stamped}`);

      p.put({ 'srv/handler.js': 'export const rule = 2;\n' });
      const stale = wiki(p.dir, 'audit');
      expect(stale.status, stale.stderr).toBe(1);
      expect(listed(stale.stdout)).toEqual([
        `- ${RULE}: code changed since verified (${stamped}); update the page to the code, then node scripts/wiki.mjs confirm ${RULE}`,
        "- _i18n/messages.properties: ITEMS_NAME_TAKEN is in no rule page's messages",
        expect.stringMatching(/^- Items\.name \(@mandatory\) is in no rule page's elements$/),
      ]);
      expect(stale.stdout).toMatch(/^wiki audit: 3 findings$/m);

      // The page names the key and the element, then confirm stamps the current code.
      p.put({
        [RULE]: rule({
          messages: ['ITEMS_NAME_TAKEN'],
          elements: ['Items.name'],
          verified: stamped,
        }),
      });
      const second = wiki(p.dir, 'confirm', RULE);
      expect(second.status, second.stderr).toBe(0);
      const restamped = p.read(RULE).match(/^verified: ([0-9a-f]{16})$/m)?.[1];
      expect(restamped).not.toBe(stamped);
      expect(restamped).toBe(readPages(p.dir).find((pg) => pg.path === RULE).codeHash);
      expect(p.read(RULE).match(/^verified:/gm)).toHaveLength(1);

      const clean = wiki(p.dir, 'audit');
      expect(clean.status, clean.stdout).toBe(0);
      expect(clean.stdout).toBe('wiki audit: clean\n');
    } finally {
      p.remove();
    }
  });

  it('check-docs-fresh.mjs names stale wiki files and --fix regenerates them', () => {
    const p = tempProject('wiki-docs-fresh');
    const RULE = `${WIKI_DIR}/rules/The-item-name-is-mandatory.md`;
    const rule = (summary) =>
      rulePage({
        title: 'The item name is mandatory',
        id: 'BR-PRODUCTS-001',
        summary,
        code: ['db/schema.cds'],
      });
    const OPENAPI = `${API_DIR}/S.openapi3.json`;
    const checkDocsFresh = (...args) =>
      spawnSync(process.execPath, [path.join(root, 'scripts/check-docs-fresh.mjs'), ...args], {
        cwd: p.dir,
        encoding: 'utf8',
        env: { ...process.env, npm_config_update_notifier: 'false' },
      });
    const reasonsOf = (r) =>
      r.stderr
        .split('\n')
        .filter((l) => l.startsWith('  - '))
        .map((l) => l.slice(4));
    try {
      // gen-registry.mjs (run by --fix) calls `npx cds compile`, which resolves from node_modules.
      fs.symlinkSync(path.join(root, 'node_modules'), path.join(p.dir, 'node_modules'), 'dir');
      // --fix runs scripts/gen-registry.mjs of the project it checks: a copy, so it writes only here.
      fs.cpSync(path.join(root, 'scripts'), path.join(p.dir, 'scripts'), { recursive: true });
      p.put({
        'db/schema.cds':
          'namespace t;\n\nentity Items {\n  key ID : Integer;\n  name : String(40);\n}\n',
        'srv/service.cds':
          "using { t } from '../db/schema';\n\nservice S {\n  entity Items as projection on t.Items;\n}\n",
        [HOME]: page({
          title: 'Home',
          summary: 'Entry page of the test wiki.',
          body: '- [The item name is mandatory](rules/The-item-name-is-mandatory.md)',
        }),
        [RULE]: rule('An item is saved only with a name.'),
        [OPENAPI]: JSON.stringify({ openapi: '3.0.2', info: { title: 'S' }, paths: {} }),
      });
      writeWiki(p.dir);
      const hash = sourcesHash(p.dir);
      p.put({ [OPENAPI]: stampOpenApi(p.read(OPENAPI), hash) });
      for (const file of REGISTRY_FILES) {
        p.put({
          [`docs/registry/${file}`]: `<!-- generated by scripts/gen-registry.mjs | sources: ${hash} | 2026-10-26 | do not edit -->\n# ${file}\n`,
        });
      }
      const fresh = checkDocsFresh();
      expect(fresh.status, fresh.stderr).toBe(0);

      p.put({ [RULE]: rule('An item without a name is never saved.') });
      const stale = checkDocsFresh();
      expect(stale.status).toBe(1);
      expect(reasonsOf(stale)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^docs\/wiki\/graph\.json: sources [0-9a-f]{16} does not match/),
          expect.stringMatching(
            /^docs\/wiki\/rules\/Business-rules\.md: sources [0-9a-f]{16} does not match/
          ),
        ])
      );

      const fixed = checkDocsFresh('--fix');
      expect(fixed.status, fixed.stderr).toBe(0);
      expect(fixed.stdout).toContain('docs/registry is fresh.');
      // The whole chain ran: the registry, the real OpenAPI export of S, then the wiki.
      expect(recordedHash(path.join(p.dir, 'docs/registry/DOMAIN-MODEL.md'))).toBe(
        sourcesHash(p.dir)
      );
      expect(JSON.parse(p.read(OPENAPI)).paths).toHaveProperty('/Items');
      expect(wikiStatus(p.dir)).toEqual([]);
      const current = wikiSourcesHash(p.dir);
      expect(JSON.parse(p.read(GRAPH))['x-sources']).toBe(current);
      expect(recordedHash(path.join(p.dir, `${WIKI_DIR}/rules/Business-rules.md`))).toBe(current);
      expect(p.read(`${WIKI_DIR}/rules/Business-rules.md`)).toContain(
        'An item without a name is never saved.'
      );
    } finally {
      p.remove();
    }
  });

  it('export turns the frontmatter into a key table under the H1 and leaves out graph.json', () => {
    const out = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-export-')));
    const base = { repoUrl: 'https://github.com/daiedy/Test_CAP', ref: 'c0ffee1' };
    const pinned = `${base.repoUrl}/blob/${base.ref}/`;
    try {
      expect(() => exportWiki(root, out)).toThrow(/valid base/);
      expect(fs.readdirSync(out)).toEqual([]);
      const written = exportWiki(root, out, base).sort();
      const sourceOf = new Map(readWikiFiles(root).map((f) => [path.posix.basename(f.path), f]));
      expect(written).toEqual([...sourceOf.keys()].sort());
      expect(fs.readdirSync(out).sort()).toEqual(written);
      expect(fs.existsSync(path.join(out, 'graph.json'))).toBe(false);
      const exported = (name) => fs.readFileSync(path.join(out, name), 'utf8');

      const name = path.posix.basename(SUBCATEGORY_RULE);
      const lines = exported(name).split('\n');
      const node = readGraph(root).nodes.find((n) => n.path === SUBCATEGORY_RULE);
      const h1 = lines.findIndex((l) => /^# /.test(l));
      expect(lines.slice(0, h1).every((l) => l === '')).toBe(true);
      expect(lines[h1]).toBe(`# ${node.title}`);
      expect(lines.slice(h1 + 1, h1 + 4)).toEqual(['', '| Key | Value |', '|---|---|']);
      const table = lines.slice(h1 + 2, lines.indexOf('', h1 + 2));
      expect(table).toEqual(
        expect.arrayContaining([
          `| Summary | ${node.summary} |`,
          '| Id | `BR-PRODUCTS-001` |',
          '| Status | active |',
          '| Messages | `PRODUCTS_SUBCATEGORY_MISMATCH` |',
        ])
      );
      expect(table.some((row) => /^\| (title|verified|Title|Verified) /.test(row))).toBe(false);
      expect(lines).not.toContain('---');
      const headings = (text) => text.split('\n').filter((l) => /^##? /.test(l));
      expect(headings(exported(name))).toEqual(headings(readRepo(SUBCATEGORY_RULE)));
      expect(exported('_Footer.md')).toBe(readRepo(`${WIKI_DIR}/_Footer.md`));

      // Every link of the export works in the flat wiki: a relative target is an exported page,
      // a mapped repository link a pinned blob URL of an existing file, any other URL as written.
      let pageLinks = 0;
      let repoLinks = 0;
      for (const file of written) {
        for (const target of writtenTargets(exported(file))) {
          const where = `${file}: ${target}`;
          if (target.startsWith('#')) continue;
          if (target.startsWith(pinned)) {
            const rel = decodeURIComponent(target.slice(pinned.length).split(/[?#]/)[0]);
            const stat = fs.statSync(path.join(root, rel), { throwIfNoEntry: false });
            expect(stat?.isFile(), where).toBe(true);
            repoLinks++;
          } else if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
            expect(sourceOf.get(file).text, where).toContain(target);
          } else {
            const page = decodeURIComponent(target.split(/[?#]/)[0]);
            expect(written, where).toContain(`${page}.md`);
            pageLinks++;
          }
        }
      }
      expect(pageLinks).toBeGreaterThan(0);
      expect(repoLinks).toBeGreaterThan(0);

      expect(() => exportWiki(root, out, base)).toThrow(/not empty/);
      expect(() => exportWiki(root, `${WIKI_DIR}/out`, base)).toThrow(/neither is nor contains/);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('export writes wiki-ready links: page links as bare page names, repository links as blob URLs of the given ref, and fails on an unmappable link', () => {
    const p = tempProject('wiki-export-links');
    const REPO = 'https://repo.example/team/shop';
    const REF = 'v1.2';
    const ADR = 'docs/decisions/ADR-0001-x.md';
    const R = `${WIKI_DIR}/rules/R.md`;
    const BAD = `${WIKI_DIR}/rules/Bad.md`;
    const SHARED = [`${WIKI_DIR}/domain/S.md`, `${WIKI_DIR}/rules/S.md`];
    // Never the GITHUB_* of the runner: CI sets GITHUB_SHA during npm test.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_'))
    );
    const run = (extraEnv, ...args) =>
      spawnSync(process.execPath, [CLI, 'export', ...args], {
        cwd: p.dir,
        encoding: 'utf8',
        env: { ...env, ...extraEnv },
      });
    const exists = (rel) => fs.existsSync(path.join(p.dir, rel));
    const lineOf = (text, part) => text.split('\n').findIndex((l) => l.includes(part)) + 1;
    try {
      p.put({
        'package.json': JSON.stringify({
          name: 'shop',
          repository: { type: 'git', url: 'git+https://github.example/acme/shop.git' },
        }),
        [ADR]: '# ADR-0001 X\n',
        'docs/images/logo.png': 'png',
        [`${WIKI_DIR}/graph.json`]: '{}\n',
        [`${WIKI_DIR}/_Footer.md`]: 'A mirror; edit [Home](Home.md) in the repository.\n',
        [HOME]: page({
          title: 'Home',
          summary: 'Entry page.',
          body: '- [R](rules/R.md)\n- [D](domain/D.md)\n- [Rules](rules/Business-rules.md)',
        }),
        [`${WIKI_DIR}/rules/Business-rules.md`]: `${WIKI_GENERATED_MARK}; do not edit -->\n\n# Business rules\n\n- [R](R.md)\n- [Home](../Home.md)\n`,
        [SHARED[1]]: page({ title: 'S', summary: 'Same folder.', body: 'Back to [R](R.md).' }),
        [R]: page({
          title: 'R',
          summary: 'A page with every kind of link.',
          body: [
            '## Why',
            '',
            '- [Home](../Home.md)',
            '- [S](S.md)',
            '- [Index](Business-rules.md)',
            '- [ADR `X`](../../decisions/ADR-0001-x.md)',
            '- [ADR X](<../../decisions/ADR-0001-x.md> "The ADR")',
            '- [Decisions](../../decisions)',
            '- ![Logo](../../images/logo.png)',
            '- [External](https://example.com/x)',
            '- [Top](#why)',
            '- [D][d]',
            '',
            '[d]: ../domain/D.md#facts "Facts"',
          ].join('\n'),
        }),
        [`${WIKI_DIR}/domain/D.md`]: [
          '---',
          'title: D',
          'summary: A page with repository sources.',
          'tags: [test]',
          `sources: [${ADR}, https://example.com/spec]`,
          '---',
          '',
          '# D',
          '',
          '## Facts',
          '',
          '- [R](../rules/R.md#why)',
          '',
        ].join('\n'),
      });

      // Options win over the Actions environment.
      const actions = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r' };
      const r = run(
        { ...actions, GITHUB_SHA: 'f'.repeat(40) },
        'out',
        '--ref',
        REF,
        '--repo-url',
        REPO
      );
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain(`links pinned to ${REPO}/blob/${REF}`);
      const names = ['Business-rules.md', 'D.md', 'Home.md', 'R.md', 'S.md', '_Footer.md'];
      expect(fs.readdirSync(path.join(p.dir, 'out')).sort()).toEqual(names.sort());
      const out = (name, dir = 'out') => p.read(`${dir}/${name}`);
      const blob = `${REPO}/blob/${REF}/${ADR}`;
      expect(out('R.md').split('\n')).toEqual(
        expect.arrayContaining([
          '- [Home](Home)',
          '- [S](S)',
          '- [Index](Business-rules)',
          `- [ADR \`X\`](${blob})`,
          `- [ADR X](<${blob}> "The ADR")`,
          `- [Decisions](${REPO}/tree/${REF}/docs/decisions)`,
          `- ![Logo](${REPO}/raw/${REF}/docs/images/logo.png)`,
          '- [External](https://example.com/x)',
          '- [Top](#why)',
          '- [D][d]',
          '[d]: D#facts "Facts"',
        ])
      );
      expect(out('D.md').split('\n')).toEqual(
        expect.arrayContaining([
          `| Sources | [${ADR}](${blob}), https://example.com/spec |`,
          '- [R](R#why)',
        ])
      );
      expect(out('Business-rules.md')).toContain('\n- [R](R)\n- [Home](Home)\n');
      expect(out('_Footer.md')).toBe('A mirror; edit [Home](Home) in the repository.\n');
      for (const name of names)
        for (const target of linkTargets(out(name)))
          expect(names, `${name}: ${target}`).toContain(`${target.split('#')[0]}.md`);

      // The environment channel, then the local default: main and the package.json repository.
      const viaEnv = run({ ...actions, GITHUB_SHA: 'abc123' }, 'out-env');
      expect(viaEnv.status, viaEnv.stderr).toBe(0);
      expect(viaEnv.stdout).toContain('links pinned to https://github.com/o/r/blob/abc123');
      expect(out('R.md', 'out-env')).toContain(
        `- [ADR \`X\`](https://github.com/o/r/blob/abc123/${ADR})`
      );
      const local = run({}, 'out-local');
      expect(local.status, local.stderr).toBe(0);
      expect(local.stdout).toContain('links pinned to https://github.example/acme/shop/blob/main');
      expect(out('D.md', 'out-local')).toContain(
        `[${ADR}](https://github.example/acme/shop/blob/main/${ADR})`
      );

      // An invalid base is a usage error before anything is written.
      for (const [extraEnv, args, why] of [
        [{}, ['--ref', 'a..b'], /ref a\.\.b/],
        [{}, ['--repo-url', 'repo.example/team/shop'], /repository URL/],
        [{ GITHUB_SERVER_URL: 'https://github.com' }, [], /GITHUB_REPOSITORY/],
        [{ GITHUB_REPOSITORY: 'o/r' }, [], /GITHUB_SERVER_URL/],
      ]) {
        const bad = run(extraEnv, 'out-base', ...args);
        expect(bad.status, args.join(' ')).toBe(1);
        expect(bad.stderr).toMatch(why);
        expect(exists('out-base')).toBe(false);
      }

      // Each unmappable link alone fails the export, named by file, line and target.
      const base = { repoUrl: REPO, ref: REF };
      const failure = () => {
        try {
          exportWiki(p.dir, path.join(p.dir, 'out-bad'), base);
        } catch (err) {
          return err.findings;
        }
        return [];
      };
      const kinds = [
        ['Gone.md', /does not exist/, '[Gone]'],
        ['../../../../outside.md', /outside the repository/, '[Out]'],
        ['../_Footer.md', /_Footer\.md/, '[Footer]'],
        ['S.md', /image of a page/, '![Page]'],
        ['../../decisions', /image of a folder/, '![Folder]'],
      ];
      const bodies = kinds.map(([target, , text]) => `- ${text}(${target})`);
      for (const [i, [target, why]] of kinds.entries()) {
        const text = page({ title: 'Bad', summary: 'One unmappable link.', body: bodies[i] });
        p.put({ [BAD]: text });
        const findings = failure();
        expect(findings, target).toHaveLength(1);
        expect(findings[0].startsWith(`${BAD}:${lineOf(text, bodies[i])}: ${target} (`)).toBe(true);
        expect(findings[0]).toMatch(why);
        expect(exists('out-bad')).toBe(false);
      }
      fs.rmSync(path.join(p.dir, BAD));
      p.put({
        [SHARED[0]]: page({ title: 'S', summary: 'Shared name.', body: '- [R](../rules/R.md)' }),
      });
      const shared = failure();
      expect(shared).toHaveLength(2);
      for (const [i, file] of SHARED.entries())
        expect(shared[i].startsWith(`${file}: S.md (`), shared[i]).toBe(true);
      expect(exists('out-bad')).toBe(false);

      // The CLI exits 1 with every finding and writes nothing.
      const text = page({
        title: 'Bad',
        summary: 'Every unmappable link.',
        body: bodies.join('\n'),
      });
      p.put({ [BAD]: text });
      const all = run({}, 'out-bad', '--ref', REF, '--repo-url', REPO);
      expect(all.status).toBe(1);
      for (const [i, [target]] of kinds.entries())
        expect(all.stderr).toContain(`${BAD}:${lineOf(text, bodies[i])}: ${target} (`);
      for (const file of SHARED) expect(all.stderr).toContain(`${file}: S.md (`);
      expect(exists('out-bad')).toBe(false);
    } finally {
      p.remove();
    }
  });
});

describe('Wiki mirror workflow (ADR-0030 decision 7, amendment F)', () => {
  it('the mirror workflow exports the pages, pins the action with preprocess off, filters on docs/wiki and ignores graph.json', () => {
    const ACTION = 'Andrew-Chen-Wang/github-wiki-action@1bbb4280446f9630e8e21a18012cbacf3b0f992e';
    const text = readRepo('.github/workflows/wiki.yml');
    const workflow = parseYaml(text);
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on.push.paths).toEqual(['docs/wiki/**']);
    expect(Object.keys(workflow.on)).toContain('workflow_dispatch');
    expect(workflow.permissions.contents).toBe('write');

    const isAction = (step) => String(step.uses ?? '').startsWith(ACTION.split('@')[0]);
    const jobs = Object.values(workflow.jobs).filter((job) => job.steps?.some(isAction));
    expect(jobs).toHaveLength(1);
    const { steps } = jobs[0];
    const at = steps.findIndex(isAction);
    expect(steps[at].uses).toBe(ACTION);
    const raw = text.split('\n').filter((line) => line.includes(ACTION));
    expect(raw.map((line) => line.trim())).toEqual([`uses: ${ACTION} # v5.0.6`]);
    const exportAt = steps.findIndex(
      (step) => String(step.run ?? '').trim() === 'node scripts/wiki.mjs export .wiki-out'
    );
    expect(exportAt).toBeGreaterThanOrEqual(0);
    expect(exportAt).toBeLessThan(at);
    expect(steps[at].with).toMatchObject({
      path: '.wiki-out',
      strategy: 'init',
      preprocess: false,
    });
    expect(String(steps[at].with.ignore).split(/\s+/)).toContain('graph.json');
  });
});
