---
name: debug-after-upgrade
description: Investigation of a breakage after upgrading CAP, UI5 or Fiori tools dependencies using the changelog for the version range. Use when the user says "it broke after the upgrade", "tests failed after the update", "figure out the upgrade", "not working after the bump", "regression after upgrade" (Russian: «после обновления сломалось», «тесты упали после апдейта», «разобраться с обновлением», «после bump не работает»), and also when CI went red on a commit that changed the lockfile.
allowed-tools: Bash, Read, Grep, WebFetch, mcp__cds-mcp__search_docs
---

# Debugging after a dependency upgrade

Principle: first find the changelog entry that explains the breakage, and only then fix the code. A patch without a reference to the source is not accepted.

## Step 1. Capture the symptom

Collect the error text and the stack trace into a search variable: function names, configuration keys, annotation names, HTTP codes. Run the failing command once yourself (`npm test`, `npm run lint`, `cd app/products && npm run lint`, `cds compile srv --to json`) to have fresh output.

## Step 2. Determine the version range

```bash
git diff HEAD -- package-lock.json app/products/package-lock.json | grep -E '^[-+]\s+"(version|resolved)"' -B2 | head -80
```

If the lockfile is already committed, find the commit: `git log -5 --oneline -- package-lock.json app/products/package-lock.json` and take `git show <sha> -- package-lock.json`. Build a table "package: was → became". Take into account the transitive packages `@sap/cds-compiler`, `@cap-js/db-service`, `@sap/ux-specification`.

## Step 3. Checklist of known cds 10 changes

Check these first, before reading the changelog:

| Symptom | Cause in cds 10 | Fix |
|---|---|---|
| A test expected a number, the string `'1299.99'` arrived | Decimal and Int64 from SQLite arrive as strings (`cds.features.ieee754compatible: true`) | Compare with a string or parse in the test, do not disable the flag |
| `INSERT`/`UPDATE` returned `{ affected: 1 }` instead of a row | Results of write operations are unified | Do a `SELECT` after the write if the data is needed |
| `srv.entities()` is not a function | `srv.entities` became a getter | Remove the parentheses |
| SQLite errors, missing `better-sqlite3` | Default driver is `node:sqlite`, Node ≥ 22 | Check `node -v`; `better-sqlite3` only via `cds.requires.db.driver` |
| `cds.test` not found in `@sap/cds` | Tests live in the separate package `@cap-js/cds-test` | `npm add -D @cap-js/cds-test` |
| Warnings about annotations without targets, duplicate elements | Stricter compiler checks | Fix the model, do not suppress |

Full list: `https://cap.cloud.sap/docs/releases/migration/cds10.md`.

## Step 4. Find the changelog entry

For each changed package take its source and search it for the terms from step 1 (WebFetch the page, then search the text):

| Package | Source |
|---|---|
| `@sap/cds`, `@sap/cds-dk`, `@sap/cds-compiler` | `https://cap.cloud.sap/docs/releases/<year>/changelog.md`; for major and minor releases `https://cap.cloud.sap/docs/releases/<year>/<mon><yy>.md`, for example `jun26.md` |
| `@cap-js/sqlite`, `@cap-js/cds-test`, `@cap-js/mcp-server` | `https://github.com/cap-js/<repo>/releases` and `CHANGELOG.md` in the repository |
| SAPUI5 (`sap.ui.core`, `sap.m`, `sap.fe.core`, `sap.fe.macros`) | `https://ui5.sap.com/test-resources/<lib/path>/relnotes/changes-<version>.json`, for example `sap/fe/core/relnotes/changes-1.152.json` |
| `@sap/ux-ui5-tooling`, `@sap-ux/*` | `https://github.com/SAP/open-ux-tools/blob/main/packages/<package>/CHANGELOG.md` |
| `@ui5/cli`, `@ui5/linter` | `https://github.com/UI5/<repo>/releases` |

Additionally `mcp__cds-mcp__search_docs` by the error wording, but remember: the documentation in MCP may lag behind the installed version; the version is checked with `npm ls <pkg>`.

## Step 5. Fix minimally

1. Quote the found entry with its URL in the report.
2. Propose a minimal patch that follows the recommendation from the entry. Do not roll back the version and do not enable a kill switch if the entry proposes a code migration; a kill switch is acceptable only as a temporary measure with a task to fix it.
3. Apply the patch, repeat the failing command, attach the output.
4. If this is a CAP major: first `npx -p @sap/cds-dk cds upgrade` for the report in `.cds-upgrade/`, then the `cap-upgrade` skill; manual edits only after its report.

## Step 6. Record the lesson

Add an entry to `docs/LESSONS.md`:

```markdown
## <YYYY-MM-DD> <package> a.b.c → x.y.z: <symptom in one phrase>
Cause: <changelog entry with URL>. Fix: <what was done>. Check: <command>.
```

If the entry explains behavior that all agents should know about, propose an edit to the corresponding rule in `.claude/rules/*.md` or to `docs/architecture/PATTERNS.md`.
