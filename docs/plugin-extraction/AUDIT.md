# Semantic audit of the pipeline rules

Step 1 of issue #65, done on 2026-11-19, before anything moves into the plugin repository. It answers one question for every rule the pipeline carries: is it true for any CAP and Fiori project, or only because this project chose it.

## Result

881 statements were read. 387 describe how the pipeline itself works and move as they are. 452 are about the stack, and of those:

- 41 are facts without a condition;
- 122 are facts that hold only when the project has some property (drafts, Fiori Elements V4, cds 10, a mock server);
- 289, which is 64%, are choices of this project where another answer is legitimate.

Another 15 statements are about this application or this machine and stay here. 27 are not rules.

A search for the application's name would not have found this. Of the 304 statements that are a project choice or an application detail, 70 name the application and 234 do not.

The consequence for the plugin: it cannot be a set of hard CAP rules. It is a small core of facts, a larger set of facts switched on by what the install finds in the project, and a base of defaults that a project replaces with its own way.

## Groups

| Code | Meaning | Where it goes |
|---|---|---|
| `F` | Stack fact: framework behaviour, an API contract, a tool limitation; no legitimate alternative | Hard rule of the plugin |
| `C` | Stack fact under a condition: true only when the project has a named property | In the plugin, switched on by detection |
| `D` | Default: a choice of this project or team; the alternative is named in the ledger | A default the project can replace |
| `A` | Application or environment detail; nothing general remains without this application | Stays in Test_CAP |
| `P` | Pipeline mechanic: agents, phases, gates, reports, documents, budgets | Plugin, as is |
| `X` | Not a rule: a pointer or a navigation line | Ignored |

`P` was added to the four groups of the issue: most statements of the skills and agent prompts are about the pipeline, not about CAP.

## Figures

| Source | Statements | F | C | D | A | P | X | To reword |
|---|---|---|---|---|---|---|---|---|
| Path rules, `.claude/rules/` (12 files) | 220 | 25 | 39 | 83 | 2 | 62 | 9 | 26 |
| `PATTERNS.md`, `CONVENTIONS.md`, `TESTING.md` | 182 | 3 | 47 | 97 | 4 | 31 | 0 | 84 |
| Agent prompts, `.claude/agents/` (11 files) | 153 | 1 | 10 | 45 | 1 | 95 | 1 | 36 |
| `CLAUDE.md` and the 13 skills | 266 | 10 | 11 | 41 | 3 | 184 | 17 | 31 |
| Tables and assumptions in code | 60 | 2 | 15 | 23 | 5 | 15 | 0 | 28 |
| All | 881 | 41 | 122 | 289 | 15 | 387 | 27 | 205 |

"To reword" counts statements whose wording names the application, its paths or this machine, whatever their group.

The full ledgers, one row per statement with the reason, the condition or the alternative: `audit/rules.md`, `audit/arch.md`, `audit/agents.md`, `audit/skills.md`, `audit/code.md`.

## What the project choices are

The 289 defaults fall into ten themes. The counts come from a keyword grouping of the ledger and are approximate.

| Theme | About | Examples of the choice | In the plugin |
|---|---|---|---|
| Test tooling and test style | 67 | Vitest with `@cap-js/cds-test`; the `$metadata` snapshot as the contract; one test file per service; negative tests for annotations; `npm test` as the gate; QUnit and OPA5 with `ui5-test-runner`; the mock server | Detected from the project; a test command and a list of test tools in the project profile |
| Annotation layering, folders, file and key names | 41 | Semantic annotations in `srv/annotations/<Entity>.cds`, UI annotations in `app/<app>/annotations/<Entity>.cds`; `srv/lib` for shared code; i18n key schemes | The layout found in an existing project wins; this layout is the default for a new one |
| Team languages | 37 | `en` and `ru` bundles in the same change; English for every file; the Cyrillic check; Russian trigger phrases in descriptions | A list of bundle languages and a file language in the project profile |
| Formatter, linters, documentation toolchain | 34 | Prettier; ESLint with the JSDoc gate; `ui5lint` with zero errors; doc comments as the only descriptions; the OpenAPI export; `cds.log` only | Each tool switched on when the project has it |
| Modelling style | 21 | `cuid, managed` on every entity; CodeList instead of enum; `Decimal(15, 2)`; one projection per entity; one service; seed data through `cds add data` | Defaults for a new project; an existing model is read, not corrected |
| Tracker and hosting | 21 | GitHub Issues and `gh` as the backlog; pull requests and GitHub Actions as the merge gate; the GitHub Wiki mirror | One supported tracker at first, named as a default and isolated behind the backlog script |
| Strictness and process policies | 20 | Deployment files only by a human; exact pins of MCP versions; a breaking model change needs an ADR; no version rollback after an upgrade | Switches in the project profile |
| UI policy | 16 | Fiori Elements V4 by default; apps and `manifest.json` only through Fiori MCP; no custom CSS; five filters and seven columns | Defaults with a switch |
| JavaScript, module and handler style | 12 | JavaScript without TypeScript; ESM; handlers as classes; XML views | Detected from the project |
| Tuned numbers and models | 5 | `maxTurns` per agent, raised after runs on this application; `sonnet` for three agents | Defaults of the plugin, open to a setting |

