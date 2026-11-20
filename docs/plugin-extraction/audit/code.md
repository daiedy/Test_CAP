# Audit ledger: Tables and assumptions in code (`scripts/`, settings, workflows)

Groups: `F` stack fact, `C` stack fact under a condition, `D` default (a choice of this project), `A` application or environment detail, `P` pipeline mechanic, `X` not a rule. See `../AUDIT.md`.

Generated from `.pipeline/plugin-audit/out/code.jsonl` by `.pipeline/plugin-audit/merge.mjs`; 60 statements.

## `scripts/lib/file-checks.mjs`

F 1, C 6, D 5, A 1, P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 24 | STALE_SCOPE and STALE_EXCLUDE: an edit under db/, srv/, app/ marks the registry stale | C | The registry sources are the standard CAP folders | default CAP folder layout (db/, srv/, app/ not remapped in cds.env.folders) |  | reasoned |  |
| 35 | UI5_SCOPE: ui5lint runs on app/**/webapp JS, HTML, view and fragment XML, manifest.json | D | Running @ui5/linter on every edit is a tool choice; the code already tolerates a missing install | no UI5 linter, or only the Fiori tools ESLint |  | reasoned | The glob itself needs UI5 apps under app/<name>/webapp with a ui5.yaml |
| 41 | APP_ESLINT_SCOPE: the app ESLint with the JSDoc gate runs on webapp/**/*.js | D | The JSDoc lint gate is the documentation toolchain this project chose (ADR-0029) | no JSDoc gate in the app |  | reasoned |  |
| 50 | checkCds: npx cds compile <file> --to json after every .cds edit | F | Every CAP model compiles with cds compile; a broken model is an error in any project |  |  | reasoned | Needs @sap/cds-dk reachable through npx in the project |
| 148 | checkJs: prettier --write and ESLint on srv/**/*.js, test/**/*.js, scripts/**/*.mjs | D | Prettier and ESLint on JavaScript are this project's formatter and linter; .ts files get no check at all | TypeScript sources, another formatter, no auto-format on edit | yes | reasoned | scripts/** is the pipeline's own code and leaves the scope |
| 211 | checkCyrillic: Cyrillic in code and docs is flagged outside ru bundles, .texts.csv and tests | D | English files with Russian only in ru bundles is this team's language policy | another language set, or no language check |  | reasoned |  |
| 235 | checkMockdata: a mockdata JSON file must be an array, also for a singleton | C | sap-fe-mockserver iterates each file with forEach; the object form throws on the $batch path | UI mock mode on @sap-ux/ui5-middleware-fe-mockserver |  | measured |  |
| 248 | checkSandboxHtml: the sandbox bootstrap script needs id="sap-ushell-bootstrap" | C | sandbox.js otherwise takes the last script tag; behaviour of the legacy FLP sandbox bootstrap | legacy FLP sandbox bootstrap (ushell/bootstrap/sandbox.js) |  | measured |  |
| 260 | checkSandboxConfig: the app intent url must be relative; a LaunchPage block is overridden | C | Both notes are FLP sandbox behaviour, but the regular expression hardcodes /products/webapp | FLP sandbox configuration files in the app | yes | measured | The literal /products/webapp is this application; the check must match any absolute /<app>/webapp |
| 275 | checkUi5Yaml: a Fiori tools middleware needs its package in devDependencies and in package.json ui5.dependencies | C | Bound to the UI5 Tooling generation where ui5.dependencies is still read | UI5 Tooling version that requires ui5.dependencies |  | reasoned | DOUBT: UI5 Tooling 3 and later resolve middlewares from devDependencies alone; re-check against the UI5 CLI documentation |
| 307 | checkTemplateNamespace: a templates/*.cds file needs its own namespace my.catalog.tpl.<name> | A | Exists because the templates sit inside the project where cds-mcp compiles every .cds; in the plugin they live outside the project |  | yes | measured | Disappears with the move; keep only if templates are ever copied into a project |
| 335 | checkI18n: every bundle has the pair <name>.properties and <name>_ru.properties with the same keys | D | The language pair en and ru is this team's choice; the key-parity check itself is general | the language list of the project (for example en and de) |  | reasoned | Make the list of languages project configuration |
| 355 | checkDocShapes: STATE.md, wiki pages, PLAN.md and CONTEXT.md keep their template shape | P | Document shapes are pipeline mechanics |  |  | reasoned |  |
| 389 | runFileChecks: dispatch by path (.cds, srv/**/*.js, test/**/*.js, _i18n/**, app/**/webapp/i18n/**) | C | The globs are the standard CAP layout with JavaScript sources | default CAP folder layout (db/, srv/, app/ not remapped in cds.env.folders), JavaScript sources |  | reasoned | TypeScript sources and tests outside test/ fall through every check |

## `scripts/lib/mcp-audit.mjs`

C 3, D 2, P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 23 | MCP_RULES "CDS model and services": db/**/*.cds and srv/**/*.cds need a cds-mcp query | P | MCP-first is the pipeline's own invariant; the globs are the standard layout |  | yes | reasoned | Tool names change when the server is bundled in the plugin |
| 29 | MCP_RULES "CAP handlers": srv/**/*.js needs a cds-mcp query | C | Handlers are JavaScript files under srv/ only on the Node.js runtime | CAP Node.js runtime with JavaScript handlers | yes | reasoned |  |
| 34 | MCP_RULES "UI annotations": app/**/annotations.cds and app/**/annotations/**/*.cds | D | Where UI annotations live is this project's layering decision (ADR-0004) | annotations in srv/, in one file per app, or in a differently named file | yes | reasoned |  |
| 39 | MCP_RULES "UI5 code": app/**/webapp JS and XML need a ui5 or fiori MCP query | C | Applies when the project has UI5 apps in the Fiori tools structure | UI5 apps under app/<name>/webapp | yes | reasoned |  |
| 50 | MCP_RULES "UI tests": webapp/test needs the ui5 plugin skills for OPA5 and QUnit | C | Depends on the ui5 plugin being installed and on OPA5 and QUnit as the UI test tools | ui5 plugin enabled; OPA5 and QUnit tests under webapp/test | yes | reasoned | The Skill:ui5:... names assume the plugin id ui5 |
| 59 | MCP_RULES "backend tests": test/**/*.js that touch CAP need a cds-mcp query | D | Tests in a root test/ folder written in JavaScript is this project's setup | tests elsewhere, in TypeScript, on another runner | yes | reasoned |  |

