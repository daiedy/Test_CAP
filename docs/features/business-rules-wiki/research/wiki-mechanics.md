# business-rules-wiki: GitHub Wiki and mirror mechanics

Date: 2026-10-26, corrected 2026-10-27. Author: `architect`. Read by `architect` and `reviewer`; plan steps 0, 2 and 4 name this file.
- Facts are measured in the session of their date unless marked otherwise. Nothing here is an SAP artefact, so no MCP query applies; the issue's own research of 2026-10-14 is the second source.
- Correction of 2026-10-27 (ADR-0030 amendment A-F): sections 1 to 3 and 5 had quoted the action's unreleased `master` as the behaviour of the pinned v5.0.6. Section 2 now separates the two refs.

## 1. State of the repository wiki (measured 2026-10-26)

| Fact | Measurement | Consequence |
|---|---|---|
| Wiki enabled, repository public | `gh repo view --json hasWikiEnabled,isPrivate` gives `true`, `false` | The GitHub Wiki is reachable without a login; the mirror needs no PAT |
| The wiki git repository does not exist yet | `git ls-remote https://github.com/daiedy/Test_CAP.wiki.git` (authenticated with the `gh` token) answers `remote: Repository not found`; `curl -sI https://github.com/daiedy/Test_CAP/wiki` answers `302` to the repository root | GitHub creates `.wiki.git` on the first page made in the web UI; the action README says the same ("You must create a dummy page manually"). A user step before the first mirror run |
| Wiki pages are served flat by basename | the action README on `master` only (unreleased, "`preprocess:` notes"): "GitHub serves wiki pages flat by basename, so cross-directory page links are rewritten to bare page names"; not measured on a wiki | Every page file name must be unique across all folders of `docs/wiki/`, so a generated per-folder `_index.md` would collide five times and the folder index is named after the folder (`rules/Business-rules.md`). The export writes the mirror flat (ADR-0030 amendment B), so the mirror does not depend on this fact |
| The page title is derived from the file name | action README: "Each page has an auto-generated title. It is derived from the filename by replacing every `-` (dash) character with a space" | A file name is the human title in sentence case with dashes (`Subcategory-belongs-to-the-category.md`); ids (`BR-...`, `ADR-...`) live in the frontmatter and the H1, not in the file name |
| `Home.md` is the home page, `_Sidebar.md` and `_Footer.md` the navigation | action README ("The `Home.md` file will automatically become the homepage, not `README.md`"); GitHub Wiki documentation (not re-read in this session) | `docs/wiki/Home.md` hand-written; `_Sidebar.md` generated; `_Footer.md` hand-written once with the read-only notice |
| Edits in the wiki UI bypass pull requests, hooks and review | GitHub Wiki model; issue #28 scope hints | The wiki is read-only by convention and by the mirror strategy (section 2, `strategy: init`) |
| Whether YAML frontmatter renders as a table or as raw text on a wiki page | not measurable without a page; the repository file view renders it as a table (GitHub Docs "About READMEs"/markup, not re-read here) | Plan step 0: the first hand-made page is a frontmatter probe; if the wiki shows raw `---` blocks, the mirror job exports the pages without frontmatter (`node scripts/wiki.mjs export`), else the folder is mirrored as is |

## 2. The mirror action `Andrew-Chen-Wang/github-wiki-action` (read via `gh api` on 2026-10-26; corrected to the pinned ref on 2026-10-27)

- Latest release `v5.0.6`, published 2026-07-11, still the latest on 2026-10-27 (`releases/latest`). Tags `v5` and `v5.0.6` both point at commit `1bbb4280446f9630e8e21a18012cbacf3b0f992e` (`git/ref/tags/v5`, `git/ref/tags/v5.0.6`). The project pins actions by commit with a version comment (`.github/workflows/ci.yml`), and the `github-actions` ecosystem of `.github/dependabot.yml` bumps them weekly, so the pin is maintained like the others.
- Composite action (`runs: using: composite`, one `cliw` step running `cli.ts` under Deno). Inputs from `action.yml` at `1bbb428`:

