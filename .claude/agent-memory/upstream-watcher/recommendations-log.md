---
name: recommendations-log
description: Which upstream recommendations were already given in the digest and whether they were carried out; consult before repeating a recommendation
metadata:
  type: project
---

Digest 2026-10-07 (heading `## 2026-10-07` in docs/upstream/UPDATES.md). All status: not yet carried out as of that date.

- Bump `.mcp.json` `@ui5/mcp-server` 0.2.18 to 0.3.2 (fixes draft-06 defect, issue UI5/mcp-server#447): given; done 2026-10-07 by the user, `run_manifest_validation` returns `isValid: true`, STATE debt row and LESSONS entry removed.
- Re-test cds 10.1.1 LESSONS entries (positional `req.error` code, `sap-messages` Accept-Language): given, pending. Changelog shows no fix.
- `npm test` plus `npm run lint` against installed cds 10.1.1 / sqlite 3.1.1; global cds-dk still 10.0.7: given, pending.
- fiori-mcp 1.15.6: do not bump for filterFields/liveMode (not covered through 1.15.6); optional bump: given, pending.
- UI5 CDN now 1.153.0; TypeError (`_Helper.aggregateExpandSelect`) not mentioned in 1.153.0 notes; check in running app: given, pending.
- Optional bumps `@cap-js/mcp-server` 0.0.6, `chrome-devtools-mcp` 1.10.1: given, pending.

**Why:** avoid repeating the same advice weekly.
**How to apply:** next run, check `.mcp.json` pins and STATE open debt to see which were done; mark done ones, mention still-open ones in one line instead of the full text. Re-check fiori-mcp changelog for `filterFields`/`liveMode` on each new version (debt row owner is upstream-watcher).
