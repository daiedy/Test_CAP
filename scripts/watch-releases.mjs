#!/usr/bin/env node
/**
 * Upstream dependency release watcher for the CAP + UI5 pipeline.
 *
 * Fetches npm dist-tags, CAP release pages, GitHub Atom feeds and UI5 version
 * JSON files, compares them with the state stored in docs/upstream/versions.json
 * and prints a Markdown diff. Deterministic, no LLM involved: the agent
 * (skill `upstream-check`) only reads the diff this script produces.
 *
 * Usage:
 *   node scripts/watch-releases.mjs                 # update state, print Markdown diff
 *   node scripts/watch-releases.mjs --dry-run       # print diff, do not write state
 *   node scripts/watch-releases.mjs --out diff.md   # also write the Markdown diff to a file
 *   node scripts/watch-releases.mjs --json          # print machine-readable diff on stdout
 *
 * Exit code: 0, or 1 when every source failed to load.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const STATE_FILE = path.join(ROOT, 'docs', 'upstream', 'versions.json');
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;
const MAX_FEED_ENTRIES = 20;

const NPM_PACKAGES = [
  '@sap/cds',
  '@sap/cds-dk',
  '@sap/cds-compiler',
  '@cap-js/cds-test',
  '@cap-js/sqlite',
  '@cap-js/mcp-server',
  '@ui5/linter',
  '@ui5/mcp-server',
  '@sap-ux/fiori-mcp-server',
  '@sap-ux/ui5-test-writer',
  '@sap/ux-ui5-tooling',
  'wdio-ui5-service',
  'ui5-test-runner',
  '@ui5/cli',
  '@sap-ux/ui5-middleware-fe-mockserver',
  'chrome-devtools-mcp',
];

const ATOM_FEEDS = {
  'cap-js/cds-dbs releases': 'https://github.com/cap-js/cds-dbs/releases.atom',
  'cap-js/cds-test releases': 'https://github.com/cap-js/cds-test/releases.atom',
  'cap-js/mcp-server releases': 'https://github.com/cap-js/mcp-server/releases.atom',
  'SAP/open-ux-tools releases': 'https://github.com/SAP/open-ux-tools/releases.atom',
  'UI5/linter releases': 'https://github.com/UI5/linter/releases.atom',
  'UI5/mcp-server releases': 'https://github.com/UI5/mcp-server/releases.atom',
  'UI5/openui5 releases': 'https://github.com/UI5/openui5/releases.atom',
  'ui5-community/wdi5 releases': 'https://github.com/ui5-community/wdi5/releases.atom',
  'UI5/plugins-coding-agents releases':
    'https://github.com/UI5/plugins-coding-agents/releases.atom',
  'capire/skills commits': 'https://github.com/capire/skills/commits/main.atom',
  "SAP-docs/sapui5 What's New commits":
    'https://github.com/SAP-docs/sapui5/commits/main/docs/01_Whats-New.atom',
};

const UI5_JSON = {
  'UI5 version overview': 'https://ui5.sap.com/versionoverview.json',
  'UI5 CDN current version': 'https://ui5.sap.com/resources/sap-ui-version.json',
};

// ---------------------------------------------------------------------------
// CLI

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = flag('--dry-run');
const AS_JSON = flag('--json');
const OUT_FILE = option('--out');

// ---------------------------------------------------------------------------
// Helpers

const sha256 = (input) => createHash('sha256').update(input).digest('hex');
const nowIso = () => new Date().toISOString();

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'test-cap-upstream-watcher', accept: '*/*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function parseAtom(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml)) && entries.length < MAX_FEED_ENTRIES) {
    const block = m[1];
    const id = decodeEntities(block.match(/<id>([\s\S]*?)<\/id>/)?.[1] ?? '');
    const title = decodeEntities(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link = block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '';
    const updated = block.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() ?? '';
    entries.push({ id, title, link, updated });
  }
  return entries;
}

function markdownHeadings(md) {
  return md
    .split('\n')
    .filter((l) => /^#{2,3}\s/.test(l))
    .map((l) => l.replace(/\s+\{[^}]*\}\s*$/, '').trim());
}

const npmDistTagsUrl = (pkg) =>
  `https://registry.npmjs.org/-/package/${encodeURIComponent(pkg)}/dist-tags`;

// ---------------------------------------------------------------------------
// Source definitions: each returns { hash, ...details }

