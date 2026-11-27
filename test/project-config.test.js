// ADR-0033: the pipeline files name no application. What a pipeline file needs and cannot read from
// the project lives in .claude/pipeline.json (scripts/lib/project-config.mjs); the names of the
// project (services, paths, applications) are in docs/registry, generated from the project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONFIG_FILE,
  projectConfig,
  projectConfigErrors,
  projectName,
  wikiRuleAreas,
} from '../scripts/lib/project-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** A temp folder holding the given files (relative path to content); removed by the caller. */
function tempProject(files = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'project-config-')));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

describe('project configuration (ADR-0033)', () => {
  it('reads .claude/pipeline.json and answers for a project without one', () => {
    const none = tempProject();
    const set = tempProject({ [CONFIG_FILE]: '{ "wiki": { "areas": ["ORDERS", "BILLING"] } }' });
    try {
      expect(projectConfig(none)).toEqual({});
      expect(projectConfigErrors(none)).toEqual([]);
      expect(wikiRuleAreas(none)).toEqual(['ACCESS']);

      expect(projectConfig(set)).toEqual({ wiki: { areas: ['ORDERS', 'BILLING'] } });
      expect(projectConfigErrors(set)).toEqual([]);
      // The built-in area first, then the project's own in their order.
      expect(wikiRuleAreas(set)).toEqual(['ACCESS', 'ORDERS', 'BILLING']);
    } finally {
      for (const d of [none, set]) fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('reports a broken file and never fails a caller that only needs the areas', () => {
    const notJson = tempProject({ [CONFIG_FILE]: '{ "wiki": ' });
    const notObject = tempProject({ [CONFIG_FILE]: '["ORDERS"]' });
    const badAreas = tempProject({
      [CONFIG_FILE]: '{ "wiki": { "areas": ["ORDERS", "orders", "TWO WORDS", 7, "ACCESS"] } }',
    });
    const noList = tempProject({ [CONFIG_FILE]: '{ "wiki": { "areas": "ORDERS" } }' });
    try {
      expect(() => projectConfig(notJson)).toThrow(/^\.claude\/pipeline\.json: not valid JSON/);
      expect(projectConfigErrors(notJson)).toEqual([
        expect.stringMatching(/^\.claude\/pipeline\.json: not valid JSON/),
      ]);
      expect(wikiRuleAreas(notJson)).toEqual(['ACCESS']);

      expect(() => projectConfig(notObject)).toThrow(/must hold a JSON object/);
      expect(wikiRuleAreas(notObject)).toEqual(['ACCESS']);

      // One finding per entry that is no upper-case word; the valid ones still count, once each.
      expect(projectConfigErrors(badAreas)).toEqual([
        expect.stringMatching(/wiki\.areas entry "orders" must be one upper-case word/),
        expect.stringMatching(/wiki\.areas entry "TWO WORDS" must be one upper-case word/),
        expect.stringMatching(/wiki\.areas entry 7 must be one upper-case word/),
      ]);
      expect(wikiRuleAreas(badAreas)).toEqual(['ACCESS', 'ORDERS']);

      expect(projectConfigErrors(noList)).toEqual([
        expect.stringMatching(/wiki\.areas must be a list of words/),
      ]);
      expect(wikiRuleAreas(noList)).toEqual(['ACCESS']);
    } finally {
      for (const d of [notJson, notObject, badAreas, noList])
        fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('names a project by its package.json, else by its folder', () => {
    const named = tempProject({ 'package.json': '{ "name": "order-desk" }' });
    const unnamed = tempProject({ 'package.json': '{ "private": true }' });
    const bare = tempProject();
    try {
      expect(projectName(named)).toBe('order-desk');
      expect(projectName(unnamed)).toBe(path.basename(unnamed));
      expect(projectName(bare)).toBe(path.basename(bare));
    } finally {
      for (const d of [named, unnamed, bare]) fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('keeps the configuration of this project valid', () => {
    expect(projectConfigErrors(root)).toEqual([]);
    expect(wikiRuleAreas(root)[0]).toBe('ACCESS');
  });
});

// The ratchet of ADR-0033: a file that will move into the plugin names no service, service path,
// service file, namespace, application folder or intent of this project, and not the repository. The names come from the
// generated registry, so the list follows the project. CLAUDE.md, docs/ and test/ are the
// project's own and may name it.
describe('pipeline files name no application (ADR-0033)', () => {
  /** Files under `dir` (repository-relative, forward slashes), recursively. */
  const walk = (dir) =>
    fs
      .readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => path.relative(root, path.join(d.parentPath, d.name)).split(path.sep).join('/'));

  const pipelineFiles = () => [
    ...walk('.claude/agents'),
    ...walk('.claude/skills'),
    ...walk('.claude/rules'),
    '.claude/settings.json',
    '.mcp.json',
    // scripts/build-plan-page.py builds this repository's own plan page and stays here.
    ...walk('scripts').filter((f) => f !== 'scripts/build-plan-page.py'),
    ...walk('templates'),
  ];

  /** The names of this project, read from docs/registry. */
  function projectNames() {
    const services = read('docs/registry/SERVICES.md');
    const names = new Set();
    for (const m of services.matchAll(/^## (\S+)$/gm)) names.add(m[1]);
    for (const m of services.matchAll(/^Path: `([^`]+)`/gm)) names.add(m[1]);
    // The service file gives its name to the handler and the test file: `srv/<stem>.cds`.
    for (const m of services.matchAll(/File: `srv\/([^`/]+)\.cds`/g)) names.add(m[1]);
    // The Source column of the entity tables: `<namespace>.<Entity>`; sap.* comes with CAP.
    for (const m of services.matchAll(/^\| [^|]+ \| ((?:[a-z]\w*\.)+)[A-Z]\w* \|/gm))
      if (!m[1].startsWith('sap.')) names.add(m[1].slice(0, -1));
    const ui = read('docs/registry/UI-ARTIFACTS.md');
    for (const m of ui.matchAll(/^## (app\/\S+)$/gm)) names.add(m[1]);
    for (const m of ui.matchAll(/FLP intents: ((?:`[^`]+`(?:, )?)+)/g))
      for (const i of m[1].matchAll(/`([^`]+)`/g)) names.add(i[1]);
    const repository = path.basename(root);
    if (repository.length >= 5) names.add(repository);
    return [...names];
  }

  it('reads the names of the project from the registry', () => {
    expect(projectNames()).toEqual(
      expect.arrayContaining([
        'CatalogService',
        '/odata/v4/catalog',
        'catalog-service',
        'my.catalog',
        'app/products',
        'products-display',
      ])
    );
  });

  it('finds in the registry what a placeholder of a command stands for', () => {
    // <Service> and the local metadata file of `cds compile ... -s <Service> > app/<app>/...`.
    const ui = read('docs/registry/UI-ARTIFACTS.md');
    expect(ui).toMatch(
      /^\| mainService \| \/odata\/v4\/catalog\/ \| 4\.0 \| CatalogService \| app\/products\/webapp\/localService\/metadata\.xml \|$/m
    );
    // <app> and <intent> of the start address.
    expect(ui).toMatch(
      /^Served by the CAP server at `\/products\/webapp\/`\. Entry pages: `test\/flpSandbox\.html`, `index\.html`\. FLP intents: `products-display`\.$/m
    );
    // <service path> and <name>-service.
    expect(read('docs/registry/SERVICES.md')).toMatch(
      /^Path: `\/odata\/v4\/catalog`\. File: `srv\/catalog-service\.cds`\./m
    );
  });

  it('finds none of them in the agents, skills, rules, scripts, templates and settings', () => {
    const names = projectNames();
    const findings = [];
    for (const file of pipelineFiles()) {
      read(file)
        .split('\n')
        .forEach((line, i) => {
          for (const name of names)
            if (line.includes(name)) findings.push(`${file}:${i + 1}: ${name}`);
        });
    }
    expect(findings).toEqual([]);
  });
});
