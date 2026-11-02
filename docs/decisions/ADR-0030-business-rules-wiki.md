# ADR-0030: Business-rules wiki: `docs/wiki/` as the source of truth, a generated link graph with lookup commands, a one-way mirror to the GitHub Wiki

Date: 2026-10-26. Status: accepted (user, 2026-10-26, feature `business-rules-wiki`).
<!-- On acceptance replace the whole Status sentence with the accepted form; never append to the proposed one. -->

## Context
Issue #28 asks for a wiki of small, human-readable pages that holds every business decision and business rule of the Product Catalog with its change history, readable by any person without the AI, mirrored to the GitHub Wiki, and loaded by the agents page by page through a link graph instead of whole documents. Today the business rules live in six places that no person reads together: `@assert`, `@assert.*` and `@mandatory` annotations in `srv/annotations/*.cds` (6 constraints, 3 ranges, 6 target checks, 8 mandatory elements), `#XMSG` comments on 21 message keys, `//` developer notes (21 lines), the rule catalogue of the approved #10 spec (11 rules), 29 ADRs (261 KB) and 14 pruned feature summaries (117 KB); the 6 `@assert` constraints are even absent from the generated registry (`annots()` prints `@assert.` keys only). The pipeline's selective loading (path rules, skills, registry, `search_model`) has no link index and no backlinks in `docs/`. `PATTERNS.md` has no row for a wiki, a link graph, a lookup before an edit or a GitHub Wiki mirror, so invariant 4 requires this ADR. Facts: `docs/features/business-rules-wiki/research/wiki-mechanics.md` (the wiki is enabled, its git repository does not exist yet, pages are served flat by basename, the page title is derived from the file name, the action `Andrew-Chen-Wang/github-wiki-action` v5.0.6 rewrites relative links) and `research/llm-wiki-pattern.md` (the pattern, the inventory, the lookup design, rejected mechanisms).