| Input | Default | Use here |
|---|---|---|
| `direction` | `push` | `push` (the repository folder is the source) |
| `strategy` | `clone` | `init`: a fresh single-commit repository is force-pushed, so the wiki equals the folder after every run and a page created or edited in the wiki UI disappears at the next sync; `clone` would keep a page that exists only in the wiki. History lives in the repository and in each page's History table, not in the wiki repository |
| `repository` | `${{ github.repository }}` | default |
| `token` | `${{ github.token }}` | default; the README states that `permissions: contents: write` on the job gives `github.token` the right to push to the `.wiki.git` of the same repository, no PAT |
| `path` | `wiki` | `.wiki-out`, the folder `node scripts/wiki.mjs export` writes (step 0 measured raw frontmatter; ADR-0030 amendment B) |
| `commit-message` | `Update wiki ${{ github.sha }}` | default |
| `ignore` | none | `graph.json` (an agent artefact, not a page); gitignore syntax relative to `path` |
| `dry-run` | `false` | `true` for the first run of the workflow from the feature branch, then `false` |
| `preprocess` | `true` | `false` (ADR-0030 amendment F). At `1bbb428` preprocess does three things (`cli.ts` lines 93-130): (1) it renames a top-level `README.md` to `Home.md`; (2) for each Markdown file at the top level only (`readdir`, not recursive), it strips `.md` from relative links that stay inside the folder and keeps their path (`rules/X.md` becomes `rules/X`, `../x.md` is left as written); (3) it writes each such file back through `remark` 14 without GFM. It makes no `blob/` or `raw/` URL and does not touch subfolder pages. Our export already writes the final links, so preprocess would only re-serialize the pages |
| `disable-empty-commits` | `false` | irrelevant with `init` |

- Output `wiki_url`: the wiki tab URL, printed by the job for the verification step.
- The README at `1bbb428` describes the same `preprocess` input: "move the `README.md` to `Home.md` as well as rewriting all `.md` links to be bare links".
- **Unreleased on `master`.** `master` is 8 untagged commits ahead of v5.0.6 and 0 behind, all from 2026-07-11 (`compare/1bbb428...master`); its head is `93c86ef70e8354bbd677185b355ba164cb29288f`. Two of those commits rewrite links:
  - `e70259f` "Add repo-file blob links (#78)";
  - `93c86ef` "Preprocess subdirectory pages, images, and reference definitions".

  Only there does preprocess behave as follows:
  - it walks subfolders and serves pages flat by basename, so a cross-folder page link becomes the bare page name and a same-folder link keeps its form;
  - a repository file becomes `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${GITHUB_SHA}/<path>` with each segment `encodeURIComponent`-encoded, and an image becomes `raw/`;
  - reference definitions are rewritten;
  - a link it cannot map is left unchanged.

  The 2026-10-26 text of this section had quoted the `master` README notes as the behaviour of the pin.
- **Measured upstream on `master`** (`tests/e2e.test.ts`): Gollum renders the page link `./another-page` as an href `wiki/./another-page`, which resolves against `https://github.com/<repo>/wiki`, with the anchor kept. A `blob/<GITHUB_SHA>/<path>` link opens the blob view of that commit. A bare `another-page` without `./` is not in the test.
- **Effect on this wiki** (measured 2026-10-27 over a temp export of `docs/wiki` at `d26bd5a`, with `mapLinkTargets` and `resolveLink`): the export holds 74 Markdown files, 4 at the top level and 70 in five subfolders.
  - In the subfolders: 441 page links, and 222 repository links (118 in page bodies, 101 from the `sources` rows of the key tables, 3 in the API page). v5.0.6 would mirror them unchanged, and they 404.
  - At the top level: 91 page links, which v5.0.6 would turn into folder paths such as `rules/Business-rules`. These likely 404 (not measured).
  - 1 external link; no anchor, image, folder or reference-style link.
  - Hence ADR-0030 amendment A-F: the export writes bare page names and blob URLs of `GITHUB_SHA` into a flat folder, fails on an unmappable link, and the action runs with `preprocess: false`.
