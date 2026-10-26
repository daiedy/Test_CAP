---
name: business-rules-wiki-design
description: Facts and design choices behind ADR-0030 (business-rules wiki, #28, spec 2026-10-26): GitHub Wiki mechanics (flat basenames, title from file name, .wiki.git created on the first page, action pin), why the stale audit is not in the Stop gate or npm test, dateless generated headers, bare @assert invisible to the registry
metadata:
  type: project
---

Spec written 2026-10-26 (`docs/features/business-rules-wiki/`, ADR-0030 accepted by the user at the plan gate on 2026-10-26; every recommendation taken, issue #28 spec-ready).

GitHub Wiki facts (measured with `gh`, `git ls-remote`, `curl` on 2026-10-26; action README read via `gh api`):
- The wiki of `daiedy/Test_CAP` is enabled and public, but `.wiki.git` does not exist until a first page is made in the web UI (`ls-remote` says "Repository not found", `/wiki` answers 302 to the repo root). The first page is a user step and doubles as the frontmatter rendering probe (unknown whether the wiki renders YAML frontmatter as a table or raw).
- Pages are served flat by basename and the page title is the file name with dashes turned into spaces. So: unique basenames across folders, file names in sentence case with dashes, ids (`BR-...`, `ADR-...`) in frontmatter and H1, and no `_index.md` per folder (five would collide): the folder index is `rules/Business-rules.md` etc.
- `Andrew-Chen-Wang/github-wiki-action`: v5.0.6 (2026-07-11), tags `v5` and `v5.0.6` = commit `1bbb4280446f9630e8e21a18012cbacf3b0f992e`; inputs `path`, `strategy` (`clone` default, `init` force-pushes an exact mirror), `ignore`, `dry-run`, `preprocess` (relative page links become bare page links, repository links become `blob/` URLs). `permissions: contents: write` lets `github.token` push to the same repo's wiki. `workflow_dispatch` needs the workflow file on the default branch, so an in-feature mirror test needs a one-file PR of the workflow first.

Design choices of ADR-0030 and their reasons:
- `docs/wiki/` is the source of truth; pages hand-written by docs-keeper; generators write only indexes, `_Sidebar.md`, `graph.json` and the API page from the OpenAPI document. Generated Markdown header has `sources:` but no date, so `npm run docs:wiki` is idempotent and byte-comparable (the registry header has a date, accepted precedent, but a byte test needs none).
- Freshness reuses `recordedHash()` and the `x-sources` stamp; `check-docs-fresh.mjs` gets `wikiStatus()` (generated-file staleness plus lint: links, orphans, duplicates, shape, Cyrillic). The page-vs-code staleness (`verified` hash over the page's `code` files) and the coverage of message keys and constrained elements are a separate `node scripts/wiki.mjs audit` run in CI, `/test-all` and the `/feature` phase 6 gate, deliberately NOT in the Stop gate or `npm test`: both fire at every phase gate, and a phase 2 code change would block every stop until docs-keeper runs in phase 6.
- Rule id `BR-<AREA>-NNN` (ACCESS, PRODUCTS, DETAILS, IMPORT), statuses planned/active/retired; feature-local R-numbers are `aliases`; `messages` and `elements` are the machine joins the audit uses.
- Only the shape check goes into the hook path (`doc-shapes.mjs` + `file-checks.mjs` dispatch), the smallest protected surface; `gen-wiki.mjs` and `wiki.mjs` stay unprotected top-level scripts like `gen-api-docs.mjs`.
- `.github/workflows/**` is not on the PROTECTED list (`protected-paths.mjs`), but a workflow with `contents: write` is scheduled in the protected session anyway.

Inventory facts (2026-10-26): bare `@assert` lands in CSN as key `"@assert"` with an `xpr`; `annots()` in `gen-registry.mjs` prints `@assert.` keys only, so the 6 constraints are invisible in `DOMAIN-MODEL.md` (follow-up). Rule sources: 6 constraints, 3 ranges, 6 targets, 8 mandatory, 21 message keys, 14 SUMMARYs, 29 ADRs, 11 approved #10 rules.

**Why:** the user wants business rules readable by people without the AI and loaded by agents page by page; the project already has one freshness mechanism (ADR-0017/0029) and one shape mechanism (ADR-0018), and the wiki had to join them, not add a second.
**How to apply:** when #28 is implemented or a later feature touches `docs/wiki/`, keep the audit out of the Stop gate unless the user asks for a Stop advisory (ADR-0023 route), keep file names title-derived and unique, and re-measure the frontmatter rendering before deciding on `export`. Related: [[cds-docs-and-openapi-facts]], [[hook-lint-gates]].