About 15 further defaults fit no theme, for example the order of handler registrations and explicit string lengths.

## What the conditions are

The 122 conditional facts depend on a short list of project properties. The install command has to detect each of them; a statement may depend on several.

| Property of the project | Statements | How to detect it |
|---|---|---|
| cds major version (lean draft, values as strings, `@assert` expressions) | 37 | The `@sap/cds` version of the project |
| Fiori Elements V4 on OData V4 | 29 | `sap.fe.templates` and the data source version in `manifest.json` |
| Draft-enabled entities | 24 | `@odata.draft.enabled` in the compiled model |
| CAP Node.js runtime with JavaScript handlers | 21 | `@sap/cds` in `package.json`, no Java service module |
| OPA5 on `sap.fe.test` | 16 | `sap/fe/test` in the files under `webapp/test` |
| An MCP server or a plugin being present (`fiori-mcp`, `chrome-devtools`, `ui5`, `cap`) | 13 | The project's `.mcp.json` and the enabled plugins |
| `@ui5/linter`, `ui5-test-runner`, the UI5 Tooling version | 10 | `devDependencies` of the app, `specVersion` in `ui5.yaml` |
| SQLite as the development and test database | 9 | `@cap-js/sqlite`, `cds.requires.db` |
| The FLP sandbox as the entry page | 9 | `webapp/test/flpSandbox.html` |
| UI mock mode (`fe-mockserver`, `localService`) | 8 | The middleware in `ui5-mock.yaml`, the `localService` folder |
| UI5 version or UI5 from the CDN | 5 | `minUI5Version`, the bootstrap URL |
| Default CAP folder layout | 3 | `cds.env.folders` |
| Mocked authentication | 3 | `cds.requires.auth` |
| MTA deployment to Cloud Foundry | 3 | `mta.yaml` |
| Code lists on `sap.common.CodeList` | 2 | The compiled model |
| Claude Code version | 2 | The running version |

## What stays in Test_CAP

15 statements, all in the ledgers under `A`. The ones that matter:

- the description of the Product Catalog in `CLAUDE.md` and its list of current debt;
- the keyboard handler in `Component.js` (`CLAUDE.md`, the `ui5-webapp` rule, the `fiori-app-dev` prompt);
- the state of this application's deployment drafts (the `deploy` rule, the `Deployment` row of `PATTERNS.md`);
- the pattern row "Dependent field as a control plus guard", written around this application's entities;
- `WIKI_RULE_AREAS = ACCESS, PRODUCTS, DETAILS, IMPORT` in `scripts/lib/doc-shapes.mjs`: this application's business areas as a constant in code. The name search missed it; it must become project configuration;
- `docs/ai-pipeline-plan.md` in the protected list, the briefing title `# Test_CAP project context`, the Homebrew paths in `scripts/lib/hook-utils.mjs`;
- the namespace check of `templates/*.cds`, which exists only because the templates sit inside the project.

## Pipeline mechanics that carry an assumption

Classified `P`, but each needs a decision before it moves:

- `/feature` has exactly one backend phase and one UI phase with fixed agents (`feature` skill, `HOME_PHASE`, the reader groups `All`, `Backend`, `UI` of CONTEXT.md, the criteria phases 2 to 6). A service-only CAP project has no UI phase.
- The hand-over checks and `/test-all` call this project's script names (`npm run lint`, `lint:js`, `format:check`, `test:ui`).
- Several tables are keyed by agent names (`BRIEF_ROLES`, `HOME_PHASE`, the `maxTurns` lookup in `.claude/agents`); a hook sees a plugin agent as `<plugin>:<agent>` (see `SPIKE.md`).
- The ratchet files `test/prompt-budget.json` and `test/context-budget.json` pin sizes measured on this repository.

## Findings beyond the classification

They change steps 4 to 7 of the issue.

