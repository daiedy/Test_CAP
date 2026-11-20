# Pipeline plugin extraction

Working record of issue #65 `pipeline-plugin-repo`: moving the agentic pipeline out of this repository into a Claude Code plugin for SAP CAP and Fiori. The issue is done by hand, without `/spec` and `/feature`; this folder holds what its steps produced. It moves to the plugin repository when that exists.

| File | Step of the issue | Content |
|---|---|---|
| `AUDIT.md` | 1 | Every rule statement classified: stack fact, fact under a condition, project choice, application detail, pipeline mechanic. Figures, themes, findings, limits |
| `audit/*.md` | 1 | The ledgers: one row per statement with the reason |
| `KNOWLEDGE.md` | 2 | Where each ADR and each pattern row goes |
| `SPIKE.md` | 3 | What a trial plugin showed about the points the documentation leaves open |

## Status on 2026-11-20

| Step | State |
|---|---|
| 1. Semantic audit | Done, with the limits named in `AUDIT.md` |
| 2. Sort the knowledge | Done at the level of whole ADRs and pattern rows; the rewrite of the rows is part of step 4 |
| 3. Trial plugin | Done; three points left open in `SPIKE.md` |
| 4. Remove the application names | Done in this repository on the branch `chore/pipeline-app-neutral` (ADR-0033): placeholders in the agents, skills and rules, names from `docs/registry`, `.claude/pipeline.json` for the wiki rule areas, templates on the Orders example, a ratchet test |
| 5. Create the repository | Not started; decided: private during the extraction, public from the first working version, Apache-2.0 after the rights check. Name decided on 2026-11-20: `capline` for the repository and the plugin. Waits for the decision on the git history |
| 6 to 10 | Not started |

Decided with the user on 2026-11-20: the first version keeps this project's defaults and opens three switches (languages, test command, tracker), with a warning where a project differs; CI gets the pipeline scripts by a checkout of the plugin repository at a tag (`AUDIT.md`, finding 1).

Left by step 4 for the later steps:

- The 289 choices of this project that carry no name stay as they are until the switches of step 6.
- `test/api-docs.test.js` and `test/wiki.test.js` run against this application; the plugin repository needs a sample CAP project for them.
- `CLAUDE.md`, `docs/architecture/` and the examples of `PATTERNS.md` are the project's own files and still name the application; the base catalogue is separated from them when the knowledge is rewritten.