## `scripts/lib/protected-paths.mjs`

D 3, A 1, P 2

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 12 | PROTECTED: mta.yaml, xs-security.json, app/**/ui5-deploy.yaml | D | Deployment files are human-only by this project's policy, and they assume an MTA deployment | agents may edit them; Kyma or another deployment target |  | reasoned |  |
| 15 | PROTECTED: package-lock.json everywhere | D | A policy, and it assumes npm | pnpm or yarn lock files; lock file edits allowed |  | reasoned |  |
| 17 | PROTECTED: .claude/**, .mcp.json, scripts/hooks/**, scripts/lib/** | P | Self-protection of the pipeline code that lives in the project today |  | yes | reasoned | In the plugin the code is outside the project; only the project-side files (.claude/rules, settings, the project profile) remain to protect |
| 21 | PROTECTED and GENERATED: docs/registry/** is written only by the generator | P | Generated files are pipeline mechanics |  |  | reasoned |  |
| 22 | PROTECTED: docs/ai-pipeline-plan.md | A | A document of this repository |  | yes | reasoned |  |
| 23 | PROTECTED: app/**/webapp/manifest.json is changed only through Fiori MCP | D | A strictness policy of this project (ADR-0007, ADR-0014), with a hand-edit exception already needed (ADR-0020) | hand edits of manifest.json allowed |  | reasoned |  |

## `scripts/hooks/stop-gate.mjs`

C 1, D 1, P 2

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 48 | CODE_PATHS = db, srv, app, test, _i18n: a change there arms the Stop gate | C | Standard CAP folders plus this project's test/ and _i18n/ locations | default CAP folder layout (db/, srv/, app/ not remapped in cds.env.folders) |  | reasoned | test/ and _i18n/ are choices among the allowed locations |
| 49 | Stop gate: npm test must pass within 10 minutes | D | The script name, the runner and the time limit fit this project's small suite | another command, a longer limit, or no test run at stop |  | reasoned | A project cannot disable one plugin hook, so this needs a switch |
| 52 | LESSONS_MAX = 10 pending lessons before the gate asks for /retro | P | A tunable of the pipeline |  |  | reasoned |  |
| 297 | Stop gate: STATE.md and CHANGELOG.md were updated when code changed | P | Documentation in the same change is a pipeline invariant |  |  | reasoned |  |

