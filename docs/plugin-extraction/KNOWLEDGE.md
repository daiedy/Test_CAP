# Sorting the knowledge: ADRs and the pattern catalogue

Step 2 of issue #65. It answers where each decision record and each pattern row goes when the pipeline moves into the plugin. The statement-level classification is in `AUDIT.md`.

## ADRs

Sorted by the title, the status and the head of the Decision section of each file in `docs/decisions/` (2026-11-19). 32 records, the template `ADR-0000` not counted.

### Pipeline decisions: 12, move to the plugin repository as its own records

| ADR | Subject | What to change on the way |
|---|---|---|
| 0009 | MCP-first protocol, pinned tool versions | The server list and the versions are this project's set; the protocol is general |
| 0014 | MCP audit with a written reason | Tool names follow the plugin's MCP naming |
| 0016 | Shell writes gated by the git state | none |
| 0017 | Generated files sanctioned by content | none |
| 0018 | Context budget by structure | The pinned byte sizes are this repository's |
| 0019 | Backlog in GitHub Issues | The tracker is a default, not a requirement |
| 0022 | Pipeline metrics | none |
| 0023 | Pipeline state hygiene | none |
| 0029 | Documentation toolchain (doc comments, OpenAPI, JSDoc page) | A default the project can switch off; `@cap-js/openapi` is pinned for a draft-service bug |
| 0030 | Business-rules wiki | The rule areas `ACCESS`, `PRODUCTS`, `DETAILS`, `IMPORT` are this application's and become project configuration |
| 0031 | Context hygiene (role briefs, read gate, relays) | Agent names get the plugin prefix |
| 0032 | Turn budget hook | `maxTurns` is read from the plugin's agent files |

### Stack decisions: 15

Nine are platform and style choices of this project. In the plugin each becomes a default the project can replace; an existing project keeps what it already has.

| ADR | Choice | Legitimate alternative |
|---|---|---|
| 0001 | Node.js 22, cds 10, SQLite | Another supported cds major, HANA or PostgreSQL |
| 0002 | Vitest with `@cap-js/cds-test`, `$metadata` snapshot as the contract | Jest or Mocha; no snapshot contract |
| 0003 | `cuid, managed` on every entity, CodeList instead of enum | Own keys, enum types |
| 0004 | Semantic annotations in `srv/annotations/`, UI annotations in `app/<app>/annotations/` | One annotations file per app; annotations beside the service |
| 0005 | JavaScript for UI5, ESM for the backend, no TypeScript | TypeScript |
| 0006 | SAPUI5 from the CDN without a pinned version, `minUI5Version` 1.136.0 | A pinned or a local UI5 version |
| 0007 | Fiori Elements V4 by default; app and manifest only through Fiori MCP | Freestyle by default; hand-maintained manifest |
| 0008 | `@sap-ux/ui5-middleware-fe-mockserver` for mock mode | No mock mode |
| 0010 | Upper-case stable codes for own code lists | Another code scheme |

Six are recipes: how one recurring task is solved on this stack, with framework behaviour measured along the way. They are the core of the plugin's base catalogue; the application's names leave the text.

| ADR | Recipe | Holds when |
|---|---|---|
| 0011 | Value help for an association to a CodeList | Fiori Elements V4 |
| 0015 | Draft and lock marker in the list row through `@Common.SemanticKey` | Drafts, Fiori Elements V4 |
| 0020 | Custom filter field in the filter bar | Fiori Elements V4; `fiori-mcp` 1.12.2 has no functionality for it |
| 0024 | Dependent value help between code lists, consistency as an `@assert` expression | Fiori Elements V4, cds 10 |
| 0025 | Field editable only when another field is filled (`Common.FieldControl`) | Fiori Elements V4 |
| 0028 | Validation toolkit (custom texts, uniqueness, two-target constraints, conditional requirement) | cds 10, drafts for the uniqueness part |

### Application decisions: 5, stay in Test_CAP

| ADR | Subject | Worth extracting before it stays behind |
|---|---|---|
| 0012 | Products edited through drafts | The measured draft behaviour that `PATTERNS.md` and the test rules cite |
| 0013 | Roles `CatalogViewer` and `CatalogEditor` | The measured behaviour of `@requires` and `@restrict` with mocked users |
| 0021 | Import of products from an Excel workbook | The transport shape: a bound action with a `LargeBinary` parameter |
| 0026 | Product details as a composition | The measured authorization of a composition child |
| 0027 | Typed product details as a generated form | none; the form is this application's |

The facts in the right column are framework behaviour found while building this application. They move into the base catalogue as rows of their own, so the plugin does not cite an application record.

## Pattern catalogue

`docs/architecture/PATTERNS.md` has 77 task rows. Classified in the audit (`audit/arch.md`), each row by the larger part of its Way column; the Example column points at this application's files and stays behind in every case.

| Section | Rows | Default (`D`) | Fact under a condition (`C`) | Fact (`F`) | Pipeline (`P`) | Application (`A`) |
|---|---|---|---|---|---|---|
| Data model | 9 | 6 | 2 | 1 | 0 | 0 |
| Service and logic | 24 | 14 | 8 | 1 | 0 | 1 |
| UI Fiori Elements | 14 | 8 | 6 | 0 | 0 | 0 |
| UI freestyle UI5 | 4 | 1 | 1 | 0 | 2 | 0 |
| Tests | 5 | 4 | 1 | 0 | 0 | 0 |
| Infrastructure | 21 | 9 | 0 | 0 | 11 | 1 |
| All | 77 | 42 | 18 | 2 | 13 | 2 |

What follows for the base catalogue of the plugin:

- **It is a catalogue of recommended ways, not of facts.** 42 of the 64 rows about the stack are choices. On a new project they are the starting ways. On an existing project the install walks the rows, finds the project's own way for each task, and the user decides which one wins; the decision is stored in the project.
- **The facts sit inside the rows.** Most `D` rows carry measured framework behaviour in the same cell (the note column of the ledger names it). When a row is rewritten, the fact and the choice are separated, so a project that replaces the choice keeps the fact.
- **Rows to split first**, each holding ten or more statements across groups: "Cross-field consistency check" (line 27), "Role-aware UI visibility" (35), "Bulk create from a file" (39), "Drafts" (45), "Custom section or column" (61).
- **Rows close to this application**, written in its entities and to be rephrased or dropped: "Typed attribute values" (15), "Rule between two child rows" (29), "Rows generated from an assignment on a draft" (32).
- **Rows that stay here:** "Dependent field as a control plus guard" (30), "Deployment" (99).
- **The 13 pipeline rows** (metrics, briefs, gates, relays, the turn note, wiki lookup) move as they are.

`CONVENTIONS.md` (57 statements: 45 defaults, 9 pipeline, 1 conditional fact, 1 fact, 1 application) is almost entirely this project's naming, layout and style: in the plugin it is the default convention set of a new project and a checklist to compare an existing project against. `TESTING.md` (47 statements: 28 conditional facts, 10 defaults, 8 pipeline, 1 application) is the opposite: mostly behaviour of the test tools, valid wherever the same tools are used.