- Sources, 2026-10-27, `gh api repos/Andrew-Chen-Wang/github-wiki-action/...`: `releases/latest`, `compare/1bbb4280446f9630e8e21a18012cbacf3b0f992e...master`, `git/ref/heads/master`, `contents/cli.ts?ref=1bbb428...`, `readme?ref=1bbb428...`, `readme?ref=93c86ef...`, `contents/cli.ts?ref=93c86ef...`, `contents/tests/e2e.test.ts?ref=93c86ef...`.
- `workflow_dispatch` runs only when the workflow file exists on the default branch (GitHub Docs "Events that trigger workflows", workflow_dispatch; not re-read in this session). Consequence for an in-feature verification: the workflow file must reach `main` before the feature merge (a one-file pull request), then `gh workflow run wiki.yml --ref feature/business-rules-wiki` mirrors the branch's folder. Otherwise the first real mirror happens at the final merge.
- The wiki repository's default branch is `master`; the action handles it, the plan's criterion checks `git ls-remote` for any `refs/heads/*`.

## 3. Workflow shape (plan step 4)

```yaml
name: wiki
on:
  push:
    branches: [main]
    paths: ['docs/wiki/**']
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: wiki
  cancel-in-progress: false
jobs:
  mirror:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 22
      # step 0 measured raw frontmatter; the export also writes the final links into a flat folder
      # and pins repository links to GITHUB_SHA (ADR-0030 amendment A-E)
      - run: node scripts/wiki.mjs export .wiki-out
      - uses: Andrew-Chen-Wang/github-wiki-action@1bbb4280446f9630e8e21a18012cbacf3b0f992e # v5.0.6
        with:
          path: .wiki-out
          strategy: init
          preprocess: false   # amendment F: the links are final, remark would re-serialize every page
          ignore: |
            graph.json
```

Notes on the shape:
- `contents: write` is already granted in `.github/workflows/dependabot-automerge.yml`; `ci.yml` stays at `contents: read`.
- The `paths` filter means a push to `main` without a wiki change runs nothing, and `workflow_dispatch` covers the first run and a re-sync.
- `GITHUB_SHA`, `GITHUB_SERVER_URL` and `GITHUB_REPOSITORY` are in the default environment of every step, so the export step passes no option.
- `ignore: graph.json` stays as a guard: the export writes no `graph.json`.

## 4. Frontmatter probe content for the first page (plan step 0, user)

Create the page `Home` in the wiki UI with this body and report what renders between the heading and the paragraph:

```markdown
---
title: Home
summary: Probe of the frontmatter rendering, replaced by the first mirror run.
tags: [probe]
---
# Home

If a table with the three keys appears above this line, the wiki renders frontmatter as a table; if two horizontal rules with raw text appear, it does not.
```

The page content is irrelevant after the first mirror run (`strategy: init` replaces everything).

## 5. Link syntax measured against the two renderers

| Syntax | github.com repository view | GitHub Wiki after `node scripts/wiki.mjs export` (ADR-0030 amendment A) | Checker |
|---|---|---|---|
| `[text](../rules/Subcategory-belongs-to-the-category.md)` | resolves (relative file link) | written as the bare page name `Subcategory-belongs-to-the-category` into the flat mirror | resolves the relative path, enforces unique basenames |
| `[text](../../decisions/ADR-0024-dependent-value-help.md)` (outside `docs/wiki`) | resolves | written as `https://github.com/daiedy/Test_CAP/blob/<GITHUB_SHA>/docs/decisions/ADR-0024-dependent-value-help.md` | resolves the path in the repository |
| `[[Wikilink]]` | not rendered as a link in the repository view | rendered by the wiki only | would need a second resolver and renders nowhere in `docs/` |
| absolute `https://github.com/daiedy/Test_CAP/...` | resolves | kept | not checked (external) |

Relative Markdown links are the only form that renders in both places, and the export maps them; this table answers the issue's question 3. The 2026-10-26 text credited the mapping to the action's `preprocess`, which does it only on its unreleased `master` (section 2).