## Decision
1. **Source of truth and shape.** The wiki is the folder `docs/wiki/` with the hierarchy `Home.md`, `_Footer.md`, `Glossary.md`, `domain/`, `rules/`, `how-to/`, `decisions/`, `api/`. Every hand-written page is Markdown with a YAML frontmatter (`title`, `summary` as one sentence, `tags`; `code` as repository paths or globs on `domain/`, `rules/` and `how-to/` pages; `verified` as the 16-hex hash of the `code` files at the last confirmation; rules add `id`, `status`, `since`, `messages`, `elements`, `sources` and optional `aliases`; decisions add `adr` and `sources`), an H1 and the sections of its folder (rules: Rule, Why, Where it fires, History; domain: What it is, Fields that matter, Rules, Related; how-to: Goal, Steps, Rules that apply; decisions: Decision, Why, What it means for the catalog, Source). One topic per page; the body is "compiled truth": the summary and sections are rewritten to the current state, the History table is append-only (date, change, source link). English only (invariant 10 holds; `docs/wiki/**` stays in the Cyrillic scope of the hooks and `/test-all`). Pages are written by `docs-keeper` from the code, the ADRs and the feature summaries; a generator never writes a page body. The file name is the human title in sentence case with dashes (`Subcategory-belongs-to-the-category.md`), because the GitHub Wiki derives the page title from the file name and serves pages flat by basename; basenames are unique across folders, case-insensitive.
2. **Rule identity.** A business rule has the id `BR-<AREA>-NNN` with `AREA` in `ACCESS`, `PRODUCTS`, `DETAILS`, `IMPORT` (a new area is a one-word addition to the list in the path rule) and a three-digit number that is never reused (`node scripts/wiki.mjs next-id <AREA>`). `status` is `planned` (approved in a spec, not in code), `active` or `retired` (the page stays, the History says why). Feature-local numbers such as the R1-R14 of #10 are `aliases` and a History row; the machine joins are `messages` (keys of `_i18n/messages.properties`) and `elements` (`<Entity>.<element>` of the service projections). A rule that is a control rather than a validation (a disabled field, a dropdown) is a rule page too, with its preventing control in "Where it fires".
3. **Decisions digest.** `decisions/` holds one plain-language page per product-shaping ADR (what was decided, why, what it means for a user of the catalog, a link to the ADR) and one list page for the pipeline ADRs. A digest never repeats the ADR's Alternatives or Consequences; the reviewer rejects a digest that paraphrases more than the Decision paragraph.
4. **Generated files and freshness, one mechanism.** `scripts/gen-wiki.mjs` writes the folder index pages (`domain/Domain-model.md`, `rules/Business-rules.md`, `how-to/How-to.md`, `decisions/Decisions.md`, `api/API.md`), `_Sidebar.md`, `api/Catalog-service-API.md` (from `docs/api/*.openapi3.json`: server URL, authentication, entity sets with their operations and descriptions, actions; links to the domain pages, the committed OpenAPI document, `DOMAIN-MODEL.md` and the development Swagger UI) and `graph.json` (nodes: every page with its frontmatter and the current `code` hash; edges: `link` between pages; backlinks and relatedness are derived by the CLI). Generated Markdown carries the first-line header `<!-- generated by scripts/gen-wiki.mjs | sources: <hash> | do not edit -->` and `graph.json` a top-level `x-sources`, where the hash covers the hand-written pages and the OpenAPI documents (no date, so a second run is byte-identical). `npm run docs:wiki` runs the generator alone; `npm run docs:registry` runs it after the OpenAPI export (the API page depends on it); `node scripts/check-docs-fresh.mjs` adds `wikiStatus(root)`: a missing or stale generated file (fixed by `--fix` through `gen-registry.mjs`) and the lint findings a generator cannot fix: broken relative links, orphans (a hand-written page no other hand-written page links to; `Home.md` counts, indexes and the sidebar do not), duplicate basenames, frontmatter and section shape errors, Cyrillic. The Stop gate, CI "Registry freshness" and `/gen-docs` cover it without a change to the hook. `test/wiki.test.js` byte-compares the committed generated files with a fresh run.
5. **Lookup before an edit.** `scripts/wiki.mjs` answers `find`, `related`, `for-path`, `next-id`, `confirm`, `audit` (and `export`, decision 7). The protocol (section 2 step 3) tells every agent that edits a file under `db/`, `srv/`, `app/` or `_i18n/` to run `node scripts/wiki.mjs for-path <file>` first and read the pages it lists, never the wiki whole; the report form (section 8) gains the section `## Rules touched` (one line per rule id, `new` for a new rule, omitted when no business rule changed). A path rule `.claude/rules/docs-wiki.md` loads on any read or edit under `docs/wiki/**` and carries the page shape, the id scheme, the link syntax and the commands.
6. **Staleness and coverage are audited where a merge is decided.** `node scripts/wiki.mjs audit` exits 1 when a page's `verified` hash differs from the current hash of its `code` files, when a page has `code` but no `verified`, when a message key of `_i18n/messages.properties` is in no rule page's `messages`, or when an element of a `CatalogService.*` projection carrying `@mandatory`, `@assert` or `@assert.*` is in no rule page's `elements`. It runs in the CI backend job, in `/test-all` and at the `/feature` phase 6 gate, where `docs-keeper` updates the pages the changed files map to (`for-path`), appends the History rows, writes the digest of a new ADR, runs `npm run docs:wiki` and `confirm`. It does not run in the Stop gate and not inside `npm test`: both fire at every phase gate, and a code change in phase 2 must not block every stop until phase 6 (`research/llm-wiki-pattern.md` section 5). The edit-time hook only checks the page shape (`wikiPageShapeErrors` in `scripts/lib/doc-shapes.mjs`, dispatched by `checkDocShapes` of `scripts/lib/file-checks.mjs` for `docs/wiki/**/*.md`).
7. **One-way mirror.** `.github/workflows/wiki.yml` runs on a push to `main` that touches `docs/wiki/**` and on `workflow_dispatch`, with `permissions: contents: write`, `actions/checkout` and `Andrew-Chen-Wang/github-wiki-action` pinned by commit (`1bbb4280446f9630e8e21a18012cbacf3b0f992e`, v5.0.6; Dependabot's `github-actions` ecosystem bumps it), `path: docs/wiki`, `strategy: init` (the wiki equals the folder after every run; a page made or edited in the wiki UI disappears at the next sync, which is the read-only guarantee), `ignore: graph.json`, `preprocess` on (relative page links become bare page links, repository links become `blob/` URLs). `_Footer.md` says on every page that the wiki is a read-only mirror and names the folder to edit. The first wiki page is created by the user in the web UI (GitHub creates the `.wiki.git` repository on it) and doubles as the frontmatter rendering probe: if the wiki renders the YAML block raw, the job runs `node scripts/wiki.mjs export .wiki-out` first and mirrors that folder (the keys rendered as a small table under the H1); if it renders a table, the folder is mirrored as is.
8. **Backfill in one feature.** The first iteration writes every rule in code today (about 22), the 11 approved #10 rules as `planned`, 9 domain pages, 14 product-shaping ADR digests and the pipeline list, 7 how-to pages, Home, Glossary and the footer; `audit` is clean at the end of the backfill, so every message key and every constrained element has its page from day one.

First application: feature `business-rules-wiki` (#28).

## Amendment: the export writes wiki-ready links, the mirror is flat, `preprocess` off (user decision 2026-10-27, accepted by the user 2026-10-27, phase 4, PLAN step 4)
Step 4 wrote `.github/workflows/wiki.yml` and found that decision 7 rests on a wrong reading of the pinned action. The orchestrator measured this with `gh api` on 2026-10-27, and the architect re-read the source at both refs the same day:
- **v5.0.6 rewrites little.** The pin is `1bbb428` (v5.0.6, released 2026-07-11, still the latest release on 2026-10-27). Its `preprocess` (`cli.ts` lines 93-130) does three things:
  - It renames a top-level `README.md` to `Home.md`.
  - For each Markdown file at the top level of the copied folder (`readdir`, not recursive), it strips `.md` from every relative link that stays inside the folder, and the path stays. A target that resolves above the folder (`../`) is left as written.
  - It writes each such file back through `remark` 14 without a GFM plugin (`remark().process(md).toString()`).

  Pages in subfolders are copied as they are, and no link becomes a `blob/` or `raw/` URL. The README at the ref says the same: preprocess "move[s] the `README.md` to `Home.md` as well as rewriting all `.md` links to be bare links".
- **The rewriting decision 7 quotes is unreleased.** `master` is 8 untagged commits ahead of v5.0.6 and none behind; its head is `93c86ef`. Two of those commits add the rewriting:
  - `e70259f` "Add repo-file blob links (#78)";
  - `93c86ef` "Preprocess subdirectory pages, images, and reference definitions".

  With them, cross-folder page links become bare page names, repository files become `blob/` URLs of `GITHUB_SHA`, and images become `raw/` URLs. `research/wiki-mechanics.md` section 2 had quoted the `master` README as the behaviour of the pin.
- **The current export would break on the wiki.** Measured with `mapLinkTargets` and `resolveLink` over an export of `docs/wiki` at `d26bd5a` into a temp folder. The export holds 74 Markdown files: 4 at the top level and 70 in five subfolders.
  - The 70 subfolder files hold 441 page links and 222 repository links: 219 in hand-written pages (118 in the bodies, 101 from the `sources` rows of the key tables) and 3 in the generated API page. v5.0.6 would mirror all of them unchanged: the page links as `.md` file paths, the repository links as `../` paths outside the wiki repository.
  - The 91 page links of the 4 top-level files would become `rules/Business-rules` style paths. These likely 404 because the wiki serves pages flat by basename; that rests on the action's `master` notes and was not measured here.
  - The export holds no anchor, image, folder or reference-style link today.
- **Upstream measured the target form.** `tests/e2e.test.ts` on `master` pushes a wiki and reads the rendered HTML. Gollum renders a relative page link as an href `wiki/./<page>`, which the browser resolves against `https://github.com/<repo>/wiki` (measured on `./another-page`). A `blob/<GITHUB_SHA>/<path>` link opens the blob view of that commit.

Decisions 1-8 stay as written. A-F replace the link clause of decision 7.
- That clause, "`preprocess` on (relative page links become bare page links, repository links become `blob/` URLs)", now reads "`preprocess: false`; `node scripts/wiki.mjs export .wiki-out` writes the final links (amendment A-F)".
- The Context's "v5.0.6 rewrites relative links" holds only for `.md` links of top-level files.

The user chose the direction on 2026-10-27 from three options: our export, pinning `master`, or waiting for a release. The action stays pinned at v5.0.6. The rules below are the architect's, within that direction, and the user accepted A-F on 2026-10-27.

A. **The export writes wiki-ready links (user decision).** `exportWiki` maps the target of every inline link, image and reference definition of every exported file: hand-written pages, generated indexes, the API page, `_Sidebar.md` and `_Footer.md`. It does this through `mapLinkTargets` and `resolveLink` of `scripts/gen-wiki.mjs`, the one link reader. The rules apply in this order:
1. An external target (a scheme or `//`) and an in-page anchor (`#...`) stay as written.
2. A target that resolves to a mirrored Markdown file of `docs/wiki` (a hand-written page, a generated folder index or the API page) becomes its bare page name: the basename without `.md`, with the anchor kept. For example, `../rules/Business-rules.md#why` becomes `Business-rules#why` and `Home.md` becomes `Home`. The sidebar's links to the folder indexes become the index page names.
3. Any other existing repository path becomes an absolute URL `<repo>/<route>/<ref>/<path>`. This includes `docs/wiki/graph.json` and any non-Markdown file under `docs/wiki`.
   - The route is `blob` for a file in a link, `tree` for a folder, and `raw` for a file in an image (a `blob/` page does not render inside an image, as upstream notes).
   - Each path segment is `encodeURIComponent`-encoded, and the anchor is kept.
   - So the `sources` rows of the key tables and a page's link to an ADR both open the blob view.
4. Anything else is unmappable (decision E).

The visitor of `mapLinkTargets` learns whether a target belongs to an image (`![...](...)`). A reference definition counts as a link. Angle brackets and a link title stay as written.

B. **A flat mirror.** The export writes every Markdown file of `docs/wiki` to `<dir>/<basename>`, without subfolders, and leaves out `graph.json` as before. The page names of the wiki and the file names of the mirror then coincide:
- The bare names of A resolve from every page, Home included.
- One `_Sidebar.md` and one `_Footer.md` at the root frame every page, so it does not matter which sidebar Gollum would pick for a page in a subfolder.
- The basenames are unique: `wikiStatus` enforces that case-insensitively, and the export checks it again before it writes.

The source of truth keeps its folders. Only the mirror repository is flat, and nobody edits it (`strategy: init`).

C. **Blob URLs pin the commit of the run.** `<ref>` is the full commit SHA the workflow checked out, `GITHUB_SHA` (`github.sha`). On `push` that is the pushed commit; on `workflow_dispatch`, the head of the dispatched ref. Upstream's `master` uses the same form, and its e2e test measured it. Reasons:
- A dispatch from `feature/business-rules-wiki` links files that are not on `main` yet (this ADR, the feature summary), and they resolve.
- A file a later feature renames or prunes still resolves. For example, the planned #10 rules link `docs/features/products-validations/` files, which that feature's prune removes.
- A page and the files it cites show one state.

Costs and reachability:
- The mirror runs only when `docs/wiki/**` changes, so a linked file changed later without a wiki change shows its older version until the next run. A `workflow_dispatch` re-syncs.
- The commit of a branch dispatch stays reachable after the `--no-ff` merge, and the merge push to `main` re-mirrors with the merge commit.

D. **Inputs and defaults.** `export <dir>` resolves the ref and the repository URL in this order:
1. The options `--ref <ref>` and `--repo-url <url>`.
2. Otherwise, the default environment of GitHub Actions: `GITHUB_SHA` for the ref, and `GITHUB_SERVER_URL` plus `GITHUB_REPOSITORY` for the URL (both or neither).
3. Outside Actions, `main` and the `repository` field of `package.json` (`https://github.com/daiedy/Test_CAP`; a `{ url }` object, a `git+` prefix and a `.git` suffix are accepted).

A local export is a preview: only the workflow publishes, and it always has `GITHUB_SHA`. Further rules:
- `exportWiki(root, dir, { repoUrl, ref })` takes both values and refuses to run without them.
- The CLI resolves the values and prints the base it used (`links pinned to <repo>/blob/<ref>`), so the run log shows the ref.
- The workflow step stays `node scripts/wiki.mjs export .wiki-out` without options.
- These are usage errors (exit 1): a ref with a character outside `[A-Za-z0-9._/-]` or with `..`, and a URL that is not `http(s)://<host>/<owner>/<repo>`.

E. **An unmappable link stops the mirror.** The export resolves every link before it writes any file. It exits 1 and writes nothing when it finds any of these, and it names each finding as `<file>:<line>: <target>`:
- a relative target that does not exist in the checkout;
- a target that leaves the repository;
- a link to `_Sidebar.md` or `_Footer.md` (they frame pages and are no pages);
- an image that points at a page or a folder;
- two files with one basename.

The workflow step fails, so the action step never runs and no broken link reaches the public wiki. Upstream's `master` leaves such a link unchanged. `wikiStatus` already reports the missing and outside targets at every Stop and in CI; the export is the last check before the mirror.

F. **`preprocess: false`.** Preprocess would only do harm:
- The exported files hold only bare page names and absolute URLs, so v5.0.6 finds no link left to rewrite. A blob URL ending in `.md` is absolute, and the action skips it.
- The README-to-Home move has nothing to do: `Home.md` exists, and no `README.md` is exported.
- In the flat mirror every file is top level, so preprocess would re-serialize all 74 through `remark` 14, which does not parse GFM tables (the key tables and the History tables). The effect on the rendering is not measured, but the mirrored page would no longer equal its export byte for byte.

With preprocess off, the wiki receives the export byte for byte. Plan acceptance criterion 10 names `preprocess: false`, the export step and `path: .wiki-out`. A later release of the action with the `master` rewriting changes nothing while preprocess stays off; adopting it would be a new amendment.

## Alternatives
| Option | Why rejected |
|---|---|
| One `docs/BUSINESS-RULES.md` | the user's request: one file cannot hold many rules with their history; it would be read whole like `PATTERNS.md` |
| The GitHub Wiki as the source of truth, the folder as a copy | wiki edits bypass pull requests, hooks, review and the English gate; the pipeline can lint and read only the repository |
| `[[wikilinks]]` | render nowhere in the repository view and need a second resolver; relative Markdown links render in both places and the action documents their rewriting |
| Russian pages for colleagues (ADR exception for `docs/wiki/**`) | one more language regime in the hooks, `/test-all` and the reviewer; agents writing Russian prose; about twice the tokens per lookup; the user chose English at the plan gate (2026-10-26, Q1) |
| Generated page bodies | the practitioners' noise finding; a generator cannot say why or what the user sees; generators here write indexes, graph, sidebar and the API page only |
| Graph databases, embeddings, `qmd` now | not human-readable or a dependency to run for under a hundred pages; `qmd` is the step-up when the pages reach the hundreds |
| `_index.md` per folder, ids in file names | five `_index` basenames collide in the flat wiki namespace; the wiki derives the page title from the file name, so `BR-PRODUCTS-001-...` would be titled "BR PRODUCTS 001 ..." |
| `strategy: clone` (the action's default) | keeps a page that exists only in the wiki and keeps a wiki history nobody reads; `init` makes the mirror exact |
| Mirror on every push to `main` | runs the job for every code commit for nothing; the `paths` filter plus `workflow_dispatch` covers the first run and a re-sync |
| The stale-page check and the coverage audit in the Stop gate or in `npm test` | both fire at every phase gate of `/feature`; a phase 2 code change would block every stop until `docs-keeper` runs in phase 6; CI, `/test-all` and the phase 6 gate decide a merge |
| `graph.json` built on demand by the CLI | a lookup would walk 67 files on every call and CI would need a build step before reading it; a committed, stamped file is read in one `JSON.parse` and is byte-compared like the OpenAPI document |
| Generated wiki files under `docs/registry/` (ADR-0017 protection) | the hand-written pages cannot live there and the relative links between pages and indexes would break in the wiki |
| Copies of the OpenAPI document or Swagger pages inside `docs/wiki/api/` | a 283 KB JSON copy drifts and renders nowhere; one generated page with links to the committed document and the development Swagger URL |
| A date in the generated header (registry style) | makes the generator non-idempotent and a byte comparison impossible |
| Amendment: pin the action's `master` (`93c86ef`) | unreleased code, 8 untagged commits after v5.0.6: the mirror would run code the maintainer has not released, and the pin convention (`# vX.Y.Z` comment, Dependabot proposing releases) has no version to name; rejected by the user, 2026-10-27 |
| Amendment: wait for a release with the rewriting | no release since 2026-07-11 and none announced; the mirror and the phase 5 verification would wait for an unknown date; rejected by the user, 2026-10-27 |
| Amendment A: absolute wiki URLs (`https://github.com/daiedy/Test_CAP/wiki/<Page>`) for page links | they resolve without Gollum's relative-link rendering, but they tie every page to one host and repository and are not the bare names the user chose (2026-10-27) |
| Amendment B: keep the subfolders in the export | bare names would then work only if the wiki serves subfolder pages by basename, a fact from the action's unreleased notes; the flat mirror makes the question moot and frames every page with the root sidebar and footer |
| Amendment C: `main` as the ref of the blob URLs | shows the latest file, but a dispatch from the feature branch links files not on `main` yet (404 in phase 5), and a renamed or pruned file (the #10 feature folder after its prune) 404s later |
| Amendment E: leave an unmappable link as written (upstream `master`) | a broken link reaches the public wiki without anyone noticing; the export is the last check before the mirror |
| Amendment F: keep `preprocess: true` | nothing is left to rewrite, and remark without GFM would re-serialize every page of the flat mirror, tables included |

## Consequences
- `PATTERNS.md` (Infrastructure): new rows "Business rule documentation" (a rule page in `docs/wiki/rules/` with the frontmatter of decision 1 and the id of decision 2, written by `docs-keeper` in phase 6, example the subcategory rule page), "Wiki lookup before an edit" (`node scripts/wiki.mjs for-path <file>`, protocol step 3), "Generated wiki files and the GitHub Wiki mirror" (`npm run docs:wiki`, `check-docs-fresh.mjs`, `audit`, `.github/workflows/wiki.yml`). `CONVENTIONS.md`: section 2 adds `docs/wiki/`; section 8 adds the wiki files to "documentation in the same change" and names the generated ones. `TESTING.md`: a row "Wiki" (`test/wiki.test.js`, `check-docs-fresh.mjs`, `wiki.mjs audit` in CI). `CLAUDE.md` documentation map: one row for `docs/wiki/`. `README.md`: the commands and a "Business rules wiki" paragraph with the wiki URL.
- Protected files (`PIPELINE_ALLOW_PROTECTED=1` session): `scripts/lib/doc-shapes.mjs` (`wikiPageShapeErrors`, `WIKI_FOLDERS`), `scripts/lib/file-checks.mjs` (`checkDocShapes` branch for `docs/wiki/**/*.md`), `.claude/skills/project-protocol/SKILL.md` (step 3 lookup, section 8 `## Rules touched`), `.claude/agents/docs-keeper.md` (the rule-page step), `.claude/skills/feature/SKILL.md` (phase 6 names the wiki pages and the `audit` gate), `.claude/skills/gen-docs/SKILL.md` and `.claude/skills/test-all/SKILL.md` (the commands), the new `.claude/rules/docs-wiki.md`; `test/prompt-budget.json` re-recorded (the plan gate is the retro decision ADR-0018 asks for). `.github/workflows/wiki.yml` is not on the `PROTECTED` list but grants `contents: write`, so it is written in the same session and reviewed with the same care.
- Unprotected new scripts: `scripts/gen-wiki.mjs` (generator, `wikiStatus`, `wikiSourcesHash`), `scripts/wiki.mjs` (CLI); `scripts/check-docs-fresh.mjs` and `scripts/gen-registry.mjs` call them; `package.json` gains `docs:wiki`; no new npm dependency (Node built-ins and the existing `@sap/cds` for `audit`).
- Every `/feature` grows a documentation duty: `docs-keeper` updates or creates the rule pages in phase 6 and `audit` must be clean at that gate; a feature that adds a message key or an `@assert` without a rule page cannot merge (CI). The cost is one or two pages per feature, about 300 tokens each to read later.
- The GitHub Wiki shows the mirrored pages publicly (the repository is public already); edits made there are overwritten at the next sync, which the footer announces. `graph.json` is not mirrored.
- The 6 `@assert` constraints stay invisible in `DOMAIN-MODEL.md` until `annots()` in `gen-registry.mjs` prints the bare `@assert` key (a follow-up, not this feature); the wiki's `rules/` pages and the `audit` cover them meanwhile.
- Scale: the design works for the measured 67 pages and for a few hundred (one `JSON.parse` of `graph.json`); the step-up to `qmd` is a new ADR when `find` stops being enough.
- Amendment A-F, code changes:
  - `scripts/wiki.mjs` `export` gains the flat layout (B), the link mapping (A, which replaces `rebaseLinks`), the inputs (C, D) and the failure (E).
  - `mapLinkTargets` in `scripts/gen-wiki.mjs` tells its visitor whether a target belongs to an image. Nothing else in the generator changes, so the generated files and `wikiStatus` keep their output.
  - `.github/workflows/wiki.yml` sets `preprocess: false` (F).
  - `test/wiki.test.js` gains the export test of the new plan criterion. Its key-table test follows the flat layout, and the rebase test is folded into the new test, the inline-code link included.
  - `research/wiki-mechanics.md` sections 1-3 and 5 are corrected to the pinned ref.
- Any commit to a file named in a page's `code` changes the `sources:` stamps, so the generated wiki files are regenerated and a merge of a code change to `main` re-runs the mirror and moves the `blob/<sha>` links of the wiki to that commit (review finding Minor 1, accepted).
- Amendment A-F: the wiki repository's tree differs from `docs/wiki/`: it is flat and its links are rewritten. A reader of the repository sees relative links; a reader of the wiki sees page names and blob URLs. The phase 5 verification therefore compares a mirrored page with the export of the mirrored commit, not with the file in `docs/wiki/`.
- Amendment C: a repository link on the wiki shows the file at the mirrored commit, whose SHA shows in the URL. The next mirror run moves the links to its commit.
- Amendment A, E: new link kinds are covered:
  - A new page folder needs no export change, because the mirror is flat.
  - An image or a folder link is covered by rule A3.
  - A link the rules cannot map fails the `wiki` workflow run, and it fails CI first: `test/wiki.test.js` exports the committed wiki in every `npm test`. `wikiStatus` catches the missing and outside targets even earlier, at the Stop gate.

## Sources
- Issue #28 (request, scope hints of the 2026-10-14 chat research, questions for the plan gate); `docs/features/business-rules-wiki/research/wiki-mechanics.md` and `research/llm-wiki-pattern.md` (measurements of 2026-10-26)
- `gh repo view --json hasWikiEnabled,isPrivate`; `git ls-remote https://github.com/daiedy/Test_CAP.wiki.git`; `gh api repos/Andrew-Chen-Wang/github-wiki-action/{releases/latest,git/ref/tags/v5,git/ref/tags/v5.0.6,contents/action.yml,readme}` (2026-10-26)
- `npx cds compile srv --to json` (the `"@assert"` key with `xpr`); `mcp__cds-mcp__search_docs` "Expressions as annotation values" and "`@assert:` (constraint)" (2026-10-26); `mcp__cds-mcp__search_model` on `CatalogService` and `CatalogService.Products`
- `scripts/gen-registry.mjs` (`header`, `annots`, `writeOpenApi` call order), `scripts/gen-api-docs.mjs` (`stampOpenApi`, `apiDocsStatus`), `scripts/check-docs-fresh.mjs`, `scripts/lib/registry-sources.mjs` (`recordedHash`), `scripts/lib/doc-shapes.mjs`, `scripts/lib/file-checks.mjs` (`CYRILLIC_SCOPE`, `checkDocShapes`), `scripts/lib/protected-paths.mjs`, `scripts/hooks/stop-gate.mjs`, `.github/workflows/ci.yml`, `.github/dependabot.yml`
- ADR-0017 (generated files sanctioned by content), ADR-0018 (shapes, prompt budget), ADR-0019 (pruned feature folders, `SUMMARY.md` permalinks), ADR-0023 (Stop advice), ADR-0029 (doc comments, OpenAPI document, `JSDOC.md`)
- Not verified by MCP (no SAP artefact): GitHub Docs on `workflow_dispatch` (the workflow file must exist on the default branch) and on frontmatter rendering in the repository file view; both are re-measured at plan steps 0 and 4
- Amendment, from `gh api repos/Andrew-Chen-Wang/github-wiki-action/...` (2026-10-27):
  - `releases/latest`: v5.0.6, published 2026-07-11T14:16:07Z.
  - `compare/1bbb4280446f9630e8e21a18012cbacf3b0f992e...master`: 8 ahead, 0 behind, with the commit list.
  - `git/ref/heads/master`: `93c86ef70e8354bbd677185b355ba164cb29288f`.
  - At `1bbb428`: `contents/cli.ts` (lines 93-130) and `readme` (the `preprocess` input).
  - At `93c86ef`: `readme` ("`preprocess:` notes"), `contents/cli.ts` (`GITHUB_SHA`, `blob`/`raw`, `encodeURIComponent`), `contents/tests/e2e.test.ts` (rendered hrefs `wiki/./<page>`, the blob view at the SHA).
- Amendment, measured in the project (2026-10-27): the orchestrator's finding of the same day; the link inventory of a temp export of `docs/wiki` at `d26bd5a`, read with `mapLinkTargets` and `resolveLink`; the `repository` field of `package.json`.
- Amendment, not measured here and re-checked at PLAN step 5: Gollum's rendering of a bare `Page` without `./`; the flat serving of subfolder pages (moot under B); the `tree/` and `raw/` routes (no such link today). Not from MCP: no SAP artefact.
