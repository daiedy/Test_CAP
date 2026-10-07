# Product Catalog

Full-stack application on SAP CAP (Node.js 22, `@sap/cds` 10, OData V4, SQLite in-memory in development) with an SAP Fiori Elements V4 user interface (List Report and Object Page). One entity `my.catalog.Products`, one service `CatalogService` at `/odata/v4/catalog`. At the same time a testbed for an agentic pipeline that develops CAP applications with Claude Code: how the pipeline works is described in [How the pipeline works](#how-the-pipeline-works) below, the plan is in `docs/ai-pipeline-plan.md`, the working rules are in `CLAUDE.md`.

## Requirements

- Node.js 22 LTS, npm 10
- `@sap/cds-dk` 10 globally: `npm i -g @sap/cds-dk@10`
- For the pipeline only: Claude Code with the MCP servers pinned in `.mcp.json` (setup in `docs/architecture/STACK.md`). The application itself builds, runs and tests without them.

## Quick start

```bash
npm install
cd app/products && npm install && cd ../..
npm run watch
```

Open http://localhost:4004/products/webapp/test/flpSandbox.html#products-display. Service: http://localhost:4004/odata/v4/catalog/, metadata: `/odata/v4/catalog/$metadata`.

## UI run modes

| Mode | Command | Address |
|---|---|---|
| Through CAP | `npm run watch` in the root | http://localhost:4004/products/webapp/test/flpSandbox.html |
| UI5 tooling with proxy to CAP | `npm start` in `app/products` while `npm run watch` is running | http://localhost:8080/test/flpSandbox.html |
| Without backend (mock) | `npm run start-mock` in `app/products` | http://localhost:8080/test/flpSandbox.html |

Mock mode uses `@sap-ux/ui5-middleware-fe-mockserver` with `webapp/localService/metadata.xml` and `webapp/localService/mockdata/*.json`. After a model change update the snapshot: `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml`.

`CatalogService` requires an authenticated user (ADR-0013): through CAP or the UI5 proxy, the browser prompts with its Basic dialog on the first OData request. Log in as `alice` or `bob` for full access (`CatalogEditor`), `viewer` for read-only (`CatalogViewer`), with any password. Mock mode has no backend and no roles, so it needs no login and always shows the full action set.

## Import products from Excel

A `CatalogEditor` can create many products at once from the List Report table toolbar button "Import from Excel" (`CatalogService.importProducts`, ADR-0021). The workbook format (the only place besides the file field label "Excel File (.xlsx)" that documents it, by design):

- First sheet, first row is a header naming the columns `name`, `description`, `price`, `currency`, `stock`, `category`, `rating`, `imageUrl` (case-insensitive, any order); each column may appear at most once. Mandatory columns: `name`, `price`, `currency`, `stock`, `category`.
- `category` and `currency` hold codes (`ELECTRONICS`, `USD`), never localized names.
- At most 1,000 data rows per file; the workbook must not unzip to more than 10 MB.
- All-or-nothing: a file with any bad row writes nothing, and the response lists every bad row with its row number and column.
- Sample file: `test/fixtures/products-import-valid.xlsx` (3 rows, one per category and currency).

## Commands

Root:

| Command | What it does |
|---|---|
| `npm run watch` | CAP server with auto restart, SQLite in-memory |
| `npm test` | Backend tests (Vitest + @cap-js/cds-test), including the `$metadata` contract snapshot in `test/__snapshots__` |
| `npm run lint` | `cds lint` |
| `npm run format` / `npm run format:check` | Prettier for `srv/`, `test/`, `scripts/` |
| `npm run docs:registry` | Regenerate `docs/registry/*.md` from the model and sources |
| `npm run build` | `cds build --production` |

`app/products`:

| Command | What it does |
|---|---|
| `npm start` | UI5 dev server with proxy to :4004 |
| `npm run start-mock` | UI5 dev server with mock server |
| `npm run lint` | `ui5lint` (`lint:fix` applies the autofixes) |
| `npm run lint:js` | ESLint with the SAP Fiori tools rules |
| `npm run test:ui` | QUnit and OPA5 journeys via `ui5-test-runner` against the live stack (needs `npm run watch` or `cds serve` in the root) |
| `npm run build` | Build into `dist/` |

Pipeline scripts (root):

| Command | What it does |
|---|---|
| `node scripts/backlog.mjs list` | Backlog queue from GitHub Issues with priorities, blockers and the recommended next command |
| `node scripts/check-docs-fresh.mjs` | Checks that `docs/registry` matches the model and sources (`--fix` regenerates) |
| `node scripts/check-feature-docs.mjs <name>` | Checks the shape of a feature's `PLAN.md` and `CONTEXT.md` |
| `node scripts/prompt-budget.mjs --record` | Re-records the size ceiling of prompts, rules and skills guarded by `test/prompt-budget.test.js` |

## Tests

- Backend: Vitest with `@cap-js/cds-test` in `test/`: the service and its authorization, the Excel import, the `$metadata` contract snapshot, the hooks, the document shapes, the backlog CLI and the prompt budget.
- UI: QUnit unit tests in `app/products/webapp/test/unit` and OPA5 journeys on `sap.fe.test` in `app/products/webapp/test/integration`, both run by `ui5-test-runner` against `cds serve` on :4004 (never against `cds watch`).
- How to test and what to cover: `docs/architecture/TESTING.md`.

## Continuous integration

- `.github/workflows/ci.yml` on every push to `main` and every pull request: `backend` (cds lint, Prettier check, Vitest, registry freshness, the model with templates compiles), `ui` (ui5lint, ESLint with the Fiori rules) and `ui-tests` (OPA5 journeys against `cds serve`, the report is uploaded as a build artifact).
- `.github/workflows/upstream-check.yml` on Mondays: runs the release watcher for SAP CAP, UI5 and the Fiori tools and opens or updates an issue when something changed; the assessment is written locally by the `/upstream-check` skill into `docs/upstream/UPDATES.md`.
- Dependabot weekly, grouped (`sap-cap`, `sap-ui5-fiori`, `tooling`), CAP majors excluded.

## Backlog

Planned features live in GitHub Issues with the `feature` label, not in the repository (ADR-0019): priority labels `prio:P1` to `prio:P3`, a "Blocked by: #N" line in the body, `spec-ready` after a plan, `in-progress` after the feature branch starts. The queue and the recommended next command: `node scripts/backlog.mjs list` or `/backlog` in Claude Code. New wishes go in through `/backlog <description>` or the issue form `.github/ISSUE_TEMPLATE/feature.yml`. A feature folder `docs/features/<name>/` exists only while the feature is in work and is pruned to `SUMMARY.md` afterwards.

## Structure

```
db/            data model (my.catalog) and CSV test data
srv/           CatalogService, semantic annotations, handlers (incl. the Excel import)
app/products/  Fiori Elements application, its UI annotations, QUnit and OPA5 tests
_i18n/         backend texts (en, ru)
test/          backend tests, the $metadata snapshot, fixtures, the prompt budget
docs/          architecture, patterns, registry, decisions (ADR), state, changelog, lessons, upstream digest
templates/     reference files for new artifacts
scripts/       pipeline scripts: registry generator, hooks, backlog CLI, feature pruning, release watcher
.claude/       Claude Code agents, skills, rules, hooks configuration, agent memory
.github/       CI, the weekly upstream check, Dependabot, the feature issue form
```

Details in `docs/architecture/`, working rules in `CLAUDE.md`, the current state and open debt in `docs/STATE.md`.

## Deployment

`mta.yaml` and `xs-security.json` are drafts for Cloud Foundry and are not yet usable for deployment. See `docs/architecture/ARCHITECTURE.md`.

## How the pipeline works

*A manual for those who see the system for the first time. It reads in fifteen minutes. The "In code" lines tie every concept to the files and names in the repository.*

Contents: [What this is](#what-this-is) · [Participants](#participants) · [How a task moves through the pipeline](#how-a-task-moves-through-the-pipeline) · [Automatic checks](#automatic-checks) · [How the worker agents work](#how-the-worker-agents-work) · [Documentation files](#documentation-files) · [How to give a task](#how-to-give-a-task) · [Backlog and briefing](#backlog-and-briefing) · [Glossary](#glossary)

### What this is

In this project Claude Code works not as a single chat but as a team. The team has a lead agent and worker agents with different roles. An agent here is Claude Code in a particular role: either the main chat the human writes to, or a separate run for one specific step of the work. The human gives the task and makes the decisions at checkpoints. A checkpoint is a pause between phases of the work: the pipeline stops and waits either for a decision by the human or for green checks, that is, checks that passed without errors. The agents do everything else. Automatic checks keep them from cutting corners: they hint, forbid, or hold the agent back until the error is fixed. One task that travels the whole way from a request to finished code and documentation is called a feature. The way itself is called the pipeline.

Technically these are the standard mechanisms of Claude Code, configured by files in the repository: the worker roles live in `.claude/agents/*.md`, the automatic checks are described in the `hooks` block of `.claude/settings.json`, the references are connected as MCP servers in `.mcp.json`, the command scripts live in `.claude/skills/*/SKILL.md`, and the list of planned features lives in the project's GitHub Issues (section "Backlog and briefing"). In every section below, next to the plain name, there is an "In code" line with the names that occur in the project, so that the text matches what is visible in the files.

### Participants

There are six participants: the human, two kinds of agents and three things around them: automatic checks, SAP references and documentation files.

#### Participant 1 · The human

- **Who it is.** The developer who gives the task and is responsible for the result.
- **What it does.** Writes a command in the chat, approves the plan, answers questions at checkpoints and decides whether to send the code to the shared repository.

> **In code.** Slash commands in the chat; the environment variables `PIPELINE_ALLOW_PROTECTED=1` and `PIPELINE_SKIP_GATE=1` are set when `claude` is started and are read by the hooks from the process environment; the language of the briefing and of the replies is set by the `PIPELINE_LANG` setting in the personal file `.claude/settings.local.json`.

#### Participant 2 · The lead agent

- **Who it is.** The main Claude Code chat, the very one the human writes to; this role is also called the orchestrator.
- **What it does.** On the `/feature` command it drives the task through the phases: calls the workers one after another, checks their results and makes the commits, but does not write or fix code itself.

> **In code.** The main Claude Code session; the script `.claude/skills/feature/SKILL.md` with the flag `disable-model-invocation: true` (only the human starts it); it calls workers with the `Agent` tool and resumes a stopped one through `SendMessage`.

#### Participant 3 · Worker agents

- **Who it is.** Eleven roles, called subagents; each one is started by the lead agent for one specific step with a clean memory, and sees only what it was given and what it reads itself.
- **What it does.** Does its part of the work by the plan, writes documents and code to disk as it goes, and hands the lead agent a report in a strict form.

> **In code.** Claude Code subagents, one file per role in `.claude/agents/<role>.md`; frontmatter fields: `tools` (allowed tools), `skills: [project-protocol]` (the preloaded protocol), `memory: project` (the folder `.claude/agent-memory/<role>/`), `model`, `maxTurns`.

#### Participant 4 · Automatic checks

- **Who it is.** Seven checks that Claude Code runs by itself at specific moments, called hooks. Behind them are eight scripts on seven events.
- **What it does.** They hint to the agent, forbid a dangerous action, or hold the agent back until it fixes the errors.

> **In code.** Hooks; seven events `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStop`, `Stop`, `PreCompact` in `.claude/settings.json`; eight scripts `scripts/hooks/*.mjs` and the shared libraries `scripts/lib/*.mjs`.

#### Participant 5 · SAP references

- **Who it is.** Four external services that the Claude Code settings call MCP servers; the agent turns to them as to live SAP documentation.
- **What it does.** They answer questions about the project model and the CAP, Fiori Elements and UI5 documentation, change the manifest file in the only allowed way, and open the application in a real browser for verification.

> **In code.** MCP servers from `.mcp.json`: `cds-mcp`, `fiori-mcp`, `ui5-mcp-server`, `chrome-devtools`; the tools are named `mcp__<server>__<tool>`, for example `mcp__cds-mcp__search_model`.

#### Participant 6 · Documentation files

- **Who it is.** The memory of the system, that is, the files in the repository where the project rules, its current state, the list of code already written and the decisions taken live.
- **What it does.** They outlive the session and pass knowledge from one agent to another, because the model has no memory either between sessions or between agents.

> **In code.** `CLAUDE.md`, `docs/`, `templates/`, `.claude/rules/`; the registry is generated by `npm run docs:registry` (`scripts/gen-registry.mjs`), freshness is checked by `scripts/check-docs-fresh.mjs`.

#### Eleven worker roles

Three things in the table are worth knowing in advance. The feature context and the plan are the two documents every task starts with: the context describes what already exists and what will be touched, the plan describes the steps and the acceptance criteria. The catalog of approved ways is a document where exactly one way to solve each typical task is written down. The registry of existing code is an automatically collected list of what already exists in the code: entities, services, handlers, screens, reusable functions.

| Role | What it does | What it delivers | In code |
|---|---|---|---|
| `architect` (architect) | Studies what already exists in the project. Writes no code. If the catalog of approved ways has no way for the task, proposes a new architecture decision and stops. | Two feature documents: the context and the plan. | `.claude/agents/architect.md`; tools: read, write, Bash, `mcp__cds-mcp__*`, `mcp__fiori-mcp__search_docs`; maxTurns 60; writes `docs/features/<name>/CONTEXT.md`, `PLAN.md`, `research/*.md`, an ADR in `docs/decisions/`; the form is checked by `node scripts/check-feature-docs.mjs <name>`. |
| `ux-designer` (screen designer) | Designs screens by the SAP Fiori rules: which screen type, which fields, buttons, states, accessibility. | The "Screens" section in the feature context. | `.claude/agents/ux-designer.md`; no Bash; tools `mcp__fiori-mcp__search_docs`, `mcp__ui5-mcp-server__get_guidelines`, `get_api_reference`, `mcp__cds-mcp__search_model`; maxTurns 30; writes `SCREENS.md` by `templates/feature/SCREENS.md`. |
| `cap-backend-dev` (backend developer) | The data model, the service, field checks, translations, test data. Strictly by the plan. | Changed files of the model, the service, translations and data, plus a report. | `.claude/agents/cap-backend-dev.md`; `mcp__cds-mcp__*`; maxTurns 60; files `db/schema.cds`, `srv/*.cds`, `srv/annotations/`, `srv/*.js`, `_i18n/`, `db/data/*.csv`; templates from `templates/`. |
| `fiori-app-dev` (Fiori Elements screen developer) | UI annotations, pages, UI translations. Changes the manifest file only through the Fiori reference. | Changed application files, plus a report. | `.claude/agents/fiori-app-dev.md`; `mcp__fiori-mcp__*`, `mcp__ui5-mcp-server__run_manifest_validation`, `run_ui5_linter`, `get_api_reference`, `mcp__cds-mcp__search_model`; maxTurns 60; files `app/products/annotations/*.cds`, `webapp/ext/`, `webapp/i18n/`; `manifest.json` only through `execute_functionality`. |
| `ui5-freestyle-dev` (freestyle UI5 developer) | Screens on freestyle UI5. Works only if the plan explicitly chose freestyle UI5 instead of Fiori Elements. | Changed application files, plus a report. | `.claude/agents/ui5-freestyle-dev.md`; `mcp__ui5-mcp-server__*`, `mcp__fiori-mcp__search_docs`, `mcp__cds-mcp__search_model`; maxTurns 60; skills of the `ui5` plugin (`ui5-best-practices*`). |
| `test-backend` (backend tester) | Automated tests of the service and the OData contract snapshot, that is, the reference copy of the service metadata that new changes are compared against. | Tests and a report with command output. | `.claude/agents/test-backend.md`; `mcp__cds-mcp__*`; maxTurns 60; files `test/*.test.js` on Vitest and `@cap-js/cds-test`, the snapshot in `test/__snapshots__/` (`npx vitest -u`). |
| `test-ui` (UI tester) | Automated screen tests on QUnit and OPA5, the standard UI5 testing tools. | Tests and a report with command output. | `.claude/agents/test-ui.md`; `mcp__ui5-mcp-server__*`, `mcp__fiori-mcp__search_docs`; maxTurns 80; files `app/products/webapp/test/`; run with `npm run test:ui` against `npx cds serve --in-memory --port 4004`. |
| `ui-verifier` (browser verifier) | Opens the application in a real browser, walks through the user scenarios from the plan, takes screenshots, collects console and network errors. | A verification report and screenshots. | `.claude/agents/ui-verifier.md`; `mcp__chrome-devtools__*`; maxTurns 80; model sonnet; writes `VERIFICATION.md` and `screenshots/`. |
| `reviewer` (reviewer) | Reads the changes and checks them against the plan, the naming and style conventions and the registry of existing code. Looks for duplicates and violations. Fixes nothing. | A review report. | `.claude/agents/reviewer.md`; reads code only, `mcp__cds-mcp__search_model`, `search_docs`; maxTurns 50; writes `REVIEW.md`. |
| `docs-keeper` (documentation keeper) | Updates the registry, the project changelog, that is, the list of what changed and when, the project state, the feature summary. Moves lessons out of the worker reports. | Updated documentation files, plus a report. | `.claude/agents/docs-keeper.md`; no MCP; maxTurns 80; model sonnet; `npm run docs:registry`, `docs/CHANGELOG.md`, `docs/STATE.md` by `templates/STATE.md`, `SUMMARY.md`, `docs/LESSONS.md`. |
| `upstream-watcher` (upstream watcher) | Once a week checks new versions of SAP CAP, UI5 and the tools. Touches no code. | An updates digest. | `.claude/agents/upstream-watcher.md`; `WebFetch`; maxTurns 30; model sonnet; skills `project-protocol` and `upstream-check`; `scripts/watch-releases.mjs`, `docs/upstream/UPDATES.md`, `versions.json`. |

#### Four SAP references

- The CAP reference, MCP server `cds-mcp` (`@cap-js/mcp-server@0.0.5`): the tools `search_model` (search in the project model) and `search_docs` (CAP documentation).
- The Fiori reference, MCP server `fiori-mcp` (`@sap-ux/fiori-mcp-server@1.12.2`): `search_docs` over the Fiori Elements documentation; the only allowed way to change `manifest.json`, the main settings file of a Fiori application: `list_functionality` → `get_functionality_details` → `execute_functionality`; a new application through `generate_fiori_app_cap`.
- The UI5 reference, MCP server `ui5-mcp-server` (`@ui5/mcp-server@0.3.2`): `get_api_reference` and `get_guidelines` for controls, `run_ui5_linter` and `run_manifest_validation`; a linter is a program that looks for style and form errors in code.
- The browser, MCP server `chrome-devtools` (`chrome-devtools-mcp@1.8.0`): a real Chrome that the agent drives through `navigate_page`, `take_screenshot`, `list_console_messages`, `get_network_request`.

The reference versions are pinned exactly in `.mcp.json` and change only through the `/upstream-check` script by the human's decision. Which file type needs which reference is written in the `MCP_RULES` table in `scripts/lib/mcp-audit.mjs`; that is the table the worker exit control checks. The "reference first" rule is explained in the section about the worker agents.

### How a task moves through the pipeline

The pipeline is started by the `/feature` command. A slash command is a command script: an instruction written in advance that the main chat executes when the human types the command. Such a script is called a skill; the script file is `.claude/skills/feature/SKILL.md`. The diagram below shows the whole path of a feature, and under it each phase is taken apart separately.

![Flow diagram: eight phases in rows; the lead agent on the left, worker agents and what they deliver in the middle, what is checked before the next phase, and the automatic checks in the right column](docs/images/pipeline-flow.svg)

*The feature's path through the pipeline: eight phases, the checkpoints between them and the automatic checks that fire along the way.*

#### Phase 0 · Preparation

The lead agent comes up with a short feature name and asks the human for the checkpoint mode. Then it checks that the repository has no foreign uncommitted changes, creates the branch `feature/<name>` and the feature folder. Usually a feature comes from the backlog: the command `/feature #N` takes the name and the request from the issue with number N and puts the label `in-progress` on it (section "Backlog and briefing").

| Mode | Where it waits for the human | Checks at the end of a phase |
|---|---|---|
| Semi-autonomous, the default | After each phase it shows the result and waits for the word "next". | Runs them itself. |
| Autonomous | Only at plan approval and on red checks, that is, checks with errors. | Runs them itself. |
| Manual | After each phase. | Does not run them without the human's instruction. |

**Checkpoint.** The human confirmed the feature name and the checkpoint mode. The mode is chosen once, after that the lead agent does not ask again.

**Checks.** Session start already ran when the chat was opened, so the lead agent knows the state of the project. File protection watches every edit and every terminal command, here and in all following phases.

**Human.** Confirm the feature name and choose the mode or accept the default one.

> **In code.** branch `feature/<name>`, folder `docs/features/<name>/`, tree cleanliness `git status --porcelain`; the gate mode is remembered for the whole run; for an issue `gh issue view N --json title,body` and `node scripts/backlog.mjs status N in-progress`.

#### Phase 1 · Research and plan

The architect studies the project and writes two feature documents: the context and the plan. The context says what already exists, what is affected and which rules apply. The plan holds the acceptance criteria and a table of steps: who does it, which files, in which way, which check confirms it. If the feature has screens, the screen designer writes a separate screens file. The context stays a short brief for the workers; experiments and measurements go into a separate research folder, which only the architect and the reviewer read. A plan that the `/spec` command has already written is re-read by the architect, not written again.

**Checkpoint.** Before showing the plan, the lead agent runs the document shape check and returns a red result to the architect. The plan is approved with the word "approved". Without this word nothing goes further in any mode. If the architect answered "a new decision is needed" or "no approved way", the pipeline stops and the question goes to the human.

**Checks.** Every document edit is written to the log; the reference call log; exit control of the architect and the screen designer.

**Human.** Open the feature plan, the file `PLAN.md` in the feature folder, read the acceptance criteria and the open questions, answer the questions and write the word "approved" in the chat.

> **In code.** `CONTEXT.md` (brief), `PLAN.md`, `SCREENS.md`, `research/*.md` from the templates in `templates/feature/`; shape check `node scripts/check-feature-docs.mjs <name>`; an ADR in `docs/decisions/` gets the status accepted on approval.

#### Phase 2 · Backend

The backend developer does the plan steps for the data model, the service, translations and test data. The backend tester writes tests from the acceptance criteria. At the end of the phase the lead agent makes a commit, that is, records the changes in the repository history.

**Checkpoint.** Linter and tests green, command output attached to the reports.

**Checks.** After every edit: compilation of the CDS model, linter and code formatting, check of translation pairs; the CAP reference call log; exit control of each of the two workers.

**Human.** In semi-autonomous and manual mode look at the result and give the command to continue. In autonomous mode step in only if the checks are red.

> **In code.** `db/schema.cds`, `srv/*.cds`, `srv/annotations/`, `srv/*.js`, `_i18n/`, `db/data/*.csv`; tests `test/*.test.js`; gate `npm run lint` and `npm test`; contract snapshot `npx vitest -u` and `app/products/webapp/localService/metadata.xml`; commit `feat(srv): <name> backend`.

#### Phase 3 · User interface

The phase is needed only if the plan has screens. First the screen developer works, then the UI tester. At the end of the phase the lead agent makes a commit.

**Checkpoint.** UI linter without errors, tests green.

**Checks.** After every edit the UI5 linter and the translation check; file protection does not let anyone edit the manifest directly, only the Fiori reference changes it; the reference call log; exit control of each worker.

**Human.** As in phase 2.

> **In code.** `app/products/annotations/*.cds`, `webapp/ext/`, `webapp/i18n/`; `manifest.json` only through `mcp__fiori-mcp__execute_functionality`; tests `webapp/test/`; gate `npm run lint` in `app/products` (`ui5lint`) and `npm test`; commit `feat(app): <name> ui`.

#### Phase 4 · Browser verification

The browser verifier opens the application in a real browser, walks through the user scenarios from the plan and writes the verification report as it goes, not at the end. If defects are found, the lead agent returns the work to phase 2 or 3 with an exact list. There are at most two such returns, then the question goes to the human.

**Checkpoint.** The verdict "ready for review".

**Checks.** The browser call log; exit control of the verifier.

**Human.** After two rounds of defects decide what to do next.

> **In code.** server `npx cds serve --in-memory --port 4004`, entry point `/products/webapp/test/flpSandbox.html`, tools `mcp__chrome-devtools__*`; result `VERIFICATION.md` and `screenshots/`; a stopped agent is continued through `SendMessage`.

#### Phase 5 · Review

The reviewer reads the changes, checks them against the plan, the conventions and the registry and writes the review report: blocking, important and minor findings. Each finding goes to the worker whose code it is. After the fixes the reviewer looks again only at what was fixed.

**Checkpoint.** Zero blocking findings.

**Checks.** The CAP reference call log; exit control of the reviewer and of every worker who fixed something.

**Human.** In semi-autonomous and manual mode give the command to continue.

> **In code.** `git diff` against `PLAN.md`, `docs/architecture/CONVENTIONS.md`, `PATTERNS.md`, `docs/registry/*.md`; result `REVIEW.md` with the sections Blocking, Important, Minor, Verdict.

#### Phase 6 · Documentation

The documentation keeper updates the registry, the changelog, the project state, the feature summary and the lessons, that is, the conclusions from the mistakes of this feature. At the end of the phase the lead agent makes a commit. This phase is never skipped, even in autonomous mode.

**Checkpoint.** The documentation freshness check is green.

**Checks.** Exit control of the keeper.

**Human.** In semi-autonomous and manual mode give the command to continue.

> **In code.** `npm run docs:registry`, `node scripts/check-docs-fresh.mjs`, `docs/CHANGELOG.md`, `docs/STATE.md` from `templates/STATE.md`, `SUMMARY.md`, `docs/LESSONS.md`; commit `docs: <name> summary and registry`.

#### Phase 7 · Wrap-up

The lead agent shows the human the list of commits, which acceptance criteria are closed and what is left in the open debt, that is, the list of what is known but not yet done. Pushing the branch to the shared repository and a pull request, a request to merge the branch, are done only when the human says so.

If the feature came from an issue, before the report the lead agent posts the feature summary as a comment in that issue, closes it and prunes the feature folder down to a single file `SUMMARY.md`. A link to the full record in the git history is added to the file: the plan, the review, the verification report, the screenshots. This way the features folder does not grow and the history is not lost.

**Checkpoint.** The human's decision about the push.

**Checks.** The final gate: the registry is fresh, the project state and the changelog are updated, tests are green. It fires every time the main chat finishes a reply and waits for the human, that is, also at the pauses between phases, not only here.

**Human.** Decide whether to push the branch and whether to create a pull request.

> **In code.** `git log`, criteria from `PLAN.md`, the table `## Open debt` in `docs/STATE.md`; `node scripts/backlog.mjs close N --summary docs/features/<name>/SUMMARY.md`, then `node scripts/prune-feature.mjs <name>`, commit `docs: <name> close #N and prune`; `git push` and a pull request only on instruction.

#### Between phases

After every checkpoint the lead agent updates the lines Feature, Phase, Last commit and Next in the "Now" section of the project state file: the final gate fires at every pause of the main chat and will not let through a pause with changed code and a stale state. If a worker did not finish within its allotted number of turns, the lead agent does not start a new one but continues the same worker from where it stopped. That is why workers write their documents to disk as they work, not at the end. If the chat history has become too long and Claude Code compacts it into a summary, a note is written to the session log before the compaction.

> **In code.** the `## Now` section in `docs/STATE.md`; the turn limit is `maxTurns` in the role frontmatter; an agent is continued through `SendMessage`; the compaction log `.pipeline/sessions.log`.

### Automatic checks

A hook is a program that Claude Code runs itself at a certain moment. The human does not call it. Claude Code passes it information about what is happening right now: which tool was called, which file, which agent. Claude Code understands a hook's answer in three ways: add text to the agent's memory as a hint; forbid the action with an explanation; not release the agent, return it a list of complaints, and it keeps working. Inside the worker agents the same "before edit" and "after edit" checks fire as in the main chat, and at the exit a worker has a check of its own.

> **In code.** the `hooks` block in `.claude/settings.json`: event → list of entries, an entry has a `matcher` (a regular expression on the tool name) and the command `node scripts/hooks/<script>.mjs` with a timeout in seconds. The hook reads JSON from stdin: `tool_name`, `tool_input`, `session_id`, inside a worker also `agent_id` and `agent_type`, on a repeated stop `stop_hook_active`. It answers like this: stdout or the `additionalContext` field add text to the context; `permissionDecision: deny | ask` forbids or asks; exit code 2 with text in stderr does not release the agent. Shared functions in `scripts/lib/hook-utils.mjs`.

Two checks can be switched off with an environment variable. An environment variable is a setting that is set in the terminal when Claude Code is started. That is why only the human can set it, and an agent inside the session cannot.

#### Check 1 · Session start

- **When it fires.** When a Claude Code session is opened, when it is resumed and after the chat clear command.
- **What problem it solves.** Without it every new session would start from zero and would not know where the project stopped.
- **What it does.** First it prints the briefing in the human's language: which language is chosen, what is in work or what state the branch is in, the backlog queue by priority from GitHub Issues, the "recommended now" line with a ready command and the number of open debt items. Then the current project state, the sections "where we are" and "open debt" in full, and one pointer line to the latest digest of SAP updates. If a section is larger than its budget, it cuts the section with a visible mark of how many bytes are not shown. It compares the versions of Node and the cds tool with the expected ones. Along the way it deletes logs older than 14 days.
- **What the human sees.** The briefing at the start of the session; the lead agent repeats it in its first reply in the human's language.
- **How to bypass it and who can.** No bypass needed, the check forbids nothing.

> **In code.** event `SessionStart` (field `source`: startup, resume, clear), script `scripts/hooks/session-start.mjs`. First `collectBriefing` and `renderBriefing` from `scripts/lib/backlog.mjs` (queue via `gh issue list`, cache `.pipeline/issues.json`, timeout 8 seconds, language `PIPELINE_LANG`, texts `scripts/i18n/pipeline*.properties`); then the sections `## Now` and `## Open debt` from `docs/STATE.md` with the `readSection` function and one line with the heading of the latest section of `docs/upstream/UPDATES.md`; when `STATE_PRINT_BUDGET` (4096 bytes) is exceeded it puts the mark `[truncated …]`; cleans `.pipeline/` (`pruneAudit`, 14 days).

#### Check 2 · File protection

- **When it fires.** Before every file edit and before every command in the terminal.
- **What problem it solves.** An agent may, by mistake or for convenience, change the settings of the pipeline itself, the application's manifest file, the generated registry or the deployment files, that is files for putting the application on a server, and nobody would notice.
- **What it does.** Compares the path with the list of protected files. An edit through the editing tool it forbids with an explanation. A terminal command that looks like a write to a protected file it forbids for a worker, and in the main chat it shows the human the question "allow?".
- **What the human sees.** A message from the agent that the file is protected and an explicit request from the human is needed. In the main chat a confirmation prompt pops up.
- **How to bypass it and who can.** Only the human: either start the session with the environment variable `PIPELINE_ALLOW_PROTECTED=1`, or confirm the prompt by hand. An agent cannot do it on its own.

> **In code.** event `PreToolUse`: matcher `Edit|Write|MultiEdit` → `protect-files.mjs`, matcher `Bash` → `protect-files-bash.mjs`. The `PROTECTED` list in `scripts/lib/protected-paths.mjs`: `.claude/**`, `.mcp.json`, `scripts/hooks/**`, `scripts/lib/**`, `docs/registry/**`, `app/**/webapp/manifest.json`, `mta.yaml`, `xs-security.json`, `package-lock.json`. Answer `permissionDecision: deny` or `ask`. Decision ADR-0016.

#### Check 3 · Post-edit check

- **When it fires.** After every file edit.
- **What problem it solves.** A mistake in the model, style or translations is cheaper to catch at once than in the tests an hour later.
- **What it does.** By file type: compiles the CDS model, runs formatting and the linter for JavaScript, the UI5 linter for the interface, checks that every translation has a pair in English and Russian, looks for Russian text where English should be, checks the shape of the test data, and for the project state file and the feature documents checks the template shape. In addition it marks the registry of existing code as stale and records in the pipeline service log which agent edited which file.
- **What the human sees.** The agent receives the remarks as a hint and usually fixes them right away.
- **How to bypass it and who can.** No bypass needed, the check only hints.

> **In code.** event `PostToolUse`, matcher `Edit|Write|MultiEdit`, script `post-edit.mjs`. Checks in `scripts/lib/file-checks.mjs`: `cds compile`, prettier and eslint, `ui5lint`, i18n pairing, Cyrillic, `checkMockdata`, the shape of `docs/STATE.md`, `PLAN.md` and `CONTEXT.md` from `doc-shapes.mjs`. Marker `docs/registry/.stale`. Record `{event: "edit", agent, file}` in `.pipeline/mcp-audit-<session>.jsonl`. Answer `additionalContext`.

#### Check 4 · Reference call log

- **When it fires.** After every call by an agent to an SAP reference or to a command script.
- **What problem it solves.** The "reference first" rule lived only in the instructions, and a skipped query was invisible.
- **What it does.** Records in the pipeline service log which agent called which reference and whether the attempt succeeded.
- **What the human sees.** Nothing. This log is read by the worker exit control and by the retrospective, that is the review after a task, run with the `/retro` command.
- **How to bypass it and who can.** No bypass needed.

> **In code.** events `PostToolUse` and `PostToolUseFailure`, matcher `^mcp__|^Skill$`, script `mcp-audit.mjs`. Record `{event: "mcp" | "skill", agent, agentType, tool, ok, subject}` in the same `.pipeline/mcp-audit-<session>.jsonl`. Decision ADR-0014.

#### Check 5 · Worker exit control

- **When it fires.** When a worker finishes its work.
- **What problem it solves.** A worker could hand over work with linter errors, write a file past the checks through the terminal, or never ask the reference at all.
- **What it does.** Three checks over the list of changed files. First: linter errors. Second: files for which the service log has no record of an edit through the editor. That means they were written around the checks, through the terminal. Such files are checked here, and the protected ones among them are blocked. Third: a comparison of the edits with the reference call log; if the file type requires a reference query and there was none, the worker is sent back once with a request either to ask the reference or to write in the report the section "MCP not used", that is "reference not used", with the reason. On a repeated handover without the section it is let through, but recorded in the log for the retrospective.
- **What the human sees.** The worker makes an extra round and fixes things. A section with the reason appears in the report.
- **How to bypass it and who can.** Only for protected files, with the same environment variable `PIPELINE_ALLOW_PROTECTED=1`. Only the human sets it.

> **In code.** event `SubagentStop`, script `subagent-stop.mjs`. Changed files by `git status`; eslint and ui5lint only at severity error; files without an `edit` record go through `runFileChecks`, protected ones are blocked by `protectedWriteHit`; MCP gaps are counted by `mcpGaps` against the `MCP_RULES` table in `scripts/lib/mcp-audit.mjs`; the `## MCP not used` section is looked up in `last_assistant_message`. Answer: exit 2 and text in stderr; with `stop_hook_active` the record `skipped-unjustified`.

#### Check 6 · Final gate

- **When it fires.** Every time the main chat finishes a reply and waits for the human, including the pauses between phases.
- **What problem it solves.** Work could end with changed code but stale documentation and tests that were never run.
- **What it does.** First it checks that the project state file keeps the template shape. Then, if code was changed, it checks three things: the registry is fresh, and if not, it regenerates the registry itself; the project state file and the changelog have been updated; all tests are green. Along the way it warns if more than ten unsorted lessons have piled up. It remembers the result, so a repeated finish without new edits passes instantly.
- **What the human sees.** The chat does not finish its work but completes the documentation or fixes the tests.
- **How to bypass it and who can.** The environment variable `PIPELINE_SKIP_GATE=1`. Only the human sets it.

> **In code.** event `Stop`, script `stop-gate.mjs`. Order: protected files (`protectedWriteHit`) → shape of `docs/STATE.md` (`stateShapeErrors`, budget `STATE_PRINT_BUDGET`) → hash of `git status` over `db/ srv/ app/ test/ _i18n/` against `.claude/.gate-state.json` → `node scripts/check-docs-fresh.mjs` (`--fix` when stale) → `docs/STATE.md` and `docs/CHANGELOG.md` in `git status` → `npm test` (limit 10 minutes) → counter of entries in `docs/LESSONS.md`. Bypass `PIPELINE_SKIP_GATE=1`, loop protection `stop_hook_active`.

#### Check 7 · Note before memory compaction

- **When it fires.** When the chat memory overflows and Claude Code compresses the history into a short retelling.
- **What problem it solves.** After compaction the chat remembers only the retelling.
- **What it does.** Appends to the session log a line with the date, the branch and the number of changed files.
- **What the human sees.** A line in the service log `.pipeline/sessions.log`; it does not get into the repository.
- **How to bypass it and who can.** No bypass needed.

> **In code.** event `PreCompact` (field `trigger`: auto or manual), script `pre-compact.mjs`. A line like `2026-09-24 19:07 UTC session <id>: branch main, changed files 3, compaction manual` in `.pipeline/sessions.log`; the folder is in `.gitignore`.

### How the worker agents work

#### What a worker knows at the start

At the start a worker knows four things:

- its role: the file that says what this role does and which tools it may use;
- the shared working protocol: the order of actions, the same for all workers;
- the project constitution: what this project is, the ten invariant rules and which command is for which request;
- its memory index: a short list of notes that this role has collected in past tasks.

Plus the text of the assignment from the lead agent: the feature name, the path to the feature folder, the plan step numbers, the checkpoint mode and the list of files to read and not to read.

> **In code.** the role file `.claude/agents/<role>.md`, its body becomes the system prompt; the protocol `.claude/skills/project-protocol/SKILL.md`, preloaded by the `skills` field; the constitution `CLAUDE.md`; the memory index `.claude/agent-memory/<role>/MEMORY.md`, Claude Code inserts the first 200 lines or 25 KB. The assignment is passed by the `Agent` tool; the reading list per role is in the "Orchestrator rules" section of the `/feature` script.

Everything the model sees at the moment of work is called the agent context. Every file read takes up space in it and costs tokens, that is billable units of text. That is why at the start a worker gets only what is listed, and reads the rest itself.

#### What a worker does not know

A worker does not see the human's chat with the lead agent. If the human said something important in the chat, it must get into the plan or into the assignment. Otherwise the worker will not learn about it.

#### How a worker reads the rest

Next the worker reads on its own, in the order the protocol sets:

1. the plan and the context of the feature (`PLAN.md`, `CONTEXT.md`); the screens file `SCREENS.md` only for the interface roles; the `research/` folder only if a plan step names a file;
2. the "Now" and "Open debt" sections of the project state file (`docs/STATE.md`);
3. the registry of existing code (`docs/registry/*.md`) and the model through the CAP reference (`mcp__cds-mcp__search_model`), so as not to write a duplicate;
4. the catalog of approved ways (`docs/architecture/PATTERNS.md`), where every typical task has exactly one way;
5. the SAP reference on the topic of the edit, by the routing table in section 3 of the protocol.

Only then does it edit. File-type rules are loaded automatically at the moment the worker opens a file of that type: the data model has one set of rules, handlers another, tests a third. A file-type rule is a short instruction on how to write files of exactly this type.

> **In code.** `.claude/rules/<type>.md` with the `paths` field in the frontmatter, for example `srv/**/*.js` for handlers or `app/**/webapp/test/**` for UI tests; Claude Code loads the rule when an agent reads a file that matches the glob.

#### What "reference first" means

Before changing anything in the SAP area, a worker must ask the reference. If the reference contradicts the model's memory, the reference is right. A skipped query is visible: the reference call log records every call, and the worker exit control compares the edits with the log and sends the worker back if there was no query.

> **In code.** the `MCP_RULES` table in `scripts/lib/mcp-audit.mjs`: `db/**/*.cds` and `srv/**/*.cds` expect `mcp__cds-mcp__search_model` or `search_docs`; `srv/**/*.js` and `test/**/*.js` expect `cds-mcp`; `app/**/annotations/**/*.cds` expects `mcp__fiori-mcp__search_docs`; `app/**/webapp/**/*.js` and `*.xml` expect the UI5 MCP or `fiori-mcp`; `webapp/test/**` accepts the skills `ui5-best-practices-opa5` and `qunit`. A failed call also counts as an attempt.

#### How a worker reports

The report follows a strict form: done; files; what was reused; check results with command output; open questions; when needed, the section "MCP not used" with the reason why the reference was not used; lessons. The claim "tests pass" without fresh command output is not accepted.

> **In code.** the report form in section 8 of the protocol: `## Done`, `## Files`, `## Reused`, `## Checks`, `## Open questions`, `## MCP not used`, `## For LESSONS`.

#### What happens when a worker runs out of turns

A worker has a turn limit, that is the number of actions after which it must stop. It writes its document to disk as it works, and when the limit is exhausted it stops and names the last completed item. The lead agent continues the same worker from the same place instead of starting a new one.

> **In code.** `maxTurns` in the role frontmatter: 30 for `ux-designer` and `upstream-watcher`, 50 for `reviewer`, 60 for `architect`, the developers and `test-backend`, 80 for `test-ui`, `ui-verifier` and `docs-keeper`; continuation via `SendMessage` with the text "continue from …".

#### What a worker never does on its own

A worker does not choose between two ways. If the catalog of ways is silent, it stops and asks a question. After the handover the worker's memory disappears. Only the files it wrote and its report remain.

### Documentation files

The model has no memory between sessions and between agents. Everything that must survive a session lives in files of the repository. So the memory of the system is not the model's head but the documents that the agents read at the start and append to at the end of their work.

| File or folder | Which question it answers | Who writes it | Who reads it and when |
|---|---|---|---|
| `CLAUDE.md` | The constitution: what this project is, ten invariable rules, which command for which request. | The human. | All agents, always, at the start. |
| `.claude/rules/` | How to write files of each type: model, services, handlers, annotations, tests, translations. Attached by the `paths` field in the frontmatter (glob patterns). | The human. | The agent at the moment it opens a file of that type. |
| `.claude/agents/` | Worker roles: who does what, which tools are available. Frontmatter: `tools`, `skills`, `memory`, `model`, `maxTurns`. | The human. | The worker at the start, as its role. |
| `.claude/skills/` | Command scripts: `/backlog`, `/feature`, `/spec`, `/review`, `/test-all`, `/run-app`, `/gen-docs`, `/retro`, `/upstream-check` and the common worker protocol. Human-only commands are marked `disable-model-invocation: true`, the protocol `user-invocable: false`. | The human. | The main chat when the command is typed; every worker reads the protocol. |
| `.claude/agent-memory/` | Notes of each role from past tasks. | The worker itself. | The same worker at the start: the index right away, topics by link. |
| `docs/STATE.md` | Where we are now: the sections `Now` (Date, Branch, Feature, Phase, Last commit, Next), `Open debt`, `What works`, `Decisions` by the template `templates/STATE.md`; hooks check the shape. | The documentation keeper and the lead agent. | Session start prints it; every worker at the second reading step. |
| `docs/CHANGELOG.md` | What changed and when. | The documentation keeper. | The reviewer and the keeper. |
| `docs/LESSONS.md` | Lessons not yet turned into a rule or a check. | Workers through their reports; the retrospective moves them. | The architect, the reviewer. |
| `docs/architecture/` | How we build: the architecture, the naming and style conventions, the catalog of approved ways, tool versions, how we test. | The human and the architect. | The architect everything; the developers the catalog of ways and the conventions. |
| `docs/registry/` | What already exists in the code: entities, services, handlers, screens, reusable functions. Generator `scripts/gen-registry.mjs`, freshness `scripts/check-docs-fresh.mjs`, staleness marker `.stale`. | Generated by a command, never edited by hand. | All workers before a new function; the reviewer looks for duplicates. |
| `docs/decisions/` | Why it was decided this way: architecture decision records with context, alternatives and consequences. | The architect; the human accepts. | By link from the catalog of ways. |
| GitHub Issues, label `feature` | What is planned and in which order: the request in the human's words, priority `prio:P1..P3`, "Blocked by" dependencies, labels `spec-ready` and `in-progress`. Not in the repository (ADR-0019). | The human through `/backlog` or the issue form; the lead agent sets labels and closes. | Session start prints the queue; `/spec #N` and `/feature #N` take the issue by number. |
| `docs/features/<name>/` | Working documents of one feature while it is in progress: the context `CONTEXT.md`, the plan `PLAN.md`, the screens file `SCREENS.md`, research `research/*.md`, the verification report `VERIFICATION.md`, the review report `REVIEW.md`, the summary `SUMMARY.md`, the folder `screenshots/`. After completion only `SUMMARY.md` remains, with a link to the full record in the git history. | The architect, the screen designer, the browser verifier, the reviewer, the documentation keeper. | The workers of this feature. |
| `templates/` | Reference templates of files of each type. | The human. | The worker when creating a new file. |
| `.pipeline/` | The pipeline service logs: `mcp-audit-<session>.jsonl` (who edited what and which reference was queried), `sessions.log` (compactions), `issues.json` (a cache of the backlog queue for sessions without network). Never enter the repository, cleaned after 14 days. | Hooks. | Worker exit control; the retrospective `/retro`. |
| `test/prompt-budget.json` | The size of each prompt, rule and script file as a ceiling; growth fails the test `test/prompt-budget.test.js`. | `node scripts/prompt-budget.mjs --record` at the retrospective. | The test on every `npm test`. |
| `docs/upstream/UPDATES.md` | What is new in SAP CAP, UI5 and the tools. | The upstream watcher. | Session start prints a pointer line to the latest digest; the watcher and `/upstream-check` read it. |

#### Layers of instructions

The instructions lie in layers, from the general to the specific. The constitution always applies. File-type rules are loaded when a file of that type is opened. Each worker has its own role. A command script switches on when the human types the command.

#### Feature documents

Feature documents are the working documents of one task. They live in the feature folder: the context, the plan, the verification report, the review report, the summary and screenshots. The architect, the screen designer, the browser verifier, the reviewer and the documentation keeper write them, and the workers of this feature read them, each its own part by the reading list from the `/feature` script: the backend roles the context and the plan, the UI roles also the screens file, the reviewer everything. The folder lives while the feature is in progress: after completion the lead agent prunes it to `SUMMARY.md`, and the full record stays in the git history by a link from that file.

#### What is generated automatically

The registry of existing code is generated by a command from the code, so it does not go stale and is not edited by hand. The post-edit check marks it stale, and the final gate requires it to be refreshed.

#### Repository map

Where things live, one line per folder or file.

```
CLAUDE.md                          constitution: invariants, documentation map, commands
.claude/
  settings.json                    hooks (event → script), enabledPlugins, permissions.deny
  agents/<role>.md                 11 worker roles (frontmatter: tools, skills, memory, model, maxTurns)
  skills/<name>/SKILL.md           13 command scripts (including backlog) and the common protocol project-protocol
  rules/<type>.md                  11 file-type rules (frontmatter paths: glob)
  agent-memory/<role>/             role memory: MEMORY.md (index) and topic files
  .gate-state.json                 hash of the last green pass of the final gate (not in git)
  settings.local.json              personal settings: env.PIPELINE_LANG, language of the briefing and chat (not in git)
.github/ISSUE_TEMPLATE/feature.yml issue form for a planned feature: the same structure /backlog creates
.mcp.json                          4 MCP servers: cds-mcp, fiori-mcp, ui5-mcp-server, chrome-devtools
scripts/
  hooks/*.mjs                      8 hook scripts: session-start, protect-files, protect-files-bash, post-edit, mcp-audit, subagent-stop, stop-gate, pre-compact
  lib/*.mjs                        shared libraries: hook-utils, protected-paths, file-checks, mcp-audit (MCP_RULES), doc-shapes, registry-sources, backlog (queue, recommendation, briefing)
  backlog.mjs                      backlog CLI: list, briefing, create, prio, blocked-by, status, close, setup-labels
  prune-feature.mjs                prunes a finished feature to SUMMARY.md with a permalink to the full record
  i18n/pipeline*.properties        briefing and queue texts per language (en base, ru)
  gen-registry.mjs                 docs/registry generator (npm run docs:registry)
  check-docs-fresh.mjs             registry freshness; check-feature-docs.mjs: shape of PLAN and CONTEXT; prompt-budget.mjs: ceiling on prompt sizes
  watch-releases.mjs               release collection for upstream-watcher
docs/
  STATE.md, CHANGELOG.md, LESSONS.md
  architecture/                    ARCHITECTURE, CONVENTIONS, PATTERNS, STACK, TESTING
  decisions/ADR-*.md               architecture decision records, template templates/adr.md
  registry/*.md                    generated; post-edit sets the .stale marker
  features/<name>/                 only features in progress: CONTEXT, PLAN, SCREENS, research/, VERIFICATION, REVIEW, SUMMARY, screenshots/; finished ones keep SUMMARY.md
  upstream/                        UPDATES.md (digest), versions.json
templates/                         reference templates: STATE.md, feature/*, adr.md, entity.cds, service.cds, handler.js, tests
test/*.test.js                     Vitest: service, $metadata contract, hooks, document shapes, prompt budget
.pipeline/                         service logs (not in git): mcp-audit-<session>.jsonl, sessions.log, issues.json
db/  srv/  app/  _i18n/            the application itself: CAP model, service, Fiori Elements, translations
```

### How to give a task

A task is given by a command in the chat. Below are all the commands and what happens after each.

- `/backlog` The backlog queue by priority and the "recommended now" line. Without arguments it changes nothing.
- `/backlog <description>` Record a wish as a GitHub issue: checks whether it already exists among the issues and in the code, translates the request into English and puts the original wording into a collapsed block, asks once for the priority P1, P2 or P3 and the blockers, creates the issue and shows its place in the queue. It creates no folder in the repository. Only the human types this command.
- `/backlog #N prio P1`, `/backlog #N blocked-by #M` Change the priority or a dependency of issue N.
- `/feature <description or #N>` The full pipeline from the plan to the documentation, with checkpoints; with an issue number it takes the name and the request from the issue and closes the issue at the end. Only the human types this command.
- `/spec <description or #N>` Only the plan and the context, no code. For an estimate. With an issue number it takes the request from the issue and, after the plan is approved, sets the label `spec-ready`.
- `/add-entity <Name and fields>` A fast path for a simple entity without logic.
- `/review` Review of the current changes.
- `/test-all` All project checks: `npm run lint`, `npm test`, `ui5lint`, `node scripts/check-docs-fresh.mjs`, `npm run format:check`, a server start, a search for Russian text in the code.
- `/run-app` Start the application. Three modes: `full` brings up the CAP server (`npm run watch`, port 4004) and opens the application from it; `proxy` adds a separate UI server (`npm start` in `app/products`, port 8080) that talks to the CAP server; `mock` opens only the UI on test data (`npm run start-mock`), without a server.
- `/gen-docs` Refresh the registry (`npm run docs:registry`) and check the documentation freshness.
- `/retro` The retrospective: what went wrong and where to move the lesson so that it acts by itself.
- `/upstream-check` What is new in SAP CAP, UI5 and the tools.

> **In code.** Each command is a folder `.claude/skills/<name>/SKILL.md`. `/backlog`, `/feature`, `/spec`, `/add-entity`, `/review`, `/upgrade-cds` are marked `disable-model-invocation: true` and are started only by the human; `/test-all`, `/run-app`, `/gen-docs`, `/retro`, `/upstream-check` can also be started by the lead agent. The skills of the `cap-developer` and `ui5` plugins are enabled through `enabledPlugins` in `.claude/settings.json`.

#### Three things expected from the human

1. Answer "approved" to the plan. Without this word no code is written.
2. Answer open questions and the returns after two rounds of defects.
3. Decide whether to push the branch to the shared repository.

> **Note.** If the human describes a code change without a command, the lead agent suggests typing `/feature` or `/spec`, or recording the wish for later through `/backlog`, and waits.

> **Warning.** Only the human can switch off the file protection and the final gate. To do so, the environment variables `PIPELINE_ALLOW_PROTECTED=1` and `PIPELINE_SKIP_GATE=1` are set when Claude Code is started. An agent inside the session cannot set them.

### Backlog and briefing

The backlog is the list of what we want to do but have not started yet. Before, there was no such list: the state file held one "what next" line, and the features folder suited only tasks in progress. If plans and finished features with screenshots are stored there too, the folder grows without end, it has no priorities, and a new session does not know what to take up. The decision ADR-0019: planned features live in GitHub Issues, a feature folder exists only while the feature is in progress, and a session opens with a short briefing.

#### A feature's life in three states

| State | Where it lives | Who moves it on |
|---|---|---|
| Planned | Only a GitHub issue with the label `feature`: the request in the human's words, dependencies, questions for the plan. Neither a folder nor a file in the repository. | The command `/backlog <description>` in the chat or the issue form in the browser. |
| In progress | The same issue with the label `spec-ready` after the plan and `in-progress` after the branch starts, plus the folder `docs/features/<name>/` with all feature documents. | `/spec #N` writes the plan, `/feature #N` leads through the phases. |
| Done | The issue is closed, its last comment is the feature summary. Only `SUMMARY.md` remains in the folder, with a link to the full record in the git history: the plan, the review, the verification report, screenshots. | Phase 7 of the `/feature` script: closes the issue and prunes the folder. |

> **In code.** Labels `feature`, `prio:P1`, `prio:P2`, `prio:P3`, `spec-ready`, `in-progress` (created by `node scripts/backlog.mjs setup-labels`); the issue form `.github/ISSUE_TEMPLATE/feature.yml` with the fields Request, Original, Blocked by, Scope hints, Questions; closing `node scripts/backlog.mjs close N --summary docs/features/<name>/SUMMARY.md`; pruning `node scripts/prune-feature.mjs <name>` appends to `SUMMARY.md` the section `## Full record` with a permalink to the folder's last commit. The four features finished before ADR-0019 were pruned the same way.

#### Priorities and "what to do now"

A priority is a label on the issue: `prio:P1` next in the queue, `prio:P2` normal, the default, `prio:P3` later. A dependency is written in the issue body as the line "Blocked by: #N": the feature waits until issue N is closed. The queue builds itself: first by priority, within a priority by age. There is one recommendation. If there is a feature with the label `in-progress`, continue it. Otherwise the first in the queue whose blockers are all closed: without a plan it is `/spec #N`, with the label `spec-ready` it is `/feature #N`. A priority or a blocker can be changed with the mouse in GitHub or with the command `/backlog #N prio P1`, `/backlog #N blocked-by #M`.

The queue as of 29 September 2026: P1 #14 `pipeline-metrics` (per-agent and per-phase time, tokens and cost of the pipeline); P2 #8 `products-subcategories` (subcategories that depend on the category), #9 `products-details-section` (a "Details" section on the product page, after #8), #10 `products-validations` (validations through annotations), #11 `sandbox-flex-connector` (saved filter views keep their filters in the FLP sandbox). The first three features of the backlog, #5 `products-rating-column`, #6 `products-rating-filter` and #7 `products-excel-upload`, are done and closed.

> **In code.** `scripts/lib/backlog.mjs`: `gh issue list --label feature --state all --json …` → `parseIssue`, `buildQueue` (priority, then `createdAt`; `blocked` if the blocker is open), `recommend` (continue → feature → spec → none); cache `.pipeline/issues.json`, timeout 8 seconds, without network the queue comes from the cache with its date; test `test/backlog.test.js`.

#### The briefing at session start

The first thing the "Session start" check prints is the briefing in the human's language: which language is selected, what is in progress or what state the branch is in, the queue by priority with the marks "after #N" and "in progress", the "recommended now" line with a ready command, and the number of open debt items. The lead agent repeats the briefing as its first reply. The SAP updates digest was removed from the start: instead there is one pointer line to the digest file.

```
## Briefing
Language: en (PIPELINE_LANG in .claude/settings.local.json, env)
Now: no feature in work, branch main, tree clean, last commit 0485310 Merge branch 'feature/products-excel-upload'.
Queue: P1 #14 pipeline-metrics; P2 #8 products-subcategories, #9 products-details-section (after #8), #10 products-validations, #11 sandbox-flex-connector
Recommended now: /spec #14 (P1, unblocked, no plan yet).
Open debt: 13 item(s), docs/STATE.md.
```

> **In code.** `scripts/hooks/session-start.mjs` calls `collectBriefing` and `renderBriefing` from `scripts/lib/backlog.mjs`; `node scripts/backlog.mjs briefing` and `/backlog` without arguments print the same. If GitHub is unavailable: the line "queue from cache dated …" or "GitHub unavailable and no cache".

#### Language of the briefing and the chat

The human chooses the language, separately on each machine: the setting `PIPELINE_LANG` in the personal Claude Code settings file, which does not enter the repository. The scripts print the briefing and the queue in that language, the lead agent sees the value in the first line of the briefing and replies in it. If the setting is not set, the scripts write in English, and the chat goes in the human's language. Everything that is stored stays in English: issue bodies, documents, code; the original wording of the request in Russian lies in the issue in the collapsed "Original" block.

```
.claude/settings.local.json
{ "env": { "PIPELINE_LANG": "ru" } }
```

> **In code.** `pickLang`: the environment variable `PIPELINE_LANG`, otherwise `env.PIPELINE_LANG` from `.claude/settings.local.json`, otherwise `en`; texts in `scripts/i18n/pipeline.properties` and `pipeline_ru.properties` (Russian is allowed only in the bundles, invariant 10); the reply language rule is in CLAUDE.md and in the `/spec`, `/feature`, `/backlog` scripts.

### Glossary

- **Worker agent, subagent.** An agent with one role and a clean memory, which the lead agent starts for a specific step of the work. In code: subagent, the file `.claude/agents/<role>.md`, started with the `Agent` tool.
- **Lead agent, orchestrator.** The main Claude Code chat, which leads the task through the phases and calls the workers. In code: the main session and the script `.claude/skills/feature/SKILL.md`.
- **Hook, automatic check.** A program that Claude Code itself runs at a certain moment: it hints, forbids, or does not release the agent. In code: hook, the `hooks` block in `.claude/settings.json`, the scripts `scripts/hooks/*.mjs`.
- **SAP reference, MCP server.** An external service with live SAP documentation, which the agent queries before an edit. In code: an entry in `.mcp.json`, the tools `mcp__<server>__<tool>`.
- **Checkpoint, phase gate.** A pause between phases where the pipeline waits for the human's decision or for green checks. In code: gate in the `/feature` script; the checks `npm run lint`, `npm test`, `ui5lint`, `check-feature-docs.mjs`, `check-docs-fresh.mjs`.
- **Command script, skill.** A pre-written instruction that the main chat executes on a slash command. In code: skill, `.claude/skills/<name>/SKILL.md`.
- **File-type rule.** An instruction on how to write files of one type; loaded when the agent opens such a file. In code: rule, `.claude/rules/<type>.md` with the `paths` field.
- **Registry of existing code.** An automatically assembled list of what already exists in the code; never edited by hand. In code: `docs/registry/*.md`, the generator `scripts/gen-registry.mjs`.
- **Architecture decision record, ADR.** A document on why it was decided this way: context, alternatives, consequences. In code: `docs/decisions/ADR-NNNN-*.md`, the template `templates/adr.md`.
- **Catalog of approved ways, PATTERNS.** A document where exactly one way to solve each typical task is written down. In code: `docs/architecture/PATTERNS.md`.
- **Agent context.** Everything the model sees while it works; every file in it costs tokens. In code: what the hooks add through `additionalContext`, plus the files read; the length of the work is limited by `maxTurns`.
- **Feature.** One task that goes through the pipeline from the request to finished code and documentation. In code: a GitHub issue, the branch `feature/<name>`, the folder `docs/features/<name>/` while the feature is in progress.
- **Backlog.** The list of planned features with priorities and dependencies; lives in GitHub Issues, not in the repository. In code: issues with the label `feature`, `prio:P1..P3`, the "Blocked by" line; `scripts/backlog.mjs`, ADR-0019.
- **Briefing.** A short summary at the start of a session: what is in progress, the backlog queue, what to do now, how much debt. In code: `renderBriefing` in `scripts/lib/backlog.mjs`, printed by `session-start.mjs`.
- **Pipeline language, PIPELINE_LANG.** A personal setting for the language in which the human receives the briefing, the queue and the chat replies. In code: `env.PIPELINE_LANG` in `.claude/settings.local.json`, the texts `scripts/i18n/pipeline*.properties`.
