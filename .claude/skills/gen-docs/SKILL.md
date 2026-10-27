---
name: gen-docs
description: Regenerates docs/registry from the model and sources and checks documentation freshness. Use when the user says "update the registry", "documentation is stale" (Russian: «обнови реестр», «документация устарела»), after changes in db/, srv/, app/.
allowed-tools: Bash(npm run docs:registry), Bash(npm run docs:wiki), Bash(node scripts/check-docs-fresh.mjs*), Bash(node scripts/wiki.mjs*), Read
---

1. `npm run docs:registry` (PATH must contain `/opt/homebrew/opt/node@22/bin`); it writes the generated wiki files too. After an edit of `docs/wiki/` pages alone: `npm run docs:wiki`.
2. `node scripts/check-docs-fresh.mjs`: it must print `docs/registry is fresh.` Then `node scripts/wiki.mjs audit`: `wiki audit: clean`, else name the stale or missing pages for `docs-keeper`.
3. Read the diff (`git diff --stat docs/registry docs/api docs/wiki`): the registry tables, `docs/registry/JSDOC.md` (JSDoc of `srv/` and `webapp/ext/`) and the OpenAPI document `docs/api/CatalogService.openapi3.json`; briefly tell the user what changed in the model, services, handlers, functions or UI.
4. If code changed, remind about the lines in `docs/CHANGELOG.md` and the update of `docs/STATE.md`; if needed, delegate to `docs-keeper`.
