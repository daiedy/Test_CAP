#!/usr/bin/env node
/**
 * Prunes a finished feature folder to SUMMARY.md (ADR-0019): the full record (PLAN, CONTEXT,
 * SCREENS, REVIEW, VERIFICATION, screenshots, research) stays in git history and is linked from
 * SUMMARY.md by a permalink to the last commit that touched the folder. Run by the /feature
 * orchestrator in phase 7 after the documentation commit: node scripts/prune-feature.mjs <name>
 */
import fs from 'node:fs';
import path from 'node:path';
import { run, repoRoot } from './lib/hook-utils.mjs';

const name = process.argv[2];
if (!name) {
  process.stderr.write('usage: node scripts/prune-feature.mjs <feature-name>\n');
  process.exit(2);
}
const root = repoRoot();
const dir = path.join(root, 'docs', 'features', name);
const summary = path.join(dir, 'SUMMARY.md');
if (!fs.existsSync(summary)) {
  process.stderr.write(
    `${path.relative(root, summary)} is missing: prune only a finished feature.\n`
  );
  process.exit(1);
}
const rel = `docs/features/${name}`;
const sha = run('git', ['log', '-1', '--format=%H', '--', rel], { cwd: root }).stdout.trim();
if (!sha) {
  process.stderr.write(`${rel} has no commit yet: commit the feature documents first.\n`);
  process.exit(1);
}
const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: root }).stdout.trim();
const repo = (remote.match(/github\.com[:/](.+?)(?:\.git)?$/) || [])[1];
const permalink = repo ? `https://github.com/${repo}/tree/${sha}/${rel}` : `${rel} at ${sha}`;

const removed = [];
for (const entry of fs.readdirSync(dir)) {
  if (entry === 'SUMMARY.md') continue;
  fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  removed.push(entry);
}
let text = fs.readFileSync(summary, 'utf8').trimEnd();
if (!/^## Full record/m.test(text)) {
  text +=
    `\n\n## Full record\n\nPruned to this file (ADR-0019). ${removed.length ? removed.sort().join(', ') : 'Nothing else'} ` +
    `of this feature stay${removed.length === 1 ? 's' : ''} in git history at ${permalink} (commit \`${sha.slice(0, 7)}\`).\n`;
  fs.writeFileSync(summary, text);
}
process.stdout.write(
  `${rel}: kept SUMMARY.md, removed ${removed.length ? removed.join(', ') : 'nothing'}; full record ${permalink}\n`
);