function buildSources() {
  const sources = [];

  for (const pkg of NPM_PACKAGES) {
    sources.push({
      id: `npm:${pkg}`,
      kind: 'npm',
      group: 'npm dist-tags changed',
      url: npmDistTagsUrl(pkg),
      async load(text) {
        const tags = JSON.parse(text);
        const sorted = Object.fromEntries(
          Object.entries(tags).sort(([a], [b]) => a.localeCompare(b))
        );
        return { hash: sha256(JSON.stringify(sorted)), latest: tags.latest, tags: sorted };
      },
    });
  }

  const year = new Date().getUTCFullYear();
  sources.push({
    id: 'cap:releases-index',
    kind: 'cap-md',
    group: 'CAP release notes/changelog changed',
    url: 'https://cap.cloud.sap/docs/releases/index.md',
    async load(text) {
      return { hash: sha256(text.replace(/\s+/g, ' ').trim()), headings: markdownHeadings(text) };
    },
  });
  sources.push({
    id: 'cap:changelog',
    kind: 'cap-md',
    group: 'CAP release notes/changelog changed',
    url: `https://cap.cloud.sap/docs/releases/${year}/changelog.md`,
    fallbackUrl: `https://cap.cloud.sap/docs/releases/${year - 1}/changelog.md`,
    async load(text) {
      return { hash: sha256(text.replace(/\s+/g, ' ').trim()), headings: markdownHeadings(text) };
    },
  });

  for (const [name, url] of Object.entries(ATOM_FEEDS)) {
    sources.push({
      id: `feed:${name}`,
      kind: 'atom',
      group: 'Feeds changed',
      url,
      async load(text) {
        const entries = parseAtom(text);
        const key = entries
          .map((e) => `${e.id}|${e.title}`)
          .sort()
          .join('\n');
        return { hash: sha256(key), entries };
      },
    });
  }

  sources.push({
    id: 'ui5:versionoverview',
    kind: 'ui5-json',
    group: 'UI5 changed',
    url: UI5_JSON['UI5 version overview'],
    async load(text) {
      const data = JSON.parse(text);
      const versions = (data.versions ?? []).map((v) => ({
        version: v.version,
        support: v.support,
        lts: Boolean(v.lts),
        eom: v.eom,
      }));
      const active = versions.find((v) => /maintenance/i.test(v.support ?? '')) ?? versions[0];
      return {
        hash: sha256(JSON.stringify(versions)),
        activeVersion: active?.version,
        lts: versions.filter((v) => v.lts).map((v) => v.version),
        maintained: versions
          .filter((v) => /maintenance/i.test(v.support ?? ''))
          .map((v) => v.version),
      };
    },
  });
  sources.push({
    id: 'ui5:cdn-version',
    kind: 'ui5-json',
    group: 'UI5 changed',
    url: UI5_JSON['UI5 CDN current version'],
    async load(text) {
      const data = JSON.parse(text);
      return {
        hash: sha256(String(data.version)),
        version: data.version,
        buildTimestamp: data.buildTimestamp,
      };
    },
  });

  return sources;
}

// ---------------------------------------------------------------------------
// State

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { updatedAt: null, sources: {} };
    throw err;
  }
}

async function writeState(state) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Diffing

