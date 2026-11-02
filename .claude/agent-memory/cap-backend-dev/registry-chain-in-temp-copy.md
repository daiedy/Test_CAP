---
name: registry-chain-in-temp-copy
description: Exercise npm run docs:registry / check-docs-fresh --fix in an rsync temp copy with a symlinked node_modules, so the dated registry headers in the repo do not churn (2026-10-26)
metadata:
  type: feedback
---

To prove a change in the `gen-registry.mjs` chain (registry, OpenAPI, wiki) without rewriting the six `docs/registry/*.md` headers, which carry the run date: `rsync -a` the project to a temp folder (exclude node_modules, .git, .pipeline, .claude), `ln -s` the real node_modules into it, delete a generated file there and run `node scripts/check-docs-fresh.mjs --fix` from that folder, then `diff -r` the outputs against the repo.

**Why:** a real run on a day other than the registry date changes six files only by the date, and the protocol forbids `git checkout --` on `docs/registry` to undo it. Without the node_modules link, `npx cds` in a bare temp folder may try to fetch a package from the registry.

**How to apply:** when a task touches `gen-registry.mjs`, `gen-api-docs.mjs`, `gen-wiki.mjs` or `check-docs-fresh.mjs` but no model file. The same applies to a test that runs `--fix` in a temp project (business-rules-wiki, [[openapi-converter-local-copy]]).
