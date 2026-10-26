# business-rules-wiki: the LLM wiki pattern, selective loading and the backfill inventory

Date: 2026-10-26. Author: `architect`. Read by `architect` and `reviewer`; plan steps 2 and 3 name this file for the inventory (section 3) and the lookup design (section 4). Sources: issue #28 (chat research of 2026-10-14), the repository as measured in this session. No SAP artefact is involved, so no MCP query applies except the one on `@assert` in section 3.

## 1. The pattern (from the issue's research, condensed)

- Karpathy's "LLM wiki": immutable sources, LLM-maintained pages, an index read first, an append-only log, a lint for contradictions and orphans; works at hundreds of pages without embeddings.
- Practitioners report that autonomous page generation produces noise. So a human sets the focus, and each page is "compiled truth": a rewritten summary above, an append-only timeline below.
- Applied here: the sources are the code, the ADRs and the feature `SUMMARY.md` files (immutable: pruned features keep a permalink); the pages are written by `docs-keeper` from those sources, never generated; the index and the graph are generated from the pages; the lint is `check-docs-fresh.mjs` (links, orphans, duplicates, shape, Cyrillic) plus `wiki.mjs audit` (pages stale against their code, uncovered message keys and constrained elements).

## 2. Selective loading that exists today (so the wiki adds one mechanism, not a parallel one)

| Mechanism | Scope | Loaded when | Wiki relation |
|---|---|---|---|
| `.claude/rules/*.md` (11 files) | per path pattern | an agent reads or edits a matching file | the wiki gets one more path rule for `docs/wiki/**` (page shape, commands); the rules carry how-to-code, not business rules |
| Skills (12) | per command | invoked | `/gen-docs` and `/test-all` gain the wiki commands |
| Agent memory `MEMORY.md` index | per agent | agent start | per-agent experience, stays; a page index is not a memory |
| `docs/registry/*.md` (generated) | what exists in code | protocol step 3 | the registry answers "what exists"; a rule page answers "what the rule is, why, what the user sees"; the wiki links the registry, never copies tables |
| `mcp__cds-mcp__search_model` | one definition | protocol step 3 | model facts; the `domain/` page links the element table of `DOMAIN-MODEL.md` |
| `docs/architecture/PATTERNS.md` (34,389 bytes) | how to implement a kind of task | architect, developers | a rule page names the pattern row by its title; no copy |
| `docs/CHANGELOG.md` (193,789 bytes), feature `SUMMARY.md` (14 files, 116,957 bytes), ADRs (30 files, 261,168 bytes) | history | reviewer, docs-keeper, architect | the sources of the backfill; a page's History table points at them |

There are no wikilinks, backlinks or a link index in `docs/` today (grep of `[[` and `graph` under `docs/`: none relevant).

## 3. Backfill inventory (measured 2026-10-26)

