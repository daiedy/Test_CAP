// ADR-0017: a generated file is sanctioned by its content, not by the tool that wrote it. The
// git-based gates (subagent-stop.mjs, stop-gate.mjs) audit protected writes through
// protectedWriteHit(); this pins where docs/registry stops being a violation, while the PreToolUse
// guards keep protecting it through protectedHit(). Also pins the mockdata array check of
// file-checks.mjs (rule ui5-webapp.md), which came out of the same feature run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { protectedHit, protectedWriteHit, reasonFor } from '../scripts/lib/protected-paths.mjs';
import { runFileChecks } from '../scripts/lib/file-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const REGISTRY = [
  'DOMAIN-MODEL.md',
  'SERVICES.md',
  'HANDLERS.md',
  'UI-ARTIFACTS.md',
  'REUSE-CATALOG.md',
];

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'registry-gate-'));
}

describe('protected-path audit of generated files (ADR-0017)', () => {
  it('lets the generator output of docs/registry through the git-based gates', () => {
    for (const f of REGISTRY) expect(protectedWriteHit(root, `docs/registry/${f}`)).toBeNull();
  });

  it('keeps docs/registry protected for the PreToolUse guards', () => {
    expect(protectedHit('docs/registry/HANDLERS.md')).toBe('docs/registry/**');
  });

  it('treats the .stale marker as pipeline state, not as a protected file', () => {
    expect(protectedHit('docs/registry/.stale')).toBeNull();
    expect(protectedWriteHit(root, 'docs/registry/.stale')).toBeNull();
  });

  it('still blocks a registry file written by hand, without the generator header', () => {
    const tmp = tmpRoot();
    try {
      fs.mkdirSync(path.join(tmp, 'docs/registry'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'docs/registry/HANDLERS.md'), '# Handlers\n\nhand written\n');
      const hit = protectedWriteHit(tmp, 'docs/registry/HANDLERS.md');
      expect(hit).toBeTruthy();
      expect(reasonFor(hit)).toMatch(/generator header/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('audits every other protected path unchanged', () => {
    expect(protectedWriteHit(root, '.claude/settings.json')).toBe('.claude/**');
    expect(protectedWriteHit(root, 'scripts/hooks/stop-gate.mjs')).toBe('scripts/hooks/**');
    expect(protectedWriteHit(root, 'app/products/webapp/manifest.json')).toBe(
      'app/**/webapp/manifest.json'
    );
    expect(protectedWriteHit(root, '.claude/agent-memory/architect/MEMORY.md')).toBeNull();
    expect(protectedWriteHit(root, 'srv/catalog-service.cds')).toBeNull();
  });
});

describe('mock data shape check (rule ui5-webapp.md)', () => {
  const rel = 'app/products/webapp/localService/mockdata/Permissions.json';

  it('accepts the committed array fixture', () => {
    const notes = runFileChecks(root, rel, { markRegistryStale: false });
    expect(notes.filter((n) => /mock data must be a JSON array/.test(n))).toEqual([]);
  });

  it('flags an object fixture, the form that throws on the $batch path of sap-fe-mockserver', () => {
    const tmp = tmpRoot();
    try {
      fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(tmp, rel), '{ "ID": "me", "isEditor": true }\n');
      const notes = runFileChecks(tmp, rel, { markRegistryStale: false });
      expect(notes.some((n) => /mock data must be a JSON array/.test(n))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
