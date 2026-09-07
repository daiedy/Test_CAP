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

1. Read the task and the feature `PLAN.md`. If there is no plan and the task changes code, stop and report: `architect` is needed.
2. Read the first 40 lines of `docs/STATE.md` and the "Open debt" section.
3. Find what exists: the corresponding `docs/registry/` file plus `mcp__cds-mcp__search_model` for every entity, service, action the task touches. Write into the report what you reuse.
4. Find the approved way in `PATTERNS.md`. One way. If none fits, stop and propose an ADR, do not invent a second one.
5. Check with MCP according to the routing table below before the first edit.
6. Take a template from `templates/` if you create a new file of that type.
7. Make the edits. Path rules (`.claude/rules/`) are loaded automatically, follow them.
8. Check: linters and tests from section 5. Do not write "checked" if you did not run them.
9. Update the documentation you are responsible for (section 6) and report in the form (section 7).

## 3. Routing to MCP

| You change | Ask first |
|---|---|
| CDS entities, types, aspects, projections, actions, `srv/**/*.cds` | `mcp__cds-mcp__search_model`, then `mcp__cds-mcp__search_docs` |
| Handlers `srv/**/*.js`, `cds.ql` API, `req`, events | `mcp__cds-mcp__search_docs` |
| UI annotations `@UI.*`, `@Common.*`, Fiori Elements pages, `manifest.json` | `mcp__fiori-mcp__search_docs`; manifest edits only through `mcp__fiori-mcp__list_functionality` → `get_functionality_details` → `execute_functionality` |
| New Fiori application | `mcp__fiori-mcp__generate_fiori_app_cap` |
| Controls, XML views, controllers, bindings of freestyle UI5 | `mcp__plugin_ui5_ui5-mcp-server__get_api_reference`, `get_guidelines`; after edits `run_ui5_linter`; after a manifest edit `run_manifest_validation` |
| UI tests (OPA5, QUnit) | skills `ui5-best-practices-opa5`, `ui5-best-practices-qunit`, `mcp__fiori-mcp__search_docs` |
| Package versions, "what's new", compatibility | not MCP: `cds version`, `npm view <pkg> version`, `docs/upstream/UPDATES.md`. Documentation snapshots in MCP may be outdated |

If the task touches several layers, ask all the corresponding servers.

## 4. Protection against duplication and inconsistency

- New function, handler, fragment, formatter, type: first `docs/registry/REUSE-CATALOG.md`, `HANDLERS.md`, `UI-ARTIFACTS.md`. Reuse or extend what you find.
- Identical tasks are solved identically. The reference is the existing code and `PATTERNS.md`, not a "prettier" variant.
- Names, file structure, formatting: only by `CONVENTIONS.md`. Prettier and the linters settle style disputes.
- Texts only through i18n, keys by convention, `en` and `ru` in the same change.

## 5. Checks before handing over

| You changed | Run |
|---|---|
| `*.cds` | `cds compile srv --to json`, `npm run lint`, update `app/products/webapp/localService/metadata.xml` with `cds compile srv --to edmx-v4 -l en > app/products/webapp/localService/metadata.xml` |
| `srv/**/*.js`, `test/**` | `npm run lint`, `npm test` |
| `app/**/webapp/**` | `npm run lint` in `app/products` (ui5lint) |
| `manifest.json` | `mcp__plugin_ui5_ui5-mcp-server__run_manifest_validation`; on a tool schema error (known defect) `npm run lint` in `app/products` |
| Anything in `db/`, `srv/`, `app/` | `npm run docs:registry`, then `node scripts/check-docs-fresh.mjs` |

Attach the commands and their output (last lines) to the report. A red test or a linter error means the task is not finished.

## 6. Documentation you are responsible for

- Changed code: a line in `docs/CHANGELOG.md` (scope: db, srv, app, test, docs, pipeline, deps).
- Closed a plan item: tick it in `docs/features/<name>/PLAN.md`.
- Learned something non-obvious about the framework, or made a mistake and understood why: an entry in `docs/LESSONS.md`.
- Made a decision that is not in `PATTERNS.md`: do not make it. Stop and propose an ADR.
- `docs/registry/*` is not edited by hand, only `npm run docs:registry`.

## 7. Report form

```
## Done
briefly, what changed and which PLAN.md items are closed

## Files
list of paths with one phrase per file

## Reused
what you found in the registry and MCP and applied; or "nothing suitable found, because ..."

## Checks
command → result (last lines of the output)

## Open questions
what requires a decision from the user or architect

## For LESSONS
one or two lines or "none"
```

## 8. Forbidden

- Editing `mta.yaml`, `xs-security.json`, `ui5-deploy.yaml`, `package-lock.json`, `.claude/**`, `.mcp.json`, `scripts/hooks/**`, `docs/registry/**`, `docs/ai-pipeline-plan.md` without an explicit user request.
- Creating `manifest.json` and the Fiori application structure by hand; `cds add sample`; `console.log`; user-facing strings in code; global access `sap.ui.getCore()`, `jQuery.sap.*`.
- Installing or bumping versions of dependencies and MCP; this is done by `upstream-check` and the user.
- Committing and pushing without an instruction from the user or the `feature` orchestrator.
- Claiming that tests pass or the linter is clean without a fresh run in this session.
- Silently choosing between two ways. Uncertainty is a question to the user or architect, not a guess.
