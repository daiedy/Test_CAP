# ADR-0033: Pipeline files name no application: placeholders, the registry as the source of names, project configuration for the rest

Date: 2026-11-20. Status: accepted (user, 2026-11-20, issue #65 `pipeline-plugin-repo`, step 4).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
The pipeline moves into a separate repository as a Claude Code plugin for SAP CAP and Fiori (issue #65). A file that moves must serve another project unchanged. The audit of step 1 (`docs/plugin-extraction/AUDIT.md`) found 133 statements that name this application, and the same names in code: the prompts and rules carried `CatalogService`, `app/products`, `/odata/v4/catalog` and `my.catalog` inside commands; `scripts/lib/doc-shapes.mjs` held this application's business areas as `WIKI_RULE_AREAS`; `scripts/lib/file-checks.mjs` matched `/products/webapp`; half of the templates were written on Products; the third section of a wiki decision page was called "What it means for the catalog". The step is done here, before the move, because the tests of the wiki and of the documentation toolchain run against this application.

## Decision
1. **No application name in a pipeline file.** The agents, skills, path rules, scripts, templates and the hook wiring name no service, service path, service file, namespace, application folder or FLP intent of the project, and not the repository. Where a command needs one, the file writes a placeholder: `<Service>`, `<service path>`, `<name>-service`, `<namespace>`, `<app>`, `<intent>`.
2. **The registry is the source of the names.** `docs/registry/SERVICES.md` states each service with its path and file. `docs/registry/UI-ARTIFACTS.md` states each application folder and now, per data source, the service it points at and its local metadata file, and in a new `Start` section the entry pages and the FLP intents (`scripts/gen-registry.mjs`; `webapp/appconfig/fioriSandboxConfig.json` joins the registry sources). The protocol says so in one sentence. There is no second profile of the project.
3. **What the project cannot state itself is project configuration.** `.claude/pipeline.json` in the project, read by `scripts/lib/project-config.mjs`, whose functions take the project root as an argument and never use their own location. The first key is `wiki.areas`, the business areas of a rule id; `ACCESS` is built in. A project without the file is valid. A broken file is reported by `projectConfigErrors()` and never fails a hook: `wikiRuleAreas()` falls back to the built-in area.
4. **One neutral example in the templates.** Every template uses the Orders example (`OrdersService`, `Orders`, namespaces `tpl.<name>`), which the CDS templates already had.
5. **Wiki texts.** The third section of a decision page is "What it means for the application"; the intros of the generated folder indexes say "the application". This amends ADR-0030 decisions 1 and 2.
6. **Ratchet.** `test/project-config.test.js` reads the names of this project from the registry and fails when an agent, skill, rule, script, template or settings file contains one. `CLAUDE.md`, `docs/` and `test/` are the project's own and may name it; `scripts/build-plan-page.py` builds this repository's plan page and stays here.

## Alternatives
| Option | Why rejected |
|---|---|
| A separate profile script that prints the names of the project | A second source for facts the registry already generates from the model and the manifests (invariant 3) |
| A hook that hands the names to every session and every agent | Costs context on every launch; the registry is read when a task needs it |
| The areas stay in code and each project edits the list | Plugin files are replaced on every update |
| The configuration as a key of `package.json` | Ties the pipeline to Node.js projects, and `.claude/` is already a protected path |
| The areas derived from the rule ids in use | A typing error opens a new area without a word, and a project has no area before its first rule |
| The step done in the new repository after the move | The tests of the wiki and of the documentation toolchain need an application to run against |

## Consequences
- Every prompt, rule and skill stayed at or below its recorded size (`test/prompt-budget.json`); the ratchet was not raised.
- A project that needs business areas for its rule ids adds one line to `.claude/pipeline.json`. The switches of the later steps of #65 (languages, test command, tracker) go into the same file.
- An application with several services or apps reads the registry the same way; nothing in the pipeline files assumes one.
- Not covered by this decision: the choices of this project that carry no name (289 statements of the audit), the examples and application decisions cited in `PATTERNS.md`, and the pipeline tests that run against this application (`test/api-docs.test.js`, `test/wiki.test.js`), which need a sample project in the plugin repository.
- `PATTERNS.md` gets the row "Name of the application in a pipeline file"; the `docs-wiki` rule names the configuration instead of the list of areas.

## Sources
- Issue #65, steps 1 and 4.
- `docs/plugin-extraction/AUDIT.md`, sections "What stays in Test_CAP" and "Findings beyond the classification"; `docs/plugin-extraction/SPIKE.md`.
