---
name: measuring-suite-duration
description: How to measure npm test Duration for a plan criterion on the user's noisy Mac - check load first, A/B alternating pairs for a cost, quiet triple for the absolute figure
metadata:
  type: project
---

A plan criterion that compares `npm test` Duration with an earlier figure (docs-toolchain criterion 22:
"less than 2 s against 16.86 s") cannot be judged under foreign load. On 2026-10-25 a game on the
user's Mac (load average 6) made the same 220 tests take 75-87 s; twenty minutes later, at load 2.9,
they took 16.7-17.3 s. The hook tests (`hooks-metrics`, `hooks-state-hygiene`, git and process
spawns) inflate the most under load.

**Why:** an absolute figure taken under load looks like a 4x regression and would have pushed a
needless `CDS_SWAGGER=false` into the `test` script.

**How to apply:** run `uptime` next to every Duration you report. To isolate one cost (a plugin, a
switch), run alternating pairs (A, B, A, B...) of only the affected files from a scratch `.mjs` that
spawns `npx vitest run --reporter=verbose <files>` with the env per mode, and compare medians of
Duration and of the `server ... launched in N ms` lines (the verbose reporter prints them). Report
the absolute triple only from a quiet machine, and say so when it was not quiet. The Swagger plugin
measured 1800 vs 1787 ms median boot (no cost). Related: [[contract-test-red-proof]].
