#!/usr/bin/env node
/**
 * Role briefs of a feature (ADR-0031 decision 2), built by scripts/lib/feature-brief.mjs from
 * docs/features/<name>/. Run from the repository root:
 *   node scripts/feature-brief.mjs <name> <agent-type> <phase>  writes .pipeline/brief/<agent-type>-<phase>.md
 *                                                              and prints its path, bytes and sections
 *   node scripts/feature-brief.mjs <name> --all                 lists the brief of every agent type and
 *                                                              phase of the Steps table, with the ceilings
 *   node scripts/feature-brief.mjs <name> --record              raises the ceiling of each role group in
 *                                                              test/context-budget.json to the feature's
 *                                                              largest brief; never lowers one (Q10)
 * `--record` is a ratchet like scripts/prompt-budget.mjs --record: run it only by a retro decision,
 * with a line in docs/CHANGELOG.md. Exit 2 on a usage error, 1 without PLAN.md, else 0.
 */
import {
  BRIEF_ROLES,
  BUDGET_FILE,
  allBriefs,
  groupDigits,
  largestPerGroup,
  readBudget,
  readFeatureDocs,
  recordCeilings,
  writeBrief,
} from './lib/feature-brief.mjs';

const root = process.cwd();
const print = (s) => process.stdout.write(`${s}\n`);
const [name, second, phase] = process.argv.slice(2);

function usage() {
  process.stderr.write(
    'usage: node scripts/feature-brief.mjs <name> <agent-type> <phase> | <name> --all | <name> --record\n'
  );
  process.exit(2);
}

if (!name || !second || (!second.startsWith('--') && !/^[0-7]$/.test(phase ?? ''))) usage();
const docs = readFeatureDocs(root, name);
if (!docs) {
  process.stderr.write(`docs/features/${name}/PLAN.md: missing\n`);
  process.exit(1);
}

if (second === '--all') {
  const briefs = allBriefs(docs);
  const { budget, error } = readBudget(root);
  const ceilings = budget?.briefs?.bytes || {};
  const ceilingNote = error || (budget ? `ceilings from ${BUDGET_FILE}` : `${BUDGET_FILE} absent`);
  print(`docs/features/${name}: ${briefs.length} brief(s); ${ceilingNote}`);
  for (const { agentType, phase: p, brief } of briefs) {
    const ceiling = ceilings[brief.group];
    const limit = Number.isFinite(ceiling) ? `, ceiling ${groupDigits(ceiling)}` : '';
    print(
      `  ${agentType.padEnd(18)} phase ${p}  steps ${brief.steps.join(', ').padEnd(10)} ${groupDigits(brief.bytes).padStart(7)} bytes  ${brief.group}${limit}`
    );
  }
  const largest = Object.entries(largestPerGroup(briefs))
    .map(([g, n]) => `${g} ${groupDigits(n)}`)
    .join(', ');
  print(`largest per role group: ${largest || 'none'}`);
} else if (second === '--record') {
  const res = recordCeilings(root, name);
  if (!res) {
    process.stderr.write(`${readBudget(root).error || 'nothing recorded'}\n`);
    process.exit(1);
  }
  const changes = Object.entries(res.bytes).map(([g, n]) => {
    const was = res.previous[g];
    const got = res.measured[g];
    if (got !== undefined && got < n)
      return `${g} ${groupDigits(n)} (kept; measured ${groupDigits(got)})`;
    return `${g} ${groupDigits(n)}${was === undefined || was === n ? '' : ` (was ${groupDigits(was)})`}`;
  });
  print(`recorded the brief ceilings of ${name} into ${BUDGET_FILE}: ${changes.join(', ')}`);
} else if (second.startsWith('--')) {
  usage();
} else {
  const brief = writeBrief(root, name, second, phase);
  if (brief) {
    print(
      `${brief.path}: ${groupDigits(brief.bytes)} bytes, ${brief.sections} sections, steps ${brief.steps.join(', ')}`
    );
  } else if (!Object.hasOwn(BRIEF_ROLES, second)) {
    print(`no brief for ${second}: it reads the feature documents whole (ADR-0031 decision 2)`);
  } else {
    print(`no brief for ${second} in phase ${phase}: no step row of ${second} in that phase`);
  }
}
