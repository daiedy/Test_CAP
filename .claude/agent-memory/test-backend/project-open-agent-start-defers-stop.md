---
name: project-open-agent-start-defers-stop
description: in a shared hook sandbox, an agent-start record without an agent-stop in the test session makes runningAgents() defer the Stop gate of later tests (exit 0 instead of 2); give such a test its own session_id
metadata:
  type: project
---

An `agent-start` record written into the test session of a shared sandbox (`test/hooks-metrics.test.js` SESSION) with no matching `agent-stop` reads as a running subagent: `runningAgents()` makes `stop-gate.mjs` defer, so later Stop-gate tests in the same file get exit 0 instead of 2 (three reds on 2026-11-13, #60 "agent-start carries maxTurns").

**Why:** the Stop gate defers while a subagent of the session still works (CHANGELOG 2026-10-09); the log is per session and survives `resetTree()` (`.pipeline/` is ignored).

**How to apply:** a test that only starts agents passes `session_id: <own id>` in the hook payload (`box.hook` spreads the payload over the default session) and reads `metricsFile(sandbox, ownId)` itself instead of `appended()`. Related: [[project-hook-sandbox]], [[hook-test-mutation-check]].
