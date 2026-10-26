# business-rules-wiki: GitHub Wiki and mirror mechanics

Date: 2026-10-26. Author: `architect`. Read by `architect` and `reviewer`; plan steps 0, 2 and 4 name this file. Facts are measured in this session unless marked otherwise; nothing here is an SAP artefact, so no MCP query applies (the issue's own research of 2026-10-14 is the second source).

## 1. State of the repository wiki (measured 2026-10-26)

| Fact | Measurement | Consequence |
|---|---|---|
| Wiki enabled, repository public | `gh repo view --json hasWikiEnabled,isPrivate` gives `true`, `false` | The GitHub Wiki is reachable without a login; the mirror needs no PAT |
| The wiki git repository does not exist yet | `git ls-remote https://github.com/daiedy/Test_CAP.wiki.git` (authenticated with the `gh` token) answers `remote: Repository not found`; `curl -sI https://github.com/daiedy/Test_CAP/wiki` answers `302` to the repository root | GitHub creates `.wiki.git` on the first page made in the web UI; the action README says the same ("You must create a dummy page manually"). A user step before the first mirror run |
| Wiki pages are served flat by basename | action README, "preprocess notes": "GitHub serves wiki pages flat by basename, so cross-directory page links are rewritten to bare page names" | Every page file name must be unique across all folders of `docs/wiki/`; a generated per-folder `_index.md` would collide five times, so the folder index is named after the folder (`rules/Business-rules.md`) |
| The page title is derived from the file name | action README: "Each page has an auto-generated title. It is derived from the filename by replacing every `-` (dash) character with a space" | A file name is the human title in sentence case with dashes (`Subcategory-belongs-to-the-category.md`); ids (`BR-...`, `ADR-...`) live in the frontmatter and the H1, not in the file name |
| `Home.md` is the home page, `_Sidebar.md` and `_Footer.md` the navigation | action README ("The `Home.md` file will automatically become the homepage, not `README.md`"); GitHub Wiki documentation (not re-read in this session) | `docs/wiki/Home.md` hand-written; `_Sidebar.md` generated; `_Footer.md` hand-written once with the read-only notice |
| Edits in the wiki UI bypass pull requests, hooks and review | GitHub Wiki model; issue #28 scope hints | The wiki is read-only by convention and by the mirror strategy (section 2, `strategy: init`) |
| Whether YAML frontmatter renders as a table or as raw text on a wiki page | not measurable without a page; the repository file view renders it as a table (GitHub Docs "About READMEs"/markup, not re-read here) | Plan step 0: the first hand-made page is a frontmatter probe; if the wiki shows raw `---` blocks, the mirror job exports the pages without frontmatter (`node scripts/wiki.mjs export`), else the folder is mirrored as is |

## 2. The mirror action `Andrew-Chen-Wang/github-wiki-action` (read via `gh api`, 2026-10-26)

- Latest release `v5.0.6`, published 2026-07-11. Tags `v5` and `v5.0.6` both point at commit `1bbb4280446f9630e8e21a18012cbacf3b0f992e` (`git/ref/tags/v5`, `git/ref/tags/v5.0.6`). The project pins actions by commit with a version comment (`.github/workflows/ci.yml`), and the `github-actions` ecosystem of `.github/dependabot.yml` bumps them weekly, so the pin is maintained like the others.
- Composite action (`runs: using: composite`, one `cliw` step). Inputs from `action.yml`:

| Input | Default | Use here |
|---|---|---|
| `direction` | `push` | `push` (the repository folder is the source) |
| `strategy` | `clone` | `init`: a fresh single-commit repository is force-pushed, so the wiki equals the folder after every run and a page created or edited in the wiki UI disappears at the next sync; `clone` would keep a page that exists only in the wiki. History lives in the repository and in each page's History table, not in the wiki repository |
| `repository` | `${{ github.repository }}` | default |
| `token` | `${{ github.token }}` | default; the README states that `permissions: contents: write` on the job gives `github.token` the right to push to the `.wiki.git` of the same repository, no PAT |
| `path` | `wiki` | `docs/wiki` (or the export folder, see section 1 last row) |
| `commit-message` | `Update wiki ${{ github.sha }}` | default |
| `ignore` | none | `graph.json` (an agent artefact, not a page); gitignore syntax relative to `path` |
| `dry-run` | `false` | `true` for the first run of the workflow from the feature branch, then `false` |
| `preprocess` | `true` | `true`: `README.md` becomes `Home.md` (we write `Home.md` directly); links to wiki pages become bare page links (cross-directory links rewritten to the basename, same-directory links kept); relative links to other repository files become `blob/` URLs, images `raw/` URLs; reference-style definitions are rewritten like inline links; only Markdown pages are parsed for links |
| `disable-empty-commits` | `false` | irrelevant with `init` |

- Output `wiki_url`: the wiki tab URL, printed by the job for the verification step.
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
      # only when step 0 measured raw frontmatter on the wiki:
      # - uses: actions/setup-node@... (node 22) and `node scripts/wiki.mjs export .wiki-out`
      - uses: Andrew-Chen-Wang/github-wiki-action@1bbb4280446f9630e8e21a18012cbacf3b0f992e # v5.0.6
        with:
          path: docs/wiki        # or .wiki-out
          strategy: init
          ignore: |
            graph.json
```

`contents: write` is already granted in `.github/workflows/dependabot-automerge.yml`; `ci.yml` stays at `contents: read`. The `paths` filter means a push to `main` without a wiki change runs nothing; `workflow_dispatch` covers the first run and a re-sync.

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

| Syntax | github.com repository view | GitHub Wiki after `preprocess` | Checker |
|---|---|---|---|
| `[text](../rules/Subcategory-belongs-to-the-category.md)` | resolves (relative file link) | rewritten to the bare page `Subcategory-belongs-to-the-category` | resolves the relative path, enforces unique basenames |
| `[text](../../decisions/ADR-0024-dependent-value-help.md)` (outside `docs/wiki`) | resolves | rewritten to a `blob/` URL | resolves the path in the repository |
| `[[Wikilink]]` | not rendered as a link in the repository view | rendered by the wiki only | would need a second resolver and renders nowhere in `docs/` |
| absolute `https://github.com/daiedy/Test_CAP/...` | resolves | kept | not checked (external) |

Relative Markdown links are the only form that renders in both places and that the action documents rewriting; the issue's question 3 is answered by this table.
