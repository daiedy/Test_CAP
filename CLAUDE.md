# CLAUDE.md

Constitution of the Test_CAP project. Short by design: invariants and pointers. Details live in `docs/`, per-file-type rules in `.claude/rules/` (loaded automatically), workflows in `.claude/skills/`.

## What this is

Product Catalog: SAP CAP (Node.js 22, `@sap/cds` 10, OData V4, SQLite in-memory in development) plus Fiori Elements V4 (List Report + Object Page). One entity `my.catalog.Products`, service `CatalogService` at `/odata/v4/catalog`. The project is at the same time a testbed for the agentic pipeline, the plan is in `docs/ai-pipeline-plan.md`.

## Documentation map

| Question | File |
|---|---|
| Where we are, open debt | `docs/STATE.md` |
| How it is built and why | `docs/architecture/ARCHITECTURE.md` |
| How to name things, where things live, style | `docs/architecture/CONVENTIONS.md` |
| The single way to solve a typical task | `docs/architecture/PATTERNS.md` |
| Versions and tools | `docs/architecture/STACK.md` |
| How to test | `docs/architecture/TESTING.md` |
| What already exists in the code (generated) | `docs/registry/*.md` |
| Why it was decided this way | `docs/decisions/ADR-*.md` |
| Feature specifications | `docs/features/<name>/` |
| Lessons learned, typical mistakes | `docs/LESSONS.md` |
| What changed | `docs/CHANGELOG.md` |
| What is new in the upstream dependencies | `docs/upstream/UPDATES.md` |
| Reference files | `templates/` |

## Invariants

1. **MCP-first.** Before creating or changing any SAP artifact, query the relevant server. If MCP contradicts your knowledge, MCP is right.

   | You change | Server and tools |
   |---|---|
   | CDS: entities, projections, actions, handlers | `cds-mcp`: `search_model`, then `search_docs` |
   | `@UI.*`, `@Common.*`, Fiori Elements, `manifest.json` | `fiori-mcp`: `search_docs`; manifest only via `list_functionality` → `execute_functionality` |
   | Controls, XML views, UI5 controllers | UI5 MCP (`ui5-mcp-server`, pinned in `.mcp.json`; the `ui5` plugin supplies the skills, its bundled server is toggled off in `/mcp`): `get_api_reference`, `get_guidelines`, `run_ui5_linter`, `run_manifest_validation` |
   | Versions, "what's new" | not MCP: `cds version`, `npm view`, `docs/upstream/UPDATES.md` |

2. **Specification before code.** A code change starts with `docs/features/<name>/PLAN.md` approved by the user. Orchestrator: `/feature`, plan only: `/spec`.
3. **Registry before implementation.** Before a new function, handler, fragment, type: `docs/registry/` and `search_model`. A duplicate of something existing is a blocking review error.
4. **One task, one way.** The way is taken from `PATTERNS.md`. No row means an ADR is needed, not a second way.
5. **Annotation layers.** Semantics (`@title`, `@mandatory`, `@assert.*`, `@readonly`) in `srv/annotations/<Entity>.cds`; presentation (`@UI.*`, `@Common.ValueList`, `@Common.Text`) in `app/<app>/annotations/<Entity>.cds`; no annotations in `db/`.
6. **Declarative before imperative.** A handler is written when an annotation is not enough.
7. **Texts through i18n.** `en` and `ru` in the same change. No user-facing strings in code.
8. **Gates, not trust.** Hooks run linters after edits, and tests and the documentation check before finishing. "Tests pass" without fresh output is not accepted.
9. **Documentation in the same change.** `npm run docs:registry`, a line in `docs/CHANGELOG.md`, an up-to-date `docs/STATE.md`.
10. **English everywhere the AI reads.** Code comments, commit messages, `docs/`, feature specs, ADRs, agent reports and memories are English. Russian lives only in i18n `ru` bundles, `.texts.csv` and asserted test values. Chat replies follow the user's language. The PostToolUse hook flags Cyrillic; `/test-all` scans for it.

## Style in two lines

CDS: PascalCase plural entities, camelCase elements, `cuid, managed`, lengths on strings, CodeList instead of enum. JS: ESM, `extends cds.ApplicationService`, `cds.log`, `req.reject(code, 'KEY')`, `cds.ql`, Prettier. UI: XML only, `sap.ui.define`, no global `sap.*`, JavaScript, Fiori Elements by default, manifest only via Fiori MCP.

## Commands

```bash
npm run watch                    # CAP on :4004, UI http://localhost:4004/products/webapp/test/flpSandbox.html
npm test                         # Vitest + @cap-js/cds-test, $metadata snapshot in test/__snapshots__
npm run lint                     # cds lint
npm run docs:registry            # regenerate docs/registry
node scripts/check-docs-fresh.mjs
cd app/products && npm start     # UI5 dev server with proxy to :4004
cd app/products && npm run start-mock   # UI without backend (sap-fe-mockserver)
cd app/products && npm run lint  # ui5lint
cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml   # snapshot after a model change
```

