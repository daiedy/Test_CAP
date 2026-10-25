---
name: feedback-turn-budget
description: test-backend runs have a hard 60-turn limit; orchestrator wants the test file written first, no exploration beyond named files, minimal hook runs
metadata:
  type: feedback
---

Write the target test file in the first tool call, then read only the files the task names, then run and fix. Keep hook runs per test file minimal (one sandbox in `beforeAll`, share one run between `it`s when it proves both).

**Why:** a previous test-backend run on docs-toolchain (#27) hit the 60-turn limit before handing over; the orchestrator now states the budget and the "write first" rule in the task (2026-10-25). Each SubagentStop run with an app ESLint pass costs 2-4 s of `npm test`.

**How to apply:** for hook and script tests, batch reads into one Bash call, batch edits with one python heredoc, and run prettier plus vitest in the same call. Report the added `npm test` time (per-file numbers via `npx vitest run --reporter=json --outputFile=...`). See [[hook-test-mutation-check]].
