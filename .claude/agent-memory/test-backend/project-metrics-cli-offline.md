---
name: metrics-cli-offline
description: How to drive scripts/metrics.mjs in a test against synthetic transcripts without reading ~/.claude and without gh reaching GitHub
metadata:
  type: project
---

`scripts/metrics.mjs feature|record` always calls `fetchIssues()` (`gh issue list`) before anything else, and `run()` in `hook-utils.mjs` prepends `/opt/homebrew/bin` to PATH, so restricting PATH cannot hide `gh`. Spawn the CLI with `GH_CONFIG_DIR=<empty temp dir>` and without `GH_TOKEN`/`GITHUB_TOKEN`/`GH_ENTERPRISE_TOKEN`/`GITHUB_ENTERPRISE_TOKEN`: `gh` exits 4 in about 0.1 s with no network call, and the lookup falls back to the read-only `.pipeline/issues.json` cache (its mtime stays unchanged). Point the transcript lookup at a fixture with `CLAUDE_CONFIG_DIR=<temp home>` and write the sessions to `projectDir(root, home)`; pass `--history <temp file>` to `record`/`compare`, and `PIPELINE_LANG=en` to pin the texts.

**Why:** the brief forbids reading real transcripts and depending on `gh` in a test (coordinator correction, 2026-09-29, `pipeline-metrics` step 6); `test/metrics.test.js` `cli()` is the working reference.

**How to apply:** any test or verification that runs the metrics CLI (step 8 hooks tests, step 11 verification). Pure functions (`featureReport`, `promptWindows`) take the issue number explicitly and need no `gh` at all. Related: [[project-probing-runtime-behavior]].
