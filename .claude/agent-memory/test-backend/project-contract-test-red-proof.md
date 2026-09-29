---
name: contract-test-red-proof
description: How to prove a new test is a real guard without reverting the working tree - EDMX red/green proof in a scratchpad copy, avoiding tautological substrings, contract tests for a later phase, and per-rule mutations of pure-function libs
metadata:
  type: project
---

To prove a new contract assertion in `test/metadata.test.js` is a real guard, build a pre-feature copy
of the repo outside it and run the new test there:

1. `git archive HEAD | tar -x -C <scratchpad>/pre-feature` (pure read, no worktree, no `.git` writes)
2. `ln -s <repo>/node_modules <scratchpad>/pre-feature/node_modules` (148 MB, do not copy)
3. write a `vitest.config.js` in the copy with `cacheDir` inside the scratchpad, so the run does not
   write into the repo's `node_modules/.vite`
4. copy the edited test file into the copy and `npx vitest run test/<file>.test.js`
5. also compare occurrence counts: `cds compile '*' --to edmx-v4 -s CatalogService -l en` in the copy
   vs. the working tree, `grep -c` for each asserted substring

**Why:** the pipeline forbids reverting the annotation in the working tree to demo a red test, and a
snapshot-only guard accepts a blind `npx vitest -u`. The copy gives a genuine red run plus a measured
count diff, and the count diff catches tautologies: on 2026-09-09 `Term="Common.SemanticKey"` went
0 -> 1 (a real guard) while `<PropertyPath>name</PropertyPath>` was already present once via
`UI.SelectionFields`, so that second assertion alone would have passed before the feature.

The same copy technique works forward as well as backward: when a plan asks phase 2 for a contract
test on annotations that phase 3 will add, write the assertion, mark it `it.skip` with a comment
naming the plan step that removes `.skip`, and prove both directions before handing over: 0
occurrences in the current EDMX, and a green un-skipped run in a scratchpad copy of the **working
tree** (tar the repo without `node_modules`/`.git`) that carries the future annotation. Keeps the
phase gate green without inventing the feature. Done 2026-09-11 for the `UI.*Hidden` half of
`catalog-authorization`.

Assert on EDMX with the whitespace between tags removed (`data.replace(/>\s+</g, '><')`): the
compiler pretty-prints, so an `$edmJson` expression copied from a plan as
`<Not><Path>...</Path></Not>` matches nothing, and comparing the term and its expression in one
normalized string is what keeps the test from only proving that the term exists somewhere.

Mutation variant for pure-function tests (pipeline-metrics 11d, 2026-09-30), when the pre-feature
code lacks the exports and would only fail on import: tar the working tree's `scripts test
package.json` into a scratch dir, symlink `node_modules`, scratch `vitest.config.mjs` with
`cacheDir` and `include: ['test/<file>.test.js']`, then per mutation restore the lib file from a
saved original, apply one string replace with a uniqueness assert (a tiny node script), and run
`npx vitest run -t '<it name>'`. One mutation per rule the new `it` claims to guard; every one must
turn red, and the restored copy must be green again. 15 of 15 went red for criteria 30-32.

Cleanup: `rm -rf $(cat file)` or `rm -rf "$VAR"` is refused by Claude Code's built-in safety check
(an unresolvable target). Print the path first, then `rm -rf` the literal path.

**How to apply:** whenever a plan asks for a contract test that "must fail on main", or a new `it`
could pass vacuously. Count the asserted substring in the pre-feature EDMX; if the count is not 0,
say so in the report instead of claiming the test proves the change. See
[[project-probing-runtime-behavior]] for the in-repo probe variant used for runtime behavior.