function diffSource(source, previous, current) {
  if (!previous) return { status: 'baseline', details: [] };
  if (previous.hash === current.hash) return { status: 'unchanged', details: [] };
  const details = [];
  switch (source.kind) {
    case 'npm':
      if (previous.latest !== current.latest) {
        details.push(`latest: ${previous.latest} → ${current.latest}`);
      }
      for (const [tag, ver] of Object.entries(current.tags ?? {})) {
        if (tag !== 'latest' && previous.tags?.[tag] !== ver)
          details.push(`${tag}: ${previous.tags?.[tag] ?? '—'} → ${ver}`);
      }
      break;
    case 'cap-md': {
      const before = new Set(previous.headings ?? []);
      const added = (current.headings ?? []).filter((h) => !before.has(h));
      if (added.length) details.push(...added.map((h) => `new heading: ${h}`));
      else details.push('content changed, no new headings');
      break;
    }
    case 'atom': {
      const before = new Set((previous.entries ?? []).map((e) => e.id));
      const added = (current.entries ?? []).filter((e) => !before.has(e.id));
      if (added.length) details.push(...added.map((e) => `[${e.title}](${e.link})`));
      else details.push('feed changed (entries re-ordered or removed)');
      break;
    }
    case 'ui5-json':
      if (source.id === 'ui5:cdn-version') {
        details.push(`CDN version: ${previous.version} → ${current.version}`);
      } else {
        if (previous.activeVersion !== current.activeVersion) {
          details.push(`active version: ${previous.activeVersion} → ${current.activeVersion}`);
        }
        const beforeLts = new Set(previous.lts ?? []);
        for (const v of current.lts ?? []) if (!beforeLts.has(v)) details.push(`new LTS: ${v}`);
        const beforeMaint = new Set(previous.maintained ?? []);
        for (const v of current.maintained ?? [])
          if (!beforeMaint.has(v)) details.push(`now maintained: ${v}`);
        for (const v of beforeMaint)
          if (!(current.maintained ?? []).includes(v)) details.push(`left maintenance: ${v}`);
        if (!details.length) details.push('version table changed (support/eom dates)');
      }
      break;
    default:
      details.push('changed');
  }
  return { status: 'changed', details };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Upstream dependency release diff (${report.checkedAt})`, '');
  if (report.baseline) {
    lines.push('First run: state seeded, nothing to compare against yet.', '');
  }
  const groups = [
    'npm dist-tags changed',
    'CAP release notes/changelog changed',
    'UI5 changed',
    'Feeds changed',
  ];
  let anyChange = false;
  for (const group of groups) {
    const items = report.changed.filter((c) => c.group === group);
    lines.push(`## ${group}`, '');
    if (!items.length) {
      lines.push('_no changes_', '');
      continue;
    }
    anyChange = true;
    for (const item of items) {
      lines.push(`- **${item.id}** (${item.url})`);
      for (const d of item.details) lines.push(`  - ${d}`);
    }
    lines.push('');
  }
  if (report.errors.length) {
    lines.push('## Errors', '');
    for (const e of report.errors) lines.push(`- ${e.id}: ${e.error} (${e.url})`);
    lines.push('');
  }
  lines.push('## Snapshot', '');
  lines.push('| Source | Value |', '|---|---|');
  for (const s of report.snapshot) lines.push(`| ${s.id} | ${s.value} |`);
  lines.push('');
  lines.push(
    `_Sources checked: ${report.stats.ok} ok, ${report.stats.failed} failed, ${report.changed.length} changed._`
  );
  if (!anyChange && !report.baseline) lines.push('', 'No changes since the last run.');
  return lines.join('\n') + '\n';
}

function snapshotValue(source, current) {
  if (!current) return '—';
  switch (source.kind) {
    case 'npm':
      return current.latest ?? '—';
    case 'cap-md':
      return `${(current.headings ?? []).length} headings`;
    case 'atom':
      return current.entries?.[0] ? `latest: ${current.entries[0].title}` : 'no entries';
    case 'ui5-json':
      return source.id === 'ui5:cdn-version'
        ? `${current.version}`
        : `active ${current.activeVersion}; LTS ${(current.lts ?? []).join(', ')}`;
    default:
      return '—';
  }
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  const sources = buildSources();
  const state = await readState();
  const baseline = Object.keys(state.sources).length === 0;
  const checkedAt = nowIso();

  const results = await mapWithLimit(sources, CONCURRENCY, async (source) => {
    const urls = [source.url, source.fallbackUrl].filter(Boolean);
    let lastError;
    for (const url of urls) {
      try {
        const text = await fetchText(url);
        const loaded = await source.load(text);
        return {
          source,
          url,
          current: { ...loaded, url, lastChecked: checkedAt, kind: source.kind },
        };
      } catch (err) {
        lastError = err;
      }
    }
    return { source, url: source.url, error: lastError?.message ?? 'unknown error' };
  });

  const report = {
    checkedAt,
    baseline,
    changed: [],
    errors: [],
    snapshot: [],
    stats: { ok: 0, failed: 0 },
  };
  const nextSources = { ...state.sources };

  for (const r of results) {
    const previous = state.sources[r.source.id];
    if (r.error) {
      report.stats.failed += 1;
      report.errors.push({ id: r.source.id, url: r.url, error: r.error });
      report.snapshot.push({ id: r.source.id, value: `error: ${r.error}` });
      continue; // keep previous state for failed sources
    }
    report.stats.ok += 1;
    const diff = diffSource(r.source, previous, r.current);
    if (diff.status === 'changed') {
      report.changed.push({
        id: r.source.id,
        group: r.source.group,
        url: r.url,
        details: diff.details,
      });
    }
    report.snapshot.push({ id: r.source.id, value: snapshotValue(r.source, r.current) });
    nextSources[r.source.id] = r.current;
  }

  if (report.stats.ok === 0) {
    console.error('All sources failed to load.');
    for (const e of report.errors) console.error(`- ${e.id}: ${e.error}`);
    process.exitCode = 1;
    return;
  }

  const markdown = renderMarkdown(report);
  if (OUT_FILE) {
    await mkdir(path.dirname(path.resolve(OUT_FILE)), { recursive: true });
    await writeFile(path.resolve(OUT_FILE), markdown, 'utf8');
  }
  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    process.stdout.write(markdown);
  }

  if (!DRY_RUN) {
    await writeState({ updatedAt: checkedAt, sources: nextSources });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
