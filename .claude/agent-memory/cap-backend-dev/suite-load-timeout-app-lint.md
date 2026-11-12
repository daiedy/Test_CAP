---
name: suite-load-timeout-app-lint
description: test/hooks-subagent-stop.test.js "blocks a hand-over on app ESLint errors..." times out (30 s beforeAll) in the full npm test under machine load; passes alone in ~19 s; never run lint or sandbox scripts beside npm test
metadata:
  type: project
---

`npm test` on 2026-11-13 (#60 steps 2-3) failed twice with only this test red: "SubagentStop lint gate of the apps > blocks a hand-over on app ESLint errors in webapp JavaScript outside test and localService", `Test timed out in 30000ms`. Its `beforeAll` (30 s budget) spawns `subagent-stop.mjs` in a sandbox, which runs ESLint and ui5lint through `npx`; with the 18 files in parallel and a load average of 7-8 (desktop apps, not leftovers) it took 37 s. `npx vitest run test/hooks-subagent-stop.test.js` alone: 9 of 9 in 19 s. The change under test did not touch that path.

**Why:** the run looks like a regression, yet the cause is the shared machine; a red gate here is not evidence against the code.

**How to apply:** start `npm test` with nothing else running (no `npm run lint`, no sandbox scripts in parallel; a background run counts too); if only this test is red, run the file alone and report both outputs and `uptime`, do not edit its timeout without a plan step. See [[sandbox-hook-run-from-scratch]].
