---
name: upstream-check
description: Weekly check of new releases of the upstream dependencies the project builds on (SAP CAP, SAPUI5, Fiori tools, SAP MCP servers), not our own code, with a digest entry in docs/upstream/UPDATES.md. Use when the user says "upstream updates", "framework updates", "release check", "what's new in CAP/UI5", "check the releases", "are there new versions" (Russian: «обновления фреймворков», «что нового в CAP/UI5», «проверь релизы», «есть ли новые версии»), and on the schedule of the upstream-watcher agent.
allowed-tools: Bash, Read, Write, WebFetch
---

# Upstream dependency update check

Goal: in one pass understand what changed in the upstream dependencies the project builds on (SAP CAP, SAPUI5, Fiori tools and the MCP servers), and write a short digest with an impact assessment for the project into `docs/upstream/UPDATES.md`. Do not update anything in `package.json` and `.mcp.json`, only recommend.

## Step 1. Collect the diff with the script

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node scripts/watch-releases.mjs --out "$SCRATCHPAD/release-diff.md"
```

`$SCRATCHPAD` is the scratchpad directory of the session. The script updates `docs/upstream/versions.json` itself. If the output contains an `## Errors` section, list those sources in the digest as "not checked" and draw no conclusions from them.

If the diff is empty (`No changes since the last run.`), add a one-line section to `UPDATES.md`: "`<date>`: no changes, N sources checked", and finish.

## Step 2. Assess every change

For every item in the diff sections decide whether it affects the project:

1. Open `docs/architecture/STACK.md` and `package.json` (root and `app/products`), as well as `.mcp.json`.
2. The package is in the project and a new version is out → **affects**. A major → affects strongly, a separate task is needed.
3. The package is planned for a future phase (see STACK.md, section "Planned") → affects, note "consider when installing".
4. The package is not used and not planned → **does not affect**.
5. New headings in the CAP changelog: check whether they mention `@sap/cds`, `@sap/cds-dk`, `@cap-js/sqlite`, `@cap-js/cds-test`, annotations or OData V4. Yes → affects.
6. UI5: a change of the active CDN version always affects, because the CDN is not pinned (ADR-0006). A new LTS → recommendation to pin the version.
7. Feeds SAP/open-ux-tools and plugins-coding-agents: only a release of `@sap-ux/fiori-mcp-server`, `@sap-ux/ui5-middleware-fe-mockserver`, `@sap-ux/ui5-test-writer` or the `ui5` plugin affects.

## Step 3. Read the primary source for the affecting items

Only for "affects" items: WebFetch the specific page, not the whole site.

- CAP: `https://cap.cloud.sap/docs/releases/<year>/changelog.md`, look for the heading with the version; for majors `https://cap.cloud.sap/docs/releases/<year>/<mon><yy>.md`.
- `@cap-js/*`, `@ui5/*`, wdi5: the GitHub release link from the diff.
- UI5: `https://ui5.sap.com/test-resources/sap/fe/core/relnotes/changes-<version>.json` and the same for `sap/m`, `sap/ui/core`.
- Fiori MCP: `https://github.com/SAP/open-ux-tools/blob/main/packages/fiori-mcp-server/CHANGELOG.md`.

Version rule: documentation snapshots in the MCP servers may lag behind. Verify any statement about a version against `npm view <pkg> version` or the release page, not against the `search_docs` answer.

## Step 4. Write the digest

Insert a new section right after the introductory text in `docs/upstream/UPDATES.md`, above the previous sections:

```markdown
## <YYYY-MM-DD>

N sources checked, K errors.

### Affects the project
- `<package>` a.b.c → x.y.z: <what changed, in one phrase>. Source: <url>.

### Does not affect
- <item>: <why>.

### Recommended actions
- [ ] bump the `<package>` pin in `.mcp.json` to x.y.z after reading the changelog
- [ ] run `/upgrade-cds` (only for a CAP major)
- [ ] pin UI5 <version> LTS in ui5.yaml and manifest (on a new LTS)
```

Phrase the actions so that they can be executed without repeating the research. If a recommendation changes dependencies, state which test or command confirms success.

## Step 5. Summary

Finish with one paragraph: how many sources were checked, how many items affect the project, which action is first by priority. No changes to code, `package.json` or `.mcp.json` within this skill.
