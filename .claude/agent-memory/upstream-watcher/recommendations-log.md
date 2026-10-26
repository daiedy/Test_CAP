---
name: recommendations-log
description: Which upstream recommendations were already given in the digest and whether they were carried out; consult before repeating a recommendation
metadata:
  type: project
---

Digest 2026-10-26 (heading `## 2026-10-26` in docs/upstream/UPDATES.md). All status: not yet carried out as of that date.

- Rebase Dependabot PRs #31, #33, #34 (their CI failed before the CI fix PR #36), merge when green; close #35 (`@cap-js/openapi` 1.7.0, pin stays while cap-js/openapi PR #207 is open): given.
- Add a semver-major ignore for `ui5-test-runner` in `.github/dependabot.yml` before 2026-11-09 (v6 needs Node >= 24.11.1, project and CI on Node 22); Node 24 migration as a `/backlog` item: given.
- cds 10.2.1 / cds-dk 10.2.0 (Dependabot after the cooldown, expected 2026-11-02): `npm test`, review a `$metadata` snapshot diff (cds-compiler 7.2 TypeDefinition change; root compiler is 7.0.3), re-measure the two LESSONS entries of 2026-09-29 (positional `req.error` code, `sap-messages` language): given.
- Optional MCP pin bumps (`@cap-js/mcp-server` 0.0.8, `chrome-devtools-mcp` 1.12.0, `fiori-mcp` 1.15.15): deferred by the user on 2026-10-07, repeated once in one line on 2026-10-26.
- Optional plugin updates `ui5` 0.1.9 (bundled server now pinned 0.3.2) and `cap-developer` (router restructure, no content change): given.

Digest 2026-10-07, outcomes: `@ui5/mcp-server` 0.3.2 bump done; cds 10.1.1 LESSONS re-test done (both still open); test run on 10.1.1 done; UI5 1.153.0 check done (new debt: boolean `initialLoad`); fiori-mcp and cds-mcp/chrome-devtools optional bumps deferred.

Recurring checks: the fiori-mcp changelog for `filterFields`/`liveMode` (not covered through 1.15.15); `@cap-js/openapi` releases for PR #207 (not merged on 2026-10-26; the script does not track this package, check by hand with `gh pr view 207 -R cap-js/openapi`).

**Why:** avoid repeating the same advice weekly.
**How to apply:** next run, check `.mcp.json` pins, `gh pr list` and STATE open debt to see which were done; mark done ones, mention still-open ones in one line instead of the full text.