| Source | Count | Where it goes |
|---|---|---|
| Features finished and pruned to `SUMMARY.md` | 14 (`catalog-authorization`, `catalog-hygiene`, `categories-code-list`, `docs-toolchain`, `pipeline-metrics`, `pipeline-state-hygiene`, `products-details-section`, `products-draft-edit`, `products-draft-marker`, `products-excel-upload`, `products-rating-column`, `products-rating-filter`, `products-subcategories`, `products-subcategory-cascade`); the issue said 13 before `docs-toolchain` closed | History rows and `sources` of rule pages; how-to pages |
| ADRs | 29 accepted (0001-0029) plus the template 0000; ADR-0030 is this feature's | 14 product-shaping digests (0003, 0010, 0011, 0012, 0013, 0015, 0020, 0021, 0024, 0025, 0026, 0027, 0028, 0029) and one list page for the 16 pipeline ADRs (0001, 0002, 0004-0009, 0014, 0016-0019, 0022, 0023, 0030) |
| Approved but unimplemented rule catalogue, `docs/features/products-validations/CONTEXT.md` (#10) | R1-R6, R8, R10-R13 approved (11); R7 not included; R9, R14 rejected | 11 rule pages with `status: planned`; the three rejected ones as rows of the ADR-0028 digest |
| `@assert: (case ...)` constraints in `srv/annotations/*.cds` | 6 elements (`Products.subcategory`, `ProductDetails.attribute`, `textValue`, `numberValue`, `listValue`, `ProductDetailSelections.value`) carrying 9 message keys | rule pages BR-PRODUCTS and BR-DETAILS |
| `@assert.range` | 3 (`price`, `stock`, `rating`) | one rule page |
| `@assert.target` | 6 (`currency`, `category`, `subcategory`, `attribute`, `listValue`, `value`) | one rule page per entity area |
| `@mandatory` | 8 (`Products` name, price, currency, stock, category, subcategory; `ProductDetails.attribute`; `ProductDetailSelections.value`) | one rule page per entity area |
| `@assert.unique.pair` in `db/schema.cds` | 1 (`SubcategoryAttributes`) | the `domain/` page of the assignment |
| Message keys in `_i18n/messages.properties`, each with a `#XMSG` comment | 21 (12 `PRODUCTS_IMPORT_*`, 9 constraint and handler keys) | `messages` of rule pages; the coverage audit requires every key to be referenced |
| `//` developer notes in `srv/annotations/*.cds` | 21 lines | background for the "Why" sections; not copied |
| Handlers (`docs/registry/HANDLERS.md`) | 4 registrations: `before PATCH Products.drafts` (`resetStaleSubcategory`, `reconcileDetailRows`), `on READ Permissions`, `on importProducts`, `after EDIT Products` (`fillDetailRows`) | rule pages for the dependent reset, the generated rows, the import, the role-aware UI |
| Entities (`mcp__cds-mcp__search_model`, `DOMAIN-MODEL.md`) | 9 project entities: `Products`, `Categories`, `Subcategories`, `ProductDetails`, `ProductDetailSelections`, `DetailAttributes`, `DetailListValues`, `DetailValueTypes`, `SubcategoryAttributes`; plus SAP's `Currencies` and the `Permissions` singleton | 9 `domain/` pages; Currencies and Permissions are paragraphs of the Products and access pages |

Fact for the generator and the audit (`npx cds compile srv --to json`, `mcp__cds-mcp__search_docs` "Expressions as annotation values", 2026-10-26): a bare `@assert` constraint lands in the compiled CSN as the key `"@assert"` with an `xpr` array (`["case", "when", {"ref": [...]}, ...]`); `annots()` in `scripts/gen-registry.mjs` prints only keys that start with `@assert.`, so the 6 constraints are invisible in `DOMAIN-MODEL.md` today. The audit reads them from `cds.load('*')` by the key `@assert` and the `@assert.*`, `@mandatory` keys; the registry change itself is out of scope here (a `gen-registry.mjs` follow-up noted in the plan risks).

Planned page count after the backfill (phase 3 figure, counted at the gate): 22 active rules (3 ACCESS, 8 PRODUCTS, 6 DETAILS, 5 IMPORT), 11 planned rules, 9 domain, 15 decisions, 7 how-to, Home, Glossary and the footer: 67 hand-written pages; generated: 5 folder indexes, `_Sidebar.md`, `api/Catalog-service-API.md`, `graph.json`. At about 1.2 KB per page the wiki weighs about 80 KB.

Candidate active rule pages (ids are tentative, `docs-keeper` assigns them in order of writing with `node scripts/wiki.mjs next-id <AREA>`):

| Area | Rule | Source |
|---|---|---|
| ACCESS | Only signed-in users reach the catalog (401 on every request including `$metadata`) | ADR-0013 |
| ACCESS | Viewers read, editors change; the UI hides Create, Edit, Delete and Import for a viewer | ADR-0013, `Permissions` singleton |
| ACCESS | Code lists are readable by every signed-in user | ADR-0013 |
| PRODUCTS | A product is created and changed through a draft; a draft locks the product for other users and is marked in the list | ADR-0012, ADR-0015 |
| PRODUCTS | Required fields: name, price, currency, stock, category, subcategory | `@mandatory` |
| PRODUCTS | Price, stock and rating stay within their bounds | `@assert.range` |
| PRODUCTS | Category, subcategory and currency must exist | `@assert.target` |
| PRODUCTS | The subcategory belongs to the product's category | `PRODUCTS_SUBCATEGORY_MISMATCH`, ADR-0024 |
| PRODUCTS | Subcategory is disabled until a category is chosen | ADR-0025 `Common.FieldControl` |
| PRODUCTS | Changing the category clears a subcategory that no longer fits | `resetStaleSubcategory`, ADR-0024 decision 3 |
| PRODUCTS | A subcategory change must not leave detail rows of unassigned attributes | `PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS`, ADR-0026 |
| DETAILS | A product's detail rows follow the attributes of its subcategory; removed filled values are announced | `reconcileDetailRows`, `fillDetailRows`, `PRODUCTS_DETAILS_VALUES_REMOVED`, ADR-0027 |
| DETAILS | Each attribute appears once and must be assigned to the subcategory | `PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED`, `_DUPLICATE` |
| DETAILS | A value matches the attribute's value type | `PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH` |
| DETAILS | A number stays within the attribute's bounds and is whole for INTEGER | `_OUT_OF_RANGE`, `_NOT_INTEGER` |
| DETAILS | A list value belongs to the attribute's list; a multi-list value is selected once | `_NOT_IN_LIST`, `PRODUCTS_DETAIL_SELECTION_DUPLICATE` |
| DETAILS | Details are written only through the product's draft | ADR-0026 (422 on a top-level write) |
| IMPORT | The import is all-or-nothing with one message per bad row | ADR-0021 |
| IMPORT | Workbook limits: `.xlsx` only, at most 1,000 rows, 10 MB unpacked | `PRODUCTS_IMPORT_NOT_XLSX`, `_TOO_MANY_ROWS`, `_TOO_LARGE`, `_EMPTY` |
| IMPORT | Workbook columns: the documented set, the mandatory ones, no unknown or duplicate header | `_UNKNOWN_COLUMN`, `_DUPLICATE_COLUMN`, `_MISSING_COLUMN` |
| IMPORT | A product name that already exists is refused | `PRODUCTS_IMPORT_DUPLICATE_NAME` |
| IMPORT | Imported rows obey the product rules row by row | `PRODUCTS_IMPORT_ROW_INVALID`, `subcategoryMismatches` |

## 4. Lookup design and token estimates

Estimates use 4 characters per token; they are estimates, not measurements, and the plan records the measured sizes at the phase 3 gate.

| Load | Bytes | Tokens | When |
|---|---|---|---|
| One rule page | about 1,200 | about 300 | after a lookup names it |
| `node scripts/wiki.mjs for-path srv/annotations/Products.cds` output (about 10 one-line hits) | about 1,000 | about 250 | protocol step 3 before an edit |
| `graph.json` (67 nodes, edges) | about 30,000 | about 7,500 | read by the CLI, never by an agent |
| The whole wiki | about 80,000 | about 20,000 | never loaded whole |
| `PATTERNS.md` today | 34,389 | about 8,600 | architect, developers |
| CHANGELOG top section | varies | thousands | docs-keeper, reviewer |

So a lookup plus two pages costs about 850 tokens against the 8,600 of `PATTERNS.md`; the point of the graph is that the agent never reads the index whole either: the CLI does.

Lookup commands (`scripts/wiki.mjs`, reads `graph.json` and the pages, no model compile except `audit`):

| Command | Answers | Output |
|---|---|---|
| `find <words...>` | pages whose id, aliases, title, summary, tags or message keys contain every word (case-insensitive) | one line per page: path, id, status, summary |
| `related <page>` | outgoing links, backlinks, pages sharing a `code` path, pages sharing a tag | grouped lines |
| `for-path <repo path>` | pages whose `code` entries match the path (exact or glob through `isUnder` of `scripts/lib/hook-utils.mjs`) | one line per page |
| `next-id <AREA>` | the next free `BR-<AREA>-NNN` | the id |
| `confirm <page...>` or `--all` | rewrites `verified` with the current hash of the page's `code` files | the pages re-stamped |
| `audit` | pages whose `verified` differs from the current hash of their `code` files, pages with `code` but no `verified`, message keys of `_i18n/messages.properties` not in any rule page's `messages`, elements of `CatalogService.*` projections carrying `@mandatory`, `@assert` or `@assert.*` not in any rule page's `elements` | exit 1 with one line per finding; exit 0 and `wiki audit: clean` otherwise |
| `export <dir>` | the mirror copy without frontmatter (the keys rendered as a small table under the H1), only if step 0 measured raw frontmatter on the wiki | the written files |

## 5. Rejected mechanisms

| Option | Why rejected |
|---|---|
| One `docs/BUSINESS-RULES.md` | the user's request: one file cannot hold many rules with their history; it would grow like `PATTERNS.md` and be read whole |
| GitHub Wiki as the source of truth | edits bypass pull requests, hooks, review and the English gate; the repository folder is the only place the pipeline can lint and the agents can read offline |
| `[[wikilinks]]` | render only in the wiki, not in the repository view; a second link resolver (section 5 of `wiki-mechanics.md`) |
| Generated page bodies (rule text from `@assert` expressions, digest text from ADR sections) | the practitioners' noise finding; a generated body cannot say why or what the user sees; generators here produce indexes, the graph, the sidebar and the API page only |
| Graph databases (Graphiti, Neo4j) | not human-readable, a service to run, oversized for under a hundred pages; the issue excludes them |
| `qmd` (local BM25 plus vectors with an MCP server) now | a dependency and an index to maintain for a wiki of under a hundred pages, where `find` on frontmatter is enough; the step-up when the pages reach the hundreds (issue scope hint) |
| A bilingual wiki (`en` and `ru` pages) | two bodies drift; the user asked for one language |
| `_index.md` per folder (the issue's name) | five files with one basename collide in the flat wiki namespace (`wiki-mechanics.md` section 1) |
| The stale-page check in the Stop gate | the Stop gate fires at every phase gate of `/feature`; a code change in phase 2 would block every stop until `docs-keeper` runs in phase 6; CI, `/test-all` and the phase 6 gate catch it before a merge, and a Stop advisory can be added later through `stop-gate.mjs` (protected) |
| The coverage audit inside `npm test` | the same timing problem: a new `@assert` in phase 2 would turn `npm test` red until the rule page exists; `audit` runs where the stale check runs |
| Rule pages inside `docs/architecture/PATTERNS.md` rows | PATTERNS tells an agent how to implement a kind of task; a rule page tells a person what the rule is and why; the two link each other |
| Generated wiki files under `docs/registry/` (protected, ADR-0017) | the hand-written pages cannot live there, and splitting generated files from their pages breaks relative links in the wiki |
| A date in the generated header (registry style) | makes `npm run docs:wiki` non-idempotent and a byte-comparison test impossible; the `sources:` hash is enough for `recordedHash()` |
