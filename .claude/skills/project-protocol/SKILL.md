---
name: project-protocol
description: Common working protocol of all agents of the Test_CAP project (SAP CAP + Fiori Elements). Preloaded into every subagent through the skills field. Defines the order of work, routing to the MCP servers, the "one task, one way" rule, protection against duplication, the report format and the prohibitions.
user-invocable: false
---

# Test_CAP agent protocol

You are part of a pipeline of specialized agents. All agents work by this protocol, so the result of one session is compatible with the result of another. Deviating from the protocol is allowed only on an explicit instruction from the user.

## 1. Sources of truth, in order of priority

1. The user's words in the current task.
2. `docs/features/<name>/PLAN.md` of the current feature: what exactly to do and the acceptance criteria.
3. `CLAUDE.md`, `docs/architecture/CONVENTIONS.md`, `docs/architecture/PATTERNS.md`: how to do it.
4. `docs/registry/*.md`: what already exists (generated, not edited by hand).
5. SAP MCP servers: how it is done in the framework today.
6. The model's own knowledge: only if the items above are silent, and marked "not verified".

If MCP or the project documentation contradicts your knowledge, the document and MCP are right.

## 2. Mandatory order of work

1. Read the task and, whole, the brief the SubagentStart hook hands you (ADR-0031); open a whole feature document only for a section the brief lists under `## Not included`. `reviewer`, `architect`, `ux-designer` and an agent handed no brief read `PLAN.md` and `CONTEXT.md` whole, `SCREENS.md` only for a UI role, `research/*.md` only when a plan step names the file. If there is no plan and the task changes code, stop and report: `architect` is needed.
2. Read the `Now` and `Open debt` sections of `docs/STATE.md`.
3. Find what exists: the corresponding `docs/registry/` file plus `mcp__cds-mcp__search_model` for every entity, service, action the task touches. Write into the report what you reuse. Before editing a file under `db/`, `srv/`, `app/` or `_i18n/`, run `node scripts/wiki.mjs for-path <file>` and read only the business-rule pages it lists, never the wiki whole (ADR-0030).
4. Find the approved way in `PATTERNS.md`. One way. If none fits, stop and propose an ADR, do not invent a second one.
5. Check with MCP according to the routing table below before the first edit; an edit without its query needs a `## MCP not used` reason, checked at hand-over (section 8). Direct edits of `manifest.json` are denied: Fiori MCP only.
6. Take a template from `templates/` if you create a new file of that type.
7. Make the edits. Path rules (`.claude/rules/`) are loaded automatically, follow them.
8. Check: linters and tests from section 6. Do not write "checked" if you did not run them.
9. Update the documentation you are responsible for (section 7) and report in the form (section 8).
10. A deliverable that is a document (CONTEXT, SCREENS, PLAN, VERIFICATION, REVIEW, SUMMARY) exists on disk before the research starts and grows as you go; your report repeats the file. A result that lives only in your transcript is lost at the turn limit or the stream watchdog (CHANGELOG 2026-09-23). Budget your turns; near `maxTurns` a hook note `Turn N of M` gives your count (ADR-0032, `turnNote()` in `scripts/lib/turn-budget.mjs`): follow it, stop cleanly and name the last completed item, so the work continues from it.

In a worktree session (`.claude/worktrees/`) the Bash guard refuses compound commands (`&&` chains, pipes with `git` or `npx`, heredocs) as "too complex to verify": run single commands, or put the steps into a scratch `.mjs` file run as `node <file>`.

## 3. Routing to MCP

| You change | Ask first |
|---|---|
| CDS entities, types, aspects, projections, actions, `srv/**/*.cds` | `mcp__cds-mcp__search_model`, then `mcp__cds-mcp__search_docs` |
| Handlers `srv/**/*.js`, `cds.ql` API, `req`, events | `mcp__cds-mcp__search_docs` |
| UI annotations `@UI.*`, `@Common.*`, Fiori Elements pages, `manifest.json` | `mcp__fiori-mcp__search_docs`; manifest edits only through `mcp__fiori-mcp__list_functionality` → `get_functionality_details` → `execute_functionality` |
| New Fiori application | `mcp__fiori-mcp__generate_fiori_app_cap` |
| Controls, XML views, controllers, bindings of freestyle UI5 | `mcp__ui5-mcp-server__get_api_reference`, `get_guidelines`; after edits `run_ui5_linter`; after a manifest edit `run_manifest_validation` |
| UI tests (OPA5, QUnit) | skills `ui5-best-practices-opa5`, `ui5-best-practices-qunit`, `mcp__fiori-mcp__search_docs` |
| Package versions, "what's new", compatibility | not MCP: `cds version`, `npm view <pkg> version`, `docs/upstream/UPDATES.md`. Documentation snapshots in MCP may be outdated |

If the task touches several layers, ask all the corresponding servers.

