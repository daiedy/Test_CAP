---
name: project-stale-marker-blocks-subagent-stop
description: docs/registry/.stale is written by the pipeline's own hook and then blocks SubagentStop as an "unrecorded protected write"; no agent-side fix exists
metadata:
  type: project
---

Editing any registry-relevant source (e.g. `app/*/annotations/*.cds`) makes the PostToolUse hook append to `docs/registry/.stale`, and `subagent-stop.mjs` then refuses to let the agent finish, reporting it as a protected file "changed outside Edit/Write". Retrying cannot clear it.

**Why:** `scripts/lib/file-checks.mjs` writes the marker; `subagent-stop.mjs` lists git-changed files, subtracts the ADR-0014 `edit` audit records, and blocks on leftovers matching `docs/registry/**`. The marker has no `edit` record because no agent wrote it, so it is permanently "unrecorded". Observed 2026-09-11 on `catalog-authorization` step 9, where it blocked four finish attempts on otherwise green work.

**How to apply:** Do not fight it and do not delete the marker on your own initiative — `git checkout --` cannot revert it (untracked), and the permission system denied both removing it and probing it with node. State the situation and hand the decision to the user/orchestrator. The legitimate exits belong to others: `npm run docs:registry` (which `gen-registry.mjs` ends by deleting the marker) at the phase commit or in `docs-keeper`'s step, or a session started with `PIPELINE_ALLOW_PROTECTED=1`. Note that `check-docs-fresh.mjs` also detects staleness via a sources hash that includes `app/**/*.cds`, so the marker is not the only freshness signal — but verifying that empirically was denied, so treat it as code-reading, not measurement. Same family as [[project-state-md-precompact-artifact]]: a hook-generated artifact misattributed to the agent.