1. **CI cannot reach the pipeline scripts after the move.** `.github/workflows/ci.yml`, `wiki.yml` and `upstream-check.yml` run `node scripts/check-docs-fresh.mjs`, `node scripts/wiki.mjs audit`, `wiki.mjs export` and `watch-releases.mjs`. In a connected project these scripts live in the plugin, which CI does not have. The same holds for the npm scripts `docs:registry`, `docs:api`, `docs:wiki`, and for a developer's terminal: a plugin's `bin/` folder is on PATH only inside Claude Code. This needs a decision that the issue does not list yet: a checkout of the plugin repository at a tag inside the workflow, an npm package with the scripts, or a composite action.
2. **Two scripts import the project's CAP runtime.** `gen-registry.mjs` and `wiki.mjs` are the only scripts with a third-party import (`@sap/cds`). From the plugin folder the bare import fails; resolving it from the project root works (`SPIKE.md`). Every other script uses Node.js built-ins only, so the plugin needs no `npm install`.
3. **TypeScript and other layouts pass every check unseen.** The dispatch in `file-checks.mjs`, `MCP_RULES` and the registry generator match `srv/**/*.js`, `test/**/*.js` and `this.on(` handlers. A project with `.ts` sources, tests in another folder or handlers registered another way gets no check and an empty registry section, with no warning.
4. **The project root is found from the script's own location or the working directory**: `repoRoot()` in `hook-utils.mjs` and `watch-releases.mjs` go up from their own folder, `check-docs-fresh.mjs` and `gen-registry.mjs` take `process.cwd()`. In the plugin all of them read `CLAUDE_PROJECT_DIR`.
5. **A report file name would carry a colon** (`report-<agent-type>-<id>.md` with a prefixed agent type).

## Statements to re-check before they become hard rules

Found by the classifiers while checking the official documentation or comparing sources.

| Where | Doubt |
|---|---|
| `.claude/rules/ui5-webapp.md:19`, `.claude/agents/fiori-app-dev.md:21`, `PATTERNS.md:63`, `CONVENTIONS.md:86` | "No `.controller.` in the name of an extension file": the documentation registers a ControllerExtension by `controllerName`, which resolves to `.controller.js`, and the application has no such file to prove the rule |
| `.claude/rules/tests-backend.md:16`, `.claude/agents/test-backend.md:20` | Decimal values as strings and the `{ affected }` result were not found in the documentation; the condition may be SQLite, not cds 10 |
| `.claude/agents/architect.md:26` | "Editing in Fiori Elements V4 needs a draft" was not confirmed |
| `.claude/rules/i18n.md:22` | "`cds compile` warns about a missing text key" was not confirmed |
| `.claude/skills/debug-after-upgrade/SKILL.md:29` to `:32` | The cds 10 changes were not found in the documentation snapshot of `cds-mcp` |
| `scripts/lib/file-checks.mjs:275` | The `ui5.dependencies` requirement may be outdated: UI5 Tooling 3 and later read `devDependencies` |
| `PATTERNS.md:83` and `TESTING.md:74` against `TESTING.md:54` and `:79` | `npm run watch` for OPA5 in one place, "never `cds watch`" in the other |
| `PATTERNS.md:33` against `CONVENTIONS.md` | `@readonly` on the projection in one, in `srv/annotations` in the other |
| `.claude/agents/test-ui.md:27` against `TESTING.md`; `test-ui.md:19` against the `tests-ui` rule | Mock mode and the use of generated test files are described differently |
| `.claude/agents/reviewer.md` | "Do not edit anything" while the agent writes REVIEW.md; its write tools come only from `memory: project` |

## Method and limits

- **Units.** One unit per list item, table row, paragraph line, frontmatter block and fenced code block of the source files, extracted by a script, so no line is skipped: 821 units. 60 more were written by hand for the tables and assumptions in code.
- **Classification.** Four classifiers worked in parallel from one brief with the group definitions and a fixed decision order, one per source group; the code slice was classified by hand. A validator checked that every unit has exactly one row, a reason, a condition for `C` and an alternative for `D`.
- **Review.** The group and the reason of every `F`, `C`, `A` and `D` row of the rules, the agent prompts, the skills and `PATTERNS.md` were read once more after the merge, without going back to each source line. The `P` rows and the rows of `CONVENTIONS.md` and `TESTING.md` were not reviewed one by one.
- **Checked against the documentation.** 27 statements were checked in the official documentation through MCP, 43 cite a measurement made in this repository. Of the 163 facts (`F` and `C`), 20 are checked in the documentation, 29 measured and 114 rest on the classifier's knowledge. Until the plugin runs on other CAP projects (step 8), an `F` or a `C` is a candidate, not a proven fact.
- **Granularity.** A unit is a line, and some lines hold many statements: the rows `PATTERNS.md:27`, `:35`, `:39`, `:45`, `:61` hold ten or more across groups. Such a unit carries the group of its larger part, the note names the rest, and the row is split when it is rewritten.
- **Not audited.** `ARCHITECTURE.md` and `STACK.md` (they are written from the project at install), the texts of the templates, the pipeline tests, the 32 ADRs statement by statement (sorted as whole records in `KNOWLEDGE.md`), and headings, a few of which carry a condition for the list below them.

The working files (skeletons, classifier outputs, the brief, the extraction, validation and merge scripts) are in `.pipeline/plugin-audit/`, which git ignores.