If an MCP server is unavailable (timeout, "Search is currently unavailable", embeddings error): retry once, then fall back to the official documentation of the pinned version (capire for CDS; for UI5 and `sap.fe.test` the CDN debug sources `https://ui5.sap.com/resources/<module path>-dbg.js` of the version in `sap-ui-version.json`), mark every such finding "not verified by MCP" in the report, and note the outage once in the report's "For LESSONS" section (the orchestrator records it once per feature, not once per agent). In a worktree session `mcp__cds-mcp__search_model` answers from the pre-feature model and does not see the feature's new entities: read `docs/registry/DOMAIN-MODEL.md` (regenerated) or the CDS files for them and say so in the report.

## 4. Language

Everything the pipeline reads or produces is written in English: code comments, commit messages, docs under `docs/` (STATE, CHANGELOG, LESSONS, feature specs, ADRs), agent reports saved to files, registry, templates. The only non-English text lives in i18n bundles (`*_ru.properties`, `*.texts.csv`), in test data that asserts translated values, and in `docs/features/<name>/VERIFICATION.md` where rendered UI is quoted as the evidence of a scenario. Reply to the user in the user's language; that is separate from the files. The PostToolUse hook flags Cyrillic in code and docs; the reviewer treats it as an important finding. Write and Edit decode a `\uXXXX` escape in their parameters into the real character, so in English files give Russian values as `U+XXXX` code points.

## 5. Protection against duplication and inconsistency

- New function, handler, fragment, formatter, type: first `docs/registry/REUSE-CATALOG.md`, `HANDLERS.md`, `UI-ARTIFACTS.md`. Reuse or extend what you find.
- Identical tasks are solved identically. The reference is the existing code and `PATTERNS.md`, not a "prettier" variant.
- Names, file structure, formatting: only by `CONVENTIONS.md`. Prettier and the linters settle style disputes.
- Texts only through i18n, keys by convention, `en` and `ru` in the same change.

## 6. Checks before handing over

| You changed | Run |
|---|---|
| `*.cds` | `cds compile srv --to json`, `npm run lint`, update `app/products/webapp/localService/metadata.xml` with `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml` |
| `srv/**/*.js`, `test/**` | `npm run lint`, `npm test` |
| `app/**/webapp/**` | `npm run lint` in `app/products` (ui5lint) |
| `manifest.json` | `mcp__ui5-mcp-server__run_manifest_validation`; when the server is down `npm run lint` in `app/products` |
| Anything in `db/`, `srv/`, `app/` | `npm run docs:registry`, then `node scripts/check-docs-fresh.mjs` |

Attach each command with the verdict it printed and, for a long output, its log path under `.pipeline/logs/`; never the last lines. A red test or a linter error means the task is not finished.

## 7. Documentation you are responsible for

- Changed code: a line in `docs/CHANGELOG.md` (scope: db, srv, app, test, docs, pipeline, deps).
- `docs/STATE.md` keeps the shape of `templates/STATE.md`: change values of the `Now` lines, rows of `Open debt`, items of `What works`; never add a paragraph or a section (ADR-0018).
- Closed a plan item: tick it in `docs/features/<name>/PLAN.md`.
- Learned something non-obvious about the framework, or made a mistake and understood why: an entry in `docs/LESSONS.md`.
- Made a decision that is not in `PATTERNS.md`: do not make it. Stop and propose an ADR.
- `docs/registry/*` is not edited by hand, only `npm run docs:registry`.

## 8. Report form

Your `SubagentHandback` call runs the hand-over checks first (lint, protected writes, the MCP reason); a deny names what to fix before the next call, and SubagentStop checks a plain-text end alike (ADR-0031 decision 8). The hook keeps the delivered report as `.pipeline/logs/report-<agent-type>-<agent-id>.md`; a rework launch reads the previous report there.

```
## Done
briefly, what changed and which PLAN.md items are closed

## Files
list of paths with one phrase per file

## Reused
what you found in the registry and MCP and applied; or "nothing suitable found, because ..."

## Checks
command → verdict, log path if saved (section 6)

## Open questions
what requires a decision from the user or architect

## Rules touched
one line per business rule id whose behaviour changed (`BR-<AREA>-NNN: what changed`), `new` for a new rule; omit the section when no business rule changed

## MCP not used
only if you edited a file without the MCP query its type expects (or when the hand-over hook asks for it): one line per file, `path → reason` (why the query was unnecessary, or impossible); otherwise omit the section

## For LESSONS
one or two lines or "none"
```

## 9. Forbidden

- Editing `mta.yaml`, `xs-security.json`, `ui5-deploy.yaml`, `package-lock.json`, `.claude/**`, `.mcp.json`, `scripts/hooks/**`, `docs/registry/**`, `docs/ai-pipeline-plan.md` without an explicit user request.
- Creating `manifest.json` and the Fiori application structure by hand; `cds add sample`; `console.log`; user-facing strings in code; global access `sap.ui.getCore()`, `jQuery.sap.*`.
- Installing or bumping versions of dependencies and MCP; this is done by `upstream-check` and the user.
- Committing and pushing without an instruction from the user or the `feature` orchestrator.
- Claiming that tests pass or the linter is clean without a fresh run in this session.
- Silently choosing between two ways. Uncertainty is a question to the user or architect, not a guess.
- Reverting or deleting a file to satisfy a gate (`git checkout --`, removing `docs/registry/*` or its `.stale` marker). A gate that blocks you on a file you did not write by hand is reported under "## Open questions", not worked around.