## `scripts/lib/hook-utils.mjs`

C 1, A 1, P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 11 | NODE_BIN_DIRS = /opt/homebrew/opt/node@22/bin, /opt/homebrew/bin | A | Paths of this machine |  | yes | reasoned | The same prefix is repeated in every hook command of .claude/settings.json |
| 18 | HOOK_OUTPUT_MAX = 10,000 characters handed to the model whole | C | A probed behaviour of Claude Code, exact on one version | Claude Code version (probed on 2.1.322) |  | measured |  |
| 32 | repoRoot(): two levels above scripts/lib | P | Root resolution by the script's own location |  | yes | reasoned | Breaks in a plugin: the root must come from CLAUDE_PROJECT_DIR; watch-releases.mjs:23 and check-docs-fresh.mjs:14 have their own variants |

## `scripts/lib/feature-brief.mjs`

P 2

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 32 | BRIEF_ROLES: brief contents per agent type, groups backend, ui, verifier, docs | P | Role briefs are pipeline mechanics keyed by agent names |  | yes | reasoned | Agent names get the plugin prefix; a project without a UI has no ui group |
| 72 | Ratchet files test/context-budget.json and test/prompt-budget.json | P | The ratchet is pipeline mechanics, the pinned numbers were measured on this repository |  | yes | measured | The numbers belong to the plugin repository's own tests; a connected project has no such files |

## `scripts/lib/pipeline-metrics.mjs`

P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 58 | HOME_PHASE: agent type to /feature phase | P | Metrics mechanics keyed by agent names |  | yes | reasoned | Agent names get the plugin prefix |

## `scripts/lib/turn-budget.mjs`

P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 13 | AGENTS_DIR = .claude/agents: maxTurns is read from the agent frontmatter | P | Turn budget mechanics |  | yes | reasoned | Agent files move to the plugin folder; the lookup must use CLAUDE_PLUGIN_ROOT and the prefixed name |

## `scripts/lib/doc-shapes.mjs`

A 1, P 2

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 22 | PLAN_REQUIRED, CONTEXT_REQUIRED, STATE headings and the 4,096 byte budget | P | Document shapes |  |  | reasoned |  |
| 113 | Criteria phases 2 to 6 and CONTEXT readers All, Backend, UI | P | Assumes a backend phase and a UI phase in every feature |  |  | reasoned | A service-only CAP project has no UI phase; the phase list should follow the project profile |
| 301 | WIKI_RULE_AREAS = ACCESS, PRODUCTS, DETAILS, IMPORT | A | The business areas of this application, as a constant in code |  | yes | reasoned | Missed by the name search (upper case). Must become project configuration; gen-wiki.mjs:542 depends on the ACCESS area |

## `scripts/gen-wiki.mjs`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 75 | SWAGGER = http://localhost:4004/$api-docs; docs/api/*.openapi3.json | D | The OpenAPI and Swagger toolchain is this project's documentation choice (ADR-0029), pinned to @cap-js/openapi 1.6.0 | no generated API documentation |  | reasoned |  |

## `scripts/wiki.mjs`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 52 | MESSAGES = _i18n/messages.properties | D | _i18n at the root is one of the folder names CAP accepts, chosen here | i18n/ next to the models |  | reasoned | Read the folder from cds.env.i18n.folders |

## `scripts/gen-registry.mjs`

