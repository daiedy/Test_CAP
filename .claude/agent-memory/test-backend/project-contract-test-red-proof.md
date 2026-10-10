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

Runtime variant (catalog-hygiene, 2026-10-09): the same `git archive HEAD` copy with the edited
service test and `npx vitest run -t '<regex of new it names>'` proves service tests red too (an
assertion that only `@assert.*` makes true shows 201/200 on the copy). Give rejection payloads a
distinct name prefix and clean it in an `afterEach`, or the red run leaves rows. A value above
the declared Decimal precision fails twice (400 "Multiple errors occurred", no top-level code),
so a range test needs the precision to hold the value.

Worktree-session variant (products-subcategories, 2026-10-09): inside a `.claude/worktrees/` session
the Bash guard refuses `tar --exclude=.git ...` and long heredoc commands that spawn processes
("names git in a form too complex"). Instead `cp -R _i18n db srv test package.json <scratch>/`
(enough for a service test; `app/` not needed), symlink `node_modules`, write the scratch
`vitest.config.mjs` and a `run.mjs` mutation runner with the Write tool, then run plain
`node run.mjs`; the runner uses `spawnSync('npx', ['vitest','run','--reporter=json','--outputFile=...'])`
and lists failing titles per mutation. Read the cascades too: a red that also turns an unrelated
count test red means a rejection test leaks a row (M7 "not @readonly" leaked `OTHER` into the
viewer count until the describe got an `afterEach`).

Contract variant in a worktree (products-subcategories step 8, 2026-10-09): for a `$metadata` test copy
`_i18n db srv test package.json` plus `app/products/annotations.cds` and `app/products/annotations/`
(the HTTP `$metadata` needs nothing else); the "before" file comes from a separate plain
`git show HEAD:<path> > <scratch>/head-X.cds` (allowed when it is the only command; the guard refuses it
inside a `&&` chain). Mutate the annotation file, not the test. Measured: a hand-written
`Common.ValueList #Qualifier` on a CodeList association does NOT replace the compiler-generated
unqualified one (2 ValueLists on the FK), so "exactly one `Term=\"Common.ValueList\"`" is a real guard.

**How to apply:** whenever a plan asks for a contract test that "must fail on main", or a new `it`
could pass vacuously. Count the asserted substring in the pre-feature EDMX; if the count is not 0,
say so in the report instead of claiming the test proves the change. See
[[project-probing-runtime-behavior]] for the in-repo probe variant used for runtime behavior.
