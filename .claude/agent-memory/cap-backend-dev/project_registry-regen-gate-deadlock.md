---
name: registry-regen-gate-deadlock
description: Running `npm run docs:registry` as a subagent trips the ADR-0016 SubagentStop audit, and the subagent cannot revert it — hand the choice to the orchestrator instead
metadata:
  type: project
---

Do not run `npm run docs:registry` yourself as a subagent. Report that the registry is stale and let the orchestrator or `docs-keeper` regenerate it.

**Why:** hit on 2026-09-11 in `catalog-authorization` phase 2. The two gates disagree. `PostToolUse` (`post-edit.mjs`) writes `docs/registry/.stale` and tells you to run `npm run docs:registry`; protocol section 6 says the same after a change in `db/`, `srv/` or `app/`. But `SubagentStop` (`scripts/hooks/subagent-stop.mjs`, ADR-0016) diffs changed files against the ADR-0014 `edit` records, sees the five regenerated `docs/registry/*.md` as "protected files changed outside Edit/Write" and blocks the handover — it cannot tell the approved generator from a stray shell redirect. Its remedy, `git checkout -- <path>`, is itself denied: `scripts/hooks/protect-files-bash.mjs` lists `/\bgit\s+(?:checkout|restore)\s+--/` in `IN_PLACE`, and a subagent gets `deny` (the main thread gets `ask`). So the subagent can neither keep nor undo the change. Only the user can set `PIPELINE_ALLOW_PROTECTED=1`, and only the main thread can approve the revert.

**How to apply:** after editing `srv/` or `db/`, note in the report that `docs/registry` is stale and which rows will change (`SERVICES.md` authorization/restrict/new projections, `HANDLERS.md` handler table); do not regenerate. If you already did, say so plainly and offer the orchestrator both options — keep the regenerated files (they are correct and `docs-keeper` regenerates them again in the documentation phase) or `git checkout -- docs/registry/` from the main thread, after which `node scripts/check-docs-fresh.mjs` reports stale until `docs-keeper` runs. This is the normal mid-feature state, not a defect. Related: [[handler-and-plan-priority]].