C 2, D 2

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 6 | import cds from '@sap/cds' (also wiki.mjs:320) | C | The only third-party import of the pipeline; resolves from the script's own location | CAP Node.js project with @sap/cds installed locally | yes | reasoned | From the plugin folder the bare import will not find the project's node_modules: resolve it from the project root (createRequire) |
| 208 | Titles are taken from the first service projection of an entity | D | Follows this project's rule that labels live on the projection (ADR-0004) | labels on the db entity |  | reasoned |  |
| 369 | Handlers: srv/**/*.js outside lib/, found by this.before\|on\|after( | D | Assumes JavaScript class handlers and srv/lib as the place of shared code | TypeScript, handlers registered another way, another shared folder |  | reasoned |  |
| 463 | UI artifacts: every app/<name>/webapp/manifest.json, webapp/ext, webapp/model/formatter.js | C | The Fiori tools project structure; already handles several apps | UI5 apps generated in the Fiori tools structure |  | reasoned |  |

## `scripts/hooks/protect-files.mjs`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 20 | REUSE_WATCH = srv/lib/**, app/**/webapp/ext/** | D | srv/lib as the home of reusable code is this project's convention | another folder for shared code |  | reasoned |  |

## `scripts/watch-releases.mjs`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 29 | NPM_PACKAGES, ATOM_FEEDS, UI5_JSON: the watched upstream list | D | Mixes the stack core with this project's tool choices (@cap-js/sqlite, wdio-ui5-service, ui5-test-runner, UI5 from the CDN) | derive the list from the project's package.json plus the plugin's own tools |  | reasoned |  |

## `scripts/hooks/session-start.mjs`

C 1, A 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 100 | Briefing title "# Test_CAP project context" | A | The repository name as a literal |  | yes | reasoned |  |
| 155 | Toolchain check: Node and global cds-dk against STACK.md; hint npm i -g @sap/cds-dk@10 | C | The check is general, the expected versions come from the project's STACK.md, the hint hardcodes 10 | cds-dk installed globally; versions from the project | yes | reasoned |  |

## `scripts/lib/backlog.mjs`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 22 | Backlog labels and the gh CLI | D | GitHub Issues as the backlog is this project's choice (ADR-0019) | Jira, GitLab, Azure Boards, a file |  | reasoned |  |

## `scripts/lib/i18n.mjs`

P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 11 | Pipeline texts in en with a ru bundle | P | Translatable pipeline output; ru is a shipped translation |  |  | reasoned |  |

## `.claude/settings.json`

F 1, C 1, P 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 11 | Hook commands: PATH="/opt/homebrew/..." node scripts/hooks/<name>.mjs with fixed timeouts | P | Hook wiring |  | yes | reasoned | The Homebrew PATH is this machine; paths become ${CLAUDE_PLUGIN_ROOT}/...; the 700 s Stop timeout follows the test limit |
| 2 | enabledPlugins: ui5@claude-plugins-official, cap-developer@cap | C | The pipeline uses skills of both plugins | both plugins available to the user | yes | reasoned | Becomes a declared plugin dependency or an install instruction |
| 183 | permissions.deny: Read(.env), Read(.env.*), Read(default-env.json) | F | default-env.json and .env hold bound service credentials in any CAP project |  |  | reasoned | A plugin cannot ship permissions; the install command writes them |

## `.mcp.json`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 1 | Four MCP servers with exactly pinned versions | D | Exact pins are this project's policy (ADR-0009) | version ranges; fewer servers | yes | reasoned |  |

## `.github/workflows/ci.yml`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 1 | CI on GitHub Actions: npm run lint, lint:js, format:check, npm test, check-docs-fresh, wiki audit, UI tests | D | GitHub Actions and these npm script names are this project's setup | GitLab CI, Jenkins, Azure Pipelines; other script names | yes | reasoned | FINDING: the workflows call node scripts/*.mjs; in a connected project those scripts are in the plugin, not in the repository, so CI needs another way to get them |

## `.github/workflows/upstream-check.yml`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 15 | Weekly cron runs watch-releases and opens an issue | D | Scheduling through GitHub Actions | another scheduler | yes | reasoned | A plugin cannot ship a schedule |

## `.github/workflows/wiki.yml`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 47 | The wiki mirror to the GitHub Wiki | D | The GitHub Wiki as the reading place | no mirror, another wiki | yes | reasoned |  |

## `package.json`

D 1

| Line | Statement | Group | Why | Condition or alternative | Reword | Checked | Note |
|---|---|---|---|---|---|---|---|
| 1 | npm scripts docs:registry, docs:api, docs:wiki, lint, lint:js, test point at scripts/ and at this project's tools | D | The gates call these script names | other script names | yes | reasoned | FINDING: plugin bin/ executables are on PATH only inside Claude Code, not in a developer terminal or CI |