PATH in GUI sessions may lack Node: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.

## Which skill for which request

The main agent does not write code itself. Map the request to a skill first; skills delegate to the agents listed. Skills marked "user" run only when the user types the command: when a request needs one, say so and wait instead of starting the work.

| User asks for | Skill | Runs agents | Who starts it |
|---|---|---|---|
| A new feature, screen, action, model change ("add", "implement", "make") | `/feature <description>` | architect, ux-designer, cap-backend-dev or ui5-freestyle-dev, fiori-app-dev, test-backend, test-ui, ui-verifier, reviewer, docs-keeper, phase gates and commits | user |
| Only a plan or estimate | `/spec <description>` | architect, ux-designer | user |
| A simple new entity without logic | `/add-entity <Name and fields>` | none (inline, follows the "New entity" pattern) | user |
| Code review of current changes | `/review` | reviewer | user |
| "Is everything green", before a commit | `/test-all` | none (runs the checks) | user or Claude |
| Run or show the app | `/run-app [full\|proxy\|mock]` | ui-verifier for visual checks | user or Claude |
| Registry or docs stale, after code changes | `/gen-docs` | docs-keeper when STATE or CHANGELOG need text | user or Claude |
| What is new upstream, weekly check | `/upstream-check` | upstream-watcher | user, Claude or schedule |
| Something broke after a dependency bump | `/debug-after-upgrade` | none (inline investigation) | user or Claude |
| Major CAP upgrade | `/upgrade-cds <major>` | none, wraps the `cap-upgrade` plugin skill | user |
| End of a session, what to improve | `/retro` | none (writes LESSONS, proposes rule edits) | user or Claude |
| A question about the code or the project | no skill: read `docs/STATE.md`, `docs/registry/`, `docs/architecture/`, use `search_model` | none | Claude |

Direct delegation without a skill is allowed only for read-only work: `architect` to research a question, `reviewer` to review, `ui-verifier` to check the running app, `upstream-watcher` on schedule. Writing to `db/`, `srv/`, `app/`, `test/` always goes through `/feature` or `/add-entity`.

## Pipeline

- Subagents in `.claude/agents/`: `architect`, `ux-designer`, `cap-backend-dev`, `fiori-app-dev`, `ui5-freestyle-dev`, `test-backend`, `test-ui`, `ui-verifier`, `reviewer`, `docs-keeper`, `upstream-watcher`. All preload the `project-protocol` skill and work by it.
- Skills: `/feature`, `/spec`, `/add-entity`, `/gen-docs`, `/run-app`, `/test-all`, `/review`, `/retro`, `/upstream-check`, `/debug-after-upgrade`, `/upgrade-cds`. External: `cap-developer`, `cap-upgrade` (plugin `cap`), `ui5-best-practices*` (plugin `ui5`).
- Hooks (`.claude/settings.json`, scripts in `scripts/hooks/`): SessionStart prints STATE and checks the environment; PreToolUse forbids editing protected files; PostToolUse runs compilation and linters by file type and marks the registry stale; SubagentStop blocks handing over with linter errors; Stop requires a fresh registry, updated STATE and CHANGELOG and a green `npm test`. Bypass only by user decision: `PIPELINE_SKIP_GATE=1`, `PIPELINE_ALLOW_PROTECTED=1`.
- MCP in `.mcp.json` with pinned versions: `cds-mcp` 0.0.5, `fiori-mcp` 1.12.2, `chrome-devtools` 1.8.0, `ui5-mcp-server` 0.2.18 (the `ui5` plugin stays for its skills; its unpinned bundled server `plugin:ui5:ui5-mcp-server` is toggled off in `/mcp` on each machine). Setup on a new machine: `docs/architecture/STACK.md`.

## Do not do without an explicit user request

- Edit `mta.yaml`, `xs-security.json`, `ui5-deploy.yaml`, `package-lock.json`, `.claude/**`, `.mcp.json`, `scripts/hooks/**`, `docs/registry/**`, `docs/ai-pipeline-plan.md`.
- Change the keyboard hack in `app/products/webapp/Component.js`.
- Bump versions of `@sap/cds`, `@sap/cds-dk`, MCP servers; this is done by `/upstream-check` and `/upgrade-cds` with a user decision.
- Create a Fiori application or `manifest.json` by hand; `cds add sample`; TypeScript in the UI (ADR-0005).
- Commit and push. Commits are made by the `/feature` orchestrator per phase or by the user.

## Known debt

See `docs/STATE.md`, section "Open debt". Key items today: legacy FLP sandbox bootstrap (`createRenderer`, New Sandbox migration via the `modernize-flp-sandbox` skill), `Products.price` Decimal(10, 2) instead of the convention, deployment not configured.
